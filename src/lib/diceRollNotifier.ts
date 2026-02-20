/**
 * Dice Roll Notifier
 * 
 * Subscribes to diceStore changes and shows toast notifications
 * when another player rolls dice in a multiplayer session.
 */
import { toast } from 'sonner';
import { useDiceStore } from '@/stores/diceStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import type { DiceRollResult } from '@/lib/diceEngine';

let lastSeenRollId: string | null = null;
let unsubscribe: (() => void) | null = null;

/** Format a roll result for display in a toast */
function formatRollToast(roll: DiceRollResult): string {
  const parts: string[] = [];
  if (roll.meta?.source) parts.push(String(roll.meta.source));
  if (roll.meta?.reason) parts.push(String(roll.meta.reason));
  parts.push(roll.formula);
  parts.push(`→ ${roll.total}`);
  return parts.join(', ');
}

/** Start listening for dice rolls from other players */
export function startDiceRollNotifier() {
  // Clean up any existing subscription
  stopDiceRollNotifier();

  // Seed the last seen roll so we don't toast on initial load
  const initialHistory = useDiceStore.getState().rollHistory;
  if (initialHistory.length > 0) {
    lastSeenRollId = initialHistory[0].id;
  }

  unsubscribe = useDiceStore.subscribe((state, prevState) => {
    const latest = state.rollHistory[0];
    if (!latest || latest.id === lastSeenRollId) return;

    const prevLatest = prevState.rollHistory[0];
    if (prevLatest && prevLatest.id === latest.id) return;

    lastSeenRollId = latest.id;

    // Only toast for rolls from OTHER players
    const myUsername = useMultiplayerStore.getState().currentUsername;
    const isConnected = useMultiplayerStore.getState().isConnected;

    if (!isConnected) return; // No toasts in single-player
    if (latest.rolledBy === myUsername) return; // Don't toast own rolls

    const rollerName = latest.rolledBy || 'Someone';
    const rollText = formatRollToast(latest);
    const label = latest.label ? ` (${latest.label})` : '';

    toast(`🎲 ${rollerName} rolled${label}`, {
      description: rollText,
      duration: 4000,
    });
  });
}

/** Stop listening */
export function stopDiceRollNotifier() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  lastSeenRollId = null;
}
