import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { triggerSound } from '@/lib/soundEngine';
import type {
  EffectTemplate,
  PlacedEffect,
  EffectImpact,
  EffectPlacementState,
} from '@/types/effectTypes';
import { createEffectId, computeScaledTemplate } from '@/types/effectTypes';
import { cancelEffectModifiers } from '@/lib/effectModifierEngine';
import {
  BUILT_IN_EFFECT_TEMPLATES,
  getBuiltInTemplate,
} from '@/lib/effectTemplateLibrary';
import {
  hashImageData,
  saveTextureByHash,
  loadTextureByHash,
} from '@/lib/textureStorage';

// ---------------------------------------------------------------------------
// Local-storage helpers for custom templates & hidden built-ins
// ---------------------------------------------------------------------------
const CUSTOM_TEMPLATES_KEY = 'magehand-custom-effect-templates';
const HIDDEN_BUILTINS_KEY = 'magehand-hidden-builtin-effects';

/**
 * Compute a fast synchronous hash for immediate use (FNV-1a 32-bit).
 * Used to set textureHash immediately before async IndexedDB persistence.
 */
function fastHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Strip large texture data URIs from a template, keeping only the textureHash.
 * This prevents blowing the ~5MB localStorage quota.
 */
function stripTextureData(template: EffectTemplate): EffectTemplate {
  if (!template.texture || template.texture.length < 200) return template;
  // Ensure textureHash is set before stripping
  const hash = template.textureHash || fastHash(template.texture);
  return { ...template, texture: '', textureHash: hash };
}

/**
 * Persist a template's texture to IndexedDB and set textureHash synchronously.
 * The IndexedDB write is fire-and-forget; the hash is set immediately.
 */
function persistTemplateTexture(template: EffectTemplate): void {
  if (!template.texture || template.texture.length < 200) return;
  // Set hash synchronously so it's available for localStorage
  const syncHash = fastHash(template.texture);
  template.textureHash = syncHash;
  // Also do the async SHA-256 hash + IndexedDB save
  const textureData = template.texture;
  hashImageData(textureData).then(async (sha) => {
    await saveTextureByHash(sha, textureData);
    // Update to the stronger hash
    template.textureHash = sha;
  }).catch(e => {
    console.warn('[effectStore] Failed to persist texture to IndexedDB:', e);
    // Fallback: save with sync hash
    saveTextureByHash(syncHash, textureData).catch(() => {});
  });
}

/**
 * Reload a template's texture from IndexedDB using its textureHash.
 */
async function rehydrateTemplateTexture(template: EffectTemplate): Promise<EffectTemplate> {
  const hash = template.textureHash;
  if (!hash) return template;
  if (template.texture && template.texture.length > 200) return template; // already loaded
  try {
    const dataUrl = await loadTextureByHash(hash);
    if (dataUrl) {
      return { ...template, texture: dataUrl };
    }
  } catch (e) {
    console.warn('[effectStore] Failed to rehydrate texture from IndexedDB:', e);
  }
  return template;
}

