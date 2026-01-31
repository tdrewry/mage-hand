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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Edit3, Palette, Trash2, Dices, Plus, Eye, Scan, Shield, Lightbulb, Sparkles, Upload, X } from 'lucide-react';
import { TokenIlluminationModal } from './modals/TokenIlluminationModal';
import { ImageImportModal, type ImageImportResult } from './modals/ImageImportModal';
import { useSessionStore, type LabelPosition } from '../stores/sessionStore';
import { useRoleStore } from '../stores/roleStore';
import { useInitiativeStore } from '../stores/initiativeStore';
import { getSelectablePresets, presetToIlluminationSource, type PresetKey } from '../lib/illuminationPresets';
import { 
  canControlToken, 
  canDeleteToken, 
  canAssignTokenRoles 
} from '../lib/rolePermissions';
import { toast } from 'sonner';
import { saveTokenTexture } from '@/lib/tokenTextureStorage';
import { uploadTexture } from '@/lib/textureSync';
import { hashImageData } from '@/lib/tokenTextureStorage';

interface TokenContextMenuProps {
  children: React.ReactNode;
  tokenId: string;
  onColorChange?: (tokenId: string, color: string) => void;
  onUpdateCanvas?: () => void;
}

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
    updateTokenVision,
    updateTokenVisionRange,
    updateTokenIllumination,
    removeToken,
    setTokenOwner,
    currentPlayerId,
    players
  } = useSessionStore();
  
  const { roles } = useRoleStore();
  const { addToInitiative } = useInitiativeStore();
  
  const [showTokenEditModal, setShowTokenEditModal] = useState(false);
  const [showImageImportModal, setShowImageImportModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [showVisionRangeModal, setShowVisionRangeModal] = useState(false);
  const [showIlluminationModal, setShowIlluminationModal] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [labelValue, setLabelValue] = useState('');
  const [labelPositionValue, setLabelPositionValue] = useState<LabelPosition>('below');
  const [imageUrlValue, setImageUrlValue] = useState('');
  const [labelColorValue, setLabelColorValue] = useState('#FFFFFF');
  const [labelBackgroundValue, setLabelBackgroundValue] = useState('rgba(30, 30, 30, 0.75)');
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

  const handleEditTokenClick = () => {
    if (!canControl) {
      toast.error("You don't have permission to edit these tokens");
      return;
    }
    
    if (targetTokens.length === 1) {
      setNameValue(targetTokens[0].name || '');
      setLabelValue(targetTokens[0].label || '');
      setLabelPositionValue(targetTokens[0].labelPosition || 'below');
      setLabelColorValue(targetTokens[0].labelColor || '#FFFFFF');
      setLabelBackgroundValue(targetTokens[0].labelBackgroundColor || 'rgba(30, 30, 30, 0.75)');
      setImageUrlValue(targetTokens[0].imageUrl || '');
    } else {
      setNameValue('');
      setLabelValue('');
      setLabelPositionValue('below');
      setLabelColorValue('#FFFFFF');
      setLabelBackgroundValue('rgba(30, 30, 30, 0.75)');
      setImageUrlValue('');
    }
    setShowTokenEditModal(true);
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
      const tokenPixelWidth = token.gridWidth * 50;
      const tokenPixelHeight = token.gridHeight * 50;
      maxTokenWidth = Math.max(maxTokenWidth, tokenPixelWidth);
      maxTokenHeight = Math.max(maxTokenHeight, tokenPixelHeight);
    });
    // Minimum reasonable size for tokens
    maxTokenWidth = Math.max(maxTokenWidth, 128);
    maxTokenHeight = Math.max(maxTokenHeight, 128);
    
    for (const token of targetTokens) {
      if (nameValue) {
        updateTokenName(token.id, nameValue);
      }
      if (labelValue) {
        updateTokenLabel(token.id, labelValue);
      }
      updateTokenLabelPosition(token.id, labelPositionValue);
      updateTokenLabelStyle(token.id, labelColorValue, labelBackgroundValue);
      
      // Apply image with texture sync
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
      } else {
        // Clear image
        updateTokenImage(token.id, '', undefined);
      }
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Token{isMultiSelection ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              {isMultiSelection 
                ? `Edit properties for ${targetTokens.length} tokens`
                : 'Edit token name, label, and display settings'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
          </div>
          <DialogFooter>
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