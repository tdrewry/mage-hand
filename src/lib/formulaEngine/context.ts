/**
 * Formula Engine — Property Context Builder
 * 
 * Builds a flat PropertyContext map from an EntitySheet + token metadata.
 * DM-role context has full access; player context is filtered to own/visible tokens.
 * 
 * @see Plans/STEP-009-generic-token-character-sheet-schema.md
 */

import type { EntitySheet } from '@/types/entitySheet';
import { computeModifiable, abilityModifier } from '@/types/entitySheet';
import type { PropertyContext, PropertyContextMeta } from './types';

/** Build a PropertyContext from an EntitySheet for a given token in a given role. */
export function buildPropertyContext(
  sheet: EntitySheet,
  options: {
    tokenId: string;
    clientId: string;
    role: 'dm' | 'player' | 'host';
    targetTokenId?: string;
  }
): { context: PropertyContext; meta: PropertyContextMeta } {
  const ctx: PropertyContext = {};
  let isPartial = false;

  // ── Ability scores ─────────────────────────────────────────────────────────
  if (sheet.abilityScores) {
    for (const [key, mv] of Object.entries(sheet.abilityScores)) {
      const score = computeModifiable(mv);
      ctx[key] = score;
      ctx[`${key}.score`] = score;
      ctx[`${key}.modifier`] = abilityModifier(score);
    }
  }

  // ── Proficiency bonus ──────────────────────────────────────────────────────
  if (sheet.proficiencyBonus) {
    ctx['proficiency'] = computeModifiable(sheet.proficiencyBonus);
  } else {
    // Infer from total character level (5e formula)
    const totalLevel = sheet.description.levels?.reduce((s, l) => s + l.level, 0) ?? 0;
    if (totalLevel > 0) {
      ctx['proficiency'] = Math.ceil(1 + totalLevel / 4);
    }
  }

  // ── Defenses ──────────────────────────────────────────────────────────────
  if (sheet.defenses) {
    if (sheet.defenses.armorClass) {
      ctx['armorClass'] = computeModifiable(sheet.defenses.armorClass);
      ctx['ac'] = ctx['armorClass'];
    }
    if (sheet.defenses.hitPoints) {
      ctx['hp'] = sheet.defenses.hitPoints.current;
      ctx['hp.max'] = sheet.defenses.hitPoints.max;
      ctx['hp.temp'] = sheet.defenses.hitPoints.temporary;
    }
    if (sheet.defenses.savingThrows) {
      for (const [key, mv] of Object.entries(sheet.defenses.savingThrows)) {
        ctx[`save.${key}`] = computeModifiable(mv);
      }
    }
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  if (sheet.skills) {
    for (const [key, skill] of Object.entries(sheet.skills)) {
      if (skill.modifier) {
        ctx[`skill.${key}`] = computeModifiable(skill.modifier);
      }
    }
  }

  // ── Initiative ────────────────────────────────────────────────────────────
  if (sheet.initiative) {
    ctx['initiative'] = computeModifiable(sheet.initiative);
  }

  // ── Passive perception ────────────────────────────────────────────────────
  if (sheet.passivePerception !== undefined) {
    ctx['passivePerception'] = sheet.passivePerception;
    ctx['pp'] = sheet.passivePerception;
  }

  // ── Player-role access filter ─────────────────────────────────────────────
  // Player role can only read their own token fully; other tokens are partial.
  if (options.role === 'player' && options.targetTokenId && options.targetTokenId !== options.tokenId) {
    // Only expose combat-visible fields for non-owned tokens
    const allowed = new Set(['ac', 'armorClass', 'hp', 'hp.max', 'hp.temp']);
    for (const key of Object.keys(ctx)) {
      if (!allowed.has(key)) {
        delete ctx[key];
        isPartial = true;
      }
    }
  }

  const meta: PropertyContextMeta = {
    builtBy: options.clientId,
    role: options.role,
    sourceTokenId: options.tokenId,
    targetTokenId: options.targetTokenId,
    isPartial,
  };

  return { context: ctx, meta };
}
