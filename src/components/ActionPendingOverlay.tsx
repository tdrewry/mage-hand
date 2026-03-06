// src/components/ActionPendingOverlay.tsx
// Player-facing overlay showing pending and recently resolved actions.
// Renders as floating notifications in the bottom-right corner.

import { useEffect } from 'react';
import { useActionPendingStore } from '@/stores/actionPendingStore';
import { useRoleStore } from '@/stores/roleStore';
import { Swords, Check, X, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Resolution label for player-visible outcomes */
function resolutionLabel(resolution: string): { text: string; color: string } {
  switch (resolution) {
    case 'critical_hit': return { text: 'Critical Hit!', color: 'text-orange-400' };
    case 'critical_threat': return { text: 'Critical Threat', color: 'text-yellow-400' };
    case 'hit': return { text: 'Hit', color: 'text-green-400' };
    case 'half': return { text: 'Half Damage', color: 'text-blue-400' };
    case 'miss': return { text: 'Miss', color: 'text-muted-foreground' };
    case 'critical_miss': return { text: 'Critical Miss', color: 'text-red-400' };
    default: return { text: resolution, color: 'text-muted-foreground' };
  }
}

export function ActionPendingOverlay() {
  const { pendingActions, resolvedActions, clearOldResolved } = useActionPendingStore();
  const currentRole = useRoleStore((s) => s.currentRole);
  const isDM = currentRole?.name?.toLowerCase() === 'dm' || currentRole?.name?.toLowerCase() === 'dungeon master';

  // Auto-clear old resolved actions every 30s
  useEffect(() => {
    const interval = setInterval(() => clearOldResolved(30_000), 10_000);
    return () => clearInterval(interval);
  }, [clearOldResolved]);

  // DMs don't need this overlay — they see the full Action Card
  if (isDM) return null;

  const pending = Object.values(pendingActions);
  // Only show resolved actions from the last 15 seconds
  const recentResolved = resolvedActions.filter(a => Date.now() - a.receivedAt < 15_000);

  if (pending.length === 0 && recentResolved.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {/* Pending actions */}
      {pending.map((action) => (
        <div
          key={action.actionId}
          className="bg-card/95 backdrop-blur-sm border border-primary/30 rounded-lg p-3 shadow-lg animate-in slide-in-from-right-5 pointer-events-auto"
        >
          <div className="flex items-center gap-2 mb-1">
            <Swords className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm font-medium text-foreground">
              Resolving Action...
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{action.sourceName}</span>
            {' '}is resolving{' '}
            <span className="text-primary font-medium">{action.attackName}</span>
            {action.targetNames.length > 0 && (
              <>
                {' '}against{' '}
                <span className="text-foreground">
                  {action.targetNames.join(', ')}
                </span>
              </>
            )}
          </p>
        </div>
      ))}

      {/* Recently resolved actions */}
      {recentResolved.map((action) => (
        <div
          key={action.actionId}
          className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-md animate-in slide-in-from-right-5 pointer-events-auto"
        >
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {action.sourceName} — {action.attackName}
            </span>
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {action.category}
            </Badge>
          </div>
          <div className="space-y-0.5">
            {action.targets.map((t, i) => {
              const rl = resolutionLabel(t.resolution);
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {t.resolution === 'miss' || t.resolution === 'critical_miss'
                    ? <X className="h-3 w-3 text-muted-foreground" />
                    : <Check className="h-3 w-3 text-green-400" />
                  }
                  <span className="text-muted-foreground">{t.tokenName}:</span>
                  <span className={rl.color}>{rl.text}</span>
                  {t.totalDamage > 0 && (
                    <span className="text-foreground">
                      ({t.totalDamage} {t.damageType})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
