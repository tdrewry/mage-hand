/**
 * CampaignSceneRunner — persistent DM widget for advancing through campaign nodes.
 * Row 1: standard tools (name, current node, Run, ✓, ✗, Back, Reset, Stop)
 * Row 2 (conditional): decision choice buttons for dialog nodes
 * Clicking the node title opens a NodeSummaryCard popup.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCampaignStore } from '@/stores/campaignStore';
import { executeNode } from '@/lib/campaign-editor/adapters/magehand-ttrpg';
import { createGraphRunner } from '@/lib/campaign-editor/lib/graphRunner';
import { NodeSummaryCard } from '@/components/NodeSummaryCard';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  RotateCcw,
  Swords,
  ScrollText,
  MessageSquare,
  Tent,
  Play,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';

const NODE_ICONS: Record<string, React.ReactNode> = {
  encounter: <Swords className="h-3.5 w-3.5" />,
  narrative: <ScrollText className="h-3.5 w-3.5" />,
  dialog: <MessageSquare className="h-3.5 w-3.5" />,
  rest: <Tent className="h-3.5 w-3.5" />,
};

/* ── Tiny icon button with tooltip ── */
function IconBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 w-7 p-0 ${destructive ? 'text-destructive hover:border-destructive/50' : 'hover:border-primary/50'} ${className ?? ''}`}
          onClick={onClick}
          disabled={disabled}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function CampaignSceneRunner() {
  const {
    campaigns,
    activeCampaignId,
    activeProgress,
    setProgress,
    setActiveCampaign,
  } = useCampaignStore();

  const [showSummary, setShowSummary] = useState(false);

  const campaign = campaigns.find((c) => c.id === activeCampaignId) ?? null;

  const runner = useMemo(() => {
    if (!campaign) return null;
    const r = createGraphRunner({
      campaign,
      onProgressUpdate: (p) => setProgress(p),
      onCampaignComplete: () => toast.success('🎉 Campaign complete!'),
      onCampaignFailed: () => toast.error('Campaign failed.'),
    });
    if (activeProgress) r.initialize(activeProgress);
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id]);

  const currentNode = runner?.getCurrentNode() ?? null;
  const nodeType = currentNode?.nodeType || 'encounter';

  // Decision outcomes for dialog nodes
  const decisionOutcomes = useMemo(() => {
    if (!currentNode || nodeType !== 'dialog' || !campaign) return [];
    const outcomes = currentNode.outcomes || currentNode.dialogContent?.outcomes || [];
    return outcomes.map((o) => {
      const targetNode = o.targetNodeId ? campaign.nodes.find((n) => n.id === o.targetNodeId) : null;
      return { ...o, targetLabel: targetNode?.nodeData.name };
    });
  }, [currentNode?.id, nodeType, campaign]);

  if (!campaign || !activeProgress || !runner) return null;

  const isComplete = activeProgress.isComplete || activeProgress.isFailed;
  const completedCount = activeProgress.completedNodeIds.length;
  const totalCount = campaign.nodes.length;
  const canGoBack = runner.canGoBack();

  const handleExecuteCurrent = () => {
    if (!currentNode) return;
    executeNode(currentNode);
  };

  const handleResolveSuccess = () => {
    if (!currentNode) return;
    const newProgress = runner.resolveNode(currentNode.id, { outcome: 'success' });
    setProgress(newProgress);
    setShowSummary(false);
    const nextNode = runner.getCurrentNode();
    if (nextNode) executeNode(nextNode);
  };

  const handleResolveFailure = () => {
    if (!currentNode) return;
    const newProgress = runner.resolveNode(currentNode.id, { outcome: 'failure' });
    setProgress(newProgress);
    setShowSummary(false);
  };

  const handleChooseOutcome = (outcomeId: string, targetNodeId?: string) => {
    if (!currentNode) return;
    const newProgress = runner.resolveNode(currentNode.id, {
      outcome: 'choice',
      choiceId: targetNodeId || outcomeId,
    });
    setProgress(newProgress);
    setShowSummary(false);
    const nextNode = runner.getCurrentNode();
    if (nextNode) executeNode(nextNode);
  };

  const handleBack = () => {
    const newProgress = runner.goBack();
    setProgress(newProgress);
    setShowSummary(false);
    toast.info('Returned to previous node');
  };

  const handleReset = () => {
    const newProgress = runner.reset();
    setProgress(newProgress);
    setShowSummary(false);
    toast.info('Campaign progress reset');
  };

  const handleStop = () => {
    setActiveCampaign(null);
  };

  const showDecisionRow =
    !isComplete && currentNode && nodeType === 'dialog' && decisionOutcomes.length > 0;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[31000] pointer-events-auto">
      {/* Node Summary Card popup (above the widget) */}
      {showSummary && currentNode && !isComplete && (
        <NodeSummaryCard
          node={currentNode}
          decisionOutcomes={decisionOutcomes}
          onChooseOutcome={handleChooseOutcome}
          onClose={() => setShowSummary(false)}
        />
      )}

      <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 flex flex-col gap-1.5 min-w-[320px] max-w-[640px]">
        {/* ── Row 1: Standard tools ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Campaign name + progress */}
          <div className="flex items-center gap-1.5 min-w-0 shrink">
            <span className="text-xs font-medium text-muted-foreground truncate max-w-[100px]">
              {campaign.name}
            </span>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {completedCount}/{totalCount}
            </Badge>
          </div>

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Current scene info */}
          {currentNode && !isComplete ? (
            <>
              <button
                type="button"
                className="flex items-center gap-1.5 min-w-0 hover:bg-accent/50 rounded px-1 py-0.5 -mx-1 transition-colors cursor-pointer"
                onClick={() => setShowSummary((v) => !v)}
                title="Click to view node details"
              >
                <span className="text-muted-foreground shrink-0">{NODE_ICONS[nodeType]}</span>
                <span className="text-sm font-medium truncate max-w-[140px] underline decoration-dotted underline-offset-2">
                  {currentNode.nodeData.name}
                </span>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                {/* Run */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={handleExecuteCurrent}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Run
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    Activate this scene
                  </TooltipContent>
                </Tooltip>

                {/* Success */}
                <IconBtn icon={Check} label="Resolve as success → advance" onClick={handleResolveSuccess} />

                {/* Failure */}
                <IconBtn icon={X} label="Resolve as failure" onClick={handleResolveFailure} destructive />
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {isComplete
                ? activeProgress.isFailed
                  ? 'Campaign failed'
                  : 'Campaign complete!'
                : 'No active scene'}
            </span>
          )}

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Standard controls: Back, Reset, Stop */}
          <div className="flex items-center gap-1 shrink-0">
            <IconBtn icon={ChevronLeft} label="Go back to previous node" onClick={handleBack} disabled={!canGoBack} />
            <IconBtn icon={RotateCcw} label="Reset progress" onClick={handleReset} />
            <IconBtn icon={Square} label="Stop campaign" onClick={handleStop} destructive className="[&_svg]:h-3 [&_svg]:w-3" />
          </div>
        </div>

        {/* ── Row 2: Decision choices (only for dialog nodes) ── */}
        {showDecisionRow && (
          <div className="flex items-center gap-1.5 flex-wrap border-t border-border pt-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Choices</span>
            {decisionOutcomes.map((outcome) => (
              <Tooltip key={outcome.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleChooseOutcome(outcome.id, outcome.targetNodeId)}
                  >
                    <ChevronRight className="h-3 w-3 mr-0.5" />
                    {outcome.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {outcome.targetLabel ? `→ ${outcome.targetLabel}` : outcome.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
