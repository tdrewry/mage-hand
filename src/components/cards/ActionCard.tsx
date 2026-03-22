import { useMemo, useRef, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Swords, Target, Check, X, AlertTriangle, Skull, Shield, ChevronRight, Percent, Dices, Lock, Zap, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { useActionStore, broadcastResolutionClaim } from '@/stores/actionStore';
import { useActionPendingStore } from '@/stores/actionPendingStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { AttackResolution, ActionQueueEntry } from '@/types/actionTypes';
import type { ResolutionPayload } from '@/lib/rules-engine/types';
const RESOLUTION_CONFIG: Record<AttackResolution, { label: string; color: string; icon: typeof Check }> = {
  critical_miss: { label: 'Critical Miss', color: 'bg-red-900/50 text-red-300 border-red-700', icon: Skull },
  miss: { label: 'Miss', color: 'bg-muted text-muted-foreground border-border', icon: X },
  half: { label: 'Half Damage', color: 'bg-blue-900/50 text-blue-300 border-blue-700', icon: Percent },
  hit: { label: 'Hit', color: 'bg-green-900/50 text-green-300 border-green-700', icon: Check },
  critical_threat: { label: 'Critical Threat', color: 'bg-yellow-900/50 text-yellow-300 border-yellow-700', icon: AlertTriangle },
  critical_hit: { label: 'Critical Hit', color: 'bg-orange-900/50 text-orange-300 border-orange-700', icon: Swords },
};

/** Resolution types shown as buttons (excludes 'half' which is a damage modifier) */
const RESOLUTION_BUTTON_KEYS: AttackResolution[] = ['critical_miss', 'miss', 'hit', 'critical_threat', 'critical_hit'];

/** Short label for an action entry used in tabs */
function actionTabLabel(action: ActionQueueEntry, index: number, allActions: ActionQueueEntry[]): string {
  const baseName = action.category === 'skill'
    ? (action.attack?.name || 'Skill')
    : (action.attack?.name || 'Action');
  
  // Count how many actions share this base name
  const duplicateCount = allActions.filter(a => {
    const n = a.category === 'skill' ? (a.attack?.name || 'Skill') : (a.attack?.name || 'Action');
    return n === baseName;
  }).length;
  
  if (duplicateCount > 1) {
    // Find ordinal among duplicates
    let ordinal = 0;
    for (let i = 0; i <= index; i++) {
      const n = allActions[i].category === 'skill'
        ? (allActions[i].attack?.name || 'Skill')
        : (allActions[i].attack?.name || 'Action');
      if (n === baseName) ordinal++;
    }
    return `${baseName} #${ordinal}`;
  }
  
  return baseName;
}

export function ActionCardContent() {
  const { currentAction, pendingActions, swapToAction } = useActionStore();
  // Maintain stable tab ordering — new actions append, removed actions get pruned
  const stableOrderRef = useRef<string[]>([]);

  if (!currentAction) {
    stableOrderRef.current = [];
    return <EmptyState />;
  }

  const allActions = [currentAction, ...pendingActions];
  const actionMap = new Map(allActions.map(a => [a.id, a]));
  const currentIds = new Set(allActions.map(a => a.id));

  // Prune removed IDs, then append any new IDs
  stableOrderRef.current = stableOrderRef.current.filter(id => currentIds.has(id));
  for (const a of allActions) {
    if (!stableOrderRef.current.includes(a.id)) {
      stableOrderRef.current.push(a.id);
    }
  }

  const orderedActions = stableOrderRef.current
    .map(id => actionMap.get(id))
    .filter(Boolean) as typeof allActions;

  const hasTabs = orderedActions.length > 1;

  if (!hasTabs) {
    return <SingleActionView action={currentAction} />;
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className="shrink-0 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: 'none' }}
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
            e.preventDefault();
          }
        }}
      >
        <div className="inline-flex w-max gap-0 flex-nowrap p-0 border-b border-border">
          {orderedActions.map((action, idx) => {
            const isActive = action.id === currentAction.id;
            return (
              <button
                key={action.id}
                onClick={() => {
                  if (!isActive) {
                    const pendingIdx = pendingActions.findIndex(a => a.id === action.id);
                    if (pendingIdx >= 0) swapToAction(pendingIdx);
                  }
                }}
                className={`text-xs px-4 py-2 whitespace-nowrap shrink-0 -mb-px border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {actionTabLabel(action, idx, orderedActions)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <SingleActionView action={currentAction} />
      </div>
    </div>
  );
}

function SingleActionView({ action }: { action: ActionQueueEntry }) {
  switch (action.phase) {
    case 'targeting':
      return <TargetingPhase />;
    case 'resolve':
      if (action.category === 'skill') return <SkillCheckResolvePhase />;
      return <ResolvePhase />;
    default:
      return <EmptyState />;
  }
}

function EmptyState() {
  const { actionHistory } = useActionStore();

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="text-center text-muted-foreground py-8">
          <Swords className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No active action</p>
          <p className="text-xs mt-1">Right-click a token → Attack to start</p>
        </div>

        {actionHistory.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Actions</h4>
              <div className="space-y-2">
                {actionHistory.slice(0, 10).map(entry => (
                  <div key={entry.id} className="text-xs p-2 rounded bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-1 font-medium">
                      {entry.attack.damageType === 'none' ? <Dices className="w-3 h-3" /> : <Swords className="w-3 h-3" />}
                      <span>{entry.sourceTokenName}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      <span>{entry.attack.name}{entry.attack.damageType === 'none' ? ' Check' : ''}</span>
                    </div>
                    {entry.targets.map(t => {
                      const cfg = RESOLUTION_CONFIG[t.resolution];
                      const isSkill = entry.attack.damageType === 'none';
                      return (
                        <div key={`${t.tokenId}-${t.attackRoll?.totalRoll}`} className="mt-1 flex items-center gap-2 text-muted-foreground">
                          {isSkill ? (
                            <>
                              <span className="font-mono font-bold text-foreground">{t.attackRoll?.totalRoll}</span>
                              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${cfg.color}`}>
                                {t.resolution === 'hit' ? 'Pass' : 'Fail'}
                              </Badge>
                            </>
                          ) : (
                            <>
                              <span>→ {t.tokenName}</span>
                              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${cfg.color}`}>
                                {cfg.label}
                              </Badge>
                              {(t.resolution === 'hit' || t.resolution === 'critical_hit') && (
                                <span className="text-destructive">{t.damage.adjustedTotal} {t.damage.damageType}</span>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function TargetingPhase() {
  const { currentAction, cancelAction, confirmTargets } = useActionStore();
  if (!currentAction) return null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-primary animate-pulse" />
        <div>
          <h3 className="font-semibold text-sm">{currentAction.sourceTokenName}</h3>
          <p className="text-xs text-muted-foreground">
            {currentAction.attack?.name} — Select target on map
          </p>
        </div>
      </div>

      <div className="bg-primary/10 border border-primary/30 rounded-md p-3 text-xs text-center">
        Click a token on the map to target it
      </div>

      {currentAction.targets.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Targets ({currentAction.targets.length})</Label>
          {currentAction.targets.map(t => (
            <div key={t.tokenId} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded border border-border/50">
              <span className="font-medium">{t.tokenName}</span>
              <span className="text-muted-foreground">{(t.distance * 5).toFixed(0)} ft.</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={cancelAction}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={confirmTargets}
          disabled={currentAction.targets.length === 0}
        >
          Confirm Target{currentAction.targets.length > 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}

function SkillCheckResolvePhase() {
  const { currentAction, setResolution, commitAction, cancelAction } = useActionStore();
  const claims = useActionPendingStore((s) => s.claims);
  const currentUserId = useMultiplayerStore((s) => s.currentUserId);
  const connectedUsers = useMultiplayerStore((s) => s.connectedUsers);

  const handleSetResolution = useCallback((targetKey: string, r: AttackResolution) => {
    if (!currentAction) return;
    const username = connectedUsers.find(u => u.userId === currentUserId)?.username ?? 'DM';
    broadcastResolutionClaim(currentAction.id, currentUserId!, username);
    setResolution(targetKey, r);
  }, [currentAction?.id, currentUserId, connectedUsers, setResolution]);

  if (!currentAction || !currentAction.attack) return null;

  const claim = claims[currentAction.id];
  const claimedByOther = !!(claim && claim.claimedBy !== currentUserId);

  const target = currentAction.targets[0];
  const roll = target ? currentAction.rollResults[target.targetKey] : null;
  const resolution = target ? currentAction.resolutions[target.targetKey] : undefined;
  
  const isNat20 = roll?.naturalRoll === 20;
  const isNat1 = roll?.naturalRoll === 1;




  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">

        {/* Claimed by another DM banner */}
        {claimedByOther && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-accent/50 border border-accent text-accent-foreground text-xs">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Being resolved by <strong>{claim.claimedByName}</strong></span>
          </div>
        )}

        {/* Skill Check Header */}
        <div className="flex items-center gap-2">
          <Dices className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">{currentAction.sourceTokenName}</h3>
            <p className="text-xs text-muted-foreground">{currentAction.attack.name} Check</p>
          </div>
        </div>

        <Separator />

        {/* Roll result */}
        {roll && (
          <div className="bg-muted/30 rounded-lg p-4 text-center space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Roll Result</p>
            <p className={`text-4xl font-bold font-mono ${isNat20 ? 'text-green-400' : isNat1 ? 'text-red-400' : 'text-foreground'}`}>
              {roll.totalRoll}
            </p>
            <p className="text-xs text-muted-foreground">
              d20({roll.naturalRoll}) {roll.attackBonus >= 0 ? '+' : ''} {roll.attackBonus}
            </p>
            {isNat20 && <Badge variant="outline" className="bg-green-900/50 text-green-300 border-green-700 text-xs">Natural 20!</Badge>}
            {isNat1 && <Badge variant="outline" className="bg-red-900/50 text-red-300 border-red-700 text-xs">Natural 1</Badge>}
          </div>
        )}

        <Separator />

        {/* Pass / Fail resolution */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Outcome</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => target && handleSetResolution(target.targetKey, 'miss')}
              disabled={claimedByOther}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                claimedByOther ? 'opacity-50 cursor-not-allowed' :
                resolution === 'miss'
                  ? 'bg-red-900/50 text-red-300 border-red-700 border-2'
                  : 'border-border/50 hover:bg-muted/50 text-muted-foreground'
              }`}
            >
              <X className="w-4 h-4" />
              Fail
            </button>
            <button
              onClick={() => target && handleSetResolution(target.targetKey, 'hit')}
              disabled={claimedByOther}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                claimedByOther ? 'opacity-50 cursor-not-allowed' :
                resolution === 'hit'
                  ? 'bg-green-900/50 text-green-300 border-green-700 border-2'
                  : 'border-border/50 hover:bg-muted/50 text-muted-foreground'
              }`}
            >
              <Check className="w-4 h-4" />
              Pass
            </button>
          </div>
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={cancelAction} disabled={claimedByOther}>
            Dismiss
          </Button>
          <Button size="sm" className="flex-1" onClick={commitAction} disabled={!resolution || claimedByOther}>
            Record
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function ResolvePhase() {
  const { currentAction, setResolution, overrideDamage, commitAction, cancelAction, removeTarget } = useActionStore();
  const claims = useActionPendingStore((s) => s.claims);
  const currentUserId = useMultiplayerStore((s) => s.currentUserId);
  const connectedUsers = useMultiplayerStore((s) => s.connectedUsers);

  const claimAndResolve = useCallback((targetKey: string, r: AttackResolution) => {
    if (!currentAction) return;
    const username = connectedUsers.find(u => u.userId === currentUserId)?.username ?? 'DM';
    broadcastResolutionClaim(currentAction.id, currentUserId!, username);
    setResolution(targetKey, r);
  }, [currentAction?.id, currentUserId, connectedUsers, setResolution]);

  const claimAndOverride = useCallback((targetKey: string, v: number) => {
    if (!currentAction) return;
    const username = connectedUsers.find(u => u.userId === currentUserId)?.username ?? 'DM';
    broadcastResolutionClaim(currentAction.id, currentUserId!, username);
    overrideDamage(targetKey, v);
  }, [currentAction?.id, currentUserId, connectedUsers, overrideDamage]);

  if (!currentAction || !currentAction.attack) return null;

  const claim = claims[currentAction.id];
  const claimedByOther = !!(claim && claim.claimedBy !== currentUserId);
  const allResolved = currentAction.targets.every(t => currentAction.resolutions[t.targetKey]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">

        {/* Claimed by another DM banner */}
        {claimedByOther && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-accent/50 border border-accent text-accent-foreground text-xs">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Being resolved by <strong>{claim.claimedByName}</strong></span>
          </div>
        )}

        {/* Action Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">{currentAction.sourceTokenName}</h3>
              <p className="text-xs text-muted-foreground">
                {currentAction.attack.name}
                {currentAction.effectInfo?.castLevel && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-1">
                    L{currentAction.effectInfo.castLevel}
                  </Badge>
                )}
              </p>
            </div>
          </div>
          {(() => {
            const firstTarget = currentAction.targets[0];
            const dmg = firstTarget ? currentAction.damageResults[firstTarget.targetKey] : null;
            if (dmg?.breakdown && dmg.breakdown.length > 1) {
              return (
                <div className="flex gap-1">
                  {dmg.breakdown.map((b, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{b.damageType}</Badge>
                  ))}
                </div>
              );
            }
            return (
              <Badge variant="outline" className="text-xs">
                {currentAction.attack.damageType}
              </Badge>
            );
          })()}
        </div>

        <Separator />

        {/* Per-target resolution */}
        {(() => {
          const tokenDropIndex = new Map<string, number>();
          const tokenDropTotal = new Map<string, number>();
          for (const t of currentAction.targets) {
            tokenDropTotal.set(t.tokenId, (tokenDropTotal.get(t.tokenId) || 0) + 1);
          }
          return currentAction.targets.map(target => {
            const roll = currentAction.rollResults[target.targetKey];
            const damage = currentAction.damageResults[target.targetKey];
            const resolution = currentAction.resolutions[target.targetKey];
            const dropIdx = (tokenDropIndex.get(target.tokenId) || 0) + 1;
            tokenDropIndex.set(target.tokenId, dropIdx);
            const total = tokenDropTotal.get(target.tokenId) || 1;
            const dropLabel = total > 1 ? `Drop ${dropIdx} of ${total}` : undefined;

            return (
              <TargetResolveCard
                key={target.targetKey}
                targetName={target.tokenName}
                distance={target.distance}
                defenseValue={target.defenseValue}
                defenseLabel={target.defenseLabel}
                roll={roll}
                damage={damage}
                resolution={resolution}
                damageType={currentAction.attack!.damageType}
                dropLabel={dropLabel}
                disabled={claimedByOther}
                onSetResolution={(r) => claimAndResolve(target.targetKey, r)}
                onOverrideDamage={(v) => claimAndOverride(target.targetKey, v)}
                onDismiss={() => removeTarget(target.targetKey)}
              />
            );
          });
        })()}

        <Separator />

        {/* Aggregate damage summary */}
        {(() => {
          const tokenTotals = new Map<string, { name: string; total: number; hits: number }>();
          for (const t of currentAction.targets) {
            const dmg = currentAction.damageResults[t.targetKey];
            const res = currentAction.resolutions[t.targetKey];
            const adjusted = dmg?.adjustedTotal ?? 0;
            const isHit = res === 'hit' || res === 'half' || res === 'critical_hit' || res === 'critical_threat';
            const existing = tokenTotals.get(t.tokenId) || { name: t.tokenName, total: 0, hits: 0 };
            existing.total += isHit ? adjusted : 0;
            existing.hits += isHit ? 1 : 0;
            tokenTotals.set(t.tokenId, existing);
          }
          const hasMultiHit = Array.from(tokenTotals.values()).some(v => v.hits > 1) || currentAction.targets.length > tokenTotals.size;
          if (!hasMultiHit && tokenTotals.size <= 1) return null;
          return (
            <div className="space-y-1 rounded-md bg-muted/50 p-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Damage Summary</p>
              {Array.from(tokenTotals.entries()).map(([tokenId, { name, total, hits }]) => (
                <div key={tokenId} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{name} {hits > 1 && <span className="text-muted-foreground">×{hits} hits</span>}</span>
                  <span className="font-mono font-bold text-destructive">{total} dmg</span>
                </div>
              ))}
            </div>
          );
        })()}

        <Separator />

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={cancelAction} disabled={claimedByOther}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1" onClick={commitAction} disabled={!allResolved || claimedByOther}>
            Commit Results
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

interface TargetResolveCardProps {
  targetName: string;
  distance: number;
  defenseValue: number;
  defenseLabel: string;
  roll: import('@/types/actionTypes').ActionRollResult;
  damage: import('@/types/actionTypes').DamageResult;
  resolution?: AttackResolution;
  damageType: string;
  dropLabel?: string;
  onSetResolution: (r: AttackResolution) => void;
  onOverrideDamage: (v: number) => void;
  onDismiss: () => void;
  /** Whether controls are disabled (another DM has claimed this action) */
  disabled?: boolean;
  /** Whether this is an effect-based action (shows breakdown if available) */
  isEffect?: boolean;
}

function TargetResolveCard({
  targetName,
  distance,
  defenseValue,
  defenseLabel,
  roll,
  damage,
  resolution,
  damageType,
  dropLabel,
  onSetResolution,
  onOverrideDamage,
  onDismiss,
  disabled,
  isEffect,
}: TargetResolveCardProps) {
  const [damageOverride, setDamageOverride] = useState<string>('');
  const isHit = roll.totalRoll >= defenseValue;
  const isNat20 = roll.naturalRoll === 20;
  const isNat1 = roll.naturalRoll === 1;

  // Auto-suggest resolution
  const suggested: AttackResolution = isNat1
    ? 'critical_miss'
    : isNat20
      ? 'critical_hit'
      : isHit
        ? 'hit'
        : 'miss';

  const handleDamageOverride = () => {
    const val = parseInt(damageOverride);
    if (!isNaN(val) && val >= 0) {
      onOverrideDamage(val);
      setDamageOverride('');
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-3 bg-card">
      {/* Target header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{targetName}</span>
          {dropLabel && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
              {dropLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{(distance * 5).toFixed(0)} ft.</span>
          <button
            onClick={onDismiss}
            className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            title="Dismiss target"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Attack roll vs defense */}
      <div className="flex items-center justify-between bg-muted/30 rounded p-2">
        <div className="text-center flex-1">
          <p className="text-xs text-muted-foreground">Attack Roll</p>
          <p className="text-lg font-bold font-mono">
            <span className={isNat20 ? 'text-green-400' : isNat1 ? 'text-red-400' : ''}>
              {roll.totalRoll}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            d20({roll.naturalRoll}) + {roll.attackBonus}
          </p>
        </div>
        <div className="text-center px-2">
          <span className={`text-sm font-bold ${isHit ? 'text-green-400' : 'text-red-400'}`}>
            {isHit ? '≥' : '<'}
          </span>
        </div>
        <div className="text-center flex-1">
          <p className="text-xs text-muted-foreground">{defenseLabel}</p>
          <p className="text-lg font-bold font-mono">{defenseValue}</p>
        </div>
      </div>

      {/* Damage display */}
      <div className="bg-muted/30 rounded p-2 space-y-1">
        {/* Show breakdown rows if multi-type damage */}
        {damage.breakdown && damage.breakdown.length > 1 ? (
          <>
            <p className="text-xs text-muted-foreground">Damage</p>
            {damage.breakdown.map((row, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm">
                    {row.adjustedTotal}{' '}
                    <span className="text-xs text-muted-foreground">{row.damageType}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {row.formula} → [{row.diceResults.join(', ')}] = {row.total}
                  </p>
                </div>
              </div>
            ))}
            <div className="border-t border-border/50 pt-1 mt-1 flex items-center justify-between">
              <p className="font-mono text-sm font-bold">
                {damage.adjustedTotal}{' '}
                <span className="text-xs text-muted-foreground">total</span>
              </p>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-xs font-bold text-blue-400 hover:bg-blue-900/30"
                      onClick={() => onOverrideDamage(Math.floor(damage.total / 2))}
                    >
                      ½
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Save for Half</TooltipContent>
                </Tooltip>
                <Input
                  type="number"
                  className="w-16 h-7 text-xs"
                  placeholder="Adj."
                  value={damageOverride}
                  onChange={(e) => setDamageOverride(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDamageOverride()}
                />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleDamageOverride}>
                  <Check className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Single damage type (standard layout) */
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Damage</p>
              <p className="font-mono text-sm">
                {damage.adjustedTotal}{' '}
                <span className="text-xs text-muted-foreground">{damageType}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {damage.formula} → [{damage.diceResults.join(', ')}] = {damage.total}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-xs font-bold text-blue-400 hover:bg-blue-900/30"
                    onClick={() => onOverrideDamage(Math.floor(damage.total / 2))}
                  >
                    ½
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Save for Half</TooltipContent>
              </Tooltip>
              <Input
                type="number"
                className="w-16 h-7 text-xs"
                placeholder="Adj."
                value={damageOverride}
                onChange={(e) => setDamageOverride(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDamageOverride()}
              />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleDamageOverride}>
                <Check className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Resolution buttons */}
      <div className={`space-y-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <p className="text-xs text-muted-foreground">Resolution {suggested !== 'miss' && `(suggested: ${RESOLUTION_CONFIG[suggested].label})`}</p>
        <div className="grid grid-cols-5 gap-1">
          {RESOLUTION_BUTTON_KEYS.map(key => {
              const cfg = RESOLUTION_CONFIG[key];
              const Icon = cfg.icon;
              const isActive = resolution === key;
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSetResolution(key)}
                      disabled={disabled}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded border text-[10px] transition-colors ${
                        isActive
                          ? cfg.color + ' border-2'
                          : 'border-border/50 hover:bg-muted/50'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span className="leading-tight text-center">{cfg.label.split(' ').map(w => w[0]).join('')}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {cfg.label}
                  </TooltipContent>
                </Tooltip>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}

export function ActionCard({
  payload,
  onCommit
}: {
  payload: ResolutionPayload;
  onCommit?: (result: any) => void;
}) {
  const { source, targets, challenge, rawResults, targetResults } = payload;
  
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

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Global Results */}
        {(rawResults?.damage || rawResults?.effects) && (
          <div className="space-y-3">
            <h4 className="text-sm flex items-center gap-2 font-medium text-slate-500 uppercase tracking-wider">
              <Zap className="w-4 h-4" /> Base Output
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(rawResults.damage || {}).map(([type, dmg]) => (
                <div key={type} className="bg-slate-900 border border-slate-800 rounded p-3 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-rose-500">{dmg.amount}</span>
                  <span className="text-xs text-slate-400 font-mono capitalize">{type} • {dmg.formula}</span>
                </div>
              ))}
            </div>
            {Object.entries(rawResults.effects || {}).length > 0 && (
               <div className="flex flex-wrap gap-2">
                 {Object.entries(rawResults.effects).map(([effectName, effect]) => (
                   <span key={effectName} className="px-2.5 py-1 bg-indigo-950 text-indigo-300 border border-indigo-900 rounded-full text-xs font-medium">
                     {effectName} ({effect.duration} {effect.unit})
                   </span>
                 ))}
               </div>
            )}
          </div>
        )}

        {/* Target Rows */}
        {targetResults && Object.keys(targetResults).length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm flex items-center gap-2 font-medium text-slate-500 uppercase tracking-wider">
              <Skull className="w-4 h-4" /> Resolutions
            </h4>
            <div className="space-y-3">
              {targets?.map(target => {
                const res = targetResults[target.id];
                if (!res) return null;
                
                const totalDamage = Object.values(res.damage || {}).reduce((acc, curr) => acc + curr.amount, 0);

                return (
                  <div key={target.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-white">{target.name}</span>
                      <div className="flex gap-2">
                         <Button variant="outline" size="sm" className="h-7 text-xs border-emerald-900 hover:bg-emerald-950 text-emerald-400 hover:text-emerald-300">
                           <CheckCircle2 className="w-3 h-3 mr-1" /> Hit
                         </Button>
                         <Button variant="outline" size="sm" className="h-7 text-xs border-rose-900 hover:bg-rose-950 text-rose-400 hover:text-rose-300">
                           <XCircle className="w-3 h-3 mr-1" /> Miss
                         </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      {res.challengeResult && (
                        <div className="flex flex-col">
                          <span className="text-slate-500 text-[10px] uppercase">Save</span>
                          <span className={`font-mono font-medium ${res.challengeResult.isSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {res.challengeResult.total}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] uppercase">Damage</span>
                        <span className="font-mono font-medium text-amber-500">
                          {totalDamage > 0 ? `-${totalDamage}` : '0'}
                        </span>
                      </div>

                      <div className="flex-1">
                        {Object.keys(res.effectsApplied || {}).length > 0 && (
                          <div className="flex flex-col items-end">
                             <span className="text-slate-500 text-[10px] uppercase mb-1">Status</span>
                             <div className="flex gap-1">
                               {Object.keys(res.effectsApplied || {}).map(e => (
                                  <span key={e} className="px-1.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-900 rounded text-[10px]">
                                    {e}
                                  </span>
                               ))}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {res.suggestedResolution && (
                      <div className="mt-3 text-xs text-slate-400 italic border-t border-slate-800 pt-2">
                        {res.suggestedResolution}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 shrink-0 mt-auto">
        <Button 
          className="w-full h-10 font-bold tracking-wide" 
          onClick={onCommit}
        >
          <ShieldAlert className="w-4 h-4 mr-2" />
          COMMIT RESULTS
        </Button>
      </div>
    </div>
  );
}

function DamageControls({ damageOverride, setDamageOverride, handleDamageOverride, total }: any) {
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-xs font-bold text-blue-400 hover:bg-blue-900/30"
            onClick={() => handleDamageOverride(Math.floor(total / 2))}
          >
            ½
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Save for Half</TooltipContent>
      </Tooltip>
      <Input
        type="number"
        className="w-16 h-7 text-xs"
        placeholder="Adj."
        value={damageOverride}
        onChange={(e) => setDamageOverride(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleDamageOverride()}
      />
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDamageOverride()}>
        <Check className="w-3 h-3" />
      </Button>
    </div>
  );
}
