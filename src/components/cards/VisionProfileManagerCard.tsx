import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVisionProfileStore, type VisionProfile } from '@/stores/visionProfileStore';
import { Plus, Edit, Trash2, Eye, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function VisionProfileManagerCardContent() {
  const { profiles, addProfile, updateProfile, removeProfile } = useVisionProfileStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VisionProfile | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formVisionRange, setFormVisionRange] = useState(6);
  const [formUseGradients, setFormUseGradients] = useState(true);
  const [formInnerFadeStart, setFormInnerFadeStart] = useState(0.7);
  const [formMidpointPosition, setFormMidpointPosition] = useState(0.85);
  const [formMidpointOpacity, setFormMidpointOpacity] = useState(0.2);
  const [formOuterFadeStart, setFormOuterFadeStart] = useState(0.95);
  const [formColor, setFormColor] = useState('#FFD700');

  const defaultProfiles = profiles.filter(p => 
    ['normal', 'darkvision', 'superior', 'lowlight', 'blindsight', 'blind'].includes(p.id)
  );
  const customProfiles = profiles.filter(p => 
    !['normal', 'darkvision', 'superior', 'lowlight', 'blindsight', 'blind'].includes(p.id)
  );

  const resetForm = () => {
    setFormName('');
    setFormVisionRange(6);
    setFormUseGradients(true);
    setFormInnerFadeStart(0.7);
    setFormMidpointPosition(0.85);
    setFormMidpointOpacity(0.2);
    setFormOuterFadeStart(0.95);
    setFormColor('#FFD700');
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (profile: VisionProfile) => {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormVisionRange(profile.visionRange);
    setFormUseGradients(profile.useGradients);
    setFormInnerFadeStart(profile.innerFadeStart);
    setFormMidpointPosition(profile.midpointPosition);
    setFormMidpointOpacity(profile.midpointOpacity);
    setFormOuterFadeStart(profile.outerFadeStart);
    setFormColor(profile.color);
    setShowEditModal(true);
  };

  const validateForm = (): boolean => {
    if (!formName.trim()) {
      toast.error('Profile name is required');
      return false;
    }
    if (formName.length > 50) {
      toast.error('Profile name must be less than 50 characters');
      return false;
    }
    if (formVisionRange < 0 || formVisionRange > 100) {
      toast.error('Vision range must be between 0 and 100 grid units');
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    if (!validateForm()) return;

    const newProfileId = addProfile({
      name: formName.trim(),
      visionRange: formVisionRange,
      useGradients: formUseGradients,
      innerFadeStart: formInnerFadeStart,
      midpointPosition: formMidpointPosition,
      midpointOpacity: formMidpointOpacity,
      outerFadeStart: formOuterFadeStart,
      color: formColor,
    });

    toast.success(`Created vision profile: ${formName}`);
    setShowCreateModal(false);
    resetForm();
  };

  const handleUpdate = () => {
    if (!editingProfile) return;
    if (!validateForm()) return;

    updateProfile(editingProfile.id, {
      name: formName.trim(),
      visionRange: formVisionRange,
      useGradients: formUseGradients,
      innerFadeStart: formInnerFadeStart,
      midpointPosition: formMidpointPosition,
      midpointOpacity: formMidpointOpacity,
      outerFadeStart: formOuterFadeStart,
      color: formColor,
    });

    toast.success(`Updated vision profile: ${formName}`);
    setShowEditModal(false);
    setEditingProfile(null);
    resetForm();
  };

  const handleDelete = (profile: VisionProfile) => {
    if (defaultProfiles.find(p => p.id === profile.id)) {
      toast.error('Cannot delete default vision profiles');
      return;
    }

    if (confirm(`Are you sure you want to delete "${profile.name}"?`)) {
      removeProfile(profile.id);
      toast.success(`Deleted vision profile: ${profile.name}`);
    }
  };

  const renderProfileCard = (profile: VisionProfile, isDefault: boolean) => (
    <div
      key={profile.id}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        "bg-card hover:bg-muted/50 transition-colors"
      )}
    >
      {/* Color indicator */}
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-border"
        style={{ backgroundColor: profile.color }}
      />

      {/* Profile info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{profile.name}</h4>
          {profile.useGradients && (
            <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {profile.visionRange === 0 ? 'No vision' : `${profile.visionRange} grid units (${profile.visionRange * 5}ft)`}
        </p>
      </div>

      {/* Actions */}
      {!isDefault && (
        <div className="flex gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openEditModal(profile)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => handleDelete(profile)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  const renderProfileForm = () => (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="profile-name">Profile Name</Label>
        <Input
          id="profile-name"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="e.g., Torch Light, Lantern"
          maxLength={50}
        />
      </div>

      {/* Color */}
      <div className="space-y-2">
        <Label htmlFor="profile-color">Display Color</Label>
        <div className="flex gap-2 items-center">
          <Input
            id="profile-color"
            type="color"
            value={formColor}
            onChange={(e) => setFormColor(e.target.value)}
            className="w-20 h-10 p-1"
          />
          <span className="text-sm text-muted-foreground">{formColor}</span>
        </div>
      </div>

      <Separator />

      {/* Vision Range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="profile-range">Vision Range</Label>
          <span className="text-sm font-medium">{formVisionRange} units ({formVisionRange * 5}ft)</span>
        </div>
        <Slider
          id="profile-range"
          min={0}
          max={50}
          step={1}
          value={[formVisionRange]}
          onValueChange={([value]) => setFormVisionRange(value)}
        />
      </div>

      <Separator />

      {/* Use Gradients Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="profile-gradients">Soft Gradient Edges</Label>
          <p className="text-xs text-muted-foreground">
            Smooth fade at vision boundaries
          </p>
        </div>
        <Switch
          id="profile-gradients"
          checked={formUseGradients}
          onCheckedChange={setFormUseGradients}
        />
      </div>

      {/* Gradient Settings */}
      {formUseGradients && (
        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
          {/* Inner Fade Start */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-inner" className="text-xs">
                Inner Clear Zone
              </Label>
              <span className="text-xs font-medium">{Math.round(formInnerFadeStart * 100)}%</span>
            </div>
            <Slider
              id="profile-inner"
              min={0}
              max={100}
              step={5}
              value={[formInnerFadeStart * 100]}
              onValueChange={([value]) => setFormInnerFadeStart(value / 100)}
            />
            <p className="text-xs text-muted-foreground">
              Radius where vision is perfectly clear
            </p>
          </div>

          {/* Midpoint Position */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-midpoint-pos" className="text-xs">
                Midpoint Distance
              </Label>
              <span className="text-xs font-medium">{Math.round(formMidpointPosition * 100)}%</span>
            </div>
            <Slider
              id="profile-midpoint-pos"
              min={0}
              max={100}
              step={5}
              value={[formMidpointPosition * 100]}
              onValueChange={([value]) => setFormMidpointPosition(value / 100)}
            />
            <p className="text-xs text-muted-foreground">
              Where the mid-fade transition occurs
            </p>
          </div>

          {/* Midpoint Opacity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-midpoint-opacity" className="text-xs">
                Midpoint Darkness
              </Label>
              <span className="text-xs font-medium">{Math.round(formMidpointOpacity * 100)}%</span>
            </div>
            <Slider
              id="profile-midpoint-opacity"
              min={0}
              max={100}
              step={5}
              value={[formMidpointOpacity * 100]}
              onValueChange={([value]) => setFormMidpointOpacity(value / 100)}
            />
            <p className="text-xs text-muted-foreground">
              Darkness level at midpoint
            </p>
          </div>

          {/* Outer Fade Start */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-outer" className="text-xs">
                Outer Fade Start
              </Label>
              <span className="text-xs font-medium">{Math.round(formOuterFadeStart * 100)}%</span>
            </div>
            <Slider
              id="profile-outer"
              min={0}
              max={100}
              step={5}
              value={[formOuterFadeStart * 100]}
              onValueChange={([value]) => setFormOuterFadeStart(value / 100)}
            />
            <p className="text-xs text-muted-foreground">
              Where final fade to full darkness begins
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Create and manage custom vision profiles for tokens
        </p>
        <Button size="sm" onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          New Profile
        </Button>
      </div>

      {/* Default Profiles */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Default Profiles
        </h3>
        <div className="space-y-2">
          {defaultProfiles.map((profile) => renderProfileCard(profile, true))}
        </div>
      </div>

      {/* Custom Profiles */}
      {customProfiles.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Custom Profiles
            </h3>
            <div className="space-y-2">
              {customProfiles.map((profile) => renderProfileCard(profile, false))}
            </div>
          </div>
        </>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Vision Profile</DialogTitle>
            <DialogDescription>
              Define a custom vision profile with gradient settings
            </DialogDescription>
          </DialogHeader>
          {renderProfileForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vision Profile</DialogTitle>
            <DialogDescription>
              Modify gradient settings for "{editingProfile?.name}"
            </DialogDescription>
          </DialogHeader>
          {renderProfileForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
