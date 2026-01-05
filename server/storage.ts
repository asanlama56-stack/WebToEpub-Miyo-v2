import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { chapters, novels, downloadJobs } from "./db/schema";
import * as schema from "./db/schema";
import type { DownloadJob, Chapter, BookMetadata } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL as string, { max: 1 });
const db = drizzle(client, { schema });

export async function getNovelById(id: string) {
  return await db.query.novels.findFirst({
    where: eq(novels.id, id),
    with: {
      chapters: true,
    },
  });
}

export async function getChaptersByNovelId(novelId: string): Promise<Chapter[]> {
  const results = await db.query.chapters.findMany({
    where: eq(chapters.novelId, novelId),
  });

  // Manually mapping to satisfy the more specific Chapter type
  return results.map((ch: any) => ({
    ...ch,
    content: ch.content || undefined,
    imageUrls: ch.imageUrls ? JSON.parse(ch.imageUrls as string) : [],
    error: ch.error || undefined
  }));
}

export async function getChapterByIds(ids: string[]): Promise<Chapter[]> {
  if (ids.length === 0) return [];
  const results = await db.select().from(chapters).where(inArray(chapters.id, ids));
  return results.map((ch: any) => ({ 
    ...ch, 
    content: ch.content || undefined,
    imageUrls: ch.imageUrls ? JSON.parse(ch.imageUrls as string) : [],
    error: ch.error || undefined 
  }));
}

export async function getDownloadJobs(): Promise<DownloadJob[]> {
  const jobs = await db.query.downloadJobs.findMany({
    with: {
      chapters: {
        columns: {
          id: true,
          status: true,
        }
      },
    },
  });

  return jobs.map((job: any) => ({
    ...job,
    metadata: job.metadata ? JSON.parse(job.metadata as unknown as string) as BookMetadata : undefined,
    chapters: job.chapters.map((ch: any) => ({ ...ch, content: undefined, imageUrls: [], error: undefined})),
    selectedChapterIds: job.selectedChapterIds ? JSON.parse(job.selectedChapterIds as unknown as string) : [],
    progress: job.progress || 0,
    downloadSpeed: job.downloadSpeed || undefined,
    eta: job.eta || undefined,
    error: job.error || undefined,
    completedAt: job.completedAt || undefined,
    outputPath: job.outputPath || undefined,
  }));
}

export async function createDownloadJob(url: string): Promise<DownloadJob> {
  const [newJob] = await db.insert(downloadJobs).values({ url }).returning();
  return {
    ...newJob,
    chapters: [],
    selectedChapterIds: [],
    outputFormat: 'epub', // Set a default
    progress: 0,
    createdAt: newJob.createdAt.getTime(),
  };
}

export async function updateDownloadJob(id: string, data: Partial<DownloadJob>): Promise<void> {
  await db.update(downloadJobs).set({
    ...data,
    metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
    selectedChapterIds: data.selectedChapterIds ? JSON.stringify(data.selectedChapterIds) : undefined,
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
    completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
  }).where(eq(downloadJobs.id, id));
}

export default db;
