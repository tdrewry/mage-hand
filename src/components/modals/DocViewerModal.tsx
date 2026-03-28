import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ArrowLeft, BookOpen } from 'lucide-react';

export interface DocEntry {
  id: string;
  title: string;
  markdown: string;
  icon?: React.ReactNode;
}

interface DocViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocEntry | null;
}

/**
 * Full-screen-ish modal that renders a Magehand markdown guide.
 * Uses the shared MarkdownRenderer for consistent styling.
 * Close / back button returns the user to wherever they opened it from.
 */
export function DocViewerModal({ open, onOpenChange, doc }: DocViewerModalProps) {
  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          max-w-3xl w-full h-[85vh] flex flex-col p-0 gap-0
          bg-background/95 backdrop-blur-2xl border border-white/10
          shadow-2xl rounded-2xl overflow-hidden
        "
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 flex flex-row items-center gap-3 px-6 py-4 border-b border-white/10 bg-black/20">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            {doc.icon ?? <BookOpen className="w-4 h-4 text-primary" />}
          </div>
          <DialogTitle className="flex-1 text-base font-bold text-foreground truncate">
            {doc.title}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
        </DialogHeader>

        {/* Scrollable markdown body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-8 py-6">
            <MarkdownRenderer content={doc.markdown} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
