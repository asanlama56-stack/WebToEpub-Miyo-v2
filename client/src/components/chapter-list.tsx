import { useState, useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  List,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Chapter, DownloadStatusType } from "@shared/schema";

interface ChapterListProps {
  chapters: Chapter[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isLoading?: boolean;
}

const statusIcons: Record<DownloadStatusType, typeof Circle> = {
  pending: Circle,
  analyzing: Loader2,
  downloading: Loader2,
  processing: Loader2,
  complete: CheckCircle2,
  error: AlertCircle,
  paused: Circle,
};

const statusColors: Record<DownloadStatusType, string> = {
  pending: "text-muted-foreground",
  analyzing: "text-primary animate-spin",
  downloading: "text-primary animate-spin",
  processing: "text-primary animate-spin",
  complete: "text-green-500",
  error: "text-destructive",
  paused: "text-yellow-500",
};

export function ChapterList({
  chapters,
  selectedIds,
  onSelectionChange,
  isLoading,
}: ChapterListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const query = searchQuery.toLowerCase();
    return chapters.filter((ch) => ch.title.toLowerCase().includes(query));
  }, [chapters, searchQuery]);

  const allSelected = filteredChapters.length > 0 && 
    filteredChapters.every((ch) => selectedIds.includes(ch.id));
  const someSelected = filteredChapters.some((ch) => selectedIds.includes(ch.id));

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => 
        !filteredChapters.some((ch) => ch.id === id)
      ));
    } else {
      const newIds = new Set(selectedIds);
      filteredChapters.forEach((ch) => newIds.add(ch.id));
      onSelectionChange(Array.from(newIds));
    }
  };

  const handleToggleChapter = (chapterId: string) => {
    if (selectedIds.includes(chapterId)) {
      onSelectionChange(selectedIds.filter((id) => id !== chapterId));
    } else {
      onSelectionChange([...selectedIds, chapterId]);
    }
  };

  const totalWordCount = useMemo(() => {
    return chapters
      .filter((ch) => selectedIds.includes(ch.id))
      .reduce((sum, ch) => sum + (ch.wordCount || 0), 0);
  }, [chapters, selectedIds]);

  if (chapters.length === 0) {
    return null;
  }

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Chapters
            </CardTitle>
            <Badge variant="secondary" className="font-mono text-xs">
              {selectedIds.length} / {chapters.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-chapters"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chapters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-chapter-search"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                data-testid="button-select-all"
              >
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </div>

          {totalWordCount > 0 && (
            <div className="text-xs text-muted-foreground">
              Estimated: ~{Math.round(totalWordCount / 1000)}k words
            </div>
          )}

          <ScrollArea className="h-80 rounded-md border border-card-border">
            <div className="p-1">
              {filteredChapters.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">No chapters match your search</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredChapters.map((chapter) => {
                    const StatusIcon = statusIcons[chapter.status];
                    const statusColor = statusColors[chapter.status];
                    const isSelected = selectedIds.includes(chapter.id);

                    return (
                      <label
                        key={chapter.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover-elevate ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                        data-testid={`chapter-row-${chapter.id}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleChapter(chapter.id)}
                          disabled={isLoading}
                          data-testid={`checkbox-chapter-${chapter.id}`}
                        />
                        <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusColor}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{chapter.title}</p>
                          {chapter.wordCount && (
                            <p className="text-xs text-muted-foreground">
                              ~{Math.round(chapter.wordCount / 1000)}k words
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          #{chapter.index + 1}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
