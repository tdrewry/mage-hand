import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Eye, EyeOff, Trash2, Plus, Palette, Scan, Lightbulb } from 'lucide-react';
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
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useSessionStore } from '@/stores/sessionStore';
import { useRoleStore } from '@/stores/roleStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useVisionProfileStore } from '@/stores/visionProfileStore';
import { canAssignTokenRoles } from '@/lib/rolePermissions';
import { toast } from 'sonner';
import { Z_INDEX } from '@/lib/zIndex';
import { IlluminationSource } from '@/types/illumination';

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
  const { profiles } = useVisionProfileStore();
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [initiativeValue, setInitiativeValue] = useState('');
  const [showColorModal, setShowColorModal] = useState(false);
  const [colorValue, setColorValue] = useState('#FF6B6B');
  const [showIlluminationModal, setShowIlluminationModal] = useState(false);
  
  // Illumination settings state
  const [illumRange, setIllumRange] = useState(6);
  const [illumBrightZone, setIllumBrightZone] = useState(0.5);
  const [illumBrightIntensity, setIllumBrightIntensity] = useState(1.0);
  const [illumDimIntensity, setIllumDimIntensity] = useState(0.4);
  const [illumColor, setIllumColor] = useState('#FFD700');
  const [illumSoftEdge, setIllumSoftEdge] = useState(true);
  const [illumSoftEdgeRadius, setIllumSoftEdgeRadius] = useState(8);
  
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
  
  const handleApplyVisionProfile = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    selectedTokens.forEach(token => {
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
    });
    
    onUpdateCanvas?.();
    toast.success(`Applied ${profile.name} to ${selectedTokens.length} token(s)`);
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
  
  const handleRollInitiative = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    setInitiativeValue(roll.toString());
  };
  
  const handleApplyInitiative = () => {
    const initiative = parseInt(initiativeValue);
    
    if (isNaN(initiative)) {
      toast.error('Please enter a valid initiative value');
      return;
    }
    
    selectedTokens.forEach(token => {
      addToInitiative(token.id, initiative);
    });
    
    setShowInitiativeModal(false);
    toast.success(`Added ${selectedTokens.length} token(s) to initiative`);
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
        className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-border rounded-xl shadow-lg p-3"
        style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground px-2">
            {selectedTokens.length} token{selectedTokens.length > 1 ? 's' : ''} selected
          </span>
          
          <div className="h-6 w-px bg-border" />
          
          {/* Role Assignment */}
          {canAssignRoles && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  Assign Role
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
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Visibility
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
              <Button variant="outline" size="sm">
                <Scan className="h-4 w-4 mr-2" />
                Vision
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-popover" style={{ zIndex: Z_INDEX.DROPDOWNS.MENU + 100 }}>
              <DropdownMenuItem onClick={() => setShowIlluminationModal(true)}>
                <Lightbulb className="h-4 w-4 mr-2" />
                Illumination Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggleVision(true)}>
                Enable Vision
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleVision(false)}>
                Disable Vision
              </DropdownMenuItem>
              {profiles.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {profiles.map((profile) => (
                    <DropdownMenuItem 
                      key={profile.id}
                      onClick={() => handleApplyVisionProfile(profile.id)}
                    >
                      <div 
                        className="mr-2 h-3 w-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: profile.color }}
                      />
                      <span className="flex-1">{profile.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Color */}
          <Button variant="outline" size="sm" onClick={() => setShowColorModal(true)}>
            <Palette className="h-4 w-4 mr-2" />
            Color
          </Button>
          
          {/* Initiative */}
          <Button variant="outline" size="sm" onClick={() => setShowInitiativeModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Initiative
          </Button>
          
          <div className="h-6 w-px bg-border" />
          
          {/* Delete */}
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          
          {/* Clear Selection */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClearSelection}
          >
            Clear
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
      
      {/* Initiative Modal */}
      <Dialog open={showInitiativeModal} onOpenChange={setShowInitiativeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Initiative</DialogTitle>
            <DialogDescription>
              Set initiative value for {selectedTokens.length} token(s)
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
                  placeholder="Enter initiative value"
                />
                <Button onClick={handleRollInitiative} variant="outline">
                  Roll d20
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitiativeModal(false)}>
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
      
      {/* Illumination Settings Modal */}
      <Dialog open={showIlluminationModal} onOpenChange={setShowIlluminationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Illumination Settings</DialogTitle>
            <DialogDescription>
              Configure illumination for {selectedTokens.length} token(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Range (grid units): {illumRange}</Label>
              <Slider
                value={[illumRange]}
                onValueChange={([v]) => setIllumRange(v)}
                min={1}
                max={24}
                step={1}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Bright Zone: {Math.round(illumBrightZone * 100)}%</Label>
              <Slider
                value={[illumBrightZone]}
                onValueChange={([v]) => setIllumBrightZone(v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Bright Intensity: {Math.round(illumBrightIntensity * 100)}%</Label>
              <Slider
                value={[illumBrightIntensity]}
                onValueChange={([v]) => setIllumBrightIntensity(v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Dim Intensity: {Math.round(illumDimIntensity * 100)}%</Label>
              <Slider
                value={[illumDimIntensity]}
                onValueChange={([v]) => setIllumDimIntensity(v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={illumColor}
                  onChange={(e) => setIllumColor(e.target.value)}
                  className="w-16 h-10"
                />
                <Input
                  type="text"
                  value={illumColor}
                  onChange={(e) => setIllumColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Soft Edge</Label>
              <Switch
                checked={illumSoftEdge}
                onCheckedChange={setIllumSoftEdge}
              />
            </div>
            
            {illumSoftEdge && (
              <div className="space-y-2">
                <Label>Soft Edge Radius: {illumSoftEdgeRadius}px</Label>
                <Slider
                  value={[illumSoftEdgeRadius]}
                  onValueChange={([v]) => setIllumSoftEdgeRadius(v)}
                  min={0}
                  max={20}
                  step={1}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIlluminationModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              selectedTokens.forEach(token => {
                const illumination: Partial<IlluminationSource> = {
                  range: illumRange,
                  brightZone: illumBrightZone,
                  brightIntensity: illumBrightIntensity,
                  dimIntensity: illumDimIntensity,
                  color: illumColor,
                  softEdge: illumSoftEdge,
                  softEdgeRadius: illumSoftEdgeRadius,
                };
                updateTokenIllumination(token.id, illumination);
              });
              setShowIlluminationModal(false);
              onUpdateCanvas?.();
              toast.success(`Updated illumination for ${selectedTokens.length} token(s)`);
            }}>
              Apply to All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
