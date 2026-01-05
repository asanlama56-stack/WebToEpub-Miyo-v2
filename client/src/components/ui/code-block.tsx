import { ScrollArea } from "@/components/ui/scroll-area";

interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CodeBlock({ children, ...props }: CodeBlockProps) {
  return (
    <div {...props}>
      <ScrollArea className="h-24 rounded-md border border-card-border p-2">
        {children}
      </ScrollArea>
    </div>
  );
}
