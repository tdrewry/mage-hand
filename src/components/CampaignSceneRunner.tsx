/**
 * CampaignSceneRunner — persistent DM widget for advancing through campaign nodes.
 * Visible only when a campaign has active progress. Similar to the initiative panel.
 */

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCampaignStore } from '@/stores/campaignStore';
import { executeNode } from '@/lib/campaign-editor/adapters/magehand-ttrpg';
import { createGraphRunner } from '@/lib/campaign-editor/lib/graphRunner';
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

export function CampaignSceneRunner() {
  const {
    campaigns,
    activeCampaignId,
    activeProgress,
    setProgress,
    setActiveCampaign,
  } = useCampaignStore();

  const campaign = campaigns.find((c) => c.id === activeCampaignId) ?? null;

  // Build graph runner when campaign is active
  const runner = useMemo(() => {
    if (!campaign) return null;
    const r = createGraphRunner({
      campaign,
      onProgressUpdate: (p) => setProgress(p),
      onCampaignComplete: () => toast.success('🎉 Campaign complete!'),
      onCampaignFailed: () => toast.error('Campaign failed.'),
    });
    // Initialize with existing progress if available
    if (activeProgress) r.initialize(activeProgress);
    return r;
    // Only recreate when campaign identity changes, not on every progress update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id]);

  const currentNode = runner?.getCurrentNode() ?? null;
  const nodeType = currentNode?.nodeType || 'encounter';

  // For decision nodes, collect the outcome choices with their target node labels
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

  const handleExecuteCurrent = () => {
    if (!currentNode) return;
    executeNode(currentNode);
  };

  const handleResolveSuccess = () => {
    if (!currentNode) return;
    const newProgress = runner.resolveNode(currentNode.id, { outcome: 'success' });
    setProgress(newProgress);

    // Auto-execute the next node if there is one
    const nextNode = runner.getCurrentNode();
    if (nextNode) {
      executeNode(nextNode);
    }
  };

  const handleResolveFailure = () => {
    if (!currentNode) return;
    const newProgress = runner.resolveNode(currentNode.id, { outcome: 'failure' });
    setProgress(newProgress);
  };

  const handleChooseOutcome = (outcomeId: string, targetNodeId?: string) => {
    if (!currentNode) return;
    // Resolve as choice with the selected outcome
    const newProgress = runner.resolveNode(currentNode.id, {
      outcome: 'choice',
      choiceId: targetNodeId || outcomeId,
    });
    setProgress(newProgress);

    // Auto-execute the next node
    const nextNode = runner.getCurrentNode();
    if (nextNode) {
      executeNode(nextNode);
    }
  };

  const handleReset = () => {
    const newProgress = runner.reset();
    setProgress(newProgress);
    toast.info('Campaign progress reset');
  };

  const handleStop = () => {
    setActiveCampaign(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[31000] pointer-events-auto">
      <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 min-w-[320px] max-w-[640px] flex-wrap">
        {/* Campaign name */}
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
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-muted-foreground shrink-0">{NODE_ICONS[nodeType]}</span>
              <span className="text-sm font-medium truncate max-w-[140px]">
                {currentNode.nodeData.name}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Execute / activate current scene */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleExecuteCurrent}
                title="Activate this scene"
              >
                <Play className="h-3 w-3 mr-1" />
                Run
              </Button>

              {/* Decision node: show outcome branch buttons instead of success/fail */}
              {nodeType === 'dialog' && decisionOutcomes.length > 0 ? (
                <>
                  {decisionOutcomes.map((outcome) => (
                    <Button
                      key={outcome.id}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleChooseOutcome(outcome.id, outcome.targetNodeId)}
                      title={outcome.targetLabel ? `→ ${outcome.targetLabel}` : outcome.label}
                    >
                      <ChevronRight className="h-3 w-3 mr-0.5" />
                      {outcome.label}
                    </Button>
                  ))}
                </>
              ) : (
                <>
                  {/* Resolve success */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 hover:border-primary/50"
                    onClick={handleResolveSuccess}
                    title="Resolve as success → advance"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>

                  {/* Resolve failure */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:border-destructive/50"
                    onClick={handleResolveFailure}
                    title="Resolve as failure"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
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

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleReset}
            title="Reset progress"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive"
            onClick={handleStop}
            title="Stop campaign"
          >
            <Square className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
