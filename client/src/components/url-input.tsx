import { useState } from "react";
import { Link2, Search, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface UrlInputProps {
  onAnalyze: (url: string) => void;
  isLoading: boolean;
}

export function UrlInput({ onAnalyze, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validateAndSubmit = () => {
    setError(null);
    
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    try {
      new URL(url);
      onAnalyze(url);
    } catch {
      setError("Please enter a valid URL (e.g., https://example.com/novel)");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      validateAndSubmit();
    }
  };

  return (
    <Card className="border-card-border">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-md bg-primary/10">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Enter Book URL</h2>
              <p className="text-xs text-muted-foreground">
                Paste a link to any web novel, book, or article
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Input
                type="url"
                placeholder="https://example.com/novel/chapter-list"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="h-12 pl-4 pr-4 text-base font-mono"
                data-testid="input-url"
              />
            </div>
            <Button
              onClick={validateAndSubmit}
              disabled={isLoading || !url.trim()}
              className="h-12 px-6 gap-2"
              data-testid="button-analyze"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1" data-testid="text-url-error">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>Supports 500+ reading sites including RoyalRoad, WebNovel, FanFiction, AO3, and more</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
