/**
 * cardSaveSync — listens for `card:save` events and emits the appropriate
 * durable network ops via OpBridge.
 *
 * Import this module once (side-effect) from the net barrel (`src/lib/net/index.ts`).
 */

import { CardSaveEvent, type CardSaveEventDetail } from '@/components/cards/CardSaveButton';
import { opBridge } from './OpBridge';
import { useSessionStore } from '@/stores/sessionStore';
import { useRegionStore } from '@/stores/regionStore';

function handleCardSave(e: Event) {
  const detail = (e as CustomEvent<CardSaveEventDetail>).detail;
  if (!detail?.context) return;

  const { type, id } = detail.context;

  switch (type) {
    case 'token': {
      if (!id) break;
      const token = useSessionStore.getState().tokens.find(t => t.id === id);
      if (!token) break;
      opBridge.emitLocalOp({
        kind: 'token.update',
        targets: { tokenIds: [id] },
        data: {
          id: token.id,
          name: token.name,
          x: token.x,
          y: token.y,
          gridWidth: token.gridWidth,
          gridHeight: token.gridHeight,
          color: token.color,
          label: token.label,
          labelPosition: token.labelPosition,
          imageUrl: token.imageUrl,
          imageHash: token.imageHash,
          isHidden: token.isHidden,
          notes: token.notes,
          quickReferenceUrl: token.quickReferenceUrl,
          statBlockJson: token.statBlockJson,
          roleId: token.roleId,
        },
      });
      break;
    }
    case 'region': {
      if (!id) break;
      const region = useRegionStore.getState().regions.find(r => r.id === id);
      if (!region) break;
      opBridge.emitLocalOp({
        kind: 'region.update',
        targets: { entityIds: [id] },
        data: {
          id: region.id,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          color: region.color,
          gridType: region.gridType,
          gridSize: region.gridSize,
          gridScale: region.gridScale,
          gridSnapping: region.gridSnapping,
          gridVisible: region.gridVisible,
          backgroundColor: region.backgroundColor,
          backgroundImage: region.backgroundImage,
          textureHash: region.textureHash,
          backgroundRepeat: region.backgroundRepeat,
          backgroundScale: region.backgroundScale,
          backgroundOffsetX: region.backgroundOffsetX,
          backgroundOffsetY: region.backgroundOffsetY,
          regionType: region.regionType,
          pathPoints: region.pathPoints,
          bezierControlPoints: region.bezierControlPoints,
          smoothing: region.smoothing,
          rotation: region.rotation,
          rotationCenter: region.rotationCenter,
          locked: region.locked,
          mapId: region.mapId,
        },
      });
      break;
    }
    default:
      console.log(`[cardSaveSync] No sync handler for context type: ${type}`);
  }
}

/** Call once to wire the listener. Returns a cleanup function. */
export function initCardSaveSync(): () => void {
  window.addEventListener(CardSaveEvent.TYPE, handleCardSave);
  return () => window.removeEventListener(CardSaveEvent.TYPE, handleCardSave);
}
