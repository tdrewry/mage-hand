import { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Swords, Target, Check, X, AlertTriangle, Skull, Shield, ChevronRight } from 'lucide-react';
import { useActionStore } from '@/stores/actionStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { AttackResolution } from '@/types/actionTypes';

const RESOLUTION_CONFIG: Record<AttackResolution, { label: string; color: string; icon: typeof Check }> = {
  critical_miss: { label: 'Critical Miss', color: 'bg-red-900/50 text-red-300 border-red-700', icon: Skull },
  miss: { label: 'Miss', color: 'bg-muted text-muted-foreground border-border', icon: X },
  hit: { label: 'Hit', color: 'bg-green-900/50 text-green-300 border-green-700', icon: Check },
  critical_threat: { label: 'Critical Threat', color: 'bg-yellow-900/50 text-yellow-300 border-yellow-700', icon: AlertTriangle },
  critical_hit: { label: 'Critical Hit', color: 'bg-orange-900/50 text-orange-300 border-orange-700', icon: Swords },
};

export function ActionCardContent() {
  const { currentAction, cancelAction, confirmTargets, setResolution, overrideDamage, commitAction } = useActionStore();

  if (!currentAction) {
    return <EmptyState />;
  }

  switch (currentAction.phase) {
    case 'targeting':
      return <TargetingPhase />;
    case 'resolve':
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
                      <Swords className="w-3 h-3" />
                      <span>{entry.sourceTokenName}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      <span>{entry.attack.name}</span>
                    </div>
                    {entry.targets.map(t => {
                      const cfg = RESOLUTION_CONFIG[t.resolution];
                      return (
                        <div key={t.tokenId} className="mt-1 flex items-center gap-2 text-muted-foreground">
                          <span>→ {t.tokenName}</span>
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                          {(t.resolution === 'hit' || t.resolution === 'critical_hit') && (
                            <span className="text-destructive">{t.damage.adjustedTotal} {t.damage.damageType}</span>
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

function ResolvePhase() {
  const { currentAction, setResolution, overrideDamage, commitAction, cancelAction, removeTarget } = useActionStore();
  if (!currentAction || !currentAction.attack) return null;

  const allResolved = currentAction.targets.every(t => currentAction.resolutions[t.tokenId]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Action Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">{currentAction.sourceTokenName}</h3>
              <p className="text-xs text-muted-foreground">{currentAction.attack.name}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {currentAction.attack.damageType}
          </Badge>
        </div>

        <Separator />

        {/* Per-target resolution */}
        {currentAction.targets.map(target => {
          const roll = currentAction.rollResults[target.tokenId];
          const damage = currentAction.damageResults[target.tokenId];
          const resolution = currentAction.resolutions[target.tokenId];

          return (
            <TargetResolveCard
              key={target.tokenId}
              targetName={target.tokenName}
              distance={target.distance}
              defenseValue={target.defenseValue}
              defenseLabel={target.defenseLabel}
              roll={roll}
              damage={damage}
              resolution={resolution}
              damageType={currentAction.attack!.damageType}
              onSetResolution={(r) => setResolution(target.tokenId, r)}
              onOverrideDamage={(v) => overrideDamage(target.tokenId, v)}
              onDismiss={() => removeTarget(target.tokenId)}
            />
          );
        })}

        <Separator />

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={cancelAction}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1" onClick={commitAction} disabled={!allResolved}>
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
  onSetResolution: (r: AttackResolution) => void;
  onOverrideDamage: (v: number) => void;
  onDismiss: () => void;
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
  onSetResolution,
  onOverrideDamage,
  onDismiss,
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
      <div className="bg-muted/30 rounded p-2">
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
      </div>

      {/* Resolution buttons */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Resolution {suggested !== 'miss' && `(suggested: ${RESOLUTION_CONFIG[suggested].label})`}</p>
        <div className="grid grid-cols-5 gap-1">
          {(Object.entries(RESOLUTION_CONFIG) as [AttackResolution, typeof RESOLUTION_CONFIG[AttackResolution]][]).map(
            ([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = resolution === key;
              const isSuggested = key === suggested;
              return (
                <button
                  key={key}
                  onClick={() => onSetResolution(key)}
                  className={`flex flex-col items-center gap-0.5 p-1.5 rounded border text-[10px] transition-colors ${
                    isActive
                      ? cfg.color + ' border-2'
                      : isSuggested
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border/50 hover:bg-muted/50'
                  }`}
                  title={cfg.label}
                >
                  <Icon className="w-3 h-3" />
                  <span className="leading-tight text-center">{cfg.label.split(' ').map(w => w[0]).join('')}</span>
                </button>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}
