import { serial, text, pgTable, timestamp, varchar, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const downloadJobs = pgTable("novels", {
  id: varchar("id", { length: 36 }).primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  author: text("author"),
  description: text("description"),
  coverUrl: text("cover_url"),
  status: varchar("status", { length: 20 }).default("pending"),
  progress: integer("progress").default(0),
  outputFormat: varchar("output_format", { length: 10 }).default("epub"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  outputPath: text("output_path"),
  error: text("error"),
  downloadSpeed: integer("download_speed"),
  eta: integer("eta"),
  metadata: jsonb("metadata"),
  selectedChapterIds: jsonb("selected_chapter_ids"),
});

export const chapters = pgTable("chapters", {
  id: varchar("id", { length: 36 }).primaryKey(),
  jobId: varchar("job_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  index: integer("index").notNull(),
  content: text("content"),
  imageUrls: jsonb("image_urls"),
  wordCount: integer("word_count"),
  status: varchar("status", { length: 20 }).default("pending"),
  error: text("error"),
});

export type OutputFormatType = "epub" | "pdf" | "azw3" | "mobi";

export interface BookMetadata {
  title: string;
  author?: string;
  description?: string;
  coverUrl?: string;
  recommendedFormat: OutputFormatType;
  detectedContentType: "text" | "image";
}

export interface Chapter {
  id: string;
  title: string;
  url: string;
  index: number;
}

export interface DownloadJob {
  id: string;
  url: string;
  status: "pending" | "analyzing" | "downloading" | "processing" | "complete" | "cancelled" | "error";
  progress: number;
  chapters: Chapter[];
  metadata?: BookMetadata;
  outputPath?: string;
}

export interface DownloadSettings {
  concurrentDownloads: number;
  delayBetweenRequests: number;
  retryAttempts: number;
  includeImages: boolean;
  cleanupHtml: boolean;
}

export const defaultSettings: DownloadSettings = {
  concurrentDownloads: 5,
  delayBetweenRequests: 100,
  retryAttempts: 3,
  includeImages: true,
  cleanupHtml: true,
};

export interface AnalyzeResponse {
  success: boolean;
  job?: DownloadJob;
  message?: string;
}
