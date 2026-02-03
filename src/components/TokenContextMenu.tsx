import React, { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Edit3, Palette, Trash2, Dices, Plus, Eye, Scan, Shield, Lightbulb, Sparkles, Upload, X, ExternalLink, Link2, Database, Save, Bookmark, Footprints, FileText } from 'lucide-react';
import { TokenIlluminationModal } from './modals/TokenIlluminationModal';
import { ImageImportModal, type ImageImportResult } from './modals/ImageImportModal';
import { TokenPathPreviewCanvas } from './TokenPathPreviewCanvas';
import { useSessionStore, type LabelPosition, type AppearanceVariant, type PathStyle, type FootprintType } from '../stores/sessionStore';
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
import { saveTokenTexture, loadTextureByHash, hashImageData, saveVariantTexture } from '@/lib/tokenTextureStorage';
import { uploadTexture } from '@/lib/textureSync';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { useCreatureStore } from '@/stores/creatureStore';

interface TokenContextMenuProps {
  children: React.ReactNode;
  tokenId: string;
  onColorChange?: (tokenId: string, color: string) => void;
  onUpdateCanvas?: () => void;
}

// Size presets based on D&D creature sizes
const SIZE_PRESETS = [
  { name: 'Tiny', gridWidth: 0.5, gridHeight: 0.5 },
  { name: 'Small/Medium', gridWidth: 1, gridHeight: 1 },
  { name: 'Large', gridWidth: 2, gridHeight: 2 },
  { name: 'Huge', gridWidth: 3, gridHeight: 3 },
  { name: 'Gargantuan', gridWidth: 4, gridHeight: 4 },
  // Non-uniform presets for vehicles, serpents, etc.
  { name: 'Long (2×1)', gridWidth: 2, gridHeight: 1 },
  { name: 'Tall (1×2)', gridWidth: 1, gridHeight: 2 },
  { name: 'Wide (3×1)', gridWidth: 3, gridHeight: 1 },
  { name: 'Tall (1×3)', gridWidth: 1, gridHeight: 3 },
] as const;

