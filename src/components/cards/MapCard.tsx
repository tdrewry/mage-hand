import React, { useRef, useEffect, useState } from 'react';
import { useCanvasTransform } from '@/hooks/useCanvasTransform';
import { useTokenInteraction } from '@/hooks/useTokenInteraction';
import { useRegionInteraction } from '@/hooks/useRegionInteraction';
import { useSessionStore } from '@/stores/sessionStore';
import { useMapStore } from '@/stores/mapStore';
import { useRegionStore } from '@/stores/regionStore';
import { useFogStore } from '@/stores/fogStore';
import { useLightStore } from '@/stores/lightStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useRoleStore } from '@/stores/roleStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { getTokensForVisionCalculation } from '@/lib/visionPermissions';
import { getFogScope, computeFogMasks, visibilityPolygonToPaperPath, addVisibleToExplored, createEmptyExplored } from '@/lib/fogGeometry';
import { computeTokenVisibilityPaper } from '@/lib/fogOfWar';
import { regionsToSegments } from '@/lib/visibilityEngine';
import { computeIllumination, renderShadows, renderLightSources } from '@/lib/lightSystem';
import { renderFogLayers } from '@/lib/fogRenderer';
import { renderDungeonMapRegions, renderDungeonMapDoors } from '@/lib/dungeonRenderer';
import paper from 'paper';

