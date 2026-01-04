import {
  Download,
  Pause,
  Play,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Gauge,
  FileDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { DownloadJob, DownloadStatusType } from "@shared/schema";

interface DownloadProgressProps {
  job: DownloadJob;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onDownloadFile?: () => void;
}

const statusConfig: Record<DownloadStatusType, {
  icon: typeof Download;
  label: string;
  color: string;
  bgColor: string;
}> = {
  pending: {
    icon: Clock,
    label: "Queued",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  analyzing: {
    icon: Loader2,
    label: "Analyzing",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  downloading: {
    icon: Download,
    label: "Downloading",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  processing: {
    icon: Loader2,
    label: "Processing",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  complete: {
    icon: CheckCircle2,
    label: "Complete",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500/10",
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  paused: {
    icon: Pause,
    label: "Paused",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-500/10",
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function DownloadProgress({
  job,
  onPause,
  onResume,
  onCancel,
  onDownloadFile,
}: DownloadProgressProps) {
  const config = statusConfig[job.status];
  const StatusIcon = config.icon;
  const isActive = ["downloading", "processing", "analyzing"].includes(job.status);
  const completedChapters = job.chapters.filter((ch) => ch.status === "complete").length;

  return (
    <Card className="border-card-border overflow-hidden" data-testid={`download-card-${job.id}`}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm break-words line-clamp-2 w-full" data-testid={`text-job-title-${job.id}`}>
                {job.metadata?.title || "Untitled Book"}
              </h3>
              <p className="text-xs text-muted-foreground truncate w-full">
                {job.metadata?.author || "Unknown Author"}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={`gap-1 ${config.bgColor} ${config.color} border-0`}
            >
              <StatusIcon className={`h-3 w-3 ${isActive ? "animate-spin" : ""}`} />
              {config.label}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {completedChapters} / {job.selectedChapterIds.length} chapters
              </span>
              <span className="font-mono">{Math.round(job.progress)}%</span>
            </div>
            <Progress
              value={job.progress}
              className={`h-2 ${isActive ? "animate-pulse" : ""}`}
              data-testid={`progress-bar-${job.id}`}
            />
          </div>

          {isActive && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {job.downloadSpeed && (
                <div className="flex items-center gap-1">
                  <Gauge className="h-3 w-3" />
                  <span>{formatBytes(job.downloadSpeed)}/s</span>
                </div>
              )}
              {job.eta && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>ETA: {formatTime(job.eta)}</span>
                </div>
              )}
            </div>
          )}

          {job.status === "error" && job.error && (
            <div className="p-2 rounded-md bg-destructive/10 text-destructive text-xs">
              {job.error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-card-border">
            {job.status === "complete" && job.outputPath && (
              <Button
                size="sm"
                className="gap-1"
                onClick={onDownloadFile}
                data-testid={`button-download-file-${job.id}`}
              >
                <FileDown className="h-3 w-3" />
                Download {job.outputFormat.toUpperCase()}
              </Button>
            )}

            {job.status === "downloading" && onPause && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPause}
                data-testid={`button-pause-${job.id}`}
              >
                <Pause className="h-3 w-3" />
              </Button>
            )}

            {job.status === "paused" && onResume && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResume}
                data-testid={`button-resume-${job.id}`}
              >
                <Play className="h-3 w-3" />
              </Button>
            )}

            {!["complete", "error"].includes(job.status) && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                data-testid={`button-cancel-${job.id}`}
              >
                <X className="h-3 w-3" />
              </Button>
            )}

            <div className="flex-1" />

            <Badge variant="outline" className="text-xs font-mono uppercase">
              {job.outputFormat}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
