import type { DownloadJob, Chapter, DownloadStatusType } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createJob(url: string): Promise<DownloadJob>;
  getJob(id: string): Promise<DownloadJob | undefined>;
  getAllJobs(): Promise<DownloadJob[]>;
  updateJob(id: string, updates: Partial<DownloadJob>): Promise<DownloadJob | undefined>;
  updateJobChapters(id: string, chapters: Chapter[]): Promise<DownloadJob | undefined>;
  updateChapterStatus(jobId: string, chapterId: string, status: DownloadStatusType, content?: string, error?: string, imageUrls?: string[]): Promise<void>;
  updateAnalysisProgress(jobId: string, progress: number): Promise<void>;
  deleteJob(id: string): Promise<boolean>;
  clearCompletedJobs(): Promise<void>;
}

export class MemStorage implements IStorage {
  private jobs: Map<string, DownloadJob>;

  constructor() {
    this.jobs = new Map();
  }

  async createJob(url: string): Promise<DownloadJob> {
    const id = randomUUID();
    const job: DownloadJob = {
      id,
      url,
      chapters: [],
      selectedChapterIds: [],
      outputFormat: "epub",
      status: "pending",
      progress: 0,
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJob(id: string): Promise<DownloadJob | undefined> {
    return this.jobs.get(id);
  }

  async getAllJobs(): Promise<DownloadJob[]> {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async updateJob(id: string, updates: Partial<DownloadJob>): Promise<DownloadJob | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...updates };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async updateJobChapters(id: string, chapters: Chapter[]): Promise<DownloadJob | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    
    job.chapters = chapters;
    this.jobs.set(id, job);
    return job;
  }

  async updateChapterStatus(
    jobId: string,
    chapterId: string,
    status: DownloadStatusType,
    content?: string,
    error?: string,
    imageUrls?: string[]
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    const chapterIndex = job.chapters.findIndex((ch) => ch.id === chapterId);
    if (chapterIndex === -1) return;
    
    job.chapters[chapterIndex] = {
      ...job.chapters[chapterIndex],
      status,
      content,
      error,
      imageUrls,
    };
    
    this.jobs.set(jobId, job);
  }

  async deleteJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  async updateAnalysisProgress(jobId: string, progress: number): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    job.progress = Math.min(progress, 99);
    this.jobs.set(jobId, job);
  }

  async clearCompletedJobs(): Promise<void> {
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === "complete" || job.status === "error") {
        this.jobs.delete(id);
      }
    }
  }
}

export const storage = new MemStorage();
