import { Book, Link2, Download, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  type: "initial" | "no-chapters" | "no-downloads";
}

export function EmptyState({ type }: EmptyStateProps) {
  const configs = {
    initial: {
      icon: Book,
      title: "Ready to Convert",
      description: "Enter a URL above to extract chapters from web novels, fiction sites, or any readable content.",
      features: [
        { icon: Link2, text: "Paste any book or novel URL" },
        { icon: Download, text: "Download as EPUB, PDF, or HTML" },
        { icon: ArrowRight, text: "Smart chapter detection" },
      ],
    },
    "no-chapters": {
      icon: Book,
      title: "No Chapters Detected",
      description: "We couldn't find any chapters on this page. Try a different URL or the main novel page.",
      features: [],
    },
    "no-downloads": {
      icon: Download,
      title: "No Active Downloads",
      description: "Start by analyzing a URL and selecting chapters to download.",
      features: [],
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center" data-testid={`empty-state-${type}`}>
      <div className="p-4 rounded-full bg-muted/50 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {config.description}
      </p>
      {config.features.length > 0 && (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          {config.features.map((feature, index) => {
            const FeatureIcon = feature.icon;
            return (
              <div key={index} className="flex items-center gap-2">
                <FeatureIcon className="h-4 w-4 text-primary" />
                <span>{feature.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
