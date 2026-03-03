import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
// Local-storage helpers for custom templates & hidden built-ins
// ---------------------------------------------------------------------------
const CUSTOM_TEMPLATES_KEY = 'magehand-custom-effect-templates';
const HIDDEN_BUILTINS_KEY = 'magehand-hidden-builtin-effects';

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

function loadHiddenBuiltIns(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_BUILTINS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHiddenBuiltIns(ids: string[]): void {
  localStorage.setItem(HIDDEN_BUILTINS_KEY, JSON.stringify(ids));
}

function buildAllTemplates(customTemplates: EffectTemplate[], hiddenIds: string[]): EffectTemplate[] {
  const customIds = new Set(customTemplates.map(t => t.id));
  const hiddenSet = new Set(hiddenIds);
  // Built-ins that aren't hidden and haven't been overridden by a custom copy
  const visibleBuiltIns = BUILT_IN_EFFECT_TEMPLATES.filter(t => !hiddenSet.has(t.id) && !customIds.has(t.id));
  return [...visibleBuiltIns, ...customTemplates];
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

  hiddenBuiltInIds: string[];

  // --- Template CRUD ---
  addCustomTemplate: (template: Omit<EffectTemplate, 'id' | 'isBuiltIn'>) => EffectTemplate;
  updateCustomTemplate: (id: string, updates: Partial<EffectTemplate>) => void;
  deleteTemplate: (id: string) => void;
  /** Restore all hidden built-in templates */
  restoreBuiltInTemplates: () => void;
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
      waypoints?: { x: number; y: number }[];
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

export const useEffectStore = create<EffectState>()(
  persist(
    (set, get) => {
  const customTemplates = loadCustomTemplates();
  const hiddenBuiltInIds = loadHiddenBuiltIns();
  const allTemplates = buildAllTemplates(customTemplates, hiddenBuiltInIds);

  return {
    customTemplates,
    allTemplates,
    hiddenBuiltInIds,
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
          allTemplates: buildAllTemplates(updated, s.hiddenBuiltInIds),
        };
      });
      return template;
    },

    updateCustomTemplate: (id, updates) => {
      set((s) => {
        const isBuiltIn = BUILT_IN_EFFECT_TEMPLATES.some(t => t.id === id);
        let newCustom: EffectTemplate[];
        if (isBuiltIn) {
          // Clone built-in as a custom override with same ID
          const original = BUILT_IN_EFFECT_TEMPLATES.find(t => t.id === id)!;
          const overridden = { ...original, ...updates, id, isBuiltIn: false };
          newCustom = [...s.customTemplates.filter(t => t.id !== id), overridden];
        } else {
          newCustom = s.customTemplates.map((t) =>
            t.id === id ? { ...t, ...updates, id, isBuiltIn: false } : t,
          );
        }
        saveCustomTemplates(newCustom);
        return {
          customTemplates: newCustom,
          allTemplates: buildAllTemplates(newCustom, s.hiddenBuiltInIds),
        };
      });
    },

    deleteTemplate: (id) => {
      set((s) => {
        const isBuiltIn = BUILT_IN_EFFECT_TEMPLATES.some(t => t.id === id);
        const newCustom = s.customTemplates.filter((t) => t.id !== id);
        const newHidden = isBuiltIn ? [...s.hiddenBuiltInIds, id] : s.hiddenBuiltInIds;
        saveCustomTemplates(newCustom);
        saveHiddenBuiltIns(newHidden);
        return {
          customTemplates: newCustom,
          hiddenBuiltInIds: newHidden,
          allTemplates: buildAllTemplates(newCustom, newHidden),
        };
      });
    },

    restoreBuiltInTemplates: () => {
      set((s) => {
        saveHiddenBuiltIns([]);
        return {
          hiddenBuiltInIds: [],
          allTemplates: buildAllTemplates(s.customTemplates, []),
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

      // Polyline shape: go directly to polyline step
      const isPolyline = template.shape === 'polyline';

      // skipRotation: skip the direction step entirely (place at origin with direction=0)
      const wantsSkipRotation = template.skipRotation === true;

      let initialStep: 'origin' | 'direction' | 'polyline';
      if (isPolyline) {
        initialStep = 'polyline';
      } else if (skipToDirection && !wantsSkipRotation) {
        initialStep = 'direction';
      } else if (skipToDirection && wantsSkipRotation) {
        // Will auto-place immediately — still start at 'origin' but we handle it below
        initialStep = 'origin';
      } else {
        initialStep = 'origin';
      }

      set({
        placement: {
          templateId,
          template,
          casterId,
          damageFormula,
          step: initialStep,
          origin: skipToDirection ? tokenOrigin : null,
          previewOrigin: tokenOrigin,
          previewDirection: 0,
          casterToken,
          multiDropGroupId,
          multiDropTotal: template.multiDrop?.count,
          multiDropPlaced: isMultiDrop ? 0 : undefined,
          polylineWaypoints: isPolyline ? [] : undefined,
          polylineLengthUsed: isPolyline ? 0 : undefined,
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
        waypoints: options.waypoints,
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
},
    {
      name: 'vtt-effect-store',
      partialize: (state) => ({
        placedEffects: state.placedEffects.filter(e => !e.dismissedAt), // Don't persist fading effects
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.placedEffects) {
          // Reset animation timers to current time so animations restart cleanly
          const now = performance.now();
          state.placedEffects = state.placedEffects.map(e => ({
            ...e,
            placedAt: now,
            dismissedAt: undefined,
          }));
        }
      },
    }
  )
);
