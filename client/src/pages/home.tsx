import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Book, Download, Loader2, AlertCircle, Sparkles, X } from "lucide-react";
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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; text: string; sender: 'user' | 'ai'; thinking?: string }>>([]);
  const [expandedThinking, setExpandedThinking] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [taskExecuting, setTaskExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState('');
  const [aiMode, setAiMode] = useState<'fast' | 'thinking'>('fast');
  const [notifiedJobIds, setNotifiedJobIds] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: downloadJobs = [] } = useQuery<DownloadJob[]>({
    queryKey: ["/api/jobs"],
    refetchInterval: 2000,
  });

  // Poll for image status when we have an imageJobId
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
          // Update metadata with the validated image
          setEditableMetadata(prev => ({
            ...prev,
            coverUrl: data.finalUrl
          }));
          setImageLoaded(true);
          clearInterval(interval);
        } else if (data.state === "failed") {
          console.error("[IMG-POLL] Image validation failed:", data.error);
          setImageLoaded(true); // Allow download even without image
          clearInterval(interval);
        }
      } catch (error) {
        console.error("[IMG-POLL] Error checking image status:", error);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [imageJobId]);

  // Auto-continue AI when analysis completes
  useEffect(() => {
    const analyzingJobs = downloadJobs.filter(j => j.status === 'analyzing');
    const completedJobs = downloadJobs.filter(j => 
      j.status === 'pending' && !notifiedJobIds.has(j.id) && j.chapters.length > 0
    );

    if (completedJobs.length > 0 && chatOpen) {
      const job = completedJobs[0];
      console.log("[AUTO-CONTINUE] Job analysis complete, notifying AI:", job.id);
      
      // Auto-send message to AI to continue
      const continueMessage = `Analysis complete! Found ${job.chapters.length} chapters. Please proceed with downloading chapters 1 through ${Math.min(50, job.chapters.length)} in EPUB format.`;
      setChatMessages(prev => [...prev, { id: Date.now().toString(), text: continueMessage, sender: 'user' as const }]);
      setChatInput('');
      setNotifiedJobIds(prev => {
        const newSet = new Set(prev);
        newSet.add(job.id);
        return newSet;
      });
      
      // Automatically send to AI
      setTimeout(() => {
        setChatLoading(true);
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: continueMessage,
            mode: aiMode,
            taskStatus: downloadJobs.map(j => ({ id: j.id, status: j.status, progress: j.progress })),
            history: [...chatMessages.map(m => ({ role: (m as any).sender === 'user' ? 'user' : 'assistant', content: m.text })), { role: 'user', content: continueMessage }]
          }),
        }).then(r => r.json()).then(data => {
          const aiReply = data.reply || 'Processing your request...';
          setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: aiReply, sender: 'ai', thinking: data.thinking }]);
        }).catch(err => {
          console.error("[AUTO-CONTINUE] Error:", err);
          setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: 'Error: Could not continue processing', sender: 'ai' }]);
        }).finally(() => setChatLoading(false));
      }, 500);
    }
  }, [downloadJobs, chatOpen, aiMode, notifiedJobIds, chatMessages]);

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
          // Start polling for image validation if imageJobId exists
          const imgJobId = (data.job.metadata as any).imageJobId;
          if (imgJobId) {
            setImageJobId(imgJobId);
          }
        }
        toast({
          title: "Analysis Complete",
          description: `Found ${data.job.chapters.length} chapters`,
        });
      } else {
        toast({
          title: "Analysis Failed",
          description: data.message || "Could not analyze the URL",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze the URL",
        variant: "destructive",
      });
    },
  });

  const [analysisProgress, setAnalysisProgress] = useState(0);

  useEffect(() => {
    const analyzingJob = downloadJobs.find((j) => j.status === "analyzing");
    if (analyzingJob) {
      setAnalysisProgress(analyzingJob.progress);
    }
  }, [downloadJobs]);

  const downloadMutation = useMutation({
    mutationFn: async (params: {
      jobId: string;
      selectedChapterIds: string[];
      outputFormat: OutputFormatType;
      metadata?: Partial<BookMetadata>;
      settings?: Partial<DownloadSettings>;
    }) => {
      const response = await apiRequest("POST", "/api/download", params);
      return await response.json() as { success: boolean; jobId: string; message?: string };
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        toast({
          title: "Download Started",
          description: "Your book is being processed",
        });
        setCurrentJob(null);
        setSelectedChapterIds([]);
      } else {
        toast({
          title: "Download Failed",
          description: data.message || "Failed to start download",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    
    downloadMutation.mutate({
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
  }, [currentJob, selectedChapterIds, outputFormat, editableMetadata, settings, downloadMutation, toast]);

  const handleDownloadFile = useCallback(async (job: DownloadJob) => {
    if (job.outputPath) {
      try {
        const response = await fetch(`/api/download-file/${job.id}`);
        if (!response.ok) throw new Error("Download failed");
        
        const blob = await response.blob();
        const contentDisposition = response.headers.get("content-disposition") || "";
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `book.${job.outputFormat}`;
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Download Started",
          description: `${filename} is downloading to your device`,
        });
      } catch (error) {
        toast({
          title: "Download Failed",
          description: "Could not download the file. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleCancelJob = useCallback(async (jobId: string) => {
    try {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/cancel`, {});
      await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Download Cancelled",
        description: "The download has been cancelled",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to cancel download",
        variant: "destructive",
      });
    }
  }, [queryClient, toast]);

  const handleClearCompleted = useCallback(async () => {
    try {
      const response = await apiRequest("POST", "/api/jobs/clear-completed", {});
      await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch {
      toast({
        title: "Error",
        description: "Failed to clear completed downloads",
        variant: "destructive",
      });
    }
  }, [queryClient, toast]);

  const handleSettingsChange = useCallback((newSettings: Partial<DownloadSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const handleMetadataChange = useCallback((newMetadata: Partial<BookMetadata>) => {
    setEditableMetadata((prev) => ({ ...prev, ...newMetadata }));
  }, []);

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    const updatedMessages = [...chatMessages, { id: Date.now().toString(), text: userMessage, sender: 'user' as const }];
    setChatInput('');
    setChatMessages(updatedMessages);
    setChatLoading(true);

    try {
      setTaskExecuting(true);
      setExecutionStatus('Sending request to AI...');
      
      // Force immediate refetch of jobs to show analyzing indicator
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          mode: aiMode,
          taskStatus: downloadJobs.map(j => ({ id: j.id, status: j.status, progress: j.progress })),
          history: updatedMessages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chat error');
      const aiReply = data.reply || 'Sorry, I encountered an error.';
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: aiReply, sender: 'ai', thinking: data.thinking }]);
      setExecutionStatus('');
      
      // Refetch jobs again after AI response to show updated status
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: `Error: ${errorMsg}`, sender: 'ai' }]);
      setExecutionStatus('');
    } finally {
      setChatLoading(false);
      setTaskExecuting(false);
    }
  }, [chatInput, chatMessages, downloadJobs, aiMode, queryClient]);

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
          
          {/* Background Task Indicator - Visible & Prominent */}
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
                isLoading={downloadMutation.isPending}
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
                  disabled={selectedChapterIds.length === 0 || downloadMutation.isPending || (!imageLoaded && !!currentJob?.metadata?.coverUrl)}
                  className="gap-2"
                  data-testid="button-start-download"
                  title={!imageLoaded && currentJob?.metadata?.coverUrl ? "Waiting for cover image to load..." : ""}
                >
                  {downloadMutation.isPending ? (
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
          <p className="mt-1">Supports 500+ reading sites worldwide</p>
        </div>
      </footer>

      {/* Floating AI Chat Button - Always fixed to bottom-left of viewport */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-8 left-8 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl flex items-center justify-center z-50 transition-all duration-200 hover-elevate active-elevate-2"
          style={{ position: 'fixed', bottom: '2rem', left: '2rem', zIndex: 50 }}
          aria-label="Open AI chat"
          data-testid="button-open-chat"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Chat Modal */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/35 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-background rounded-xl border border-border shadow-2xl w-full sm:w-96 max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between p-4 border-b border-border bg-card rounded-t-xl">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-base">AI Assistant</h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={aiMode === 'fast' ? 'default' : 'outline'}
                      className="h-6 px-2 text-xs"
                      onClick={() => setAiMode('fast')}
                      data-testid="button-mode-fast"
                    >
                      Fast ⚡
                    </Button>
                    <Button
                      size="sm"
                      variant={aiMode === 'thinking' ? 'default' : 'outline'}
                      className="h-6 px-2 text-xs"
                      onClick={() => setAiMode('thinking')}
                      data-testid="button-mode-thinking"
                    >
                      Thinking 🧠
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Task Status in Chat Header */}
              {downloadJobs.filter(j => ['analyzing', 'downloading', 'processing'].includes(j.status)).length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-orange-500/20 border border-orange-500/40 ml-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                  <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                    {downloadJobs.filter(j => ['analyzing', 'downloading', 'processing'].includes(j.status)).length} running
                  </span>
                </div>
              )}
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                data-testid="button-close-chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  Ask me anything about your books or the app!
                </p>
              )}
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} flex-col`}>
                  {msg.thinking && (
                    <div className="mb-2 max-w-xs">
                      <button
                        onClick={() => setExpandedThinking(expandedThinking === msg.id ? null : msg.id)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        data-testid="button-toggle-thinking"
                      >
                        {expandedThinking === msg.id ? '▼' : '▶'} 💭 AI Thinking Process
                      </button>
                      {expandedThinking === msg.id && (
                        <div className="mt-1 p-2 rounded bg-muted/50 text-xs text-muted-foreground border border-border/50 max-h-40 overflow-y-auto">
                          {msg.thinking}
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-secondary text-secondary-foreground rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {(chatLoading || taskExecuting) && (
                <div className="flex justify-start flex-col gap-2">
                  {executionStatus && (
                    <div className="text-xs text-muted-foreground italic">
                      {executionStatus}
                    </div>
                  )}
                  <div className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg rounded-bl-none text-sm">
                    <span className="inline-flex gap-1">
                      <span className="w-2 h-2 bg-current rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border p-4 bg-card rounded-b-xl flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSendChat()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                disabled={chatLoading}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSendChat}
                disabled={chatLoading || !chatInput.trim()}
                size="default"
                className="gap-2"
                data-testid="button-send-chat"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
