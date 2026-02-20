import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Eye, EyeOff, Trash2, Plus, Palette, Scan, Lightbulb, Sparkles, Dices } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSessionStore } from '@/stores/sessionStore';
import { useRoleStore } from '@/stores/roleStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { canAssignTokenRoles } from '@/lib/rolePermissions';
import { toast } from 'sonner';
import { Z_INDEX } from '@/lib/zIndex';
import { TokenIlluminationModal } from './modals/TokenIlluminationModal';
import { getSelectablePresets, presetToIlluminationSource, type PresetKey } from '@/lib/illuminationPresets';

interface BulkOperationsToolbarProps {
  selectedTokenIds: string[];
  onClearSelection: () => void;
  onUpdateCanvas?: () => void;
}

export const BulkOperationsToolbar: React.FC<BulkOperationsToolbarProps> = ({
  selectedTokenIds,
  onClearSelection,
  onUpdateCanvas
}) => {
  const { tokens, currentPlayerId, players, removeToken, updateTokenIllumination } = useSessionStore();
  const { roles } = useRoleStore();
  const { addToInitiative } = useInitiativeStore();
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [initiativeValues, setInitiativeValues] = useState<Record<string, string>>({});
  const [showColorModal, setShowColorModal] = useState(false);
  const [colorValue, setColorValue] = useState('#FF6B6B');
  const [showIlluminationModal, setShowIlluminationModal] = useState(false);
  
  const selectedTokens = tokens.filter(t => selectedTokenIds.includes(t.id));
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const canAssignRoles = currentPlayer && canAssignTokenRoles(currentPlayer, roles);
  
  if (selectedTokenIds.length === 0) return null;
  
  const handleAssignRole = (roleId: string) => {
    if (!canAssignRoles) {
      toast.error("You don't have permission to assign roles");
      return;
    }
    
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    
    selectedTokens.forEach(token => {
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) =>
          t.id === token.id ? { ...t, roleId } : t
        ),
      }));
    });
    
    onUpdateCanvas?.();
    toast.success(`Assigned ${selectedTokens.length} token(s) to ${role.name}`);
  };
  
  const handleToggleHidden = (hide: boolean) => {
    if (!canAssignRoles) {
      toast.error("You don't have permission to hide/show tokens");
      return;
    }
    
    selectedTokens.forEach(token => {
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) =>
          t.id === token.id ? { ...t, isHidden: hide } : t
        ),
      }));
    });
    
    onUpdateCanvas?.();
    toast.success(`${hide ? 'Hidden' : 'Shown'} ${selectedTokens.length} token(s)`);
  };
  
  const handleToggleVision = (enabled: boolean) => {
    selectedTokens.forEach(token => {
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) =>
          t.id === token.id ? { ...t, hasVision: enabled } : t
        ),
      }));
    });
    
    onUpdateCanvas?.();
    toast.success(`Vision ${enabled ? 'enabled' : 'disabled'} for ${selectedTokens.length} token(s)`);
  };
  
  const handleApplyIlluminationPreset = (presetKey: PresetKey) => {
    const presets = getSelectablePresets();
    const presetEntry = presets.find(p => p.key === presetKey);
    if (!presetEntry) return;
    
    const illuminationSettings = presetToIlluminationSource(presetEntry.preset);
    
    selectedTokens.forEach(token => {
      updateTokenIllumination(token.id, illuminationSettings);
    });
    
    onUpdateCanvas?.();
    toast.success(`Applied ${presetEntry.preset.icon} ${presetEntry.preset.name} to ${selectedTokens.length} token(s)`);
  };
  
  const handleDeleteConfirm = () => {
    selectedTokens.forEach(token => {
      removeToken(token.id);
    });
    
    setShowDeleteModal(false);
    onClearSelection();
    onUpdateCanvas?.();
    toast.success(`Deleted ${selectedTokens.length} token(s)`);
  };
  
  const handleRollOne = (tokenId: string) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    setInitiativeValues(prev => ({ ...prev, [tokenId]: roll.toString() }));
  };

  const handleRollAll = () => {
    const newValues: Record<string, string> = {};
    selectedTokens.forEach(token => {
      newValues[token.id] = String(Math.floor(Math.random() * 20) + 1);
    });
    setInitiativeValues(newValues);
  };
  
  const handleApplyInitiative = () => {
    let count = 0;
    selectedTokens.forEach(token => {
      const raw = initiativeValues[token.id];
      const value = raw !== undefined ? parseInt(raw) : NaN;
      if (!isNaN(value)) {
        addToInitiative(token.id, value);
        count++;
      }
    });
    
    if (count === 0) {
      toast.error('Please enter at least one initiative value');
      return;
    }

    setShowInitiativeModal(false);
    setInitiativeValues({});
    toast.success(`Added ${count} token(s) to initiative`);
  };
  
  const handleApplyColor = () => {
    selectedTokens.forEach(token => {
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map((t) =>
          t.id === token.id ? { ...t, color: colorValue } : t
        ),
      }));
    });
    
    setShowColorModal(false);
    onUpdateCanvas?.();
    toast.success(`Color updated for ${selectedTokens.length} token(s)`);
  };
  
  return (
    <>
      <div 
        className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg px-2 py-1.5"
        style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
      >
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-foreground px-1.5">
            {selectedTokens.length} token{selectedTokens.length > 1 ? 's' : ''}
          </span>
          
          <div className="h-4 w-px bg-border" />
          
          {/* Role Assignment */}
          {canAssignRoles && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Role
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 bg-popover" style={{ zIndex: Z_INDEX.DROPDOWNS.MENU + 100 }}>
                {roles.map((role) => (
                  <DropdownMenuItem 
                    key={role.id}
                    onClick={() => handleAssignRole(role.id)}
                  >
                    <div 
                      className="mr-2 h-3 w-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="flex-1">{role.name}</span>
                    {role.isSystem && (
                      <span className="text-xs text-muted-foreground ml-2">System</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Visibility */}
          {canAssignRoles && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  Vis
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover" style={{ zIndex: Z_INDEX.DROPDOWNS.MENU + 100 }}>
                <DropdownMenuItem onClick={() => handleToggleHidden(true)}>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleHidden(false)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Show All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Vision Settings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Light
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-popover" style={{ zIndex: Z_INDEX.DROPDOWNS.MENU + 100 }}>
              <DropdownMenuItem onClick={() => setShowIlluminationModal(true)}>
                <Lightbulb className="h-4 w-4 mr-2" />
                Custom Settings...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {getSelectablePresets().map(({ key, preset }) => (
                <DropdownMenuItem 
                  key={key}
                  onClick={() => handleApplyIlluminationPreset(key)}
                >
                  <span className="mr-2 text-base">{preset.icon}</span>
                  <span className="flex-1">{preset.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{preset.description.split(' ')[0]}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggleVision(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Enable Vision
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleVision(false)}>
                <EyeOff className="h-4 w-4 mr-2" />
                Disable Vision
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Color */}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowColorModal(true)}>
            <Palette className="h-3 w-3 mr-1" />
            Color
          </Button>
          
          {/* Initiative */}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowInitiativeModal(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Init
          </Button>
          
          <div className="h-4 w-px bg-border" />
          
          {/* Delete */}
          <Button 
            variant="ghost" 
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Del
          </Button>
          
          {/* Clear Selection */}
          <Button 
            variant="ghost" 
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onClearSelection}
          >
            ✕
          </Button>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tokens</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedTokens.length} token(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Initiative Modal — per-token initiative entry */}
      <Dialog open={showInitiativeModal} onOpenChange={(open) => { setShowInitiativeModal(open); if (!open) setInitiativeValues({}); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add to Initiative</DialogTitle>
            <DialogDescription>
              Set individual initiative values for {selectedTokens.length} token(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleRollAll}>
                <Dices className="h-3.5 w-3.5 mr-1.5" />
                Roll All d20
              </Button>
            </div>
            <div className="space-y-2">
              {selectedTokens.map(token => (
                <div key={token.id} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-muted/30">
                  {/* Token preview */}
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-border overflow-hidden"
                  >
                    {token.imageUrl ? (
                      <img src={token.imageUrl} alt={token.label || token.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full" style={{ backgroundColor: token.color || '#888' }} />
                    )}
                  </div>
                  {/* Name */}
                  <span className="flex-1 text-sm font-medium truncate">
                    {token.label || token.name}
                  </span>
                  {/* Per-token input + roll */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Input
                      type="number"
                      placeholder="d20"
                      value={initiativeValues[token.id] ?? ''}
                      onChange={e => setInitiativeValues(prev => ({ ...prev, [token.id]: e.target.value }))}
                      className="w-16 h-7 text-center text-sm p-0 px-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRollOne(token.id)}
                      title="Roll d20"
                    >
                      <Dices className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowInitiativeModal(false); setInitiativeValues({}); }}>
              Cancel
            </Button>
            <Button onClick={handleApplyInitiative}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Color Modal */}
      <Dialog open={showColorModal} onOpenChange={setShowColorModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Color</DialogTitle>
            <DialogDescription>
              Set color for {selectedTokens.length} token(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="token-color">Token Color</Label>
              <div className="flex gap-2">
                <Input
                  id="token-color"
                  type="color"
                  value={colorValue}
                  onChange={(e) => setColorValue(e.target.value)}
                  className="h-10"
                />
                <Input
                  type="text"
                  value={colorValue}
                  onChange={(e) => setColorValue(e.target.value)}
                  placeholder="#FF6B6B"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColorModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyColor}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Illumination Settings Modal - shared component */}
      <TokenIlluminationModal
        open={showIlluminationModal}
        onOpenChange={setShowIlluminationModal}
        tokenIds={selectedTokenIds}
        currentIllumination={selectedTokens[0]?.illuminationSources?.[0]}
        onApply={(settings) => {
          selectedTokens.forEach((token) => {
            updateTokenIllumination(token.id, settings);
          });
          onUpdateCanvas?.();
          toast.success(`Updated illumination for ${selectedTokens.length} token(s)`);
        }}
      />
    </>
  );
};
