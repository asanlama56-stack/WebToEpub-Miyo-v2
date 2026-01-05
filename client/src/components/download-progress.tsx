import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import JobStatus from "./JobStatus";
import JobActions from "./JobActions";
import type { DownloadJob } from "@shared/schema";
import { formatBytes, formatTime } from "../lib/utils";
import { Gauge, Clock } from "lucide-react";

interface DownloadProgressProps {
  job: DownloadJob;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onDownloadFile?: () => void;
}

export function DownloadProgress({
  job,
  onPause,
  onResume,
  onCancel,
  onDownloadFile,
}: DownloadProgressProps) {
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
            <JobStatus status={job.status} />
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

          <JobActions 
            job={job} 
            onPause={onPause} 
            onResume={onResume} 
            onCancel={onCancel} 
            onDownloadFile={onDownloadFile} 
          />
        </div>
      </CardContent>
    </Card>
  );
}