export const TokenContextMenu = ({ 
  children, 
  tokenId, 
  onColorChange,
  onUpdateCanvas 
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
  const [showImageImportModal, setShowImageImportModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [showVisionRangeModal, setShowVisionRangeModal] = useState(false);
  const [showIlluminationModal, setShowIlluminationModal] = useState(false);
  
  // Edit modal state
  const [activeTab, setActiveTab] = useState<'label' | 'style' | 'appearance' | 'details'>('label');
  const [nameValue, setNameValue] = useState('');
  const [labelValue, setLabelValue] = useState('');
  const [labelPositionValue, setLabelPositionValue] = useState<LabelPosition>('below');
  const [imageUrlValue, setImageUrlValue] = useState('');
  const [labelColorValue, setLabelColorValue] = useState('#FFFFFF');
  const [labelBackgroundValue, setLabelBackgroundValue] = useState('rgba(30, 30, 30, 0.75)');
  const [gridWidthValue, setGridWidthValue] = useState(1);
  const [gridHeightValue, setGridHeightValue] = useState(1);
  const [notesValue, setNotesValue] = useState('');
  const [quickReferenceUrlValue, setQuickReferenceUrlValue] = useState('');
  
  // Appearance variant state
  const [showSaveVariantInput, setShowSaveVariantInput] = useState(false);
  const [variantNameInput, setVariantNameInput] = useState('');
  const [variantImageUrls, setVariantImageUrls] = useState<Record<string, string>>({});
  
  // Style tab state - path styling
  const [pathStyleValue, setPathStyleValue] = useState<PathStyle>('dashed');
  const [pathColorValue, setPathColorValue] = useState('#FFFFFF');
  const [useTokenColorForPath, setUseTokenColorForPath] = useState(true);
  const [pathWeightValue, setPathWeightValue] = useState(3);
  const [pathOpacityValue, setPathOpacityValue] = useState(0.7);
  const [pathGaitWidthValue, setPathGaitWidthValue] = useState(0.6);
  const [footprintTypeValue, setFootprintTypeValue] = useState<FootprintType>('barefoot');
  const [tokenColorValue, setTokenColorValue] = useState('#FF6B6B');
  
  // Other modal state
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

  const handleEditTokenClick = async () => {
    if (!canControl) {
      toast.error("You don't have permission to edit these tokens");
      return;
    }
    
    // Reset to first tab and clear variant UI state
    setActiveTab('label');
    setShowSaveVariantInput(false);
    setVariantNameInput('');
    
    if (targetTokens.length === 1) {
      const token = targetTokens[0];
      // Label tab fields
      setNameValue(token.name || '');
      setLabelValue(token.label || '');
      setLabelPositionValue(token.labelPosition || 'below');
      setLabelColorValue(token.labelColor || '#FFFFFF');
      setLabelBackgroundValue(token.labelBackgroundColor || 'rgba(30, 30, 30, 0.75)');
      // Appearance tab fields
      setImageUrlValue(token.imageUrl || '');
      setGridWidthValue(token.gridWidth || 1);
      setGridHeightValue(token.gridHeight || 1);
      // Details tab fields
      setNotesValue(token.notes || '');
      setQuickReferenceUrlValue(token.quickReferenceUrl || '');
      // Style tab fields
      setTokenColorValue(token.color || '#FF6B6B');
      setPathStyleValue(token.pathStyle || 'dashed');
      setPathColorValue(token.pathColor || token.color || '#FFFFFF');
      setUseTokenColorForPath(token.pathColor === undefined);
      setPathWeightValue(token.pathWeight ?? 3);
      setPathOpacityValue(token.pathOpacity ?? 0.7);
      setPathGaitWidthValue(token.pathGaitWidth ?? 0.6);
      setFootprintTypeValue(token.footprintType || 'barefoot');
      
      // Load variant image URLs from IndexedDB
      if (token.appearanceVariants?.length) {
        const urls: Record<string, string> = {};
        for (const variant of token.appearanceVariants) {
          if (variant.imageHash) {
            try {
              const url = await loadTextureByHash(variant.imageHash);
              if (url) urls[variant.id] = url;
            } catch (e) {
              console.warn('Failed to load variant image:', variant.imageHash);
            }
          }
        }
        setVariantImageUrls(urls);
      } else {
        setVariantImageUrls({});
      }
    } else {
      // Multi-selection: blank fields for batch update
      setNameValue('');
      setLabelValue('');
      setLabelPositionValue('below');
      setLabelColorValue('#FFFFFF');
      setLabelBackgroundValue('rgba(30, 30, 30, 0.75)');
      setImageUrlValue('');
      // For size, show "Mixed" if different, otherwise use common value
      const allSameSizeW = targetTokens.every(t => t.gridWidth === targetTokens[0].gridWidth);
      const allSameSizeH = targetTokens.every(t => t.gridHeight === targetTokens[0].gridHeight);
      setGridWidthValue(allSameSizeW ? targetTokens[0].gridWidth || 1 : 1);
      setGridHeightValue(allSameSizeH ? targetTokens[0].gridHeight || 1 : 1);
      setNotesValue('');
      setQuickReferenceUrlValue('');
      setVariantImageUrls({});
      // Style tab - use defaults for multi-selection
      setTokenColorValue('#FF6B6B');
      setPathStyleValue('dashed');
      setPathColorValue('#FFFFFF');
      setUseTokenColorForPath(true);
      setPathWeightValue(3);
      setPathOpacityValue(0.7);
      setPathGaitWidthValue(0.6);
      setFootprintTypeValue('barefoot');
    }
    setShowTokenEditModal(true);
  };

  // Check if current size matches a preset
  const getCurrentSizePreset = () => {
    return SIZE_PRESETS.find(p => p.gridWidth === gridWidthValue && p.gridHeight === gridHeightValue);
  };

  // Get size description for display
  const getSizeDescription = (width: number, height: number) => {
    const preset = SIZE_PRESETS.find(p => p.gridWidth === width && p.gridHeight === height);
    if (preset) return `${width}×${height} (${preset.name})`;
    return `${width}×${height}`;
  };

  // Get current token for variant operations (single selection only)
  const currentToken = targetTokens.length === 1 ? targetTokens[0] : null;

  // Check if single token has a linked creature
  const linkedCreatureId = !isMultiSelection && currentToken?.entityRef?.entityId;
  const linkedCreatureType = linkedCreatureId ? getCreatureType(linkedCreatureId) : undefined;
  const hasLinkedCreature = !!linkedCreatureType;

  // Handle opening the linked creature's stat block or character sheet
  const handleViewStats = () => {
    if (!linkedCreatureId || !linkedCreatureType) return;
    
    const cardType = linkedCreatureType === 'monster' 
      ? CardType.MONSTER_STAT_BLOCK 
      : CardType.CHARACTER_SHEET;
    
    // Check if a card of this type already exists with this creature
    const existingCard = cards.find(c => 
      c.type === cardType && 
      c.metadata?.monsterId === linkedCreatureId
    );
    
    if (existingCard) {
      // Show and bring existing card to front
      setVisibility(existingCard.id, true);
      bringToFront(existingCard.id);
    } else {
      // Register a new card with the creature ID
      const cardId = registerCard({
        type: cardType,
        title: linkedCreatureType === 'monster' ? 'Monster Stat Block' : 'Character Sheet',
        defaultPosition: { x: 360, y: 80 },
        defaultSize: { width: 420, height: 650 },
        minSize: { width: 380, height: 500 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
        metadata: { monsterId: linkedCreatureId },
      });
      bringToFront(cardId);
    }
  };
  const handleSaveVariant = async () => {
    if (!currentToken || !variantNameInput.trim()) {
      toast.error('Please enter a name for the variant');
      return;
    }

    let imageHash: string | undefined;
    
    // For variants, we need to save textures independently of the token's main mapping.
    // Using saveTokenTexture would manage refCounts tied to the token mapping and could
    // delete the previous texture when saving a new one. Instead, we hash and save directly.
    if (imageUrlValue) {
      try {
        // Generate hash for the image data
        imageHash = await hashImageData(imageUrlValue);
        // Save variant texture with proper refCount to prevent garbage collection
        await saveVariantTexture(imageHash, imageUrlValue);
        // Also upload to server for multiplayer sync
        await uploadTexture(imageHash, imageUrlValue);
        console.log('Saved variant texture with hash:', imageHash);
      } catch (e) {
        console.error('Failed to save variant image:', e);
        // Fall back to current token's hash if save fails
        imageHash = currentToken.imageHash;
      }
    }

    const variant: AppearanceVariant = {
      id: `variant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: variantNameInput.trim(),
      imageHash,
      gridWidth: gridWidthValue,
      gridHeight: gridHeightValue,
      isDefault: (currentToken.appearanceVariants?.length ?? 0) === 0,
    };

    addAppearanceVariant(currentToken.id, variant);
    
    // Update local image URLs cache
    if (imageHash && imageUrlValue) {
      setVariantImageUrls(prev => ({ ...prev, [variant.id]: imageUrlValue }));
    }

    setShowSaveVariantInput(false);
    setVariantNameInput('');
    toast.success(`Saved variant "${variant.name}" ${imageHash ? `(texture: ${imageHash.slice(0, 8)}...)` : '(no image)'}`);
  };

  // Handle using/applying a variant
  const handleUseVariant = async (variant: AppearanceVariant) => {
    if (!currentToken) return;

    console.log('Applying variant:', variant.name, 'imageHash:', variant.imageHash);

    // Update size values first (these always work)
    setGridWidthValue(variant.gridWidth);
    setGridHeightValue(variant.gridHeight);
    updateTokenSize(currentToken.id, variant.gridWidth, variant.gridHeight);

    // Apply the variant to the token (sets activeVariantId, size, and imageHash)
    setActiveVariant(currentToken.id, variant.id);

    // Load and apply the image from cache or IndexedDB
    if (variant.imageHash) {
      const cachedUrl = variantImageUrls[variant.id];
      if (cachedUrl) {
        console.log('Using cached image URL for variant');
        setImageUrlValue(cachedUrl);
        updateTokenImage(currentToken.id, cachedUrl, variant.imageHash);
      } else {
        try {
          console.log('Loading variant texture from IndexedDB:', variant.imageHash);
          const url = await loadTextureByHash(variant.imageHash);
          if (url) {
            console.log('Loaded variant texture successfully');
            setImageUrlValue(url);
            setVariantImageUrls(prev => ({ ...prev, [variant.id]: url }));
            updateTokenImage(currentToken.id, url, variant.imageHash);
          } else {
            console.warn('Variant texture not found in IndexedDB:', variant.imageHash);
            toast.error(`Texture for "${variant.name}" not found. Please re-upload the image.`);
          }
        } catch (e) {
          console.error('Failed to load variant image:', e);
          toast.error(`Failed to load texture for "${variant.name}"`);
        }
      }
    } else {
      // Variant without image - just clear the image
      console.log('Variant has no image, clearing token image');
      setImageUrlValue('');
      updateTokenImage(currentToken.id, '', undefined);
    }

    onUpdateCanvas?.();
    toast.success(`Applied variant "${variant.name}"`);
  };

  // Handle deleting a variant
  const handleDeleteVariant = (variantId: string, variantName: string) => {
    if (!currentToken) return;
    removeAppearanceVariant(currentToken.id, variantId);
    toast.success(`Deleted variant "${variantName}"`);
  };

  const handleImageImportConfirm = (result: ImageImportResult) => {
    console.log('ImageImportModal confirmed with URL:', result.imageUrl?.substring(0, 50) + '...');
    setImageUrlValue(result.imageUrl);
    // Note: scale and offset could be stored on the token if needed for texture tiling
  };

  const openImageImport = () => {
    setShowImageImportModal(true);
  };

  const clearImage = () => {
    setImageUrlValue('');
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


  const applyTokenEdit = async () => {
    console.log('Applying token edit with imageUrlValue:', imageUrlValue?.substring(0, 50) + '...');
    
    // Calculate max token size for compression
    let maxTokenWidth = 0;
    let maxTokenHeight = 0;
    targetTokens.forEach(token => {
      // Token size in pixels (gridWidth * gridSize approximation - use 50px per grid unit as reasonable default)
      const tokenPixelWidth = (gridWidthValue || token.gridWidth) * 50;
      const tokenPixelHeight = (gridHeightValue || token.gridHeight) * 50;
      maxTokenWidth = Math.max(maxTokenWidth, tokenPixelWidth);
      maxTokenHeight = Math.max(maxTokenHeight, tokenPixelHeight);
    });
    // Minimum reasonable size for tokens
    maxTokenWidth = Math.max(maxTokenWidth, 128);
    maxTokenHeight = Math.max(maxTokenHeight, 128);
    
    for (const token of targetTokens) {
      // Label tab updates
      if (nameValue) {
        updateTokenName(token.id, nameValue);
      }
      if (labelValue) {
        updateTokenLabel(token.id, labelValue);
      }
      updateTokenLabelPosition(token.id, labelPositionValue);
      updateTokenLabelStyle(token.id, labelColorValue, labelBackgroundValue);
      
      // Appearance tab updates - size
      if (gridWidthValue !== token.gridWidth || gridHeightValue !== token.gridHeight) {
        updateTokenSize(token.id, gridWidthValue, gridHeightValue);
      }
      
      // Appearance tab updates - image
      if (imageUrlValue) {
        try {
          // Save to IndexedDB and get hash
          const hash = await saveTokenTexture(token.id, imageUrlValue);
          // Upload to server for multiplayer sync with compression
          await uploadTexture(hash, imageUrlValue, maxTokenWidth, maxTokenHeight);
          // Update token with both imageUrl and hash
          updateTokenImage(token.id, imageUrlValue, hash);
          console.log('Updated token', token.id, 'with imageUrl and hash:', hash);
        } catch (error) {
          console.error('Failed to sync token texture:', error);
          // Still update the local image
          updateTokenImage(token.id, imageUrlValue);
        }
      } else if (token.imageUrl && !imageUrlValue) {
        // Clear image only if there was an image and now it's cleared
        updateTokenImage(token.id, '', undefined);
      }
      
      // Details tab updates
      const hasDetailsChanged = 
        (notesValue && notesValue !== token.notes) || 
        (quickReferenceUrlValue && quickReferenceUrlValue !== token.quickReferenceUrl) ||
        (isMultiSelection && (notesValue || quickReferenceUrlValue));
      
      if (hasDetailsChanged || notesValue !== '' || quickReferenceUrlValue !== '') {
        // For single token: update if changed; for multi: update if value provided
        if (!isMultiSelection || notesValue || quickReferenceUrlValue) {
          updateTokenDetails(
            token.id, 
            notesValue || token.notes, 
            quickReferenceUrlValue || token.quickReferenceUrl
          );
        }
      }
      
      // Style tab updates - update token color and path styling directly
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) =>
          t.id === token.id
            ? {
                ...t,
                color: tokenColorValue,
                pathStyle: pathStyleValue,
                pathColor: useTokenColorForPath ? undefined : pathColorValue,
                pathWeight: pathWeightValue,
                pathOpacity: pathOpacityValue,
                pathGaitWidth: pathGaitWidthValue,
                footprintType: footprintTypeValue,
              }
            : t
        ),
      }));
    }
    
    setShowTokenEditModal(false);
    onUpdateCanvas?.();
    toast.success(`Token${targetTokens.length > 1 ? 's' : ''} updated`);
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
          {/* View Stats - only show for single token with linked creature */}
          {hasLinkedCreature && (
            <ContextMenuItem onClick={handleViewStats}>
              <FileText className="mr-2 h-4 w-4" />
              <span>View {linkedCreatureType === 'monster' ? 'Stat Block' : 'Character Sheet'}</span>
            </ContextMenuItem>
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
          <ContextMenuItem onClick={handleInitiativeClick}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Add to Initiative</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDeleteClick} className="text-destructive" disabled={!canDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete Token{isMultiSelection ? 's' : ''}</span>
            {!canDelete && <span className="ml-auto text-xs text-muted-foreground">No permission</span>}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Token Edit Modal */}
      <Dialog open={showTokenEditModal} onOpenChange={setShowTokenEditModal}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Edit Token{isMultiSelection ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              {isMultiSelection 
                ? `Edit properties for ${targetTokens.length} tokens`
                : 'Manage token label, appearance, and details'
              }
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="label">Label</TabsTrigger>
              <TabsTrigger value="style">Style</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            
            {/* Label Tab */}
            <TabsContent value="label" className="flex-1 overflow-y-auto space-y-4 mt-4">
              <div>
                <Label htmlFor="token-name">Token Name</Label>
                <Input
                  id="token-name"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  placeholder={isMultiSelection ? 'Enter name for all tokens' : 'Enter token name'}
                />
                <p className="text-xs text-muted-foreground mt-1">Internal identifier for the token</p>
              </div>
              <div>
                <Label htmlFor="token-label">Display Label</Label>
                <Input
                  id="token-label"
                  value={labelValue}
                  onChange={(e) => setLabelValue(e.target.value)}
                  placeholder={isMultiSelection ? 'Enter label for all tokens' : 'Enter display label'}
                />
                <p className="text-xs text-muted-foreground mt-1">Text displayed on/near the token</p>
              </div>
              <div>
                <Label>Label Position</Label>
                <div className="flex gap-2 mt-2">
                  {(['above', 'center', 'below'] as LabelPosition[]).map((pos) => (
                    <Button
                      key={pos}
                      variant={labelPositionValue === pos ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLabelPositionValue(pos)}
                      className="flex-1 capitalize"
                    >
                      {pos}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Label Style Presets */}
              <div>
                <Label>Label Style</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {labelStylePresets.map((preset) => (
                    <button
                      key={preset.name}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        labelColorValue === preset.labelColor && labelBackgroundValue === preset.bgColor
                          ? 'ring-2 ring-primary ring-offset-1'
                          : 'hover:opacity-80'
                      }`}
                      style={{
                        backgroundColor: preset.bgColor,
                        color: preset.labelColor,
                      }}
                      onClick={() => {
                        setLabelColorValue(preset.labelColor);
                        setLabelBackgroundValue(preset.bgColor);
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Choose a label style preset</p>
              </div>
            </TabsContent>
            
            {/* Style Tab */}
            <TabsContent value="style" className="flex-1 overflow-y-auto space-y-4 mt-4 pr-3">
              {/* Token Color Section */}
              <div>
                <Label>Token Color</Label>
                <div className="flex gap-2 items-center mt-2">
                  <Input
                    type="color"
                    value={tokenColorValue}
                    onChange={(e) => setTokenColorValue(e.target.value)}
                    className="w-14 h-10 p-1"
                  />
                  <span className="text-sm text-muted-foreground font-mono">
                    {tokenColorValue}
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-2 mt-2">
                  {[
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
                    '#FFEAA7', '#DDA0DD', '#F8C471', '#85C1E9',
                    '#F1948A', '#82E0AA', '#BB8FCE', '#F7DC6F',
                    '#85C1E9', '#98D8C8', '#F39C12', '#E74C3C'
                  ].map(color => (
                    <button
                      key={color}
                      className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                        tokenColorValue === color ? 'border-ring ring-2 ring-ring ring-offset-1' : 'border-border'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setTokenColorValue(color)}
                    />
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="flex items-center gap-1 mb-3">
                  <Footprints className="h-3.5 w-3.5" />
                  Movement Path
                </Label>
                
                {/* Path Style */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Style</Label>
                    <Select
                      value={pathStyleValue}
                      onValueChange={(v) => setPathStyleValue(v as PathStyle)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PATH_STYLES.map(({ style, label }) => (
                          <SelectItem key={style} value={style}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Footprint Type - only show when pathStyle is 'footprint' */}
                  {pathStyleValue === 'footprint' && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Footprint Type</Label>
                      <div className="grid grid-cols-5 gap-2 mt-2">
                        {FOOTPRINT_TYPES.map(({ type, label, icon }) => (
                          <button
                            key={type}
                            className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                              footprintTypeValue === type
                                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => setFootprintTypeValue(type)}
                          >
                            <span className="text-xl">{icon}</span>
                            <span className="text-[10px] mt-1">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Path Color */}
                  {pathStyleValue !== 'none' && (
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Path Color</Label>
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={useTokenColorForPath}
                            onChange={(e) => setUseTokenColorForPath(e.target.checked)}
                            className="rounded"
                          />
                          Use token color
                        </label>
                      </div>
                      {!useTokenColorForPath && (
                        <div className="flex gap-2 items-center mt-2">
                          <Input
                            type="color"
                            value={pathColorValue}
                            onChange={(e) => setPathColorValue(e.target.value)}
                            className="w-14 h-8 p-1"
                          />
                          <span className="text-xs text-muted-foreground font-mono">
                            {pathColorValue}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Path Weight/Size */}
                  {pathStyleValue !== 'none' && (
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          {pathStyleValue === 'footprint' ? 'Footprint Size' : 'Line Weight'}
                        </Label>
                        <span className="text-xs font-mono">{pathWeightValue}</span>
                      </div>
                      <Slider
                        value={[pathWeightValue]}
                        onValueChange={(v) => setPathWeightValue(v[0])}
                        min={1}
                        max={5}
                        step={1}
                        className="mt-2"
                      />
                    </div>
                  )}
                  
                  {/* Path Opacity */}
                  {pathStyleValue !== 'none' && (
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Opacity</Label>
                        <span className="text-xs font-mono">{pathOpacityValue.toFixed(1)}</span>
                      </div>
                      <Slider
                        value={[pathOpacityValue]}
                        onValueChange={(v) => setPathOpacityValue(v[0])}
                        min={0.3}
                        max={1}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>
                  )}
                  
                  {/* Gait Width - only for footprints */}
                  {pathStyleValue === 'footprint' && (
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Gait Width</Label>
                        <span className="text-xs font-mono">{pathGaitWidthValue.toFixed(1)}</span>
                      </div>
                      <Slider
                        value={[pathGaitWidthValue]}
                        onValueChange={(v) => setPathGaitWidthValue(v[0])}
                        min={0.2}
                        max={1.0}
                        step={0.1}
                        className="mt-2"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Side-to-side offset between footprints</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Preview */}
              {pathStyleValue !== 'none' && (
                <div className="border-t pt-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
                  <TokenPathPreviewCanvas
                    pathStyle={pathStyleValue}
                    footprintType={footprintTypeValue}
                    pathColor={useTokenColorForPath ? tokenColorValue : pathColorValue}
                    pathWeight={pathWeightValue}
                    pathOpacity={pathOpacityValue}
                    pathGaitWidth={pathGaitWidthValue}
                  />
                </div>
              )}
            </TabsContent>
            
            {/* Appearance Tab */}
            <TabsContent value="appearance" className="flex-1 overflow-y-auto space-y-4 mt-4">
              {/* Token Image Section */}
              <div>
                <Label>Token Image</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={openImageImport}
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    {imageUrlValue ? 'Change Image' : 'Add Image'}
                  </Button>
                  {imageUrlValue && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {/* Image Preview */}
                {imageUrlValue && (
                  <div className="mt-2">
                    <div className="border rounded-lg p-2 bg-muted/50">
                      <img 
                        src={imageUrlValue} 
                        alt="Token preview" 
                        className="w-16 h-16 object-cover rounded-full mx-auto"
                        onError={() => {
                          toast.error('Failed to load image');
                          setImageUrlValue('');
                        }}
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {isMultiSelection ? 'Image will be applied to all selected tokens' : 'Optional image for the token'}
                </p>
              </div>
              
              {/* Token Size Section */}
              <div>
                <Label>Token Size</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {SIZE_PRESETS.map((preset) => {
                    const isSelected = gridWidthValue === preset.gridWidth && gridHeightValue === preset.gridHeight;
                    return (
                      <button
                        key={preset.name}
                        className={`px-2 py-2 rounded text-xs font-medium transition-all border ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1'
                            : 'border-border hover:border-primary/50 hover:bg-muted'
                        }`}
                        onClick={() => {
                          setGridWidthValue(preset.gridWidth);
                          setGridHeightValue(preset.gridHeight);
                        }}
                      >
                        <div className="font-medium">{preset.name}</div>
                        <div className="text-muted-foreground">{preset.gridWidth}×{preset.gridHeight}</div>
                      </button>
                    );
                  })}
                </div>
                
                {/* Custom Size */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Custom:</span>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={gridWidthValue}
                    onChange={(e) => setGridWidthValue(parseFloat(e.target.value) || 1)}
                    className="w-16 h-8 text-center"
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={gridHeightValue}
                    onChange={(e) => setGridHeightValue(parseFloat(e.target.value) || 1)}
                    className="w-16 h-8 text-center"
                  />
                  <span className="text-xs text-muted-foreground">grid units</span>
                </div>
                
                {isMultiSelection && !getCurrentSizePreset() && (
                  <p className="text-xs text-amber-500 mt-1">
                    Selected tokens have mixed sizes
                  </p>
                )}
              </div>
              
              {/* Saved Variants Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="flex items-center gap-1">
                    <Bookmark className="h-3 w-3" />
                    Saved Variants
                  </Label>
                  {!isMultiSelection && !showSaveVariantInput && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSaveVariantInput(true)}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Save Current
                    </Button>
                  )}
                </div>
                
                {/* Save Variant Input */}
                {showSaveVariantInput && !isMultiSelection && (
                  <div className="flex gap-2 mb-3">
                    <Input
                      value={variantNameInput}
                      onChange={(e) => setVariantNameInput(e.target.value)}
                      placeholder="Variant name (e.g., Bear Form)"
                      className="flex-1 h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveVariant();
                        if (e.key === 'Escape') {
                          setShowSaveVariantInput(false);
                          setVariantNameInput('');
                        }
                      }}
                    />
                    <Button size="sm" onClick={handleSaveVariant} className="h-8">
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setShowSaveVariantInput(false);
                        setVariantNameInput('');
                      }}
                      className="h-8"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                {/* Multi-selection message */}
                {isMultiSelection && (
                  <p className="text-xs text-muted-foreground">
                    Manage variants for individual tokens
                  </p>
                )}
                
                {/* Variant Grid */}
                {!isMultiSelection && currentToken && (
                  <>
                    {currentToken.appearanceVariants && currentToken.appearanceVariants.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {currentToken.appearanceVariants.map((variant) => {
                          const isActive = currentToken.activeVariantId === variant.id;
                          const variantImageUrl = variantImageUrls[variant.id];
                          
                          return (
                            <div
                              key={variant.id}
                              className={`relative p-2 rounded-lg border transition-all ${
                                isActive
                                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              {/* Variant Preview */}
                              <div className="flex items-center gap-2">
                                {variantImageUrl ? (
                                  <img
                                    src={variantImageUrl}
                                    alt={variant.name}
                                    className="w-10 h-10 rounded-full object-cover border border-border"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border">
                                    <Bookmark className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-xs truncate">{variant.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {getSizeDescription(variant.gridWidth, variant.gridHeight)}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex gap-1 mt-2">
                                <Button
                                  variant={isActive ? 'secondary' : 'outline'}
                                  size="sm"
                                  className="flex-1 h-6 text-xs"
                                  onClick={() => handleUseVariant(variant)}
                                  disabled={isActive}
                                >
                                  {isActive ? 'Active' : 'Use'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteVariant(variant.id, variant.name)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              {/* Default badge */}
                              {variant.isDefault && (
                                <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                                  Default
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        No variants saved. Click "Save Current" to save the current appearance.
                      </p>
                    )}
                  </>
                )}
                
                <p className="text-xs text-muted-foreground mt-2">
                  Save image + size combos for forms like Wild Shape or mounted/unmounted
                </p>
              </div>
            </TabsContent>
            
            {/* Details Tab */}
            <TabsContent value="details" className="flex-1 overflow-y-auto space-y-4 mt-4">
              {/* Entity Link Placeholder */}
              <div className="p-3 rounded-lg bg-muted/50 border border-dashed border-muted-foreground/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Database className="h-4 w-4" />
                  <span className="text-sm font-medium">Entity Linking</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Link to character sheets, creatures, and resources coming soon.
                </p>
              </div>
              
              {/* Quick Reference URL */}
              <div>
                <Label htmlFor="quick-ref-url" className="flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Quick Reference URL
                </Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="quick-ref-url"
                    value={quickReferenceUrlValue}
                    onChange={(e) => setQuickReferenceUrlValue(e.target.value)}
                    placeholder="https://dndbeyond.com/characters/..."
                    className="flex-1"
                  />
                  {quickReferenceUrlValue && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(quickReferenceUrlValue, '_blank')}
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Link to an external character sheet, wiki, or reference
                </p>
              </div>
              
              {/* Token Notes */}
              <div>
                <Label htmlFor="token-notes">Token Notes</Label>
                <Textarea
                  id="token-notes"
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder={isMultiSelection 
                    ? 'Notes will be applied to all selected tokens'
                    : 'Add GM notes, stats, or other information...'
                  }
                  className="mt-2 min-h-[100px] resize-y"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Token-specific notes (not shared with linked entity data)
                </p>
              </div>
              
              {isMultiSelection && (
                <p className="text-xs text-amber-500">
                  ⚠ Entering values will override notes/URL for all {targetTokens.length} selected tokens
                </p>
              )}
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowTokenEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={applyTokenEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Image Import Modal */}
      <ImageImportModal
        open={showImageImportModal}
        onOpenChange={setShowImageImportModal}
        onConfirm={handleImageImportConfirm}
        shape={{
          type: 'circle',
          width: 50, // Token diameter in pixels (approximate)
          height: 50,
        }}
        title="Import Token Image"
        description="Select an image and position it within the token circle."
        initialImageUrl={imageUrlValue}
      />
    </>
  );
};