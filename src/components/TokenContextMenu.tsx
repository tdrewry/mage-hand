import React, { useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
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
import { AlertTriangle, Edit3, Palette, Trash2 } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
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
    removeToken,
    setTokenOwner 
  } = useSessionStore();
  
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [labelValue, setLabelValue] = useState('');
  const [colorValue, setColorValue] = useState('#FF6B6B');

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

  const targetTokens = getTargetTokens();
  const isMultiSelection = targetTokens.length > 1;

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
    </>
  );
};