import React, { useState, useEffect, useCallback } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Edit3, Palette, Trash2, Dices, Plus, Eye, Scan, Shield, Lightbulb, Sparkles, Upload, X, ExternalLink, Link2, Save, Bookmark, Footprints, FileText, Swords, MapPin, Copy, BookOpen, Star, Zap, RotateCw } from 'lucide-react';
import { CardSaveEvent } from '@/components/cards/CardSaveButton';
import { LinkedCreatureSection } from './LinkedCreatureSection';
import { TokenIlluminationModal } from './modals/TokenIlluminationModal';
import { ImageImportModal, type ImageImportResult } from './modals/ImageImportModal';
import { TokenEditModal } from './modals/TokenEditModal';
import { TokenPathPreviewCanvas } from './TokenPathPreviewCanvas';
import { useSessionStore, type Token, type LabelPosition, type AppearanceVariant, type PathStyle, type FootprintType } from '../stores/sessionStore';
import { FOOTPRINT_TYPES, PATH_STYLES } from '@/lib/footprintShapes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from '@/components/ui/slider';
import { useRoleStore } from '../stores/roleStore';
import { useInitiativeStore } from '../stores/initiativeStore';
import { getSelectablePresets, presetToIlluminationSource, type PresetKey } from '../lib/illuminationPresets';
import { 
  canControlToken, 
  canDeleteToken, 
  canAssignTokenRoles 
} from '../lib/rolePermissions';
import { toast } from 'sonner';
import { saveTokenTexture, loadTextureByHash, hashImageData, saveVariantTexture } from '@/lib/textureStorage';
import { uploadTexture } from '@/lib/textureSync';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { useCreatureStore } from '@/stores/creatureStore';
import { useActionStore } from '@/stores/actionStore';
import { collectAllActions, parseAttacksFromJson, type TokenActionItem, type TokenActionCategory } from '@/lib/attackParser';
import { DEFAULT_SLAM_ATTACK } from '@/types/actionTypes';
import type { AttackDefinition } from '@/types/actionTypes';
import { useMapStore } from '@/stores/mapStore';
import { useEffectStore } from '@/stores/effectStore';


/** Submenu for transferring tokens to a different map */
const MoveToMapSubmenu = ({ targetTokens, canControl }: { targetTokens: { id: string; name?: string; mapId?: string }[]; canControl: boolean }) => {
  const maps = useMapStore((s) => s.maps);
  const { setTokens, tokens } = useSessionStore();

  const handleMoveToMap = (mapId: string) => {
    const tokenIds = new Set(targetTokens.map(t => t.id));
    const updated = tokens.map(t => tokenIds.has(t.id) ? { ...t, mapId } : t);
    setTokens(updated);
    const mapName = maps.find(m => m.id === mapId)?.name || mapId;
    toast.success(`Moved ${targetTokens.length} token${targetTokens.length > 1 ? 's' : ''} to ${mapName}`);
  };

  if (maps.length < 2) return null;

  // Determine current map of tokens (if all on same map)
  const currentMapId = targetTokens.length > 0 ? targetTokens[0].mapId : undefined;

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger disabled={!canControl}>
        <MapPin className="mr-2 h-4 w-4" />
        <span>Move to Map</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48 bg-popover z-[1000]">
        {maps.map((map) => {
          const isCurrent = currentMapId === map.id;
          return (
            <ContextMenuItem
              key={map.id}
              onClick={() => handleMoveToMap(map.id)}
              disabled={isCurrent}
            >
              {isCurrent && <span className="mr-2">✓</span>}
              <span className="flex-1">{map.name}</span>
              {!map.active && <span className="text-xs text-muted-foreground ml-2">inactive</span>}
            </ContextMenuItem>
          );
        })}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
};

interface TokenContextMenuProps {
  children: React.ReactNode;
  tokenId: string;
  onColorChange?: (tokenId: string, color: string) => void;
  onUpdateCanvas?: () => void;
  /** Only ONE instance should set this true — prevents duplicate modal opens */
  listenForExternalOpen?: boolean;
}