function loadCustomTemplates(): EffectTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: EffectTemplate[]): void {
  // Strip texture data URIs before writing to localStorage
  const stripped = templates.map(t => stripTextureData(t));
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(stripped));
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
  startPlacement: (templateId: string, casterId?: string, damageFormula?: string, casterToken?: { x: number; y: number; gridWidth: number; gridHeight: number }, castLevel?: number) => void;
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
      castLevel?: number;
      waypoints?: { x: number; y: number }[];
    },
  ) => PlacedEffect;
  removeEffect: (effectId: string) => void;
  /** Start a fade-out dismiss animation; effect auto-removes after fade completes */
  dismissEffect: (effectId: string) => void;
  /** Cancel an effect: revert all non-damage impacts on targets, then dismiss */
  cancelEffect: (effectId: string, getCharacter: (tokenId: string) => any) => string[];
  /** Remove any effects whose fade-out animation has completed */
  cleanupDismissedEffects: () => void;
  clearEffectsForMap: (mapId: string) => void;
  tickRound: () => void; // decrement roundsRemaining, remove expired
  markTokenTriggered: (effectId: string, tokenId: string) => void;
  resetTriggeredTokens: (effectId: string) => void;
  updateTokensInsideArea: (effectId: string, tokenIds: string[]) => void;
  /** Update an aura effect's origin, impacts, and tokensInsideArea atomically */
  updateAuraState: (effectId: string, origin: { x: number; y: number }, impacts: EffectImpact[], insideIds: string[]) => void;
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
      // Persist texture to IndexedDB before stripping from localStorage
      persistTemplateTexture(template);
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
          const original = BUILT_IN_EFFECT_TEMPLATES.find(t => t.id === id)!;
          const overridden = { ...original, ...updates, id, isBuiltIn: false };
          persistTemplateTexture(overridden);
          newCustom = [...s.customTemplates.filter(t => t.id !== id), overridden];
        } else {
          newCustom = s.customTemplates.map((t) => {
            if (t.id === id) {
              const updated = { ...t, ...updates, id, isBuiltIn: false };
              persistTemplateTexture(updated);
              return updated;
            }
            return t;
          });
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
      // Custom overrides take priority over built-ins (user may have added texture etc.)
      return (
        get().customTemplates.find((t) => t.id === id) ??
        getBuiltInTemplate(id)
      );
    },

    // ------------------------------------------------------------------
    // Placement mode
    // ------------------------------------------------------------------

    startPlacement: (templateId, casterId, damageFormula, casterToken, castLevel) => {
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

      // Compute the scaled template for the cast level
      const scaledTemplate = computeScaledTemplate(template, castLevel);

      set({
        placement: {
          templateId,
          template: scaledTemplate,
          casterId,
          damageFormula,
          castLevel,
          step: initialStep,
          origin: skipToDirection ? tokenOrigin : null,
          previewOrigin: tokenOrigin,
          previewDirection: 0,
          casterToken,
          multiDropGroupId,
          multiDropTotal: scaledTemplate.multiDrop?.count,
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
      const placement = get().placement;
      set((s) => {
        if (!s.placement) return s;
        return {
          placement: { ...s.placement, previewOrigin: origin, previewDirection: direction },
        };
      });

      // Broadcast placement preview to peers
      if (placement) {
        import("@/lib/net").then(({ ephemeralBus }) => {
          ephemeralBus.emit("effect.placement.preview", {
            templateId: placement.templateId,
            origin,
            direction,
          });
        }).catch(() => { /* net not available */ });
      }
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

      // Apply level scaling if castLevel provided
      const scaledTemplate = computeScaledTemplate(template, options.castLevel);

      // Auto-detect aura: link to caster token when template has aura config
      const isAura = !!scaledTemplate.aura;
      const anchorTokenId = isAura ? options.casterId : undefined;

      const effect: PlacedEffect = {
        id: createEffectId(),
        templateId,
        template: { ...scaledTemplate }, // snapshot with scaling applied
        origin,
        direction: options.direction,
        casterId: options.casterId,
        placedAt: performance.now(),
        roundsRemaining:
          scaledTemplate.persistence === 'persistent'
            ? scaledTemplate.durationRounds ?? 0
            : undefined,
        mapId,
        impactedTargets: options.impactedTargets ?? [],
        triggeredTokenIds: [],
        groupId: options.groupId,
        castLevel: options.castLevel,
        waypoints: options.waypoints,
        ...(isAura ? { isAura: true, anchorTokenId, tokensInsideArea: [] } : {}),
      };

      // Persist template texture to IndexedDB so it survives localStorage stripping
      persistTemplateTexture(effect.template);

      set((s) => ({ placedEffects: [...s.placedEffects, effect] }));
      return effect;
    },

    removeEffect: (effectId) => {
      set((s) => ({
        placedEffects: s.placedEffects.filter((e) => e.id !== effectId),
      }));
      triggerSound('effect.removed');
    },

    dismissEffect: (effectId) => {
      set((s) => ({
        placedEffects: s.placedEffects.map((e) =>
          e.id === effectId && !e.dismissedAt
            ? { ...e, dismissedAt: performance.now() }
            : e
        ),
      }));
      triggerSound('effect.removed');
    },

    cancelEffect: (effectId, getCharacter) => {
      const affectedTokenIds = cancelEffectModifiers(effectId, getCharacter);
      set((s) => ({
        placedEffects: s.placedEffects.map((e) =>
          e.id === effectId && !e.cancelledAt
            ? { ...e, cancelledAt: performance.now(), dismissedAt: e.dismissedAt ?? performance.now() }
            : e
        ),
      }));
      return affectedTokenIds;
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

    updateTokensInsideArea: (effectId, tokenIds) => {
      set((s) => ({
        placedEffects: s.placedEffects.map((e) =>
          e.id === effectId ? { ...e, tokensInsideArea: tokenIds } : e
        ),
      }));
    },

    updateAuraState: (effectId, origin, impacts, insideIds) => {
      set((s) => ({
        placedEffects: s.placedEffects.map((e) =>
          e.id === effectId
            ? { ...e, origin, impactedTargets: impacts, tokensInsideArea: insideIds }
            : e
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
        // Strip texture data URIs from placed effects to avoid localStorage quota issues
        // Textures are persisted in IndexedDB and reloaded via textureHash
        placedEffects: state.placedEffects
          .filter(e => !e.dismissedAt)
          .map(e => ({
            ...e,
            template: stripTextureData(e.template),
          })),
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

          // Rehydrate textures from IndexedDB asynchronously
          Promise.all(
            state.placedEffects.map(async (e, i) => {
              const rehydrated = await rehydrateTemplateTexture(e.template);
              if (rehydrated !== e.template) {
                state.placedEffects[i] = { ...e, template: rehydrated };
              }
            })
          ).then(() => {
            // Trigger a re-render by setting state
            useEffectStore.setState({ placedEffects: [...state.placedEffects] });
          });
        }

        // Rehydrate custom template textures from IndexedDB
        const customTemplates = loadCustomTemplates();
        if (customTemplates.length > 0) {
          Promise.all(customTemplates.map(t => rehydrateTemplateTexture(t))).then(rehydrated => {
            const hiddenIds = loadHiddenBuiltIns();
            useEffectStore.setState({
              customTemplates: rehydrated,
              allTemplates: buildAllTemplates(rehydrated, hiddenIds),
            });
          });
        }
      },
    }
  )
);
