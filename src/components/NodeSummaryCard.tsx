/**
 * NodeSummaryCard — popup card showing details of the current campaign node.
 * Displays description, dialog lines / narrative text, and decision buttons.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
} from 'lucide-react';
import type { BaseFlowNode } from '@/lib/campaign-editor/types/base';

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
  const nodeType = node.nodeType || 'encounter';
  const description = node.nodeData.description;

  // Collect dialog/narrative lines from unified or legacy fields
  const dialogLines =
    node.dialogLines ||
    node.dialogContent?.lines ||
    node.cutsceneContent?.lines ||
    [];

  const prologue = node.prologue;
  const hasTextContent = dialogLines.length > 0 || !!prologue;
  const isDialog = nodeType === 'dialog' && decisionOutcomes.length > 0;

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[380px] max-w-[90vw] bg-card border border-border rounded-lg shadow-xl z-[31001] pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
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

      {/* Body */}
      <ScrollArea className="max-h-[300px]">
        <div className="px-3 py-2 space-y-3">
          {/* Description */}
          {description && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Description</p>
              <div className="text-sm text-foreground">
                <MarkdownRenderer content={description} />
              </div>
            </div>
          )}

          {/* Prologue */}
          {prologue && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Prologue</p>
              <div className="text-sm text-foreground italic">
                <MarkdownRenderer content={prologue} />
              </div>
            </div>
          )}

          {/* Dialog / Narrative lines */}
          {dialogLines.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {nodeType === 'dialog' ? 'Dialog' : 'Narrative'}
              </p>
              <div className="space-y-1.5">
                {dialogLines.map((line, i) => (
                  <div key={i} className="text-sm">
                    {line.speaker && (
                      <span className="font-semibold text-primary mr-1">{line.speaker}:</span>
                    )}
                    <span className="text-foreground">{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!description && !hasTextContent && (
            <p className="text-xs text-muted-foreground italic">No description or text content for this node.</p>
          )}
        </div>
      </ScrollArea>

      {/* Decision buttons */}
      {isDialog && (
        <div className="px-3 py-2 border-t border-border">
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
