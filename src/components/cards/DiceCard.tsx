import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dices, X, Pin, Trash2, ChevronDown } from 'lucide-react';
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

  const handleRoll = useCallback((formulaOverride?: string) => {
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
  }, [currentFormula, roll]);

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

  // Clear result highlight animation after timeout
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
      className={`rounded-md border border-border bg-muted/40 p-2 space-y-1 transition-transform overflow-hidden ${
        isAnimating ? 'scale-105' : 'scale-100'
      }`}
      style={{ transitionDuration: '200ms' }}
    >
      <RollLabel roll={roll} />
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground truncate min-w-0">{roll.formula}</span>
        <span className="text-xl font-bold tabular-nums shrink-0">{roll.total}</span>
      </div>
      <RollDetails roll={roll} />
    </div>
  );
}

/** Compact label showing [source, reason, formula → total] */
function RollLabel({ roll }: { roll: DiceRollResult }) {
  const parts: string[] = [];
  if (roll.meta?.source) parts.push(String(roll.meta.source));
  if (roll.meta?.reason) parts.push(String(roll.meta.reason));
  if (parts.length === 0 && roll.label) parts.push(roll.label);
  if (parts.length === 0) return null;
  return (
    <div className="text-xs text-muted-foreground truncate">
      {parts.join(' · ')}
    </div>
  );
}

function HistoryRow({ roll }: { roll: DiceRollResult }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(roll.timestamp);
  const ts = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
  const contextLabel = roll.meta?.source
    ? `${roll.meta.source}${roll.meta.reason ? ` · ${roll.meta.reason}` : ''}`
    : roll.label || '';
  return (
    <div className="rounded hover:bg-muted/30">
      <div
        className="flex items-center justify-between text-xs py-0.5 px-1 gap-1 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`} />
        <span className="text-muted-foreground w-10 shrink-0">{ts}</span>
        {contextLabel && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground truncate max-w-[6rem]">{contextLabel}</span>
            </TooltipTrigger>
            <TooltipContent side="top">{contextLabel}</TooltipContent>
          </Tooltip>
        )}
        <span className="font-mono text-muted-foreground truncate flex-1 mx-1">{roll.formula}</span>
        <span className="font-bold tabular-nums">{roll.total}</span>
      </div>
      {expanded && (
        <div className="px-1 pb-1.5 pt-0.5">
          <LatestResult roll={roll} isAnimating={false} />
        </div>
      )}
    </div>
  );
}

/** Reusable dice breakdown used in both LatestResult and expanded history */
function RollDetails({ roll }: { roll: DiceRollResult }) {
  return (
    <div className="flex flex-wrap gap-1 overflow-hidden max-h-24">
      {roll.groups.map((g, gi) => (
        <span key={gi} className="flex gap-0.5 flex-wrap">
          {g.results.map((v, vi) => {
            const isKept = g.keepHighest != null || g.keepLowest != null
              ? g.keptResults.includes(v)
              : true;
            return (
              <span
                key={vi}
                className={`inline-flex items-center justify-center rounded text-xs font-mono min-w-[1.5rem] h-5 px-1 shrink-0 ${
                  isKept
                    ? 'bg-primary/20 text-foreground'
                    : 'bg-muted text-muted-foreground line-through opacity-50'
                }`}
              >
                {v}
              </span>
            );
          })}
          <span className="text-xs text-muted-foreground self-center shrink-0">
            d{g.sides}
          </span>
        </span>
      ))}
      {roll.modifier !== 0 && (
        <span className="text-xs text-muted-foreground self-center font-mono shrink-0">
          {roll.modifier > 0 ? '+' : ''}{roll.modifier}
        </span>
      )}
    </div>
  );
}
