import { create } from 'zustand';
import type {
  EffectTemplate,
  PlacedEffect,
  EffectImpact,
  EffectPlacementState,
} from '@/types/effectTypes';
import { createEffectId } from '@/types/effectTypes';
import {
  BUILT_IN_EFFECT_TEMPLATES,
  getBuiltInTemplate,
} from '@/lib/effectTemplateLibrary';

// ---------------------------------------------------------------------------
// Local-storage helpers for custom templates
// ---------------------------------------------------------------------------
const CUSTOM_TEMPLATES_KEY = 'magehand-custom-effect-templates';

function loadCustomTemplates(): EffectTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: EffectTemplate[]): void {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface EffectState {
  // Template library
  customTemplates: EffectTemplate[];
  allTemplates: EffectTemplate[];

  // Placed effects on the current map
  placedEffects: PlacedEffect[];

  // Placement mode (null = not placing)
  placement: EffectPlacementState | null;

  // --- Template CRUD ---
  addCustomTemplate: (template: Omit<EffectTemplate, 'id' | 'isBuiltIn'>) => EffectTemplate;
  updateCustomTemplate: (id: string, updates: Partial<EffectTemplate>) => void;
  deleteCustomTemplate: (id: string) => void;
  getTemplate: (id: string) => EffectTemplate | undefined;

  // --- Placement mode ---
  startPlacement: (templateId: string, casterId?: string, damageFormula?: string, casterToken?: { x: number; y: number; gridWidth: number; gridHeight: number }) => void;
  setPlacementOrigin: (origin: { x: number; y: number }) => void;
  updatePlacementPreview: (origin: { x: number; y: number }, direction: number) => void;
  cancelPlacement: () => void;

  // --- Placed effects ---
  placeEffect: (
    templateId: string,
    origin: { x: number; y: number },
    mapId: string,
    options?: {
      direction?: number;
      casterId?: string;
      impactedTargets?: EffectImpact[];
      groupId?: string;
    },
  ) => PlacedEffect;
  removeEffect: (effectId: string) => void;
  /** Start a fade-out dismiss animation; effect auto-removes after fade completes */
  dismissEffect: (effectId: string) => void;
  /** Remove any effects whose fade-out animation has completed */
  cleanupDismissedEffects: () => void;
  clearEffectsForMap: (mapId: string) => void;
  tickRound: () => void; // decrement roundsRemaining, remove expired
  markTokenTriggered: (effectId: string, tokenId: string) => void;
  resetTriggeredTokens: (effectId: string) => void;
  toggleRecurring: (effectId: string) => void;
  toggleAnimationPaused: (effectId: string) => void;

  // --- Bulk ---
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEffectStore = create<EffectState>((set, get) => {
  const customTemplates = loadCustomTemplates();
  const allTemplates = [...BUILT_IN_EFFECT_TEMPLATES, ...customTemplates];

  return {
    customTemplates,
    allTemplates,
    placedEffects: [],
    placement: null,

    // ------------------------------------------------------------------
    // Template CRUD
    // ------------------------------------------------------------------

    addCustomTemplate: (draft) => {
      const template: EffectTemplate = {
        ...draft,
        id: `custom-fx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        isBuiltIn: false,
      };
      set((s) => {
        const updated = [...s.customTemplates, template];
        saveCustomTemplates(updated);
        return {
          customTemplates: updated,
          allTemplates: [...BUILT_IN_EFFECT_TEMPLATES, ...updated],
        };
      });
      return template;
    },

    updateCustomTemplate: (id, updates) => {
      set((s) => {
        const updated = s.customTemplates.map((t) =>
          t.id === id ? { ...t, ...updates, id, isBuiltIn: false } : t,
        );
        saveCustomTemplates(updated);
        return {
          customTemplates: updated,
          allTemplates: [...BUILT_IN_EFFECT_TEMPLATES, ...updated],
        };
      });
    },

    deleteCustomTemplate: (id) => {
      set((s) => {
        const updated = s.customTemplates.filter((t) => t.id !== id);
        saveCustomTemplates(updated);
        return {
          customTemplates: updated,
          allTemplates: [...BUILT_IN_EFFECT_TEMPLATES, ...updated],
        };
      });
    },

    getTemplate: (id) => {
      return (
        getBuiltInTemplate(id) ??
        get().customTemplates.find((t) => t.id === id)
      );
    },

    // ------------------------------------------------------------------
    // Placement mode
    // ------------------------------------------------------------------

    startPlacement: (templateId, casterId, damageFormula, casterToken) => {
      const template = get().getTemplate(templateId);
      if (!template) return;

      // Token-sourced: auto-lock origin to token and skip to direction step
      // Unless the effect is ranged, in which case we need the user to pick an origin first
      const isTokenSourced = !!casterToken;
      const isRanged = template.ranged === true;
      const skipToDirection = isTokenSourced && !isRanged;
      const tokenOrigin = casterToken ? { x: casterToken.x, y: casterToken.y } : null;

      // Multi-drop setup
      const isMultiDrop = !!template.multiDrop;
      const multiDropGroupId = isMultiDrop ? `group-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` : undefined;

      set({
        placement: {
          templateId,
          template,
          casterId,
          damageFormula,
          step: skipToDirection ? 'direction' : 'origin',
          origin: skipToDirection ? tokenOrigin : null,
          previewOrigin: tokenOrigin,
          previewDirection: 0,
          casterToken,
          multiDropGroupId,
          multiDropTotal: template.multiDrop?.count,
          multiDropPlaced: isMultiDrop ? 0 : undefined,
        },
      });
    },

    /** Advance from origin step to direction step */
    setPlacementOrigin: (origin: { x: number; y: number }) => {
      set((s) => {
        if (!s.placement) return s;
        return {
          placement: { ...s.placement, step: 'direction', origin, previewOrigin: origin },
        };
      });
    },

    updatePlacementPreview: (origin, direction) => {
      set((s) => {
        if (!s.placement) return s;
        return {
          placement: { ...s.placement, previewOrigin: origin, previewDirection: direction },
        };
      });
    },

    cancelPlacement: () => set({ placement: null }),

    // ------------------------------------------------------------------
    // Placed effects
    // ------------------------------------------------------------------

    placeEffect: (templateId, origin, mapId, options = {}) => {
      const template = get().getTemplate(templateId);
      if (!template) {
        throw new Error(`Effect template not found: ${templateId}`);
      }

      const effect: PlacedEffect = {
        id: createEffectId(),
        templateId,
        template: { ...template }, // snapshot
        origin,
        direction: options.direction,
        casterId: options.casterId,
        placedAt: performance.now(),
        roundsRemaining:
          template.persistence === 'persistent'
            ? template.durationRounds ?? 0
            : undefined,
        mapId,
        impactedTargets: options.impactedTargets ?? [],
        triggeredTokenIds: [],
        groupId: options.groupId,
      };

      set((s) => ({ placedEffects: [...s.placedEffects, effect] }));
      return effect;
    },

    removeEffect: (effectId) => {
      set((s) => ({
        placedEffects: s.placedEffects.filter((e) => e.id !== effectId),
      }));
    },

    dismissEffect: (effectId) => {
      set((s) => ({
        placedEffects: s.placedEffects.map((e) =>
          e.id === effectId && !e.dismissedAt
            ? { ...e, dismissedAt: performance.now() }
            : e
        ),
      }));
    },

    cleanupDismissedEffects: () => {
      const now = performance.now();
      const FADE_DURATION = 500;
      set((s) => ({
        placedEffects: s.placedEffects.filter(
          (e) => !e.dismissedAt || (now - e.dismissedAt) < FADE_DURATION
        ),
      }));
    },

    clearEffectsForMap: (mapId) => {
      set((s) => ({
        placedEffects: s.placedEffects.filter((e) => e.mapId !== mapId),
      }));
    },

    tickRound: () => {
      set((s) => {
        const updated = s.placedEffects
          .map((e) => {
            // Determine if this effect should reset triggers each round
            // Default: recurring is true for persistent effects unless explicitly set to false
            const isRecurring = e.template.recurring !== false;

            if (e.roundsRemaining === undefined || e.roundsRemaining === 0) {
              // Reset triggered tokens only for recurring effects
              return (isRecurring && e.triggeredTokenIds.length > 0)
                ? { ...e, triggeredTokenIds: [] }
                : e;
            }
            const newTriggered = isRecurring ? [] : e.triggeredTokenIds;
            return { ...e, roundsRemaining: e.roundsRemaining - 1, triggeredTokenIds: newTriggered };
          })
          .filter((e) => e.roundsRemaining === undefined || e.roundsRemaining >= 0);
        return { placedEffects: updated };
      });
    },

    markTokenTriggered: (effectId, tokenId) => {
      set((s) => ({
        placedEffects: s.placedEffects.map((e) =>
          e.id === effectId && !e.triggeredTokenIds.includes(tokenId)
            ? { ...e, triggeredTokenIds: [...e.triggeredTokenIds, tokenId] }
            : e
        ),
      }));
    },

    resetTriggeredTokens: (effectId) => {
      set((s) => ({
        placedEffects: s.placedEffects.map((e) =>
          e.id === effectId ? { ...e, triggeredTokenIds: [] } : e
        ),
      }));
    },

    toggleRecurring: (effectId) => {
      set((s) => ({
        placedEffects: s.placedEffects.map((e) =>
          e.id === effectId
            ? { ...e, template: { ...e.template, recurring: e.template.recurring === false ? true : false } }
            : e
        ),
      }));
    },

    toggleAnimationPaused: (effectId) => {
      set((s) => ({
        placedEffects: s.placedEffects.map((e) =>
          e.id === effectId
            ? { ...e, animationPaused: !e.animationPaused }
            : e
        ),
      }));
    },

    clearAll: () => set({ placedEffects: [], placement: null }),
  };
});
