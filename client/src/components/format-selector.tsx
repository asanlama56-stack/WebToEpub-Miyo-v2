import { FileText, FileType, Globe, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { OutputFormatType, ContentTypeType } from "@shared/schema";

interface FormatSelectorProps {
  selectedFormat: OutputFormatType;
  onFormatChange: (format: OutputFormatType) => void;
  recommendedFormat?: OutputFormatType;
  contentType?: ContentTypeType;
}

const formatDetails = {
  epub: {
    icon: FileText,
    name: "EPUB",
    description: "Best for e-readers and novels",
    features: ["Reflowable text", "E-reader compatible", "Small file size"],
  },
  pdf: {
    icon: FileType,
    name: "PDF",
    description: "Best for technical content with fixed layouts",
    features: ["Fixed layout", "Print-ready", "Universal format"],
  },
  html: {
    icon: Globe,
    name: "HTML",
    description: "Web-ready format for online reading",
    features: ["Browser viewing", "Easy editing", "Lightweight"],
  },
};

export function FormatSelector({
  selectedFormat,
  onFormatChange,
  recommendedFormat,
  contentType,
}: FormatSelectorProps) {
  return (
    <Card className="border-card-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileType className="h-4 w-4 text-primary" />
          Output Format
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recommendedFormat && (
          <div className="mb-4 p-3 rounded-md bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 text-sm">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span className="font-medium">Recommended:</span>
              <Badge variant="secondary" className="text-xs">
                {formatDetails[recommendedFormat].name}
              </Badge>
              {contentType && contentType !== "unknown" && (
                <span className="text-muted-foreground">
                  for {contentType} content
                </span>
              )}
            </div>
          </div>
        )}

        <RadioGroup
          value={selectedFormat}
          onValueChange={(value) => onFormatChange(value as OutputFormatType)}
          className="grid gap-3"
        >
          {(Object.keys(formatDetails) as OutputFormatType[]).map((format) => {
            const details = formatDetails[format];
            const Icon = details.icon;
            const isRecommended = format === recommendedFormat;

            return (
              <Label
                key={format}
                htmlFor={`format-${format}`}
                className={`flex items-start gap-4 p-4 rounded-md border cursor-pointer transition-colors hover-elevate ${
                  selectedFormat === format
                    ? "border-primary bg-primary/5"
                    : "border-card-border"
                }`}
                data-testid={`format-option-${format}`}
              >
                <RadioGroupItem
                  value={format}
                  id={`format-${format}`}
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{details.name}</span>
                    {isRecommended && (
                      <Badge variant="outline" className="text-xs">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {details.description}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {details.features.map((feature) => (
                      <Badge
                        key={feature}
                        variant="secondary"
                        className="text-xs font-normal"
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Label>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
