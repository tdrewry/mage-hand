/**
 * CardSaveButton — reusable "Save Changes" button for card UIs.
 *
 * Fires a custom DOM event `card:save` with the entity context so that
 * networking / sync layers can pick it up without tight coupling.
 *
 * Usage:
 *   <CardSaveButton context={{ type: 'token', id: tokenId }} onSave={handleSave} />
 */

import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

// ─── Event types ──────────────────────────────────────────────────────────────

export type CardSaveContextType = 'token' | 'region' | 'map-object' | 'effect' | 'session';

export interface CardSaveContext {
  /** Entity category this save is scoped to. */
  type: CardSaveContextType;
  /** Entity ID (e.g. tokenId, regionId). Omit for session-wide saves. */
  id?: string;
}

export interface CardSaveEventDetail {
  context: CardSaveContext;
}

/** Strongly-typed custom event dispatched on `window`. */
export class CardSaveEvent extends CustomEvent<CardSaveEventDetail> {
  static readonly TYPE = 'card:save' as const;
  constructor(detail: CardSaveEventDetail) {
    super(CardSaveEvent.TYPE, { detail, bubbles: true });
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CardSaveButtonProps {
  /** Entity context this save applies to. */
  context: CardSaveContext;
  /** Local save handler — called *before* the sync event fires. */
  onSave: () => void;
  /** Disable when there are validation errors. */
  disabled?: boolean;
  /** Optional override label (default: "Save Changes"). */
  label?: string;
  className?: string;
}

export function CardSaveButton({
  context,
  onSave,
  disabled = false,
  label = 'Save Changes',
  className = 'w-full',
}: CardSaveButtonProps) {
  const handleClick = () => {
    // 1. Persist locally
    onSave();
    // 2. Broadcast sync event
    window.dispatchEvent(new CardSaveEvent({ context }));
  };

  return (
    <Button size="sm" className={className} onClick={handleClick} disabled={disabled}>
      <Save className="w-3.5 h-3.5 mr-1.5" /> {label}
    </Button>
  );
}
