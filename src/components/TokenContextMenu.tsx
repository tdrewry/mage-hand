import React, { useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
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
import { AlertTriangle, Edit3, Palette, Trash2, Dices, Plus, Eye, Scan } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { useInitiativeStore } from '../stores/initiativeStore';
import { useVisionProfileStore } from '../stores/visionProfileStore';
import { toast } from 'sonner';

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
    updateTokenVision,
    updateTokenVisionRange,
    removeToken,
    setTokenOwner 
  } = useSessionStore();
  
  const { addToInitiative } = useInitiativeStore();
  const { profiles } = useVisionProfileStore();
  
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [showVisionRangeModal, setShowVisionRangeModal] = useState(false);
  const [labelValue, setLabelValue] = useState('');
  const [colorValue, setColorValue] = useState('#FF6B6B');
  const [initiativeValue, setInitiativeValue] = useState('');
  const [visionRangeValue, setVisionRangeValue] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [useGradientsValue, setUseGradientsValue] = useState(true);

  // Get the tokens to operate on (selected tokens or just the clicked token)
  const getTargetTokens = () => {
    if (selectedTokenIds.includes(tokenId)) {
      return tokens.filter(t => selectedTokenIds.includes(t.id));
    }
    return tokens.filter(t => t.id === tokenId);
  };

  const handleLabelClick = () => {
    const targetTokens = getTargetTokens();
    if (targetTokens.length === 1) {
      setLabelValue(targetTokens[0].label || targetTokens[0].name);
    } else {
      setLabelValue(''); // Empty for multi-edit
    }
    setShowLabelModal(true);
  };

  const handleColorClick = () => {
    const targetTokens = getTargetTokens();
    if (targetTokens.length === 1) {
      setColorValue(targetTokens[0].color || '#FF6B6B');
    } else {
      setColorValue('#FF6B6B'); // Default for multi-edit
    }
    setShowColorModal(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const applyLabel = () => {
    const targetTokens = getTargetTokens();
    targetTokens.forEach(token => {
      updateTokenLabel(token.id, labelValue);
    });
    setShowLabelModal(false);
    onUpdateCanvas?.();
    toast.success(`Label updated for ${targetTokens.length} token(s)`);
  };

  const applyColor = () => {
    const targetTokens = getTargetTokens();
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
    const targetTokens = getTargetTokens();
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
    const targetTokens = getTargetTokens();
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

  const targetTokens = getTargetTokens();
  const isMultiSelection = targetTokens.length > 1;
  const hasVisionEnabled = targetTokens.every(t => t.hasVision !== false);

  const handleToggleVision = () => {
    const newVisionState = !hasVisionEnabled;
    targetTokens.forEach(token => {
      updateTokenVision(token.id, newVisionState);
    });
    onUpdateCanvas?.();
    toast.success(`Vision ${newVisionState ? 'enabled' : 'disabled'} for ${targetTokens.length} token(s)`);
  };

  const handleVisionRangeClick = () => {
    const targetTokens = getTargetTokens();
    if (targetTokens.length === 1) {
      const token = targetTokens[0];
      setSelectedProfileId(token.visionProfileId || '');
      setVisionRangeValue(token.visionRange?.toString() || '');
      setUseGradientsValue(token.useGradients !== false);
    } else {
      setSelectedProfileId('');
      setVisionRangeValue('');
      setUseGradientsValue(true);
    }
    setShowVisionRangeModal(true);
  };

  const applyVisionRange = () => {
    const targetTokens = getTargetTokens();
    
    // Apply profile or custom settings
    targetTokens.forEach(token => {
      if (selectedProfileId) {
        // Apply profile
        const profile = profiles.find(p => p.id === selectedProfileId);
        if (profile) {
          useSessionStore.setState((state) => ({
            tokens: state.tokens.map((t) =>
              t.id === token.id
                ? {
                    ...t,
                    visionProfileId: profile.id,
                    visionRange: profile.visionRange,
                    useGradients: profile.useGradients,
                  }
                : t
            ),
          }));
        }
      } else {
        // Apply custom settings
        const range = visionRangeValue === '' ? undefined : parseFloat(visionRangeValue);
        
        if (range !== undefined && (isNaN(range) || range < 0)) {
          toast.error('Please enter a valid vision range');
          return;
        }
        
        useSessionStore.setState((state) => ({
          tokens: state.tokens.map((t) =>
            t.id === token.id
              ? {
                  ...t,
                  visionProfileId: undefined,
                  visionRange: range,
                  useGradients: useGradientsValue,
                }
              : t
          ),
        }));
      }
    });
    
    setShowVisionRangeModal(false);
    onUpdateCanvas?.();
    toast.success(`Vision settings updated for ${targetTokens.length} token(s)`);
  };

  const selectProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setVisionRangeValue(profile.visionRange.toString());
      setUseGradientsValue(profile.useGradients);
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={handleLabelClick}>
            <Edit3 className="mr-2 h-4 w-4" />
            <span>Edit Label{isMultiSelection ? 's' : ''}</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleColorClick}>
            <Palette className="mr-2 h-4 w-4" />
            <span>Change Color{isMultiSelection ? 's' : ''}</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem
            checked={hasVisionEnabled}
            onCheckedChange={handleToggleVision}
          >
            <Eye className="mr-2 h-4 w-4" />
            <span>Has Vision</span>
          </ContextMenuCheckboxItem>
          <ContextMenuItem onClick={handleVisionRangeClick}>
            <Scan className="mr-2 h-4 w-4" />
            <span>Set Vision Range</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleInitiativeClick}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Add to Initiative</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDeleteClick} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete Token{isMultiSelection ? 's' : ''}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Label Edit Modal */}
      <Dialog open={showLabelModal} onOpenChange={setShowLabelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Label{isMultiSelection ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              {isMultiSelection 
                ? `Set label for ${targetTokens.length} tokens`
                : 'Enter a new label for this token'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="token-label">Token Label</Label>
              <Input
                id="token-label"
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
                placeholder={isMultiSelection ? 'Enter label for all tokens' : 'Enter token label'}
                style={{ 
                  color: targetTokens[0]?.color || '#FFFFFF',
                  borderColor: targetTokens[0]?.color || '#444444'
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLabelModal(false)}>
              Cancel
            </Button>
            <Button onClick={applyLabel}>
              Apply Label{isMultiSelection ? 's' : ''}
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
        <DialogContent className="max-w-md">
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
            {/* Vision Profiles */}
            <div>
              <Label className="text-sm font-medium">Vision Profiles</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {profiles.map((profile) => (
                  <Button
                    key={profile.id}
                    variant={selectedProfileId === profile.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectProfile(profile.id)}
                    className="justify-start gap-2"
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: profile.color }}
                    />
                    <span className="flex-1 text-left">{profile.name}</span>
                    {profile.useGradients && (
                      <span className="text-xs text-muted-foreground">Soft</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Custom Settings */}
            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Custom Settings</Label>
              <div className="space-y-3 mt-2">
                <div>
                  <Label htmlFor="vision-range" className="text-xs">Vision Range (grid units)</Label>
                  <Input
                    id="vision-range"
                    type="number"
                    value={visionRangeValue}
                    onChange={(e) => {
                      setVisionRangeValue(e.target.value);
                      setSelectedProfileId(''); // Clear profile selection
                    }}
                    placeholder="Use default"
                    min="0"
                    step="1"
                    className="mt-1"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="use-gradients" className="text-xs">
                    Use Soft Gradient Edges
                  </Label>
                  <Switch
                    id="use-gradients"
                    checked={useGradientsValue}
                    onCheckedChange={(checked) => {
                      setUseGradientsValue(checked);
                      setSelectedProfileId(''); // Clear profile selection
                    }}
                  />
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Custom settings override profile selection
                </p>
              </div>
            </div>
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
    </>
  );
};