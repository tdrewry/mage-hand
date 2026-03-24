import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Dices, Check, X, ShieldAlert } from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import { useActionStore } from '@/stores/actionStore';
import { evaluateIntent } from '@/lib/rules-engine/evaluator';
import { rollDice } from '@/lib/diceEngine';

export function GatherCollectionCard() {
  const tokens = useSessionStore((s) => s.tokens);
  const activeGatherRequest = useActionStore((s) => s.activeGatherRequest);
  const activeGatherIntent = useActionStore((s) => s.activeGatherIntent);
  const gatheredResults = useActionStore((s) => s.gatheredResults);
  const setGatherRequest = useActionStore((s) => s.setGatherRequest);
  const submitGatherResult = useActionStore((s) => s.submitGatherResult);
  const submitIntentResolution = useActionStore((s) => s.submitIntentResolution);

  if (!activeGatherRequest || !activeGatherIntent) return null;

  const targetTokens = tokens.filter(t => activeGatherRequest.targets.includes(t.id));
  const isComplete = targetTokens.every(t => gatheredResults[t.id] !== undefined);

  const handleRollForTarget = (targetId: string) => {
    // Basic mock roll for now (would typically be 1d20 + modifier)
    const result = rollDice('1d20');
    submitGatherResult(targetId, result.total, result.groups[0]?.keptResults[0], 0);
  };

  const handleRollAll = () => {
    // Roll for any missing targets
    targetTokens.forEach(t => {
      if (gatheredResults[t.id] === undefined) {
        handleRollForTarget(t.id);
      }
    });
  };

  const handleCancel = () => {
    // Abort the gather phase
    setGatherRequest(null, null);
  };

  const handleApply = async () => {
    // Ensure all targets have results. If they don't, mock 10s or auto-roll missing?
    // Let's auto-roll missing just to be safe.
    handleRollAll();

    // Now resume the pipeline
    // Pass the gatheredResults we have in state
    const currentResults = useActionStore.getState().gatheredResults;
    const evaluation = await evaluateIntent(activeGatherIntent, currentResults);

    if (evaluation.type === 'resolution') {
      submitIntentResolution(activeGatherIntent, evaluation.payload);
      setGatherRequest(null, null);
    } else {
      // It requested *another* gather. Update state.
      setGatherRequest(evaluation.request, evaluation.state.intent || activeGatherIntent);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans border border-slate-700/50 rounded-md overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0">
        <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          Requesting Rolls
        </h2>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
          {activeGatherRequest.challengeType} • DC {activeGatherRequest.dc || '?'}
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Gathering {targetTokens.length} Results
            </Label>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-white"
              onClick={handleRollAll}
            >
              <Dices className="w-3.5 h-3.5 mr-1" /> Roll All Remaining
            </Button>
          </div>

          <Separator className="bg-slate-800" />

          <div className="space-y-2">
            {targetTokens.map(t => {
              const hasResult = gatheredResults[t.id] !== undefined;
              const currentVal = gatheredResults[t.id]?.total || '';

              return (
                <div key={t.id} className="flex items-center justify-between bg-slate-900 p-2 rounded-md border border-slate-800 group">
                  <div className="flex items-center gap-3 overflow-hidden pr-2">
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400">{t.name ? t.name.charAt(0) : '?'}</span>
                    </div>
                    <span className="text-sm font-medium truncate" title={t.name || t.label}>{t.name || t.label}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      placeholder="Total"
                      value={currentVal}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) submitGatherResult(t.id, val);
                      }}
                      className={`w-16 h-8 text-center text-sm font-semibold bg-slate-950 border-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${hasResult ? 'border-emerald-500/50 text-emerald-400' : ''}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700"
                      onClick={() => handleRollForTarget(t.id)}
                    >
                      <Dices className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 flex gap-3">
        <Button 
          variant="outline"
          className="flex-1 bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300" 
          onClick={handleCancel}
        >
          <X className="w-4 h-4 mr-1" /> Cancel Action
        </Button>
        <Button 
          className={`flex-1 font-bold gap-2 text-white ${isComplete ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`} 
          size="lg"
          onClick={handleApply}
        >
          <Check className="w-4 h-4" /> {isComplete ? 'Apply Results' : 'Force Apply'}
        </Button>
      </div>
    </div>
  );
}
