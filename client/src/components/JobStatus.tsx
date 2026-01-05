import { Badge } from "@/components/ui/badge";
import type { DownloadStatusType } from "../../../shared/schema";

interface JobStatusProps {
  status: DownloadStatusType;
}

const statusVariantMap: Record<
  DownloadStatusType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  analyzing: "outline",
  downloading: "outline",
  processing: "outline",
  complete: "default",
  error: "destructive",
  paused: "secondary",
  canceled: "secondary",
};

export default function JobStatus({ status }: JobStatusProps) {
  return (
    <Badge variant={statusVariantMap[status]} className="capitalize text-xs">
      {status}
    </Badge>
  );
}