import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { getHandoutById } from '@/lib/handouts';

interface HandoutViewerCardContentProps {
  handoutId: string;
}

export const HandoutViewerCardContent: React.FC<HandoutViewerCardContentProps> = ({ handoutId }) => {
  const entry = getHandoutById(handoutId);

  if (!entry) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Handout not found.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="pr-2">
        <MarkdownRenderer content={entry.markdown} />
      </div>
    </ScrollArea>
  );
};