export const TokenContextMenu = ({ 
  children, 
  tokenId, 
  onColorChange,
  onUpdateCanvas,
  listenForExternalOpen = false,
}: TokenContextMenuProps) => {
  const { 
    tokens, 
    selectedTokenIds, 
    updateTokenLabel,
    updateTokenName,
    updateTokenLabelPosition,
    updateTokenLabelStyle,
    updateTokenImage,
    updateTokenSize,
    updateTokenDetails,
    updateTokenVision,
    updateTokenVisionRange,
    updateTokenIllumination,
    updateTokenEntityRef,
    removeToken,
    setTokenOwner,
    addAppearanceVariant,
    removeAppearanceVariant,
    setActiveVariant,
    currentPlayerId,
    players
  } = useSessionStore();
  
  const { roles } = useRoleStore();
  const { addToInitiative } = useInitiativeStore();
  const { registerCard, setVisibility, bringToFront, cards } = useCardStore();
  const { getCreatureType } = useCreatureStore();
  
  const [showTokenEditModal, setShowTokenEditModal] = useState(false);
  // When the edit modal is opened externally (e.g. character sheet header), we
  // force it to operate on exactly one specific token regardless of canvas selection.
  const [forcedSingleTokenId, setForcedSingleTokenId] = useState<string | null>(null);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [showVisionRangeModal, setShowVisionRangeModal] = useState(false);
  const [showIlluminationModal, setShowIlluminationModal] = useState(false);
  

  const [colorValue, setColorValue] = useState('#FF6B6B');
  const [initiativeValue, setInitiativeValue] = useState('');
  const [visionRangeValue, setVisionRangeValue] = useState('');
  const [useGradientsValue, setUseGradientsValue] = useState(true);
  
  // Label style presets - each has a text color and background color
  const labelStylePresets = [
    { name: 'Default', labelColor: '#FFFFFF', bgColor: 'rgba(30, 30, 30, 0.75)' },
    { name: 'Hostile', labelColor: '#FFFFFF', bgColor: 'rgba(180, 40, 40, 0.85)' },
    { name: 'Friendly', labelColor: '#FFFFFF', bgColor: 'rgba(40, 120, 40, 0.85)' },
    { name: 'Neutral', labelColor: '#FFFFFF', bgColor: 'rgba(40, 80, 140, 0.85)' },
    { name: 'Warning', labelColor: '#1a1a1a', bgColor: 'rgba(240, 180, 40, 0.9)' },
    { name: 'Stealth', labelColor: '#a0a0a0', bgColor: 'rgba(20, 20, 20, 0.6)' },
  ];

  // Get the tokens to operate on (selected tokens or just the clicked token)
  const getTargetTokens = () => {
    // External open (e.g. character sheet header) always targets exactly one token
    if (forcedSingleTokenId) {
      return tokens.filter(t => t.id === forcedSingleTokenId);
    }
    if (selectedTokenIds.includes(tokenId)) {
      return tokens.filter(t => selectedTokenIds.includes(t.id));
    }
    return tokens.filter(t => t.id === tokenId);
  };

  // Get current player for permission checks
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  
  // Check permissions for target tokens
  const targetTokens = getTargetTokens();
  const canControl = currentPlayer && targetTokens.every(token => 
    canControlToken(token, currentPlayer, roles)
  );
  const canDelete = currentPlayer && targetTokens.every(token => 
    canDeleteToken(token, currentPlayer, roles)
  );
  const canAssignRoles = currentPlayer && canAssignTokenRoles(currentPlayer, roles);
  
  const isMultiSelection = targetTokens.length > 1;
  const hasVisionEnabled = targetTokens.every(t => t.hasVision !== false);
  const isHidden = targetTokens.every(t => t.isHidden);

  const handleEditTokenClick = () => {
    if (!canControl) {
      toast.error("You don't have permission to edit these tokens");
      return;
    }
    setShowTokenEditModal(true);
  };

  // Listen for external "openEditTokenModal" events (e.g. from CharacterSheetCard header click)
  useEffect(() => {
    const handler = (e: Event) => {
      const { tokenId: tid } = (e as CustomEvent<{ tokenId: string }>).detail;
      const token = useSessionStore.getState().tokens.find(t => t.id === tid);
      if (!token) return;
      
      // Force targetTokens to resolve to exactly this token, ignoring canvas selection
      setForcedSingleTokenId(tid);
      setShowTokenEditModal(true);
    };
    if (!listenForExternalOpen) return;
    window.addEventListener('openEditTokenModal', handler);
    return () => window.removeEventListener('openEditTokenModal', handler);
  }, [listenForExternalOpen]);



  // Get current token for variant operations (single selection only)
  const currentToken = targetTokens.length === 1 ? targetTokens[0] : null;

  // Check if single token has a linked creature
  const linkedCreatureId = !isMultiSelection && currentToken?.entityRef?.entityId;
  const linkedCreatureType = linkedCreatureId ? getCreatureType(linkedCreatureId) : undefined;
  const hasLinkedCreature = !!linkedCreatureType;

  // Handle opening the character sheet card for any token (linked or not)
  const handleViewStats = () => {
    if (!currentToken) return;
    
    // Always open as CHARACTER_SHEET with tokenId
    const existingCard = cards.find(c => 
      c.type === CardType.CHARACTER_SHEET && 
      c.metadata?.tokenId === currentToken.id
    );
    
    if (existingCard) {
      setVisibility(existingCard.id, true);
      bringToFront(existingCard.id);
    } else {
      const cardId = registerCard({
        type: CardType.CHARACTER_SHEET,
        title: 'Character Sheet',
        defaultPosition: { x: 360, y: 80 },
        defaultSize: { width: 480, height: 680 },
        minSize: { width: 400, height: 500 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
        metadata: { tokenId: currentToken.id },
      });
      bringToFront(cardId);
    }
  };

  // Get all available actions for the current token
  const getAvailableActions = (): TokenActionItem[] => {
    if (!currentToken) return [{ id: 'default-slam', name: 'Slam', category: 'attack', attackBonus: 0, damageFormula: '1d4', damageType: 'bludgeoning', range: '5 ft.', description: 'A basic melee attack.', asAttack: DEFAULT_SLAM_ATTACK }];
    
    // Try to parse from stat block JSON
    if (currentToken.statBlockJson) {
      try {
        const json = JSON.parse(currentToken.statBlockJson);
        return collectAllActions(json);
      } catch { /* fall through */ }
    }

    // Try linked creature data
    if (currentToken.entityRef?.entityId) {
      const creature = useCreatureStore.getState();
      const monster = creature.getMonsterById(currentToken.entityRef.entityId);
      if (monster) return collectAllActions(monster);
      const character = creature.getCharacterById(currentToken.entityRef.entityId);
      if (character) return collectAllActions(character);
    }

    return [{ id: 'default-slam', name: 'Slam', category: 'attack', attackBonus: 0, damageFormula: '1d4', damageType: 'bludgeoning', range: '5 ft.', description: 'A basic melee attack.', asAttack: DEFAULT_SLAM_ATTACK }];
  };

  // Legacy compat
  const getAvailableAttacks = (): AttackDefinition[] => {
    return getAvailableActions().filter(a => a.asAttack).map(a => a.asAttack!);
  };

  const handleStartAttack = (attack: AttackDefinition) => {
    if (!currentToken) return;
    
    // Open/focus the Action Card
    const cardStore = useCardStore.getState();
    let actionCard = cardStore.getCardByType(CardType.ACTION_CARD);
    if (!actionCard) {
      const newId = cardStore.registerCard({
        type: CardType.ACTION_CARD,
        title: 'Action',
        defaultPosition: { x: 360, y: 80 },
        defaultSize: { width: 380, height: 550 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
      actionCard = cardStore.getCard(newId) ?? undefined;
    }
    if (actionCard) {
      cardStore.setVisibility(actionCard.id, true);
      cardStore.bringToFront(actionCard.id);
    }

    // Start the attack in the action store
    useActionStore.getState().startAttack(currentToken.id, attack);
  };

  // Handle unlinking a creature from the token
  const handleUnlinkCreature = () => {
    if (!currentToken) return;
    updateTokenEntityRef(currentToken.id, undefined);
    toast.success('Creature unlinked from token');
  };

  // Handle linking a creature to the token
  const handleLinkCreature = (creatureId: string, creatureType: 'character' | 'monster') => {
    if (!currentToken) return;
    updateTokenEntityRef(currentToken.id, {
      type: 'local',
      entityId: creatureId,
      projectionType: creatureType === 'monster' ? 'stat-block' : 'character',
    });
    toast.success(`Token linked to ${creatureType}`);
  };


  const handleColorClick = () => {
    if (!canControl) {
      toast.error("You don't have permission to edit these tokens");
      return;
    }
    
    if (targetTokens.length === 1) {
      setColorValue(targetTokens[0].color || '#FF6B6B');
    } else {
      setColorValue('#FF6B6B'); // Default for multi-edit
    }
    setShowColorModal(true);
  };

  const handleDeleteClick = () => {
    if (!canDelete) {
      toast.error("You don't have permission to delete these tokens");
      return;
    }
    setShowDeleteModal(true);
  };



  const applyColor = () => {
    targetTokens.forEach(token => {
      if (onColorChange) {
        onColorChange(token.id, colorValue);
      }
    });
    setShowColorModal(false);
    onUpdateCanvas?.();
    toast.success(`Color updated for ${targetTokens.length} token(s)`);
  };

  const confirmDelete = () => {
    targetTokens.forEach(token => {
      removeToken(token.id);
    });
    setShowDeleteModal(false);
    onUpdateCanvas?.();
    toast.success(`Deleted ${targetTokens.length} token(s)`);
  };

  const handleInitiativeClick = () => {
    setInitiativeValue('');
    setShowInitiativeModal(true);
  };

  const handleRollInitiative = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    setInitiativeValue(roll.toString());
  };

  const applyInitiative = () => {
    const initiative = parseInt(initiativeValue);
    
    if (isNaN(initiative)) {
      toast.error('Please enter a valid initiative value');
      return;
    }
    
    targetTokens.forEach(token => {
      addToInitiative(token.id, initiative);
    });
    
    setShowInitiativeModal(false);
    toast.success(`Added ${targetTokens.length} token(s) to initiative`);
  };

  const handleToggleVision = () => {
    if (!canControl) {
      toast.error("You don't have permission to modify vision settings");
      return;
    }
    
    const newVisionState = !hasVisionEnabled;
    targetTokens.forEach(token => {
      updateTokenVision(token.id, newVisionState);
    });
    onUpdateCanvas?.();
    toast.success(`Vision ${newVisionState ? 'enabled' : 'disabled'} for ${targetTokens.length} token(s)`);
  };

  const handleVisionRangeClick = () => {
    if (!canControl) {
      toast.error("You don't have permission to modify vision settings");
      return;
    }
    
    if (targetTokens.length === 1) {
      const token = targetTokens[0];
      setVisionRangeValue(token.visionRange?.toString() || '');
      setUseGradientsValue(token.useGradients !== false);
    } else {
      setVisionRangeValue('');
      setUseGradientsValue(true);
    }
    setShowVisionRangeModal(true);
  };

  const applyIlluminationPreset = (presetKey: PresetKey) => {
    if (!canControl) {
      toast.error("You don't have permission to modify illumination settings");
      return;
    }
    
    const presets = getSelectablePresets();
    const presetEntry = presets.find(p => p.key === presetKey);
    if (!presetEntry) return;
    
    const illuminationSettings = presetToIlluminationSource(presetEntry.preset);
    
    targetTokens.forEach(token => {
      updateTokenIllumination(token.id, illuminationSettings);
    });
    
    onUpdateCanvas?.();
    toast.success(`Applied ${presetEntry.preset.icon} ${presetEntry.preset.name} to ${targetTokens.length} token(s)`);
  };

  const handleAssignRole = (roleId: string) => {
    if (!canAssignRoles) {
      toast.error("You don't have permission to assign roles to tokens");
      return;
    }
    
    const role = roles.find(r => r.id === roleId);
    
    if (!role) return;
    
    targetTokens.forEach(token => {
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) =>
          t.id === token.id ? { ...t, roleId } : t
        ),
      }));
    });
    
    onUpdateCanvas?.();
    toast.success(`Assigned ${targetTokens.length} token(s) to ${role.name}`);
  };

  const handleToggleHidden = () => {
    if (!canAssignRoles) {
      toast.error("You don't have permission to hide/show tokens");
      return;
    }
    
    const newHiddenState = !isHidden;
    
    targetTokens.forEach(token => {
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) =>
          t.id === token.id ? { ...t, isHidden: newHiddenState } : t
        ),
      }));
    });
    
    onUpdateCanvas?.();
    toast.success(`${newHiddenState ? 'Hidden' : 'Shown'} ${targetTokens.length} token(s)`);
  };

  // Quick variant switch from context menu (single token only)
  const handleQuickVariantSwitch = async (variant: AppearanceVariant) => {
    if (!currentToken) return;
    if (!canControl) {
      toast.error("You don't have permission to modify this token");
      return;
    }

    // Apply the variant to the token
    setActiveVariant(currentToken.id, variant.id);
    updateTokenSize(currentToken.id, variant.gridWidth, variant.gridHeight);

    // Load and apply the image
    if (variant.imageHash) {
      try {
        const url = await loadTextureByHash(variant.imageHash);
        if (url) {
          updateTokenImage(currentToken.id, url, variant.imageHash);
        } else {
          toast.error(`Texture for "${variant.name}" not found`);
        }
      } catch (e) {
        console.error('Failed to load variant image:', e);
        toast.error(`Failed to load texture for "${variant.name}"`);
      }
    } else {
      updateTokenImage(currentToken.id, '', undefined);
    }

    onUpdateCanvas?.();
    toast.success(`Switched to "${variant.name}"`);
  };

  const applyVisionRange = () => {
    // Apply custom settings
    const range = visionRangeValue === '' ? undefined : parseFloat(visionRangeValue);
    
    if (range !== undefined && (isNaN(range) || range < 0)) {
      toast.error('Please enter a valid vision range');
      return;
    }
    
    targetTokens.forEach(token => {
      // Update legacy fields for backward compatibility
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) =>
          t.id === token.id
            ? {
                ...t,
                visionRange: range,
                useGradients: useGradientsValue,
              }
            : t
        ),
      }));
      
      // CRITICAL: Also sync to illuminationSources so renderer sees the change
      if (range !== undefined) {
        updateTokenIllumination(token.id, { 
          range,
          dimIntensity: useGradientsValue ? 0.4 : 0.0,
          softEdge: useGradientsValue,
        });
      }
    });
    
    setShowVisionRangeModal(false);
    onUpdateCanvas?.();
    toast.success(`Vision settings updated for ${targetTokens.length} token(s)`);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 bg-popover z-[1000]">
          {/* Character Sheet - always available for single tokens */}
          {!isMultiSelection && (
            <ContextMenuItem onClick={handleViewStats}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Character Sheet</span>
            </ContextMenuItem>
          )}
          {!isMultiSelection && <ContextMenuSeparator />}
          <ContextMenuItem onClick={handleEditTokenClick} disabled={!canControl}>
            <Edit3 className="mr-2 h-4 w-4" />
            <span>Edit Token{isMultiSelection ? 's' : ''}</span>
            {!canControl && <span className="ml-auto text-xs text-muted-foreground">No permission</span>}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleColorClick} disabled={!canControl}>
            <Palette className="mr-2 h-4 w-4" />
            <span>Change Color{isMultiSelection ? 's' : ''}</span>
            {!canControl && <span className="ml-auto text-xs text-muted-foreground">No permission</span>}
          </ContextMenuItem>
          {/* Quick Variant Switcher - only show for single token with variants */}
          {currentToken && currentToken.appearanceVariants && currentToken.appearanceVariants.length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger disabled={!canControl}>
                <Bookmark className="mr-2 h-4 w-4" />
                <span>Switch Variant</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48 bg-popover z-[1000]">
                {currentToken.appearanceVariants.map((variant) => {
                  const isActive = currentToken.activeVariantId === variant.id;
                  return (
                    <ContextMenuItem 
                      key={variant.id}
                      onClick={() => handleQuickVariantSwitch(variant)}
                      disabled={isActive}
                    >
                      {isActive && <span className="mr-2">✓</span>}
                      <span className="flex-1">{variant.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {variant.gridWidth}×{variant.gridHeight}
                      </span>
                    </ContextMenuItem>
                  );
                })}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem
            checked={hasVisionEnabled}
            onCheckedChange={handleToggleVision}
            disabled={!canControl}
          >
            <Eye className="mr-2 h-4 w-4" />
            <span>Has Vision</span>
          </ContextMenuCheckboxItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger disabled={!canControl}>
              <Sparkles className="mr-2 h-4 w-4" />
              <span>Apply Illumination Preset</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48 bg-popover z-[1000]">
              {getSelectablePresets().map(({ key, preset }) => (
                <ContextMenuItem 
                  key={key}
                  onClick={() => applyIlluminationPreset(key)}
                >
                  <span className="mr-2">{preset.icon}</span>
                  <span className="flex-1">{preset.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{preset.range * 5}ft</span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem onClick={handleVisionRangeClick} disabled={!canControl}>
            <Scan className="mr-2 h-4 w-4" />
            <span>Set Vision Range</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowIlluminationModal(true)} disabled={!canControl}>
            <Lightbulb className="mr-2 h-4 w-4" />
            <span>Illumination Settings</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          {canAssignRoles && (
            <>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Assign to Role</span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48 bg-popover z-[1000]">
                  {roles.map((role) => {
                    const isCurrentRole = targetTokens.every(t => t.roleId === role.id);
                    return (
                      <ContextMenuItem 
                        key={role.id}
                        onClick={() => handleAssignRole(role.id)}
                      >
                        {isCurrentRole && <span className="mr-2">✓</span>}
                        <div 
                          className="mr-2 h-3 w-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: role.color }}
                        />
                        <span className="flex-1">{role.name}</span>
                        {role.isSystem && (
                          <span className="text-xs text-muted-foreground ml-2">System</span>
                        )}
                      </ContextMenuItem>
                    );
                  })}
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuCheckboxItem
                checked={isHidden}
                onCheckedChange={handleToggleHidden}
              >
                <Eye className="mr-2 h-4 w-4" />
                <span>{isHidden ? 'Show' : 'Hide'} Token{isMultiSelection ? 's' : ''}</span>
              </ContextMenuCheckboxItem>
              <ContextMenuSeparator />
            </>
          )}
          {/* Actions submenu — attacks, spells, skills, traits */}
          {!isMultiSelection && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Swords className="mr-2 h-4 w-4" />
                <span>Actions</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-64 bg-popover z-[1000] max-h-[400px] overflow-y-auto">
                {(() => {
                  const allActions = getAvailableActions();
                  const grouped: Partial<Record<TokenActionCategory, TokenActionItem[]>> = {};
                  for (const item of allActions) {
                    if (!grouped[item.category]) grouped[item.category] = [];
                    grouped[item.category]!.push(item);
                  }

                  const categoryConfig: { key: TokenActionCategory; label: string; icon: React.ReactNode }[] = [
                    { key: 'attack', label: 'Attacks', icon: <Swords className="w-3 h-3" /> },
                    { key: 'spell', label: 'Spells', icon: <Sparkles className="w-3 h-3" /> },
                    { key: 'bonus', label: 'Bonus Actions', icon: <Zap className="w-3 h-3" /> },
                    { key: 'reaction', label: 'Reactions', icon: <RotateCw className="w-3 h-3" /> },
                    { key: 'legendary', label: 'Legendary', icon: <Star className="w-3 h-3" /> },
                    { key: 'skill', label: 'Skills', icon: <Dices className="w-3 h-3" /> },
                    { key: 'trait', label: 'Traits & Features', icon: <BookOpen className="w-3 h-3" /> },
                  ];

                  return categoryConfig.map(({ key, label, icon }) => {
                    const items = grouped[key];
                    if (!items || items.length === 0) return null;
                    return (
                      <ContextMenuSub key={key}>
                        <ContextMenuSubTrigger className="text-xs">
                          <span className="mr-2">{icon}</span>
                          <span>{label}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">{items.length}</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-60 bg-popover z-[1001] max-h-[300px] overflow-y-auto">
                          {items.map(item => (
                            <ContextMenuItem
                              key={item.id}
                            onClick={() => {
                                if (item.asAttack) {
                                  handleStartAttack(item.asAttack);
                                } else {
                                  // Try explicit effectTemplateId first, then name match
                                  const effectStore = useEffectStore.getState();
                                  const matchedTemplate = item.effectTemplateId
                                    ? effectStore.getTemplate(item.effectTemplateId)
                                    : effectStore.allTemplates.find(
                                        t => t.name.toLowerCase() === item.name.toLowerCase()
                                      );
                                  if (matchedTemplate && currentToken) {
                                    // Use the spell's level (from the action item), fall back to template baseLevel
                                    const castLevel = item.spellLevel ?? matchedTemplate.baseLevel;
                                    const gridUnit = 50;
                                    effectStore.startPlacement(
                                      matchedTemplate.id,
                                      currentToken.id,
                                      undefined,
                                      { x: currentToken.x, y: currentToken.y, gridWidth: (currentToken.gridWidth || 1) * gridUnit, gridHeight: (currentToken.gridHeight || 1) * gridUnit },
                                      castLevel,
                                    );
                                    toast.info(`Placing ${matchedTemplate.name}${castLevel ? ` at level ${castLevel}` : ''}`);
                                  } else if (item.category === 'skill' && item.modifier !== undefined && currentToken) {
                                    useActionStore.getState().startSkillCheck(currentToken.id, item.name, item.modifier);
                                  } else {
                                    toast.info(`${item.name}: ${item.description || 'No description'}`);
                                  }
                                }
                              }}
                            >
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-xs truncate">{item.name}</span>
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {item.category === 'attack' && item.asAttack
                                    ? `+${item.attackBonus} | ${item.damageFormula} ${item.damageType}`
                                    : item.category === 'skill'
                                    ? `${item.modifier != null && item.modifier >= 0 ? '+' : ''}${item.modifier ?? 0}${item.proficient ? ' (prof)' : ''}`
                                    : item.category === 'spell'
                                    ? item.description || ''
                                    : item.description ? item.description.substring(0, 50) : ''}
                                </span>
                              </div>
                            </ContextMenuItem>
                          ))}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    );
                  });
                })()}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          <ContextMenuItem onClick={handleInitiativeClick}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Add to Initiative</span>
          </ContextMenuItem>
          {/* Duplicate */}
          <ContextMenuItem onClick={() => {
            if (!canControl) {
              toast.error("You don't have permission to duplicate these tokens");
              return;
            }
            const { addToken } = useSessionStore.getState();
            targetTokens.forEach(token => {
              const newToken: Token = {
                ...token,
                id: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                x: token.x + 30,
                y: token.y + 30,
                name: token.name ? `${token.name} (copy)` : '',
                label: token.label ? `${token.label} (copy)` : '',
              };
              addToken(newToken);
            });
            onUpdateCanvas?.();
            toast.success(`Duplicated ${targetTokens.length} token${targetTokens.length > 1 ? 's' : ''}`);
          }} disabled={!canControl}>
            <Copy className="mr-2 h-4 w-4" />
            <span>Duplicate{isMultiSelection ? ` ${targetTokens.length}` : ''}</span>
          </ContextMenuItem>
          {/* Move to Map submenu */}
          <MoveToMapSubmenu targetTokens={targetTokens} canControl={!!canControl} />
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleDeleteClick} className="text-destructive" disabled={!canDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete Token{isMultiSelection ? 's' : ''}</span>
            {!canDelete && <span className="ml-auto text-xs text-muted-foreground">No permission</span>}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Token Edit Modal */}
      <TokenEditModal
        open={showTokenEditModal}
        onOpenChange={(open) => {
          setShowTokenEditModal(open);
          if (!open) setForcedSingleTokenId(null);
        }}
        targetTokens={targetTokens}
        onUpdateCanvas={onUpdateCanvas}
      />

      {/* Color Picker Modal */}
      <Dialog open={showColorModal} onOpenChange={setShowColorModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change Token Color{isMultiSelection ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              {isMultiSelection 
                ? `Select a color for ${targetTokens.length} tokens`
                : 'Choose a new color for this token'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="token-color">Token Color</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="token-color"
                  type="color"
                  value={colorValue}
                  onChange={(e) => setColorValue(e.target.value)}
                  className="w-20 h-10 p-1"
                />
                <span className="text-sm text-muted-foreground">
                  {colorValue}
                </span>
              </div>
            </div>
            
            {/* Color Presets */}
            <div>
              <Label className="text-sm text-muted-foreground">Quick Colors</Label>
              <div className="grid grid-cols-8 gap-2 mt-2">
                {[
                  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
                  '#FFEAA7', '#DDA0DD', '#F8C471', '#85C1E9',
                  '#F1948A', '#82E0AA', '#BB8FCE', '#F7DC6F',
                  '#85C1E9', '#98D8C8', '#F39C12', '#E74C3C'
                ].map(color => (
                  <button
                    key={color}
                    className="w-8 h-8 rounded border-2 border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => setColorValue(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColorModal(false)}>
              Cancel
            </Button>
            <Button onClick={applyColor}>
              Apply Color{isMultiSelection ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Initiative Modal */}
      <Dialog open={showInitiativeModal} onOpenChange={setShowInitiativeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Initiative</DialogTitle>
            <DialogDescription>
              {isMultiSelection 
                ? `Set initiative for ${targetTokens.length} tokens`
                : 'Enter initiative value for this token'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="initiative-value">Initiative Value</Label>
              <div className="flex gap-2">
                <Input
                  id="initiative-value"
                  type="number"
                  value={initiativeValue}
                  onChange={(e) => setInitiativeValue(e.target.value)}
                  placeholder="Enter value"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleRollInitiative}
                >
                  <Dices className="mr-2 h-4 w-4" />
                  Roll d20
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitiativeModal(false)}>
              Cancel
            </Button>
            <Button onClick={applyInitiative}>
              Add to Initiative
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Token{isMultiSelection ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              {isMultiSelection 
                ? `Are you sure you want to delete ${targetTokens.length} tokens? This action cannot be undone.`
                : 'Are you sure you want to delete this token? This action cannot be undone.'
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Token{isMultiSelection ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vision Range Modal */}
      <Dialog open={showVisionRangeModal} onOpenChange={setShowVisionRangeModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Set Vision Profile</DialogTitle>
            <DialogDescription>
              {isMultiSelection 
                ? `Configure vision for ${targetTokens.length} tokens`
                : 'Configure vision for this token'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Vision Range */}
            <div>
              <Label htmlFor="vision-range" className="text-sm font-medium">Vision Range (grid units)</Label>
              <Input
                id="vision-range"
                type="number"
                value={visionRangeValue}
                onChange={(e) => setVisionRangeValue(e.target.value)}
                placeholder="Use default"
                min="0"
                step="1"
                className="mt-2"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="use-gradients" className="text-sm">
                Use Soft Gradient Edges
              </Label>
              <Switch
                id="use-gradients"
                checked={useGradientsValue}
                onCheckedChange={setUseGradientsValue}
              />
            </div>
            
            <p className="text-xs text-muted-foreground">
              For full illumination control, use "Illumination Settings" from the context menu.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVisionRangeModal(false)}>
              Cancel
            </Button>
            <Button onClick={applyVisionRange}>
              Apply Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Illumination Settings Modal */}
      <TokenIlluminationModal
        open={showIlluminationModal}
        onOpenChange={setShowIlluminationModal}
        tokenIds={targetTokens.map(t => t.id)}
        currentIllumination={targetTokens[0]?.illuminationSources?.[0]}
        onApply={(settings) => {
          targetTokens.forEach((token) => {
            updateTokenIllumination(token.id, settings);
          });
          onUpdateCanvas?.();
          toast.success(`Illumination updated for ${targetTokens.length} token(s)`);
        }}
      />

    </>
  );
};