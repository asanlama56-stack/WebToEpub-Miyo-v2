import type { DownloadJob, Chapter, DownloadStatusType, BookMetadata } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { novels, chapters as dbChapters } from "./db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";

export interface IStorage {
  createJob(url: string): Promise<DownloadJob>;
  getJob(id: string): Promise<DownloadJob | undefined>;
  getAllJobs(): Promise<DownloadJob[]>;
  updateJob(id: string, updates: Partial<DownloadJob>): Promise<DownloadJob | undefined>;
  updateJobChapters(id: string, chapters: Chapter[]): Promise<DownloadJob | undefined>;
  updateChapterStatus(jobId: string, chapterId: string, status: DownloadStatusType, content?: string, error?: string, imageUrls?: string[]): Promise<void>;
  updateAnalysisProgress(jobId: string, progress: number): Promise<void>;
  deleteJob(id: string): Promise<void>;
  clearCompletedJobs(): Promise<void>;
}

class DbStorage implements IStorage {
  async createJob(url: string): Promise<DownloadJob> {
    const id = randomUUID();
    const newJob = {
      id,
      url,
      status: "pending",
      progress: 0,
      createdAt: new Date(),
    };
    await db.insert(novels).values(newJob);
    return this.getJob(id) as Promise<DownloadJob>;
  }
  async getJob(id: string): Promise<DownloadJob | undefined> {
    const job = await db.query.novels.findFirst({ where: eq(novels.id, id) });
    if (!job) return undefined;

    const chapters = await db.query.chapters.findMany({ where: eq(dbChapters.novelId, id) });
    
    return {
      ...job,
      metadata: job.metadata as BookMetadata,
      chapters: chapters.map(c => ({...c, status: c.status as DownloadStatusType})),
      selectedChapterIds: job.selectedChapterIds as string[],
      outputFormat: job.outputFormat as any,
      status: job.status as DownloadStatusType,
      createdAt: job.createdAt ? new Date(job.createdAt).getTime() : 0,
      completedAt: job.completedAt ? new Date(job.completedAt).getTime() : undefined,
    };
  }
  async getAllJobs(): Promise<DownloadJob[]> {
    const allNovels = await db.query.novels.findMany({
      orderBy: [desc(novels.createdAt)],
    });

    if (allNovels.length === 0) {
      return [];
    }

    const allChapters = await db.query.chapters.findMany({
      where: inArray(dbChapters.novelId, allNovels.map(n => n.id))
    });

    const chaptersByNovelId = new Map<string, Chapter[]>();
    for (const chapter of allChapters) {
      const chap = { ...chapter, status: chapter.status as DownloadStatusType };
      if (!chaptersByNovelId.has(chapter.novelId)) {
        chaptersByNovelId.set(chapter.novelId, [chap]);
      } else {
        chaptersByNovelId.get(chapter.novelId)!.push(chap);
      }
    }

    const jobs: DownloadJob[] = allNovels.map(novel => ({
      ...novel,
      metadata: novel.metadata as BookMetadata,
      chapters: chaptersByNovelId.get(novel.id) || [],
      selectedChapterIds: novel.selectedChapterIds as string[],
      outputFormat: novel.outputFormat as any,
      status: novel.status as DownloadStatusType,
      createdAt: novel.createdAt ? new Date(novel.createdAt).getTime() : 0,
      completedAt: novel.completedAt ? new Date(novel.completedAt).getTime() : undefined,
    }));

    return jobs;
  }
  async updateJob(id: string, updates: Partial<DownloadJob>): Promise<DownloadJob | undefined> {
    const { chapters, ...rest } = updates;
    await db.update(novels).set(rest).where(eq(novels.id, id));
    return this.getJob(id);
  }
  async updateJobChapters(id: string, chapters: Chapter[]): Promise<DownloadJob | undefined> {
    await db.delete(dbChapters).where(eq(dbChapters.novelId, id));
    if (chapters.length > 0) {
      await db.insert(dbChapters).values(chapters.map(c => ({...c, novelId: id})));
    }
    return this.getJob(id);
  }
  async updateChapterStatus(jobId: string, chapterId: string, status: DownloadStatusType, content?: string, error?: string, imageUrls?: string[]): Promise<void> {
    await db.update(dbChapters).set({ status, content, error, imageUrls: imageUrls ? JSON.stringify(imageUrls) : undefined }).where(and(eq(dbChapters.id, chapterId), eq(dbChapters.novelId, jobId)));
  }
  async updateAnalysisProgress(jobId: string, progress: number): Promise<void> {
    await db.update(novels).set({ progress: Math.min(progress, 99) }).where(eq(novels.id, jobId));
  }
  async deleteJob(id: string): Promise<void> {
    await db.delete(novels).where(eq(novels.id, id));
  }
  async clearCompletedJobs(): Promise<void> {
    const completedJobs = await db.query.novels.findMany({
      where: eq(novels.status, "complete"),
    });
    if (completedJobs.length > 0) {
      const ids = completedJobs.map((job) => job.id);
      await db.delete(novels).where(inArray(novels.id, ids));
    }
  }
}

export const storage = new DbStorage();
