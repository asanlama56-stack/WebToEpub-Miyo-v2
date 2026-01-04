import { randomUUID } from "crypto";

export type ImageState = "pending" | "loading" | "success" | "failed";

export interface ImageJob {
  id: string;
  detectedUrl?: string;
  finalUrl?: string;
  proxyId?: string;
  state: ImageState;
  error?: string;
  downloadAttempts?: number;
  lastError?: string;
  bytesDownloaded?: number;
  mimeType?: string;
  dataUrlLength?: number;
  logs: string[];
  createdAt: string;
  updatedAt: string;
}

const imageJobs = new Map<string, ImageJob>();

export function createImageJob(detectedUrl?: string) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const job: ImageJob = {
    id,
    detectedUrl,
    state: detectedUrl ? "pending" : "failed",
    logs: [],
    createdAt: now,
    updatedAt: now
  };
  imageJobs.set(id, job);
  return job;
}

export function getImageJob(id: string) {
  return imageJobs.get(id);
}

export function updateImageJob(id: string, patch: Partial<ImageJob>) {
  const job = imageJobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
  job.updatedAt = new Date().toISOString();
}
