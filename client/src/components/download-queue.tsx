import { ListOrdered, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DownloadProgress } from "./download-progress";
import type { DownloadJob } from "@shared/schema";

interface DownloadQueueProps {
  jobs: DownloadJob[];
  onPause?: (jobId: string) => void;
  onResume?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  onClearCompleted?: () => void;
  onDownloadFile?: (job: DownloadJob) => void;
}

export function DownloadQueue({
  jobs,
  onPause,
  onResume,
  onCancel,
  onClearCompleted,
  onDownloadFile,
}: DownloadQueueProps) {
  const activeJobs = jobs.filter((j) =>
    ["analyzing", "downloading", "processing", "paused"].includes(j.status)
  );
  const completedJobs = jobs.filter((j) => ["complete", "error"].includes(j.status));

  if (jobs.length === 0) {
    return null;
  }

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-primary" />
            Downloads
            {activeJobs.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                ({activeJobs.length} active)
              </span>
            )}
          </CardTitle>
          {completedJobs.length > 0 && onClearCompleted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearCompleted}
              className="gap-1 text-xs"
              data-testid="button-clear-completed"
            >
              <Trash2 className="h-3 w-3" />
              Clear completed
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <DownloadProgress
                key={job.id}
                job={job}
                onPause={() => onPause?.(job.id)}
                onResume={() => onResume?.(job.id)}
                onCancel={() => onCancel?.(job.id)}
                onDownloadFile={() => onDownloadFile?.(job)}
              />
            ))}
            {completedJobs.map((job) => (
              <DownloadProgress
                key={job.id}
                job={job}
                onDownloadFile={() => onDownloadFile?.(job)}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
