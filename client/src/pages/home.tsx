import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { UrlInput } from "@/components/url-input";
import { MetadataDisplay } from "@/components/metadata-display";
import { ChapterList } from "@/components/chapter-list";
import { FormatSelector } from "@/components/format-selector";
import { DownloadQueue } from "@/components/download-queue";
import { EmptyState } from "@/components/empty-state";
import { SettingsPanel } from "@/components/settings-panel";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarClose, SidebarTrigger, } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";

import { Download, Loader2, Book, Settings, ArrowLeft } from "lucide-react";

import type { DownloadJob, BookMetadata, Chapter } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export function HomePage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<BookMetadata | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [outputFormat, setOutputFormat] = useState<any>("epub");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState<boolean | string>(false);

  const { data: downloadJobs = [] } = useQuery<DownloadJob[]>({
    queryKey: ["downloads"],
    queryFn: async () => {
      const response = await fetch("/api/downloads");
      if (!response.ok) {
        throw new Error("Failed to fetch download jobs");
      }
      return response.json();
    },
    refetchInterval: 2000, // Refetch every 2 seconds
  });

  const resetState = useCallback(() => {
    setUrl("");
    setJobId(null);
    setMetadata(null);
    setChapters([]);
    setSelectedChapterIds([]);
    setIsAnalyzing(false);
    setIsDownloading(false);
    setIsImageLoaded(false);
  }, []);

  const handleAnalyze = async () => {
    if (!url) return;
    setIsAnalyzing(true);
    setMetadata(null);
    setChapters([]);
    setSelectedChapterIds([]);
    setJobId(null);
    setIsImageLoaded(false);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to analyze URL");
      }

      const data = await response.json();
      setJobId(data.job.id);
      setMetadata(data.job.metadata);
      setChapters(data.job.chapters);
      setSelectedChapterIds(data.job.chapters.map((c: Chapter) => c.id));
      if (data.job.metadata.recommendedFormat) {
        setOutputFormat(data.job.metadata.recommendedFormat);
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Error Analyzing URL",
        description: error.message,
        variant: "destructive",
      });
      resetState();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartDownload = async () => {
    if (!jobId || !selectedChapterIds.length) return;

    setIsDownloading(true);

    try {
      const response = await fetch(`/api/download/${jobId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            selectedChapterIds,
            outputFormat,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to start download");
      }

      toast({
        title: "Download Started",
        description: `Your book is being downloaded.`,
      });
      resetState(); // Clear the main interface
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Error Starting Download",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancelDownload = async (id: string) => {
    try {
      const res = await fetch(`/api/download/${id}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to cancel download');
      queryClient.invalidateQueries({ queryKey: ['downloads']});
      toast({ description: 'Download canceled.'});
    } catch (err: any) {
      toast({ description: err.message, variant: 'destructive' });
    }
  };
  
  const handlePauseDownload = async (id: string) => {
    try {
      const res = await fetch(`/api/download/${id}/pause`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pause download');
      queryClient.invalidateQueries({ queryKey: ['downloads']});
      toast({ description: 'Download paused.'});
    } catch (err: any) {
      toast({ description: err.message, variant: 'destructive' });
    }
  };
  
  const handleResumeDownload = async (id: string) => {
    try {
      const res = await fetch(`/api/download/${id}/resume`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to resume download');
      queryClient.invalidateQueries({ queryKey: ['downloads']});
      toast({ description: 'Download resumed.'});
    } catch (err: any) {
      toast({ description: err.message, variant: 'destructive' });
    }
  };

  const handleDownloadFile = (path: string | undefined) => {
    if (!path) return;
    const link = document.createElement('a');
    link.href = `/api/download/file/${encodeURIComponent(path)}`;
    link.download = path.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleChapterSelection = (chapterId: string) => {
    setSelectedChapterIds((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId]
    );
  };

  const handleSelectAllChapters = () => {
    setSelectedChapterIds(chapters.map((c) => c.id));
  };

  const handleDeselectAllChapters = () => {
    setSelectedChapterIds([]);
  };

  const handleMetadataChange = (updatedMetadata: Partial<BookMetadata>) => {
    setMetadata((prev) => prev ? { ...prev, ...updatedMetadata } : null);
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text");
      if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
        setUrl(text);
        toast({
          title: "URL Pasted",
          description: "URL from clipboard has been pasted automatically.",
        });
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [toast]);

  const renderContent = () => {
    if (isAnalyzing) {
      return (
        <motion.div
          key="analyzing"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="text-center space-y-2 flex flex-col items-center justify-center pt-16"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Analyzing URL...</p>
          <p className="text-sm text-muted-foreground/80 max-w-sm">
            Please wait while we analyze the content, parse chapters, and fetch
            metadata. This may take a moment.
          </p>
        </motion.div>
      );
    }

    if (metadata && chapters.length > 0) {
      return (
        <motion.div
          key="metadata"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
        >
          <div className="md:col-span-1 space-y-4">
            <MetadataDisplay metadata={metadata} editable onMetadataChange={handleMetadataChange} onImageLoaded={setIsImageLoaded} />
            <FormatSelector
              value={outputFormat}
              onValueChange={setOutputFormat}
            />
            <Button
              onClick={handleStartDownload}
              disabled={isDownloading || selectedChapterIds.length === 0 || !isImageLoaded}
              className="w-full text-base font-bold p-6"
              size="lg"
            >
              {isDownloading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Download className="h-5 w-5 mr-2" />
              )}
              Download ({selectedChapterIds.length} Chapters)
            </Button>
          </div>
          <div className="md:col-span-2">
            <ChapterList
              chapters={chapters}
              selectedChapterIds={selectedChapterIds}
              onChapterSelection={handleChapterSelection}
              onSelectAll={handleSelectAllChapters}
              onDeselectAll={handleDeselectAllChapters}
            />
          </div>
        </motion.div>
      );
    }

    return (
      <div className="pt-16">
        <AnimatePresence>
          {downloadJobs.length > 0 ? (
             <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -20 }}
           >
            <DownloadQueue 
              jobs={downloadJobs} 
              onCancel={handleCancelDownload}
              onPause={handlePauseDownload}
              onResume={handleResumeDownload}
              onDownloadFile={(job) => handleDownloadFile(job.outputPath)}
            />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <EmptyState />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex-1 flex flex-col">
      <Sidebar isOpen={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SidebarContent position="left" className="p-0">
          <SidebarHeader className="p-4 border-b border-card-border">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Settings className="h-5 w-5"/> Settings</h2>
          </SidebarHeader>
          <div className="p-4">
            <SettingsPanel />
          </div>
          <SidebarFooter className="p-4 mt-auto border-t border-card-border">
            <p className="text-xs text-muted-foreground">v1.0.0</p>
          </SidebarFooter>
        </SidebarContent>
      </Sidebar>

      <header className="flex items-center justify-between mb-6 md:mb-8">
        <div className="flex items-center gap-2">
        {metadata && (
          <Button variant="outline" size="icon" onClick={resetState} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Book className="h-6 w-6 text-primary" /> WebNovel Archiver
        </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">View All Downloads</Button>
          <SidebarTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </SidebarTrigger>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {!metadata && (
          <div className="max-w-2xl mx-auto w-full mb-8">
            <UrlInput
              url={url}
              onUrlChange={setUrl}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
            />
          </div>
        )}
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>
    </div>
  );
}
