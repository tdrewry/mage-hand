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
  startPlacement: (templateId: string, casterId?: string) => void;
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
    },
  ) => PlacedEffect;
  removeEffect: (effectId: string) => void;
  clearEffectsForMap: (mapId: string) => void;
  tickRound: () => void; // decrement roundsRemaining, remove expired

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

    startPlacement: (templateId, casterId) => {
      const template = get().getTemplate(templateId);
      if (!template) return;
      set({
        placement: {
          templateId,
          template,
          casterId,
          previewOrigin: null,
          previewDirection: 0,
        },
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
        placedAt: Date.now(),
        roundsRemaining:
          template.persistence === 'persistent'
            ? template.durationRounds ?? 0
            : undefined,
        mapId,
        impactedTargets: options.impactedTargets ?? [],
      };

      set((s) => ({ placedEffects: [...s.placedEffects, effect] }));
      return effect;
    },

    removeEffect: (effectId) => {
      set((s) => ({
        placedEffects: s.placedEffects.filter((e) => e.id !== effectId),
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
            if (e.roundsRemaining === undefined || e.roundsRemaining === 0) return e;
            return { ...e, roundsRemaining: e.roundsRemaining - 1 };
          })
          .filter((e) => e.roundsRemaining === undefined || e.roundsRemaining >= 0);
        // Effects with roundsRemaining reaching -1 after decrement are removed
        // (they had roundsRemaining === 0 which means "until dismissed", so they stay)
        return { placedEffects: updated };
      });
    },

    clearAll: () => set({ placedEffects: [], placement: null }),
  };
});
