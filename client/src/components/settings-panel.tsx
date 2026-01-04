import { Settings, Zap, RefreshCw, Clock, Image, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { DownloadSettings } from "@shared/schema";

interface SettingsPanelProps {
  settings: DownloadSettings;
  onSettingsChange: (settings: Partial<DownloadSettings>) => void;
}

export function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  return (
    <Card className="border-card-border">
      <Accordion type="single" collapsible defaultValue="settings">
        <AccordionItem value="settings" className="border-0">
          <CardHeader className="pb-0">
            <AccordionTrigger className="hover:no-underline py-0">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Download Settings
              </CardTitle>
            </AccordionTrigger>
          </CardHeader>
          <AccordionContent>
            <CardContent className="pt-4 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm flex items-center gap-2">
                      <Zap className="h-3 w-3" />
                      Concurrent Downloads
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      More = faster, but may trigger rate limits
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[settings.concurrentDownloads]}
                      onValueChange={([value]) =>
                        onSettingsChange({ concurrentDownloads: value })
                      }
                      min={1}
                      max={10}
                      step={1}
                      className="w-24"
                      data-testid="slider-concurrent"
                    />
                    <span className="text-sm font-mono w-6 text-right">
                      {settings.concurrentDownloads}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Request Delay
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Delay between requests (ms)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[settings.delayBetweenRequests]}
                      onValueChange={([value]) =>
                        onSettingsChange({ delayBetweenRequests: value })
                      }
                      min={0}
                      max={2000}
                      step={100}
                      className="w-24"
                      data-testid="slider-delay"
                    />
                    <span className="text-sm font-mono w-12 text-right">
                      {settings.delayBetweenRequests}ms
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm flex items-center gap-2">
                      <RefreshCw className="h-3 w-3" />
                      Retry Attempts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Retries on failed downloads
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[settings.retryAttempts]}
                      onValueChange={([value]) =>
                        onSettingsChange({ retryAttempts: value })
                      }
                      min={1}
                      max={5}
                      step={1}
                      className="w-24"
                      data-testid="slider-retry"
                    />
                    <span className="text-sm font-mono w-6 text-right">
                      {settings.retryAttempts}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-card-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm flex items-center gap-2">
                      <Image className="h-3 w-3" />
                      Include Images
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Download and embed images in output
                    </p>
                  </div>
                  <Switch
                    checked={settings.includeImages}
                    onCheckedChange={(checked) =>
                      onSettingsChange({ includeImages: checked })
                    }
                    data-testid="switch-images"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm flex items-center gap-2">
                      <Sparkles className="h-3 w-3" />
                      Clean HTML
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Remove ads, scripts, and unwanted elements
                    </p>
                  </div>
                  <Switch
                    checked={settings.cleanupHtml}
                    onCheckedChange={(checked) =>
                      onSettingsChange({ cleanupHtml: checked })
                    }
                    data-testid="switch-cleanup"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm flex items-center gap-2">
                      <Zap className="h-3 w-3" />
                      Auto-detect Format
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Recommend best format for content type
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoDetectFormat}
                    onCheckedChange={(checked) =>
                      onSettingsChange({ autoDetectFormat: checked })
                    }
                    data-testid="switch-auto-format"
                  />
                </div>
              </div>
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
