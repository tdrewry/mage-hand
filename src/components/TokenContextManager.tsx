import React, { useState, useEffect } from 'react';
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
import { AlertTriangle, Edit3, Palette, Trash2, Eye, EyeOff } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { toast } from 'sonner';
import { Canvas as FabricCanvas } from 'fabric';

interface TokenContextManagerProps {
  fabricCanvas: FabricCanvas | null;
  onColorChange?: (tokenId: string, color: string) => void;
  onUpdateCanvas?: () => void;
}

export const TokenContextManager = ({ 
  fabricCanvas,
  onColorChange,
  onUpdateCanvas 
}: TokenContextManagerProps) => {
  const { 
    tokens, 
    selectedTokenIds, 
    updateTokenLabel,
    updateTokenVision,
    removeToken,
    setTokenOwner 
  } = useSessionStore();
  
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [labelValue, setLabelValue] = useState('');
  const [colorValue, setColorValue] = useState('#FF6B6B');
  const [contextTokenId, setContextTokenId] = useState<string>('');

  // Listen for custom event from PaperTabletop
  useEffect(() => {
    const handleTokenContextEvent = (event: any) => {
      const { tokenId, x, y } = event.detail;
      console.log('TokenContextManager received custom event:', { tokenId, x, y });
      setContextTokenId(tokenId);
      showTokenContextMenu(x, y, tokenId);
    };

    window.addEventListener('showTokenContextMenu', handleTokenContextEvent);
    
    return () => {
      window.removeEventListener('showTokenContextMenu', handleTokenContextEvent);
    };
  }, []);

  // Legacy Fabric.js event listener (keeping as fallback)
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleCanvasRightClick = (opt: any) => {
      const evt = opt.e as MouseEvent;
      const target = opt.target;
      
      console.log('TokenContextManager - mouse:up', { button: evt.button, target, hasTokenId: !!(target as any)?.tokenId });
      
      if (evt.button === 2 && target && (target as any).tokenId) {
        console.log('TokenContextManager - Showing context menu for token:', (target as any).tokenId);
        evt.preventDefault();
        evt.stopPropagation();
        
        const tokenId = (target as any).tokenId;
        setContextTokenId(tokenId);
        
        // Show context menu at cursor position
        showTokenContextMenu(evt.clientX, evt.clientY, tokenId);
      }
    };

    fabricCanvas.on('mouse:up', handleCanvasRightClick);

    return () => {
      fabricCanvas.off('mouse:up', handleCanvasRightClick);
    };
  }, [fabricCanvas]);

  const showTokenContextMenu = (x: number, y: number, tokenId: string) => {
    // Create a custom context menu
    const menu = document.createElement('div');
    menu.className = 'fixed z-50 bg-popover border border-border rounded-md shadow-lg p-1';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    const targetTokens = getTargetTokens(tokenId);
    const hasVisionEnabled = targetTokens.every(t => t.hasVision !== false);
    
    const menuItems = [
      { label: 'Edit Label', icon: '✏️', action: () => handleLabelClick(tokenId) },
      { label: 'Change Color', icon: '🎨', action: () => handleColorClick(tokenId) },
      { 
        label: hasVisionEnabled ? 'Disable Vision' : 'Enable Vision', 
        icon: hasVisionEnabled ? '🙈' : '👁️', 
        action: () => handleToggleVision(tokenId)
      },
      { label: 'Delete Token', icon: '🗑️', action: () => handleDeleteClick(tokenId), danger: true }
    ];
    
    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = `px-2 py-1 text-sm cursor-pointer hover:bg-accent rounded flex items-center gap-2 ${item.danger ? 'text-destructive' : ''}`;
      menuItem.innerHTML = `<span>${item.icon}</span> ${item.label}`;
      menuItem.onclick = () => {
        item.action();
        // Safe menu removal
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
      };
      menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    // Remove menu when clicking outside
    const removeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        // Safe menu removal
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
        document.removeEventListener('click', removeMenu);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
    }, 100);
  };

  // Get the tokens to operate on (selected tokens or just the clicked token)
  const getTargetTokens = (tokenId: string) => {
    if (selectedTokenIds.includes(tokenId)) {
      return tokens.filter(t => selectedTokenIds.includes(t.id));
    }
    return tokens.filter(t => t.id === tokenId);
  };

  const handleLabelClick = (tokenId: string) => {
    const targetTokens = getTargetTokens(tokenId);
    if (targetTokens.length === 1) {
      setLabelValue(targetTokens[0].label || targetTokens[0].name);
    } else {
      setLabelValue(''); // Empty for multi-edit
    }
    setContextTokenId(tokenId);
    setShowLabelModal(true);
  };

  const handleColorClick = (tokenId: string) => {
    const targetTokens = getTargetTokens(tokenId);
    if (targetTokens.length === 1) {
      setColorValue(targetTokens[0].color || '#FF6B6B');
    } else {
      setColorValue('#FF6B6B'); // Default for multi-edit
    }
    setContextTokenId(tokenId);
    setShowColorModal(true);
  };

  const handleDeleteClick = (tokenId: string) => {
    setContextTokenId(tokenId);
    setShowDeleteModal(true);
  };

  const handleToggleVision = (tokenId: string) => {
    const targetTokens = getTargetTokens(tokenId);
    const hasVisionEnabled = targetTokens.every(t => t.hasVision !== false);
    const newVisionState = !hasVisionEnabled;
    
    targetTokens.forEach(token => {
      updateTokenVision(token.id, newVisionState);
    });
    
    onUpdateCanvas?.();
    toast.success(`Vision ${newVisionState ? 'enabled' : 'disabled'} for ${targetTokens.length} token(s)`);
  };

  const applyLabel = () => {
    const targetTokens = getTargetTokens(contextTokenId);
    targetTokens.forEach(token => {
      updateTokenLabel(token.id, labelValue);
    });
    setShowLabelModal(false);
    onUpdateCanvas?.();
    toast.success(`Label updated for ${targetTokens.length} token(s)`);
  };

  const applyColor = () => {
    const targetTokens = getTargetTokens(contextTokenId);
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
    const targetTokens = getTargetTokens(contextTokenId);
    targetTokens.forEach(token => {
      removeToken(token.id);
      
      // Remove from canvas
      if (fabricCanvas) {
        const objects = fabricCanvas.getObjects();
        objects.forEach((obj: any) => {
          if (obj.tokenId === token.id || (obj.isTokenLabel && obj.tokenId === token.id)) {
            fabricCanvas.remove(obj);
          }
        });
        fabricCanvas.renderAll();
      }
    });
    setShowDeleteModal(false);
    onUpdateCanvas?.();
    toast.success(`Deleted ${targetTokens.length} token(s)`);
  };

  const targetTokens = contextTokenId ? getTargetTokens(contextTokenId) : [];
  const isMultiSelection = targetTokens.length > 1;

  return (
    <>
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