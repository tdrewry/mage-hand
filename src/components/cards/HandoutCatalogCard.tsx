import React from 'react';
import { BookOpen, Shield, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BUILTIN_HANDOUTS, type HandoutEntry } from '@/lib/handouts';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';

const ICON_MAP: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen className="h-4 w-4" />,
  Shield: <Shield className="h-4 w-4" />,
};

function getIcon(name: string) {
  return ICON_MAP[name] ?? <FileText className="h-4 w-4" />;
}

export const HandoutCatalogCardContent: React.FC = () => {
  const registerCard = useCardStore((s) => s.registerCard);
  const cards = useCardStore((s) => s.cards);
  const setVisibility = useCardStore((s) => s.setVisibility);

  const openHandout = (entry: HandoutEntry) => {
    // Check if a viewer for this handout already exists
    const existing = cards.find(
      (c) => c.type === CardType.HANDOUT_VIEWER && c.metadata?.handoutId === entry.id
    );
    if (existing) {
      setVisibility(existing.id, true);
      return;
    }

    registerCard({
      type: CardType.HANDOUT_VIEWER,
      title: entry.title,
      defaultPosition: {
        x: Math.min(window.innerWidth - 520, 380),
        y: 60,
      },
      defaultSize: { width: 500, height: 650 },
      minSize: { width: 360, height: 400 },
      isResizable: true,
      isClosable: true,
      defaultVisible: true,
      metadata: { handoutId: entry.id },
    });
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">
          Browse guides and reference documents.
        </p>

        {BUILTIN_HANDOUTS.map((entry) => {
          const isOpen = cards.some(
            (c) =>
              c.type === CardType.HANDOUT_VIEWER &&
              c.metadata?.handoutId === entry.id &&
              c.isVisible
          );

          return (
            <Button
              key={entry.id}
              variant={isOpen ? 'default' : 'outline'}
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => openHandout(entry)}
            >
              {getIcon(entry.icon)}
              <span className="flex-1 text-left">{entry.title}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5">
                {entry.category}
              </Badge>
            </Button>
          );
        })}
      </div>
    </ScrollArea>
  );
};
