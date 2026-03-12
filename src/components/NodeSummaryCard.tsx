/**
 * NodeSummaryCard — tabbed popup card showing details of the current campaign node.
 * Tabs: Summary | Dialog | Handouts | Loot
 * Choices pinned at the bottom outside tab content.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chatStore';
import {
  X,
  ChevronRight,
  Swords,
  ScrollText,
  MessageSquare,
  Tent,
  Send,
  SendHorizonal,
  BookOpen,
  Gem,
} from 'lucide-react';
import type { BaseFlowNode } from '@/lib/campaign-editor/types/base';
import { openHandoutById } from '@/lib/campaign-editor/adapters/magehand-ttrpg';

const NODE_ICONS: Record<string, React.ReactNode> = {
  encounter: <Swords className="h-4 w-4" />,
  narrative: <ScrollText className="h-4 w-4" />,
  dialog: <MessageSquare className="h-4 w-4" />,
  rest: <Tent className="h-4 w-4" />,
};

const NODE_TYPE_LABELS: Record<string, string> = {
  encounter: 'Encounter',
  narrative: 'Narrative',
  dialog: 'Dialog',
  rest: 'Rest',
};

interface DecisionOutcome {
  id: string;
  label: string;
  color: string;
  targetNodeId?: string;
  targetLabel?: string;
}

interface NodeSummaryCardProps {
  node: BaseFlowNode;
  decisionOutcomes: DecisionOutcome[];
  onChooseOutcome: (outcomeId: string, targetNodeId?: string) => void;
  onClose: () => void;
}

export function NodeSummaryCard({
  node,
  decisionOutcomes,
  onChooseOutcome,
  onClose,
}: NodeSummaryCardProps) {
  const addMessage = useChatStore((s) => s.addMessage);

  const nodeType = node.nodeType || 'encounter';
  const description = node.nodeData.description;
  const prologue = node.prologue;

  const dialogLines =
    node.dialogLines ||
    node.dialogContent?.lines ||
    node.cutsceneContent?.lines ||
    [];

  const handouts = node.handouts || [];
  const treasure = node.treasure || [];
  const isDialog = nodeType === 'dialog' && decisionOutcomes.length > 0;

  // Determine which tabs to show
  const hasDialogTab = dialogLines.length > 0;
  const hasHandoutsTab = handouts.length > 0;
  const hasLootTab = treasure.length > 0;

  const sendLineToChat = (line: { speaker?: string; text: string }) => {
    const speaker = line.speaker || node.nodeData.name || 'Narrator';
    addMessage('campaign-narrator', speaker, line.text);
  };

  const sendAllToChat = () => {
    dialogLines.forEach((line) => {
      const speaker = line.speaker || node.nodeData.name || 'Narrator';
      addMessage('campaign-narrator', speaker, line.text);
    });
  };

  const sendLootToChat = () => {
    const sceneName = node.nodeData.name || 'Treasure';
    const lines = treasure.map((item) => {
      const qty = item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : '';
      const desc = item.description ? ` — ${item.description}` : '';
      return `💎 **${item.name}**${qty}${desc}`;
    });
    addMessage('campaign-narrator', sceneName, `**Loot Found:**\n${lines.join('\n')}`);
  };

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[380px] max-w-[90vw] max-h-[70vh] bg-card border border-border rounded-lg shadow-xl z-[31001] pointer-events-auto overflow-hidden flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <span className="text-muted-foreground shrink-0">{NODE_ICONS[nodeType]}</span>
        <span className="text-sm font-semibold truncate flex-1">
          {node.nodeData.name}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {NODE_TYPE_LABELS[nodeType] ?? nodeType}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tabbed Body */}
      <Tabs defaultValue="summary" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="h-8 px-3 shrink-0 justify-start bg-transparent border-b border-border rounded-none">
          <TabsTrigger value="summary" className="text-xs h-7 px-2">Summary</TabsTrigger>
          {hasDialogTab && (
            <TabsTrigger value="dialog" className="text-xs h-7 px-2">
              {nodeType === 'dialog' ? 'Dialog' : 'Narrative'}
            </TabsTrigger>
          )}
          {hasHandoutsTab && (
            <TabsTrigger value="handouts" className="text-xs h-7 px-2">Handouts</TabsTrigger>
          )}
          {hasLootTab && (
            <TabsTrigger value="loot" className="text-xs h-7 px-2">Loot</TabsTrigger>
          )}
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full max-h-[40vh]">
            <div className="px-3 py-2 space-y-3">
              {description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Description</p>
                  <div className="text-sm text-foreground">
                    <MarkdownRenderer content={description} />
                  </div>
                </div>
              )}
              {prologue && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Prologue</p>
                  <div className="text-sm text-foreground italic">
                    <MarkdownRenderer content={prologue} />
                  </div>
                </div>
              )}
              {!description && !prologue && (
                <p className="text-xs text-muted-foreground italic">No description or prologue for this node.</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Dialog / Narrative Tab */}
        {hasDialogTab && (
          <TabsContent value="dialog" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full max-h-[40vh]">
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {nodeType === 'dialog' ? 'Dialog' : 'Narrative'}
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={sendAllToChat}
                      >
                        <SendHorizonal className="h-3 w-3 mr-0.5" />
                        Send All
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      Send all lines to chat
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="space-y-1">
                  {dialogLines.map((line, i) => (
                    <div key={i} className="flex items-start gap-1 group">
                      <div className="text-sm flex-1 min-w-0">
                        {line.speaker && (
                          <span className="font-semibold text-primary mr-1">{line.speaker}:</span>
                        )}
                        <span className="text-foreground">{line.text}</span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            onClick={() => sendLineToChat(line)}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={4}>
                          Send to chat as {line.speaker || 'Narrator'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        )}

        {/* Handouts Tab */}
        {hasHandoutsTab && (
          <TabsContent value="handouts" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full max-h-[40vh]">
              <div className="px-3 py-2 space-y-1.5">
                {handouts.map((h) => (
                  <Button
                    key={h.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start h-8 px-2 text-xs"
                    onClick={() => openHandoutById(h.handoutId, h.label)}
                    disabled={!h.handoutId}
                  >
                    <BookOpen className="h-3 w-3 mr-1.5 shrink-0" />
                    {h.label}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        )}

        {/* Loot Tab */}
        {hasLootTab && (
          <TabsContent value="loot" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full max-h-[40vh]">
              <div className="px-3 py-2 space-y-1.5">
                {treasure.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm p-1.5 rounded border border-border bg-muted/30">
                    <Gem className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{item.name}</span>
                    {item.quantity && item.quantity > 1 && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">×{item.quantity}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>

      {/* Decision buttons — pinned outside tabs */}
      {isDialog && (
        <div className="px-3 py-2 border-t border-border shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Choices</p>
          <div className="flex flex-wrap gap-1.5">
            {decisionOutcomes.map((outcome) => (
              <Button
                key={outcome.id}
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onChooseOutcome(outcome.id, outcome.targetNodeId)}
              >
                <ChevronRight className="h-3 w-3 mr-0.5" />
                {outcome.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
