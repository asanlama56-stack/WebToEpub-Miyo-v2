
import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { createDownloadJob, updateDownloadJob, getDownloadJobs, getJobById } from "./storage";
import { analyzeUrl, downloadChaptersParallel } from "./scraper";
import { generateOutput } from "./generator";
import { analyzeUrlSchema, startDownloadSchema, type BookMetadata, type DownloadJob, defaultSettings, Chapter } from "@shared/schema";
import { getImageCache } from "./pipeline/imagePipeline";
import { createImageJob, getImageJob } from "./jobs/imageJobs";
import { asyncHandler } from "./middleware/asyncHandler";
import { errorHandler } from "./middleware/errorHandler";
import db from "./storage";
import { downloadJobs } from "./db/schema";
import { inArray } from "drizzle-orm";

const activeDownloads = new Map<string, { abort: boolean }>();
const generatedFiles = new Map<string, { buffer: Buffer; filename: string; mimeType: string }>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // This applies to all routes and is used to allow cross-origin requests.
  app.use((req: Request, res: Response, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    // Handle preflight requests
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // This is a global JSON parser that applies to all routes.
  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));

  // This route is used to analyze a URL and extract the chapters.
  app.post("/api/analyze", asyncHandler(async (req: Request, res: Response) => {
    const parsed = analyzeUrlSchema.parse(req.body);
    const { url } = parsed;

    const job = await createDownloadJob(url);
    await updateDownloadJob(job.id, { status: "analyzing", progress: 0 });

    try {
      const { metadata, chapters } = await analyzeUrl(url);

      const imageJob = createImageJob(metadata?.coverUrl);

      await updateDownloadJob(job.id, {
        metadata: metadata ? { ...metadata, imageJobId: imageJob.id } : undefined,
        chapters: chapters,
        selectedChapterIds: chapters.map((ch) => ch.id),
        progress: 100,
        status: "pending",
      });

      const updatedJob = await getJobById(job.id);

      res.json({
        success: true,
        job: updatedJob,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Analysis failed";
      await updateDownloadJob(job.id, {
        status: "error",
        error: errorMessage,
        progress: 0,
      });

      res.json({
        success: false,
        message: errorMessage,
        job: await getJobById(job.id),
      });
    }
  }));

  // This route is used to start a download.
  app.post("/api/download", asyncHandler(async (req: Request, res: Response) => {
    const parsed = startDownloadSchema.parse(req.body);
    const { jobId, selectedChapterIds, outputFormat, settings } = parsed;

    const job = await getJobById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (selectedChapterIds.length > 2000) {
      return res.status(400).json({ 
        success: false, 
        message: "Download limited to 2000 chapters maximum. This limit ensures stability on mobile devices. Please select fewer chapters." 
      });
    }

    const metadataUpdates = req.body.metadata ? (req.body.metadata as Partial<BookMetadata>) : {};
    await updateDownloadJob(jobId, {
      metadata: { ...(job.metadata as BookMetadata), ...metadataUpdates },
      selectedChapterIds,
      outputFormat,
      status: "downloading",
      progress: 0,
    });

    const downloadControl = { abort: false };
    activeDownloads.set(jobId, downloadControl);

    const chaptersToDownload = (job.chapters as Chapter[]).filter((ch) =>
      (job.selectedChapterIds as string[]).includes(ch.id)
    );

    const concurrency = settings?.concurrentDownloads || 3;
    const delay = settings?.delayBetweenRequests || 500;
    const startTime = Date.now();
    let completedCount = 0;

    downloadChaptersParallel(
      chaptersToDownload,
      concurrency,
      delay,
      (job.metadata as BookMetadata)?.detectedContentType || "novel",
      async (chapterId, status, content, wordCount, error, imageUrls) => {
        if (downloadControl.abort) return;

        await updateDownloadJob(job.id, {
          chapters: (job.chapters as Chapter[]).map((ch) => ch.id === chapterId ? { ...ch, status } : ch),
        });

        if (status === "complete" || status === "error") {
          completedCount++;
          const progress = (completedCount / chaptersToDownload.length) * 100;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = completedCount / elapsed;
          const remaining = chaptersToDownload.length - completedCount;
          const eta = speed > 0 ? remaining / speed : 0;

          await updateDownloadJob(jobId, {
            progress,
            downloadSpeed: Math.round(speed * 1000),
            eta: Math.round(eta),
          });

          if (completedCount === chaptersToDownload.length) {
            await processAndGenerate(jobId, outputFormat);
          }
        }
      }
    );

    res.json({ success: true, jobId });
  }));

  // This function is used to process and generate the output file.
  async function processAndGenerate(jobId: string, outputFormat: "epub" | "pdf" | "html") {
    try {
      await updateDownloadJob(jobId, { status: "processing" });

      const job = await getJobById(jobId);
      if (!job || !job.metadata) {
        throw new Error("Job or metadata not found");
      }

      const chaptersWithContent = (job.chapters as Chapter[]).filter(
        (ch) => (job.selectedChapterIds as string[]).includes(ch.id) && ch.content
      );

      if (chaptersWithContent.length === 0) {
        throw new Error("No chapters with content available");
      }

      const result = await generateOutput(job.metadata as BookMetadata, chaptersWithContent, outputFormat);

      generatedFiles.set(jobId, result);

      await updateDownloadJob(jobId, {
        status: "complete",
        progress: 100,
        completedAt: Date.now(),
        outputPath: `/api/download-file/${jobId}`,
      });

      activeDownloads.delete(jobId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Generation failed";
      await updateDownloadJob(jobId, {
        status: "error",
        error: errorMessage,
      });
      activeDownloads.delete(jobId);
    }
  }

  // This route is used to get all the jobs.
  app.get("/api/jobs", asyncHandler(async (_req: Request, res: Response) => {
    const jobs = await getDownloadJobs();
    res.json(jobs);
  }));

  // This route is used to get a specific job.
  app.get("/api/jobs/:id", asyncHandler(async (req: Request, res: Response) => {
    const job = await getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  }));

  // This route is used to cancel a job.
  app.post("/api/jobs/:id/cancel", asyncHandler(async (req: Request, res: Response) => {
    const jobId = req.params.id;
    const control = activeDownloads.get(jobId);
    if (control) {
      control.abort = true;
      activeDownloads.delete(jobId);
    }

    await updateDownloadJob(jobId, { status: "error", error: "Cancelled by user" });
    res.json({ success: true });
  }));

  // This route is used to clear all the completed jobs.
  app.post("/api/jobs/clear-completed", asyncHandler(async (_req: Request, res: Response) => {
    const jobs = await getDownloadJobs();
    for (const job of jobs) {
      if (job.status === "complete" || job.status === "error") {
        generatedFiles.delete(job.id);
      }
    }
    await db.delete(downloadJobs).where(inArray(downloadJobs.status, ["complete", "error"]));
    res.json({ success: true });
  }));

  // This route is used to download the generated file.
  app.get("/api/download-file/:id", asyncHandler(async (req: Request, res: Response) => {
    const jobId = req.params.id;
    const file = generatedFiles.get(jobId);

    if (!file) {
      return res.status(404).json({ error: "File not found or expired" });
    }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename=\"${file.filename}\"`);
    res.setHeader("Content-Length", file.buffer.length);
    res.send(file.buffer);
  }));

  // This is a rate limiter for the image proxy.
  const imageLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

  // This route is used to proxy images.
  app.get("/api/image/:id", imageLimiter, (req: Request, res: Response) => {
    const id = req.params.id;
    const imageCache = getImageCache();
    const entry = imageCache.get<{ buffer: Buffer; mime: string }>(id);
    
    if (!entry) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.setHeader("Content-Type", entry.mime);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(entry.buffer);
  });

  // This route is a health check endpoint.
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // This is a global error handler for the application.
  app.use(errorHandler);

  return httpServer;
}
