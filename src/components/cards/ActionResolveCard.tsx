import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Shield, Swords, Activity, Check } from 'lucide-react';
import type { ResolutionPayload } from '@/lib/rules-engine/types';
import { useActionStore } from '@/stores/actionStore';

interface ActionResolveCardProps {
  payload: ResolutionPayload;
  onClose: () => void;
}

export function ActionResolveCard({ payload, onClose }: ActionResolveCardProps) {
  // Local state to track any DM overrides of the payload before applying
  const [localPayload, setLocalPayload] = useState<ResolutionPayload>(payload);

  const handleOverrideDamage = (targetId: string, damageKey: string, newAmount: number) => {
    setLocalPayload(prev => {
      const next = { ...prev, targetResults: { ...prev.targetResults } };
      const targetData = { ...next.targetResults[targetId] };
      const oldAmount = targetData.damage[damageKey]?.amount;
      targetData.damage = {
        ...targetData.damage,
        [damageKey]: { 
          ...targetData.damage[damageKey], 
          amount: typeof oldAmount === 'object' ? { ...oldAmount, total: newAmount } : newAmount 
        }
      };
      next.targetResults[targetId] = targetData;
      return next;
    });
  };

  const handleCommit = () => {
    useActionStore.getState().applyPipelineResolution(localPayload);
    onClose();
  };

  const { source, targets, challenge, rawResults, targetResults } = localPayload;

  return (
    <div className="flex flex-col flex-1 h-full bg-slate-950 text-slate-200 overflow-hidden font-sans border-none shadow-none rounded-md">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-rose-400">{source?.type || 'Unknown'}</span>
            <span className="text-xl font-bold text-white">{source?.name || 'Unknown Action'}</span>
          </div>
          {challenge && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium">DC {challenge.target} {challenge.versus}</span>
            </div>
          )}
        </div>
        <div className="text-sm text-slate-400">
          Targeting: {targets?.map(t => t.name).join(', ') || 'None'}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {/* Global Results */}
        {(rawResults?.damage || rawResults?.effects) && (
          <div className="space-y-3 mb-6">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Global Roll Results</h4>
            {rawResults.damage && Object.entries(rawResults.damage).map(([key, data]) => (
              <div key={key} className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700/50">
                <span className="text-sm capitalize">{key}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">
                    {data.formula} {data.rolls && data.rolls.length > 0 ? `[${data.rolls.join(',')}]` : ''}
                  </span>
                  <Badge variant="outline" className="text-rose-400 border-rose-900/50 bg-rose-950/30">
                    {data.amount}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Target Results */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Resolutions</h4>
          {Object.entries(targetResults).map(([targetId, result]) => {
            const targetInfo = targets?.find(t => t.id === targetId);
            return (
              <div key={targetId} className="border border-slate-800 rounded-lg p-3 space-y-3 bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{targetInfo?.name || targetId}</span>
                  <Badge variant={result.suggestedResolution === 'hit' ? 'default' : 'secondary'} className="capitalize border-slate-700">
                    {result.suggestedResolution?.replace('_', ' ') || 'None'}
                  </Badge>
                </div>

                {result.challengeResult && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/50 p-2 rounded">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Save Roll: [{result.challengeResult.rolls?.join(',') || '0'}] + {result.challengeResult.modifier} =</span>
                    <strong className={result.challengeResult.isSuccess ? 'text-emerald-400' : 'text-rose-400'}>
                      {result.challengeResult.total}
                    </strong>
                    <span>({result.challengeResult.isSuccess ? 'Success' : 'Failed'})</span>
                  </div>
                )}

                <Separator className="bg-slate-800" />
                
                <div className="space-y-2">
                  {/* Damage */}
                  {Object.entries(result.damage || {}).map(([key, d]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Swords className="w-3.5 h-3.5 text-rose-400" />
                        <span className="capitalize">{key} Damage</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          value={typeof d.amount === 'object' ? (d.amount?.total ?? 0) : d.amount} 
                          onChange={(e) => handleOverrideDamage(targetId, key, parseInt(e.target.value) || 0)}
                          className="w-16 h-7 text-xs bg-slate-950 border-slate-700" 
                        />
                      </div>
                    </div>
                  ))}

                  {/* Effects */}
                  {Object.entries(result.effectsApplied || {}).map(([key, fx]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="capitalize text-emerald-400">Apply {key}</span>
                      </div>
                      <span className="text-xs text-slate-500">{fx.duration} {fx.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-4 bg-slate-900 border-t border-slate-800 flex gap-3">
        <Button variant="outline" className="flex-1 bg-slate-800 border-slate-700 hover:bg-slate-700" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={handleCommit}>
          Commit & Apply
        </Button>
      </div>
    </div>
  );
}
