import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dices, X, Pin, Trash2 } from 'lucide-react';
import { useDiceStore } from '@/stores/diceStore';
import { parseFormula, type DiceRollResult } from '@/lib/diceEngine';

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100] as const;

export const DiceCardContent: React.FC = () => {
  const {
    rollHistory,
    currentFormula,
    pinnedFormulas,
    roll,
    clearHistory,
    setFormula,
    addPinnedFormula,
    removePinnedFormula,
  } = useDiceStore();

  const [error, setError] = useState<string | null>(null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRoll = (formulaOverride?: string) => {
    const f = formulaOverride ?? currentFormula;
    if (!f.trim()) return;
    try {
      parseFormula(f); // validate first
      const result = roll(f);
      setError(null);
      setAnimatingId(result.id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRoll();
  };

  const handlePin = () => {
    if (!currentFormula.trim()) return;
    try {
      parseFormula(currentFormula);
      addPinnedFormula(currentFormula, currentFormula);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Clear animation after timeout
  useEffect(() => {
    if (!animatingId) return;
    const t = setTimeout(() => setAnimatingId(null), 400);
    return () => clearTimeout(t);
  }, [animatingId]);

  const latestRoll = rollHistory[0];

  return (
    <div className="flex flex-col h-full p-3 gap-2 text-sm">
      {/* Formula input */}
      <div className="flex gap-1">
        <Input
          ref={inputRef}
          value={currentFormula}
          onChange={(e) => { setFormula(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 2d6+4"
          className="h-8 text-sm font-mono"
        />
        <Button size="sm" className="h-8 px-3" onClick={() => handleRoll()}>
          <Dices className="h-4 w-4" />
        </Button>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={handlePin}>
                <Pin className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Pin formula</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Quick dice row */}
      <div className="flex gap-1 flex-wrap">
        {QUICK_DICE.map((sides) => (
          <Button
            key={sides}
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs font-mono"
            onClick={() => handleRoll(`1d${sides}`)}
          >
            d{sides}
          </Button>
        ))}
      </div>

      {/* Pinned formulas */}
      {pinnedFormulas.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {pinnedFormulas.map((pf, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="cursor-pointer text-xs font-mono gap-1 pr-1"
              onClick={() => handleRoll(pf.formula)}
            >
              {pf.label}
              <X
                className="h-3 w-3 opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); removePinnedFormula(i); }}
              />
            </Badge>
          ))}
        </div>
      )}

      <Separator />

      {/* Latest result */}
      {latestRoll && (
        <LatestResult roll={latestRoll} isAnimating={animatingId === latestRoll.id} />
      )}

      {/* Roll history */}
      {rollHistory.length > 1 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">History</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearHistory}>
              <Trash2 className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-1 pr-2">
              {rollHistory.slice(1).map((r) => (
                <HistoryRow key={r.id} roll={r} />
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
};

/* ---------- sub-components ---------- */

function LatestResult({ roll, isAnimating }: { roll: DiceRollResult; isAnimating: boolean }) {
  return (
    <div
      className={`rounded-md border border-border bg-muted/40 p-2 space-y-1 transition-transform ${
        isAnimating ? 'scale-105' : 'scale-100'
      }`}
      style={{ transitionDuration: '200ms' }}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs text-muted-foreground">{roll.formula}</span>
        <span className="text-xl font-bold tabular-nums">{roll.total}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {roll.groups.map((g, gi) => (
          <span key={gi} className="flex gap-0.5">
            {g.results.map((v, vi) => {
              const kept = g.keptResults.includes(v)
                // handle duplicates: count how many times v appears in kept vs already rendered
                && g.keptResults.filter((k) => k === v).length >
                   g.results.slice(0, vi).filter((r) => r === v && g.keptResults.includes(r)).length -
                   g.results.slice(0, vi).filter((r) => r === v && !g.keptResults.includes(r)).length
                   ? true : undefined;
              const isKept = g.keepHighest != null || g.keepLowest != null
                ? g.keptResults.includes(v)
                : true;
              return (
                <span
                  key={vi}
                  className={`inline-flex items-center justify-center rounded text-xs font-mono min-w-[1.5rem] h-5 px-1 ${
                    isKept
                      ? 'bg-primary/20 text-foreground'
                      : 'bg-muted text-muted-foreground line-through opacity-50'
                  }`}
                >
                  {v}
                </span>
              );
            })}
            <span className="text-xs text-muted-foreground self-center">
              d{g.sides}
            </span>
          </span>
        ))}
        {roll.modifier !== 0 && (
          <span className="text-xs text-muted-foreground self-center font-mono">
            {roll.modifier > 0 ? '+' : ''}{roll.modifier}
          </span>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ roll }: { roll: DiceRollResult }) {
  const time = new Date(roll.timestamp);
  const ts = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
  return (
    <div className="flex items-center justify-between text-xs py-0.5 px-1 rounded hover:bg-muted/30">
      <span className="text-muted-foreground w-10 shrink-0">{ts}</span>
      <span className="font-mono text-muted-foreground truncate flex-1 mx-1">{roll.formula}</span>
      <span className="font-bold tabular-nums">{roll.total}</span>
    </div>
  );
}
