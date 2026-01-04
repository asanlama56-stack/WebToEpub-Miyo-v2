import { useState } from "react";
import { Book, User, Globe, FileText, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BookMetadata } from "@shared/schema";

interface MetadataDisplayProps {
  metadata: BookMetadata;
  onMetadataChange?: (metadata: Partial<BookMetadata>) => void;
  editable?: boolean;
  onImageLoaded?: (loaded: boolean) => void;
}

const contentTypeLabels = {
  novel: "Novel / Fiction",
  technical: "Technical / Non-Fiction",
  article: "Article / Blog",
  unknown: "Unknown",
};

export function MetadataDisplay({
  metadata,
  onMetadataChange,
  editable = false,
  onImageLoaded,
}: MetadataDisplayProps) {
  const [imageLoadState, setImageLoadState] = useState<'loading' | 'success' | 'failed'>('loading');
  return (
    <Card className="border-card-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Book className="h-4 w-4 text-primary" />
          Book Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          {metadata.coverUrl ? (
            <div className="flex-shrink-0">
              <img
                src={metadata.coverUrl}
                alt="Book cover"
                className="w-24 h-36 object-cover rounded-md border border-card-border"
                data-testid="img-book-cover"
                onError={(e) => {
                  console.error("[UI] Cover image failed to load:", metadata.coverUrl, e);
                  setImageLoadState('failed');
                  onImageLoaded?.(false);
                  if (metadata.proxyUrl && metadata.proxyUrl !== metadata.coverUrl) {
                    console.log("[UI] Attempting fallback to proxy URL:", metadata.proxyUrl);
                    (e.target as HTMLImageElement).src = metadata.proxyUrl;
                  }
                }}
                onLoad={() => {
                  console.log("[UI] Cover loaded OK:", metadata.coverUrl);
                  setImageLoadState('success');
                  onImageLoaded?.(true);
                }}
              />
            </div>
          ) : (
            <div className="w-24 h-36 rounded-md border border-dashed border-card-border flex items-center justify-center bg-muted/30">
              {imageLoadState === 'loading' ? (
                <div className="text-xs text-muted-foreground text-center px-2">Loading cover...</div>
              ) : imageLoadState === 'success' ? (
                <div className="text-xs text-green-600 text-center font-semibold">✓ Loaded</div>
              ) : (
                <Book className="h-8 w-8 text-muted-foreground/50" />
              )}
            </div>
          )}

          <div className="flex-1 space-y-3 min-w-0">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Title</Label>
              {editable && onMetadataChange ? (
                <Input
                  value={metadata.title}
                  onChange={(e) => onMetadataChange({ title: e.target.value })}
                  className="font-semibold w-full"
                  data-testid="input-metadata-title"
                />
              ) : (
                <p className="font-semibold text-sm break-words line-clamp-2 w-full" data-testid="text-metadata-title">
                  {metadata.title}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Author
              </Label>
              {editable && onMetadataChange ? (
                <Input
                  value={metadata.author}
                  onChange={(e) => onMetadataChange({ author: e.target.value })}
                  data-testid="input-metadata-author"
                />
              ) : (
                <p className="text-sm" data-testid="text-metadata-author">
                  {metadata.author || "Unknown Author"}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs gap-1">
                <FileText className="h-3 w-3" />
                {metadata.totalChapters} chapters
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                {contentTypeLabels[metadata.detectedContentType]}
              </Badge>
              {metadata.language && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Globe className="h-3 w-3" />
                  {metadata.language}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {(metadata.description || editable) && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Description</Label>
            {editable && onMetadataChange ? (
              <Textarea
                value={metadata.description || ""}
                onChange={(e) => onMetadataChange({ description: e.target.value })}
                rows={3}
                className="resize-none text-sm"
                data-testid="input-metadata-description"
              />
            ) : metadata.description ? (
              <p className="text-sm text-muted-foreground line-clamp-3" data-testid="text-metadata-description">
                {metadata.description}
              </p>
            ) : null}
          </div>
        )}

        <div className="pt-2 border-t border-card-border">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Globe className="h-3 w-3" />
            <span className="font-mono truncate" data-testid="text-source-url">
              {metadata.sourceUrl}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
