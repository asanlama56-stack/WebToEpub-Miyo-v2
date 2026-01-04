import { z } from "zod";

export const DownloadStatus = {
  PENDING: "pending",
  ANALYZING: "analyzing",
  DOWNLOADING: "downloading",
  PROCESSING: "processing",
  COMPLETE: "complete",
  ERROR: "error",
  PAUSED: "paused",
} as const;

export type DownloadStatusType = (typeof DownloadStatus)[keyof typeof DownloadStatus];

export const OutputFormat = {
  EPUB: "epub",
  PDF: "pdf",
  HTML: "html",
} as const;

export type OutputFormatType = (typeof OutputFormat)[keyof typeof OutputFormat];

export const ContentType = {
  NOVEL: "novel",
  TECHNICAL: "technical",
  ARTICLE: "article",
  MANGA: "manga",
  UNKNOWN: "unknown",
} as const;

export type ContentTypeType = (typeof ContentType)[keyof typeof ContentType];

export interface Chapter {
  id: string;
  title: string;
  url: string;
  index: number;
  content?: string;
  imageUrls?: string[];
  wordCount?: number;
  status: DownloadStatusType;
  error?: string;
}

export interface BookMetadata {
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  coverImageData?: string;
  proxyUrl?: string;
  language?: string;
  publisher?: string;
  sourceUrl: string;
  detectedContentType: ContentTypeType;
  recommendedFormat: OutputFormatType;
  totalChapters: number;
  estimatedWordCount?: number;
  imageJobId?: string;
}

export interface DownloadJob {
  id: string;
  url: string;
  metadata?: BookMetadata;
  chapters: Chapter[];
  selectedChapterIds: string[];
  outputFormat: OutputFormatType;
  status: DownloadStatusType;
  progress: number;
  downloadSpeed?: number;
  eta?: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
  outputPath?: string;
}

export interface DownloadSettings {
  concurrentDownloads: number;
  delayBetweenRequests: number;
  retryAttempts: number;
  timeout: number;
  includeImages: boolean;
  cleanupHtml: boolean;
  autoDetectFormat: boolean;
}

export const analyzeUrlSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

export type AnalyzeUrlInput = z.infer<typeof analyzeUrlSchema>;

export const startDownloadSchema = z.object({
  jobId: z.string(),
  selectedChapterIds: z.array(z.string()),
  outputFormat: z.enum(["epub", "pdf", "html"]),
  settings: z.object({
    concurrentDownloads: z.number().min(1).max(10).default(3),
    delayBetweenRequests: z.number().min(0).max(5000).default(500),
    retryAttempts: z.number().min(1).max(5).default(3),
    includeImages: z.boolean().default(true),
    cleanupHtml: z.boolean().default(true),
  }).optional(),
});

export type StartDownloadInput = z.infer<typeof startDownloadSchema>;

export interface AnalyzeResponse {
  job: DownloadJob;
  success: boolean;
  message?: string;
}

export interface DownloadProgressUpdate {
  jobId: string;
  status: DownloadStatusType;
  progress: number;
  currentChapter?: string;
  downloadSpeed?: number;
  eta?: number;
  error?: string;
  completedChapterIds?: string[];
}

export const defaultSettings: DownloadSettings = {
  concurrentDownloads: 3,
  delayBetweenRequests: 500,
  retryAttempts: 3,
  timeout: 30000,
  includeImages: true,
  cleanupHtml: true,
  autoDetectFormat: true,
};

export interface User {
  id: string;
  username: string;
  password: string;
}

export const insertUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
