import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";
import {
  MoreVertical,
  Trash2,
  Download,
  RotateCcw,
  Pause,
  Play,
} from "lucide-react";
import type { DownloadJob } from "../../../shared/schema";

interface JobActionsProps {
  job: DownloadJob;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onDownloadFile?: () => void;
  onRetry?: () => void;
}

export default function JobActions({
  job,
  onPause,
  onResume,
  onCancel,
  onDownloadFile,
  onRetry,
}: JobActionsProps) {
  const isPaused = job.status === "paused";
  const isDownloading = job.status === "downloading";
  const isCompleted = job.status === "complete";
  const isError = job.status === "error";

  return (
    <div className="flex items-center justify-end space-x-2">
      {isDownloading && onPause && (
        <Button variant="outline" size="sm" onClick={onPause}>
          <Pause className="h-4 w-4 mr-2" />
          Pause
        </Button>
      )}
      {isPaused && onResume && (
        <Button variant="outline" size="sm" onClick={onResume}>
          <Play className="h-4 w-4 mr-2" />
          Resume
        </Button>
      )}
      {isCompleted && onDownloadFile && (
        <Button variant="default" size="sm" onClick={onDownloadFile}>
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isError && onRetry && (
            <DropdownMenuItem onSelect={onRetry}>
              <RotateCcw className="mr-2 h-4 w-4" />
              <span>Retry</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onCancel}>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Cancel</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}