import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Book, Download, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { UrlInput } from "@/components/url-input";
import { FormatSelector } from "@/components/format-selector";
import { ChapterList } from "@/components/chapter-list";
import { MetadataDisplay } from "@/components/metadata-display";
import { SettingsPanel } from "@/components/settings-panel";
import { DownloadQueue } from "@/components/download-queue";
import { EmptyState } from "@/components/empty-state";
import type {
  DownloadJob,
  BookMetadata,
  OutputFormatType,
  DownloadSettings,
  AnalyzeResponse,
} from "@shared/schema";
import { defaultSettings } from "@shared/schema";

export default function Home() {
  const [currentJob, setCurrentJob] = useState<DownloadJob | null>(null);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormatType>("epub");
  const [settings, setSettings] = useState<DownloadSettings>(defaultSettings);
  const [editableMetadata, setEditableMetadata] = useState<Partial<BookMetadata>>({});
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageJobId, setImageJobId] = useState<string | null>(null);

  const { toast } = useToast();

  const { data: downloadJobs = [] } = useQuery<DownloadJob[]>({
    queryKey: ["/api/jobs"],
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (!imageJobId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${imageJobId}/image-status`);
        if (!response.ok) {
          console.warn("[IMG-POLL] Status check failed:", response.status);
          return;
        }
        const data = await response.json();
        console.log("[IMG-POLL] Status:", data.state, "FinalUrl:", !!data.finalUrl);

        if (data.state === "success" && data.finalUrl) {
          setEditableMetadata(prev => ({ ...prev, coverUrl: data.finalUrl }));
          setImageLoaded(true);
          clearInterval(interval);
        } else if (data.state === "failed") {
          console.error("[IMG-POLL] Image validation failed:", data.error);
          setImageLoaded(true);
          clearInterval(interval);
        }
      } catch (error) {
        console.error("[IMG-POLL] Error checking image status:", error);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [imageJobId]);

  const analyzeMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/analyze", { url });
      return await response.json() as AnalyzeResponse;
    },
    onSuccess: (data) => {
      if (data.success && data.job) {
        setCurrentJob(data.job);
        setSelectedChapterIds(data.job.chapters.map((ch) => ch.id));
        setImageLoaded(false);
        if (data.job.metadata) {
          setOutputFormat(data.job.metadata.recommendedFormat);
          setEditableMetadata({
            title: data.job.metadata.title,
            author: data.job.metadata.author,
            description: data.job.metadata.description,
            coverUrl: data.job.metadata.coverUrl,
          });
          const imgJobId = (data.job.metadata as any).imageJobId;
          if (imgJobId) {
            setImageJobId(imgJobId);
          }
        }
        toast({ title: "Analysis Complete", description: `Found ${data.job.chapters.length} chapters` });
      } else {
        toast({ title: "Analysis Failed", description: data.message || "Could not analyze the URL", variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Analysis Failed", description: error.message || "Failed to analyze the URL", variant: "destructive" });
    },
  });

  const startDownloadMutation = useMutation({
    mutationFn: (variables: any) => apiRequest("POST", "/api/download", variables),
    onSuccess: (data, variables) => {
      toast({ title: "Download Started", description: "Your book is being created" });
      console.log("Download started for job:", variables.jobId);
    },
    onError: (error: Error) => {
      toast({ title: "Download Failed", description: error.message, variant: "destructive" });
    },
  });

  const [analysisProgress, setAnalysisProgress] = useState(0);

  useEffect(() => {
    const analyzingJob = downloadJobs.find((j) => j.status === "analyzing");
    if (analyzingJob) {
      setAnalysisProgress(analyzingJob.progress);
    }
  }, [downloadJobs]);

  const handleAnalyze = useCallback((url: string) => {
    analyzeMutation.mutate(url);
  }, [analyzeMutation]);

  const handleStartDownload = useCallback(() => {
    if (!currentJob) return;

    if (selectedChapterIds.length > 2000) {
      toast({
        title: "Too Many Chapters",
        description: "Downloads are limited to 2000 chapters maximum to ensure stability on mobile devices. Please select fewer chapters.",
        variant: "destructive",
      });
      return;
    }

    startDownloadMutation.mutate({
      jobId: currentJob.id,
      selectedChapterIds,
      outputFormat,
      metadata: editableMetadata,
      settings: {
        concurrentDownloads: settings.concurrentDownloads,
        delayBetweenRequests: settings.delayBetweenRequests,
        retryAttempts: settings.retryAttempts,
        includeImages: settings.includeImages,
        cleanupHtml: settings.cleanupHtml,
      },
    });

    setCurrentJob(null);
    setSelectedChapterIds([]);

  }, [currentJob, selectedChapterIds, outputFormat, editableMetadata, settings, startDownloadMutation, toast]);

  const handleCancelJob = useCallback(async (jobId: string) => {
    await apiRequest("POST", `/api/jobs/${jobId}/cancel`);
    toast({ title: "Job Cancelled", description: "The download has been cancelled." });
  }, [toast]);

  const handleClearCompleted = useCallback(async () => {
    await apiRequest("POST", "/api/jobs/clear-completed");
    toast({ title: "Queue Cleared", description: "Completed downloads have been cleared." });
  }, [toast]);

  const handleDownloadFile = useCallback((job: DownloadJob) => {
    if (job.status === "complete" && job.outputPath) {
      const url = `/api/download-file?path=${encodeURIComponent(job.outputPath)}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = job.outputPath.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, []);

  const handleSettingsChange = useCallback((newSettings: Partial<DownloadSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const handleMetadataChange = useCallback((newMetadata: Partial<BookMetadata>) => {
    setEditableMetadata((prev) => ({ ...prev, ...newMetadata }));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Book className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">WebToBook</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Web Novel to EPUB/PDF Converter
              </p>
            </div>
          </div>
          
          {downloadJobs.filter(j => ['analyzing', 'downloading', 'processing'].includes(j.status)).length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold shadow-lg">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 bg-white rounded-full animate-bounce"></span>
                <span className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
              <span className="text-sm font-bold">
                {downloadJobs.filter(j => ['analyzing', 'downloading', 'processing'].includes(j.status)).length} Processing
              </span>
            </div>
          )}
          
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <UrlInput
          onAnalyze={handleAnalyze}
          isLoading={analyzeMutation.isPending}
        />

        {analyzeMutation.isPending && (
          <div className="p-6 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">Analyzing URL and detecting chapters...</p>
              <p className="text-xs text-muted-foreground">{Math.round(analysisProgress)}%</p>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
          </div>
        )}

        {analyzeMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {analyzeMutation.error?.message || "Failed to analyze URL"}
            </AlertDescription>
          </Alert>
        )}

        {currentJob ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <ChapterList
                chapters={currentJob.chapters}
                selectedIds={selectedChapterIds}
                onSelectionChange={setSelectedChapterIds}
                isLoading={startDownloadMutation.isPending}
              />

              {currentJob.chapters.length > 2000 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Chapter Limit Warning</AlertTitle>
                  <AlertDescription>
                    This novel has {currentJob.chapters.length} chapters. Downloads are limited to 2000 chapters maximum to ensure stability and performance on mobile devices. Please select 2000 or fewer chapters to proceed.
                  </AlertDescription>
                </Alert>
              )}

              {selectedChapterIds.length > 2000 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Selection Exceeds Limit</AlertTitle>
                  <AlertDescription>
                    You have selected {selectedChapterIds.length} chapters, but the maximum allowed is 2000. Please deselect some chapters to continue.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-card-border bg-card">
                <div>
                  <p className="font-medium">
                    {selectedChapterIds.length} of {currentJob.chapters.length} chapters selected
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Output format: {outputFormat.toUpperCase()}
                  </p>
                </div>
                <Button
                  onClick={handleStartDownload}
                  disabled={selectedChapterIds.length === 0 || startDownloadMutation.isPending || (!imageLoaded && !!currentJob?.metadata?.coverUrl)}
                  className="gap-2"
                  data-testid="button-start-download"
                  title={!imageLoaded && currentJob?.metadata?.coverUrl ? "Waiting for cover image to load..." : ""}
                >
                  {startDownloadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Start Download
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              {currentJob.metadata && (
                <MetadataDisplay
                  metadata={{
                    ...currentJob.metadata,
                    ...editableMetadata,
                  }}
                  onImageLoaded={setImageLoaded}
                  onMetadataChange={handleMetadataChange}
                  editable
                />
              )}

              <FormatSelector
                selectedFormat={outputFormat}
                onFormatChange={setOutputFormat}
                recommendedFormat={currentJob.metadata?.recommendedFormat}
                contentType={currentJob.metadata?.detectedContentType}
              />

              <SettingsPanel
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
            </div>
          </div>
        ) : (
          !analyzeMutation.isPending && <EmptyState type="initial" />
        )}

        {downloadJobs.filter(j => 
          j.status !== "pending" && j.id !== currentJob?.id
        ).length > 0 && (
          <DownloadQueue
            jobs={downloadJobs.filter(j => 
              j.status !== "pending" && j.id !== currentJob?.id
            )}
            onCancel={handleCancelJob}
            onClearCompleted={handleClearCompleted}
            onDownloadFile={handleDownloadFile}
          />
        )}
      </main>

      <footer className="border-t border-border py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>WebToBook - Convert web content to portable book formats</p>
          <p className>Supports 500+ reading sites worldwide</p>
        </div>
      </footer>
    </div>
  );
}