export const MapCardContent = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    transform, 
    screenToWorld, 
    worldToScreen,
    startPan, 
    updatePan, 
    endPan, 
    zoom 
  } = useCanvasTransform();
  
  const {
    selectedTokenIds,
    isDraggingToken,
    dragPath,
    getTokenAtPosition,
    startTokenDrag,
    updateTokenDrag,
    endTokenDrag,
    selectToken,
    clearSelection: clearTokenSelection
  } = useTokenInteraction();

  const {
    isDraggingRegion,
    getRegionAtPosition,
    startRegionDrag,
    updateRegionDrag,
    endRegionDrag
  } = useRegionInteraction();

  const { tokens, currentPlayerId, players, tokenVisibility, labelVisibility } = useSessionStore();
  const { maps } = useMapStore();
  const { regions } = useRegionStore();
  const fogSettings = useFogStore();
  const { roles } = useRoleStore();
  const { visibilitySnapshot, isConnected } = useMultiplayerStore(state => ({
    visibilitySnapshot: state.visibilitySnapshot,
    isConnected: state.connectionStatus === 'connected'
  }));
  const { lights, globalAmbientLight, shadowIntensity } = useLightStore();
  const { 
    renderingMode, 
    doors, 
    wallEdgeStyle, 
    wallThickness, 
    textureScale, 
    watabouStyle 
  } = useDungeonStore();

  // Fog of war state
  const [exploredArea, setExploredArea] = useState<paper.CompoundPath | null>(null);
  const [currentVisibility, setCurrentVisibility] = useState<paper.Path | null>(null);
  const fogMasksRef = useRef<{ unexploredMask: Path2D; exploredOnlyMask: Path2D; visibleMask: Path2D } | null>(null);

  // Initialize Paper.js
  useEffect(() => {
    getFogScope();
    return () => {
      // Cleanup handled by fogGeometry module
    };
  }, []);

  // Compute fog visibility when tokens move or settings change
  useEffect(() => {
    if (!fogSettings.enabled || fogSettings.revealAll || renderingMode !== 'play') {
      setCurrentVisibility(null);
      fogMasksRef.current = null;
      return;
    }

    // In multiplayer, non-DM players receive fog data from server
    if (isConnected) {
      const currentPlayer = players.find(p => p.id === currentPlayerId);
      const isDM = roles.some(role => 
        role.name === 'Dungeon Master' && 
        currentPlayer?.roleIds?.includes(role.id)
      );
      
      // Only DM computes fog locally, players receive it via sync
      if (!isDM) {
        // Players use the synced explored areas data
        if (fogSettings.serializedExploredAreas) {
          try {
            const fogScope = getFogScope();
            fogScope.activate();
            const imported = fogScope.project.importJSON(fogSettings.serializedExploredAreas);
            if (imported && typeof imported === 'object' && 'exploredPathData' in imported) {
              const pathData = (imported as any).exploredPathData;
              if (typeof pathData === 'string') {
                const restoredPath = fogScope.project.importJSON(pathData);
                if (restoredPath instanceof paper.CompoundPath) {
                  setExploredArea(restoredPath);
                  
                  // Create full visibility from explored areas for players
                  setCurrentVisibility(restoredPath.clone() as paper.Path);
                  
                  // Compute fog masks
                  const canvasBounds = {
                    x: -10000,
                    y: -10000,
                    width: 20000,
                    height: 20000
                  };
                  const masks = computeFogMasks(restoredPath, restoredPath.clone() as paper.Path, canvasBounds);
                  fogMasksRef.current = masks;
                }
              }
            }
          } catch (e) {
            console.error('Failed to restore fog from sync:', e);
          }
        } else {
          setCurrentVisibility(null);
          fogMasksRef.current = null;
        }
        return;
      }
    }

    // DM or single-player: compute fog locally
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get wall segments from regions
    const wallSegments = regionsToSegments(regions);

    // Get current player for role-based filtering
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    if (!currentPlayer) return;

    // Filter tokens based on role permissions and hostility
    // This replaces simple ownership-based filtering with role-based logic
    const playerTokens = getTokensForVisionCalculation(
      tokens,
      currentPlayer,
      roles,
      wallSegments
    );

    // Compute visibility for player tokens
    computeTokenVisibilityPaper(
      playerTokens,
      wallSegments,
      null,
      fogSettings.visionRange * 50 // Convert grid units to pixels
    ).then((visibilityPath) => {
      if (visibilityPath) {
        setCurrentVisibility(visibilityPath);
        
        // Update explored areas
        setExploredArea(prev => {
          const currentExplored = prev || createEmptyExplored();
          return addVisibleToExplored(currentExplored, visibilityPath);
        });

        // Compute fog masks
        const canvasBounds = {
          x: -10000,
          y: -10000,
          width: 20000,
          height: 20000
        };

        const masks = computeFogMasks(
          exploredArea || createEmptyExplored(),
          visibilityPath,
          canvasBounds
        );

        fogMasksRef.current = masks;
      }
    });
  }, [tokens, regions, fogSettings, renderingMode, currentPlayerId, players, roles, isConnected]);

  // Canvas mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    if (e.button === 2 || e.button === 1) {
      startPan(e.clientX, e.clientY);
      return;
    }

    const token = getTokenAtPosition(world.x, world.y);
    if (token) {
      startTokenDrag(token.id, world.x, world.y, e.shiftKey);
      return;
    }

    const region = getRegionAtPosition(world.x, world.y);
    if (region) {
      startRegionDrag(region.id, world.x, world.y);
      return;
    }

    clearTokenSelection();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    updatePan(e.clientX, e.clientY);

    if (isDraggingToken) {
      updateTokenDrag(world.x, world.y);
    } else if (isDraggingRegion) {
      updateRegionDrag(world.x, world.y);
    }
  };

  const handleMouseUp = () => {
    endPan();
    
    if (isDraggingToken) {
      endTokenDrag();
    }
    
    if (isDraggingRegion) {
      endRegionDrag();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    zoom(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
  };

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transform
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.zoom, transform.zoom);

    // Draw maps
    maps.forEach(map => {
      if (!map.visible) return;
      // TODO: Draw map images
    });

    // Draw dungeon features if in play mode
    if (renderingMode === 'play' && doors.length > 0) {
      // Render doors if available
      renderDungeonMapDoors(ctx, doors, transform.zoom);
    }

    // Draw regions (only visible ones in play mode with fog)
    regions.forEach(region => {
      // In play mode with fog, check if region is in explored area
      if (renderingMode === 'play' && fogSettings.enabled && !fogSettings.revealAll && exploredArea) {
        const regionCenter = new paper.Point(region.x + region.width / 2, region.y + region.height / 2);
        if (!exploredArea.contains(regionCenter)) {
          return; // Skip unexplored regions
        }
      }

      // Fill region background
      if (region.backgroundColor) {
        ctx.fillStyle = region.backgroundColor;
        ctx.fillRect(region.x, region.y, region.width, region.height);
      }
      
      // Draw region outline
      ctx.strokeStyle = region.color || '#ffffff';
      ctx.lineWidth = 2 / transform.zoom;
      ctx.strokeRect(region.x, region.y, region.width, region.height);
      
      // Draw grid if enabled and visible
      if (region.gridVisible && region.gridSize && region.gridSize > 0) {
        ctx.strokeStyle = region.color || '#ffffff';
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1 / transform.zoom;
        
        if (region.gridType === 'square') {
          for (let x = region.x; x <= region.x + region.width; x += region.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, region.y);
            ctx.lineTo(x, region.y + region.height);
            ctx.stroke();
          }
          
          for (let y = region.y; y <= region.y + region.height; y += region.gridSize) {
            ctx.beginPath();
            ctx.moveTo(region.x, y);
            ctx.lineTo(region.x + region.width, y);
            ctx.stroke();
          }
        }
        
        ctx.globalAlpha = 1.0;
      }
    });

    // Compute and render dynamic lighting if enabled
    if (renderingMode === 'play') {
      const enabledLights = lights.filter(l => l.enabled);
      
      if (enabledLights.length > 0) {
        const wallSegments = regionsToSegments(regions);
        const illumination = computeIllumination(enabledLights, wallSegments);
        
        // Render shadows on regions
        renderShadows(ctx, regions, illumination, shadowIntensity, globalAmbientLight);
        
        // Optionally render light sources (for GM preview)
        if (!fogSettings.enabled || fogSettings.revealAll) {
          renderLightSources(ctx, enabledLights, transform);
        }
      }
    }

    // Filter and draw tokens based on visibility
    const visibleTokens = tokens.filter(token => {
      // In play mode, apply visibility filtering
      if (renderingMode === 'play') {
        // In multiplayer, use synced visibility data
        if (isConnected && visibilitySnapshot) {
          const tokenVisData = visibilitySnapshot.tokens.find(t => t.tokenId === token.id);
          if (tokenVisData) {
            // Check if current player can see this token
            return tokenVisData.visibleToPlayers.includes(currentPlayerId || '');
          }
          // If no visibility data, assume visible (fallback)
          return true;
        }
        
        // Single player mode - use local visibility rules
        // Check ownership
        if (tokenVisibility === 'owned' && token.ownerId !== currentPlayerId) {
          return false;
        }
        if (tokenVisibility === 'dm-only') {
          return false;
        }

        // Check fog visibility
        if (fogSettings.enabled && !fogSettings.revealAll && currentVisibility) {
          const tokenPoint = new paper.Point(token.x, token.y);
          if (!currentVisibility.contains(tokenPoint)) {
            return false; // Token is in fog
          }
        }
      }

      return true;
    });

    visibleTokens.forEach(token => {
      const isSelected = selectedTokenIds.includes(token.id);
      
      ctx.fillStyle = token.color;
      ctx.beginPath();
      ctx.arc(token.x, token.y, 20, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3 / transform.zoom;
        ctx.stroke();
      }

      // Draw label based on visibility settings
      const showLabel = 
        labelVisibility === 'show' || 
        (labelVisibility === 'selected' && isSelected);

      if (token.label && showLabel) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `${14 / transform.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(token.label, token.x, token.y - 25);
      }
    });

    // Draw drag path
    if (isDraggingToken && dragPath.length > 1) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2 / transform.zoom;
      ctx.setLineDash([5 / transform.zoom, 5 / transform.zoom]);
      ctx.beginPath();
      ctx.moveTo(dragPath[0].x, dragPath[0].y);
      dragPath.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Render fog of war layers (after restoring context for screen-space rendering)
    if (renderingMode === 'play' && fogSettings.enabled && !fogSettings.revealAll && fogMasksRef.current) {
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.zoom, transform.zoom);

      renderFogLayers(
        ctx,
        fogMasksRef.current.unexploredMask,
        fogMasksRef.current.exploredOnlyMask,
        fogMasksRef.current.visibleMask,
        fogSettings.fogOpacity,
        fogSettings.exploredOpacity
      );

      ctx.restore();
    }
  }, [
    transform, 
    tokens, 
    regions, 
    maps, 
    selectedTokenIds, 
    isDraggingToken, 
    dragPath,
    fogSettings,
    exploredArea,
    currentVisibility,
    lights,
    globalAmbientLight,
    shadowIntensity,
    renderingMode,
    tokenVisibility,
    labelVisibility,
    currentPlayerId,
    doors,
    wallEdgeStyle,
    wallThickness,
    textureScale,
    watabouStyle
  ]);

  return (
    <div className="relative w-full h-full bg-background">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};
