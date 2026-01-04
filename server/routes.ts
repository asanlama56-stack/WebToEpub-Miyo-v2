import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { analyzeUrl, downloadChaptersParallel } from "./scraper";
import { generateOutput } from "./generator";
import { analyzeUrlSchema, startDownloadSchema, type BookMetadata, type DownloadStatusType, defaultSettings } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { getImageCache } from "./pipeline/imagePipeline";
import { createImageJob, getImageJob } from "./jobs/imageJobs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyB4ilhZI-C6_J6-AADS0VONispc8IhTXls";
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const geminiModel = genAI.models.generateContent;

const activeDownloads = new Map<string, { abort: boolean }>();
const generatedFiles = new Map<string, { buffer: Buffer; filename: string; mimeType: string }>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // CORS middleware - FIRST, applies to all routes
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

  // Global JSON parser - for all other routes
  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));

  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const parsed = analyzeUrlSchema.parse(req.body);
      const { url } = parsed;

      const job = await storage.createJob(url);
      await storage.updateJob(job.id, { status: "analyzing", progress: 0 });

      try {
        await storage.updateAnalysisProgress(job.id, 20);
        const { metadata, chapters } = await analyzeUrl(url);

        // Create image job for background validation
        const imageJob = createImageJob(metadata?.coverUrl);

        await storage.updateAnalysisProgress(job.id, 80);
        await storage.updateJobChapters(job.id, chapters);
        
        const updatedJob = await storage.updateJob(job.id, {
          metadata: metadata ? { ...metadata, imageJobId: imageJob.id } : undefined,
          status: "pending",
          selectedChapterIds: chapters.map((ch) => ch.id),
          progress: 100,
        });

        res.json({
          success: true,
          job: updatedJob,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Analysis failed";
        await storage.updateJob(job.id, {
          status: "error",
          error: errorMessage,
          progress: 0,
        });

        res.json({
          success: false,
          message: errorMessage,
          job: await storage.getJob(job.id),
        });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const readable = fromZodError(error);
        res.status(400).json({ success: false, message: readable.message });
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message });
      }
    }
  });

  app.post("/api/download", async (req: Request, res: Response) => {
    try {
      const parsed = startDownloadSchema.parse(req.body);
      const { jobId, selectedChapterIds, outputFormat, settings } = parsed;

      const job = await storage.getJob(jobId);
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
      await storage.updateJob(jobId, {
        metadata: { ...job.metadata!, ...metadataUpdates },
        selectedChapterIds,
        outputFormat,
        status: "downloading",
        progress: 0,
      });

      const downloadControl = { abort: false };
      activeDownloads.set(jobId, downloadControl);

      const chaptersToDownload = job.chapters.filter((ch) =>
        selectedChapterIds.includes(ch.id)
      );

      const concurrency = settings?.concurrentDownloads || 3;
      const delay = settings?.delayBetweenRequests || 500;
      const startTime = Date.now();
      let completedCount = 0;

      downloadChaptersParallel(
        chaptersToDownload,
        concurrency,
        delay,
        job.metadata?.detectedContentType || "novel",
        async (chapterId, status, content, wordCount, error, imageUrls) => {
          if (downloadControl.abort) return;

          const chapterStatus: DownloadStatusType = status === "downloading"
            ? "downloading"
            : status === "complete"
            ? "complete"
            : "error";

          await storage.updateChapterStatus(jobId, chapterId, chapterStatus, content, error, imageUrls);

          if (status === "complete" || status === "error") {
            completedCount++;
            const progress = (completedCount / chaptersToDownload.length) * 100;
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = completedCount / elapsed;
            const remaining = chaptersToDownload.length - completedCount;
            const eta = speed > 0 ? remaining / speed : 0;

            await storage.updateJob(jobId, {
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
    } catch (error) {
      if (error instanceof ZodError) {
        const readable = fromZodError(error);
        res.status(400).json({ success: false, message: readable.message });
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message });
      }
    }
  });

  async function processAndGenerate(jobId: string, outputFormat: "epub" | "pdf" | "html") {
    try {
      await storage.updateJob(jobId, { status: "processing" });

      const job = await storage.getJob(jobId);
      if (!job || !job.metadata) {
        throw new Error("Job or metadata not found");
      }

      const chaptersWithContent = job.chapters.filter(
        (ch) => job.selectedChapterIds.includes(ch.id) && ch.content
      );

      if (chaptersWithContent.length === 0) {
        throw new Error("No chapters with content available");
      }

      const result = await generateOutput(job.metadata, chaptersWithContent, outputFormat);

      generatedFiles.set(jobId, result);

      await storage.updateJob(jobId, {
        status: "complete",
        progress: 100,
        completedAt: Date.now(),
        outputPath: `/api/download-file/${jobId}`,
      });

      activeDownloads.delete(jobId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Generation failed";
      await storage.updateJob(jobId, {
        status: "error",
        error: errorMessage,
      });
      activeDownloads.delete(jobId);
    }
  }

  app.get("/api/jobs", async (_req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req: Request, res: Response) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  app.post("/api/jobs/:id/cancel", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const control = activeDownloads.get(jobId);
      if (control) {
        control.abort = true;
        activeDownloads.delete(jobId);
      }

      await storage.updateJob(jobId, { status: "error", error: "Cancelled by user" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to cancel job" });
    }
  });

  app.post("/api/jobs/clear-completed", async (_req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllJobs();
      for (const job of jobs) {
        if (job.status === "complete" || job.status === "error") {
          generatedFiles.delete(job.id);
        }
      }
      await storage.clearCompletedJobs();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to clear jobs" });
    }
  });

  app.get("/api/download-file/:id", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const file = generatedFiles.get(jobId);

      if (!file) {
        return res.status(404).json({ error: "File not found or expired" });
      }

      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
      res.setHeader("Content-Length", file.buffer.length);
      res.send(file.buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  const imageLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

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

  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { message, history, mode = 'fast', taskStatus = [] } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message required" });
      }

      console.log("[CHAT] Received message:", message, "Mode:", mode);
      console.log("[CHAT] History length:", history?.length || 0);

      // Auto-detect URLs and trigger analysis BEFORE sending to AI
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urlMatches = message.match(urlRegex);
      let autoCreatedJobId = null;
      
      if (urlMatches && (message.toLowerCase().includes('download') || message.toLowerCase().includes('analyze'))) {
        // Create analysis job for the first URL found
        const url = urlMatches[0];
        try {
          const autoJob = await storage.createJob(url);
          await storage.updateJob(autoJob.id, { status: "analyzing", progress: 10 });
          autoCreatedJobId = autoJob.id;
          console.log("[CHAT] Auto-created job for URL:", url, "JobID:", autoJob.id);
          // Start analysis in background
          analyzeUrl(url).then(
            async ({ metadata, chapters }) => {
              await storage.updateJob(autoJob.id, {
                metadata,
                chapters,
                status: "pending",
                selectedChapterIds: chapters.map(ch => ch.id),
                progress: 100,
              });
              console.log("[CHAT] Auto-analysis complete");
            }
          ).catch(err => {
            console.error("[CHAT] Auto-analysis error:", err);
            storage.updateJob(autoJob.id, { status: "error", error: String(err) });
          });
        } catch (err) {
          console.error("[CHAT] Failed to create auto-job:", err);
        }
      }

      const fastModeAddition = mode === 'fast' 
        ? "\n\n## RESPONSE STYLE (FAST MODE):\n- Give quick, direct answers\n- Be concise and to the point\n- Execute actions immediately without lengthy explanations\n- Prioritize speed and efficiency"
        : "\n\n## RESPONSE STYLE (THINKING MODE):\n- Wrap your thinking process in <thinking>...</thinking> tags so user can see your reasoning\n- Inside thinking tags, analyze problems deeply, think step-by-step, plan solutions\n- If something prevents manual operation, identify root causes and propose creative solutions\n- For example: if images are missing in EPUB downloads, analyze why and suggest fixes\n- Then provide your response outside the tags with clear, detailed guidance\n- User will expand a button to read your full thinking process";

      // Add task progress info to system prompt
      const taskProgressInfo = taskStatus && taskStatus.length > 0
        ? `\n\n## TASK PROGRESS UPDATE:\nFrontend reports these task statuses:\n${taskStatus.map((t: any) => `- Job ${t.id}: ${t.status} (${t.progress}%)`).join('\n')}\n\nIf a task just completed, continue with the next step of the user's request!`
        : "";

      const systemPrompt = `You are an expert AI assistant for WebToBook, a professional web-to-EPUB/PDF converter application. You have complete knowledge about all features and functionality.

## WHAT IS WEBTOBOOK?
WebToBook is a powerful web scraping and book conversion tool that allows users to extract content from any website (web novels, books, articles, etc.) and convert them to portable ebook formats.

## KEY FEATURES & CAPABILITIES:

### 1. URL Analysis & Chapter Detection
- Users paste any URL from web novels, books, or online articles
- The app automatically detects and extracts all chapters using intelligent pattern recognition
- Supports 500+ reading sites including: WuxiaSpot, Chinese MTL sites, Light Novel sites, Webnovel platforms, and general websites
- Automatically detects metadata: title, author, description, cover image, content type
- Determines content type: novel, technical book, article, or unknown
- Calculates estimated word count per chapter
- Shows total chapter count

### 2. Output Formats (User can choose any one):
- **EPUB**: Industry standard ebook format, works on all e-readers (Kindle, Kobo, Apple Books, etc.), supports styling and images
- **PDF**: Portable format, fixed layout, maintains precise formatting, good for reading on computers
- **HTML**: Web format, opens in any browser, allows easy editing and sharing

### 3. Intelligent Chapter Selection
- User reviews all extracted chapters with title and index
- Can select specific chapters or select all
- Can deselect unwanted chapters (e.g., skip introductions or bonus content)
- Shows chapter titles for easy identification
- Cannot exceed 2000 chapters per download (mobile stability limit)

### 4. Metadata Management & Editing
- Book title (extracted automatically, user can edit)
- Author name (extracted automatically, user can edit)
- Book description/synopsis (extracted automatically, user can edit)
- Cover image (extracted automatically, user can replace with custom URL)
- Language (detected automatically)
- Publisher (detected if available)
- Source URL (tracked for reference)
- Recommended format (AI suggests best format based on content type)

### 5. Advanced Download Settings (All configurable):
- **Concurrent Downloads** (1-10, default: 3): How many chapters to download simultaneously for speed
- **Request Delay** (0-5000ms, default: 500ms): Delay between requests to avoid overwhelming the source website
- **Retry Attempts** (1-5, default: 3): How many times to retry failed chapter downloads
- **Timeout** (seconds): How long to wait before timing out a request
- **Include Images**: Toggle to include or exclude images from chapters
- **Cleanup HTML**: Toggle to remove ads, navigation, and unnecessary HTML elements
- **Auto-Detect Format**: Let the app recommend best format based on content type

### 6. Progress Tracking & Real-Time Updates
- Real-time progress bar showing percentage complete
- Download speed display (chapters per second)
- ETA (estimated time to completion) calculation
- Per-chapter status (pending, downloading, processing, complete, error)
- Current chapter being processed
- Completed chapter count vs total

### 7. Job Management
- View all active and completed downloads in a queue
- Cancel ongoing downloads
- Clear completed/errored jobs
- Download generated file once ready
- Track multiple simultaneous downloads

## HOW TO USE WEBTOBOOK (WORKFLOW):

1. **Paste URL**: Paste the URL of the first chapter or the book's main page
2. **Analyze**: Click "Analyze" button - app extracts chapters automatically
3. **Review Results**: See detected chapters, metadata, cover image, recommended format
4. **Edit Metadata** (Optional): Change title, author, description, or cover image
5. **Select Chapters**: Choose which chapters to include (default: all)
6. **Choose Format**: Select EPUB, PDF, or HTML
7. **Configure Settings** (Optional): Adjust concurrent downloads, delays, retries, image inclusion
8. **Download**: Click "Download" to start the conversion process
9. **Monitor Progress**: Watch real-time progress with ETA
10. **Download File**: Once complete, download your generated ebook file

## SUPPORTED CONTENT TYPES:
- Web novels (Chinese, English, Korean, Japanese translations)
- Light novels and visual novels
- Webnovel platforms content
- Blog articles and long-form journalism
- Books and ebooks from websites
- Fan fiction sites
- Any website with chapter-like structures

## TECHNICAL DETAILS:
- Uses Cheerio for fast HTML parsing
- Pattern-based intelligent chapter detection
- Parallel downloading for 3-10x speed improvement
- EPUB generation with archiving
- PDF generation with PDFKit
- HTML generation with templates
- Image validation and proxy service
- Content cleanup and normalization
- Mobile-optimized (2000 chapter limit for stability)

## COMMON QUESTIONS YOU SHOULD ANSWER:
- How many chapters can I download? (Up to 2000 per job for stability)
- What websites does it work with? (500+ sites supported, especially novel and reading platforms)
- Can I edit the book details? (Yes: title, author, description, cover)
- What's the best format? (EPUB for e-readers, PDF for fixed layout, HTML for web)
- How can I speed up downloads? (Increase concurrent downloads setting)
- Does it include images? (Yes by default, but toggleable in settings)
- Can I cancel a download? (Yes, anytime during the process)
- How long does it take? (Depends on chapter count and your settings, typically 1-5 minutes for 100+ chapters)

## PERSONALITY:
- Be helpful, professional, and knowledgeable
- Explain features in simple terms
- Provide practical guidance on settings and format selection
- Help troubleshoot common issues
- Encourage users to experiment with settings
- Be supportive about the app's capabilities

## AVAILABLE API ACTIONS (You have FULL AUTHORITY to execute):
You can call these actions directly via the /api/ai-execute endpoint when the user's intent is clear:

### 1. analyze - Extract chapters from URL
- Action: "analyze"
- Params: {url: "https://..."}
- Tells user: "I'll analyze this URL and extract all chapters for you"

### 2. download - Start converting chapters
- Action: "download"  
- Params: {jobId: "...", selectedChapterIds: [...], outputFormat: "epub|pdf|html", settings: {...}}
- Tells user: "Starting download now in EPUB format"

### 3. cancel - Stop an active download
- Action: "cancel"
- Params: {jobId: "..."}
- Tells user: "I've cancelled that download"

### 4. status - Check job status
- Action: "status"
- Params: {jobId: "..." or null for all}
- Shows user current progress

### 5. clear - Remove completed/errored jobs
- Action: "clear"
- Params: {}
- Tells user: "Cleared your completed downloads"

EXECUTE PROACTIVELY: When user says "download this", "convert to epub", "analyze this url", "check status", etc., you should immediately execute the corresponding action!` + fastModeAddition + taskProgressInfo;


      // Get current jobs for AI context
      const jobs = await storage.getAllJobs();
      const jobsSummary = jobs.length > 0 
        ? `\n\nCURRENT JOBS STATUS:\n${jobs.map(j => `- Job ${j.id}: ${j.status} (${j.progress}% complete)`).join('\n')}`
        : "\n\nNo active jobs currently.";

      // Build conversation history for continuity
      const contents: any[] = [
        { role: "user", parts: [{ text: systemPrompt + jobsSummary }] },
        { role: "model", parts: [{ text: "I'm the WebToBook AI with FULL AUTHORITY. I can analyze URLs, start downloads, manage jobs, and execute all functions directly. I'll help you convert web content to ebooks efficiently!" }] },
      ];

      // Add previous messages if history exists
      if (history && Array.isArray(history) && history.length > 0) {
        for (const msg of history) {
          if (msg.role === 'user') {
            contents.push({ role: "user", parts: [{ text: msg.content }] });
          } else if (msg.role === 'assistant') {
            contents.push({ role: "model", parts: [{ text: msg.content }] });
          }
        }
      } else {
        // If no history, just add current message
        contents.push({ role: "user", parts: [{ text: message }] });
      }

      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
      });

      console.log("[CHAT] Gemini response received successfully");
      let text = result.text || "";
      let thinking = "";
      const executionSteps: string[] = [];
      
      // Extract thinking process if present
      const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/);
      if (thinkingMatch) {
        thinking = thinkingMatch[1].trim();
        text = text.replace(/<thinking>[\s\S]*?<\/thinking>\n*/g, '').trim();
      }
      
      // Parse and execute actions that the AI mentions it will perform
      const actionMatch = text.match(/\*\*Executing action:\*\*\s*`(\w+)`/);
      if (actionMatch) {
        const action = actionMatch[1];
        console.log("[CHAT] Detected action from AI response:", action);
        executionSteps.push(`📋 Executing: ${action}`);
        
        try {
          let actionResult: any = null;
          
          // Extract URL for analyze action
          if (action === 'analyze') {
            const urlMatch = text.match(/url:\s*["']?(https?:\/\/[^\s"'}`]+)/);
            if (urlMatch) {
              const url = urlMatch[1];
              console.log("[CHAT] Auto-executing analyze for URL:", url);
              executionSteps.push(`🔍 Analyzing URL: ${url.substring(0, 50)}...`);
              const job = await storage.createJob(url);
              await storage.updateJob(job.id, { status: "analyzing", progress: 20 });
              try {
                executionSteps.push(`⏳ Parsing website content...`);
                const { metadata, chapters } = await analyzeUrl(url);
                executionSteps.push(`✓ Found ${chapters.length} chapters`);
                actionResult = await storage.updateJob(job.id, {
                  metadata,
                  chapters,
                  status: "pending",
                  selectedChapterIds: chapters.map(ch => ch.id),
                  progress: 100,
                });
                executionSteps.push(`✓ Job created: ${job.id}`);
                console.log("[CHAT] Analysis complete, found", chapters.length, "chapters");
                // Append action result to response
                text += `\n\n✅ **Analysis Complete!**\n- Found ${chapters.length} chapters\n- Title: ${metadata?.title || 'Unknown'}\n- Author: ${metadata?.author || 'Unknown'}`;
              } catch (error) {
                const msg = error instanceof Error ? error.message : "Analysis failed";
                console.error("[CHAT] Analysis error:", msg);
                text += `\n\n❌ Analysis failed: ${msg}`;
              }
            }
          }
          // More actions can be added here (download, cancel, etc.)
          
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Action execution failed";
          console.error("[CHAT] Action execution error:", msg);
          text += `\n\n⚠️ Error executing action: ${msg}`;
        }
      }
      
      res.json({ 
        reply: text, 
        thinking: thinking || undefined,
        executionSteps: executionSteps.length > 0 ? executionSteps : undefined
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Chat error";
      console.error("[CHAT] Error:", errorMessage);
      res.status(500).json({ error: errorMessage });
    }
  });

  // AI Execute Action Endpoint - Allows AI to perform direct operations
  app.post("/api/ai-execute", async (req: Request, res: Response) => {
    try {
      const { action, params } = req.body;
      if (!action || typeof action !== 'string') {
        return res.status(400).json({ error: "Action required" });
      }

      console.log("[AI-EXEC] Action:", action, "Params:", JSON.stringify(params).substring(0, 100));

      switch(action) {
        case "analyze": {
          const { url } = params as { url: string };
          if (!url) return res.status(400).json({ error: "URL required" });
          const job = await storage.createJob(url);
          await storage.updateJob(job.id, { status: "analyzing", progress: 20 });
          try {
            const { metadata, chapters } = await analyzeUrl(url);
            const updated = await storage.updateJob(job.id, {
              metadata,
              chapters,
              status: "pending",
              selectedChapterIds: chapters.map(ch => ch.id),
              progress: 100,
            });
            return res.json({ success: true, job: updated });
          } catch (error) {
            await storage.updateJob(job.id, { status: "error", error: "Analysis failed", progress: 0 });
            throw error;
          }
        }

        case "download": {
          const { jobId, selectedChapterIds, outputFormat, settings } = params as any;
          if (!jobId || !selectedChapterIds || !outputFormat) {
            return res.status(400).json({ error: "Missing required params: jobId, selectedChapterIds, outputFormat" });
          }
          const job = await storage.getJob(jobId);
          if (!job) return res.status(404).json({ error: "Job not found" });
          
          const dSettings = { ...defaultSettings, ...settings };
          await storage.updateJob(jobId, {
            selectedChapterIds,
            outputFormat,
            status: "downloading",
            progress: 0,
          });

          const downloadControl = { abort: false };
          activeDownloads.set(jobId, downloadControl);

          const chaptersToDownload = job.chapters.filter((ch) =>
            selectedChapterIds.includes(ch.id)
          );

          downloadChaptersParallel(
            chaptersToDownload,
            dSettings.concurrentDownloads,
            dSettings.delayBetweenRequests,
            job.metadata?.detectedContentType || "novel",
            async (chapterId, status, content, wordCount, error, imageUrls) => {
              if (downloadControl.abort) return;

              const chapterStatus: DownloadStatusType = status === "downloading"
                ? "downloading"
                : status === "complete"
                ? "complete"
                : "error";

              await storage.updateChapterStatus(jobId, chapterId, chapterStatus, content, error, imageUrls);

              const updatedJob = await storage.getJob(jobId);
              if (updatedJob) {
                const completedCount = updatedJob.chapters.filter(ch => ch.status === "complete" || ch.status === "error").length;
                const progress = (completedCount / chaptersToDownload.length) * 100;
                
                await storage.updateJob(jobId, { progress });

                if (completedCount === chaptersToDownload.length) {
                  await processAndGenerate(jobId, outputFormat);
                }
              }
            }
          );
          
          return res.json({ success: true, message: "Download started", jobId });
        }

        case "cancel": {
          const { jobId } = params as { jobId: string };
          if (!jobId) return res.status(400).json({ error: "Job ID required" });
          const job = await storage.getJob(jobId);
          if (!job) return res.status(404).json({ error: "Job not found" });
          await storage.updateJob(jobId, { status: "error", error: "Cancelled by AI" });
          return res.json({ success: true, message: "Download cancelled", jobId });
        }

        case "status": {
          const { jobId } = params as { jobId?: string };
          if (jobId) {
            const job = await storage.getJob(jobId);
            if (!job) return res.status(404).json({ error: "Job not found" });
            return res.json({ success: true, job });
          } else {
            const jobs = await storage.getAllJobs();
            return res.json({ success: true, jobs });
          }
        }

        case "clear": {
          const jobs = await storage.getAllJobs();
          const completed = jobs.filter(j => j.status === "complete" || j.status === "error");
          for (const job of completed) {
            await storage.deleteJob(job.id);
          }
          return res.json({ success: true, cleared: completed.length });
        }

        default:
          return res.status(400).json({ error: `Unknown action: ${action}` });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Execution failed";
      console.error("[AI-EXEC] Error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}
