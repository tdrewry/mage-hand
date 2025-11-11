import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useRoleStore } from '@/stores/roleStore';
import { useSessionStore } from '@/stores/sessionStore';
import { toast } from 'sonner';

interface RoleSelectionModalProps {
  open: boolean;
}

export const RoleSelectionModal = ({ open }: RoleSelectionModalProps) => {
  const { roles } = useRoleStore();
  const { players, currentPlayerId, addPlayer } = useSessionStore();
  const [username, setUsername] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-assign roles based on whether this is the first user
  useEffect(() => {
    if (open && roles.length > 0) {
      const isFirstUser = players.length === 0;
      
      if (isFirstUser) {
        // First user gets DM role pre-selected
        const dmRole = roles.find(r => r.id === 'dm');
        if (dmRole) {
          setSelectedRoleIds([dmRole.id]);
        }
      } else {
        // Subsequent users get Player role pre-selected
        const playerRole = roles.find(r => r.id === 'player');
        if (playerRole) {
          setSelectedRoleIds([playerRole.id]);
        }
      }
    }
  }, [open, roles, players.length]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev => {
      if (prev.includes(roleId)) {
        return prev.filter(id => id !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  };

  const handleSubmit = () => {
    // Validate username
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast.error('Please enter a username');
      return;
    }

    if (trimmedUsername.length > 50) {
      toast.error('Username must be less than 50 characters');
      return;
    }

    // Validate role selection
    if (selectedRoleIds.length === 0) {
      toast.error('Please select at least one role');
      return;
    }

    setIsSubmitting(true);

    try {
      // Add or update player with selected roles
      addPlayer({
        id: currentPlayerId,
        name: trimmedUsername,
        roleIds: selectedRoleIds,
        isConnected: true,
      });

      toast.success('Welcome to the session!');
    } catch (error) {
      console.error('Failed to join session:', error);
      toast.error('Failed to join session. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting) {
      handleSubmit();
    }
  };

  // Check if current player has a valid name
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const hasValidPlayer = currentPlayer && currentPlayer.name && currentPlayer.name.trim().length > 0;

  // Don't show modal if player already has valid info
  if (!open || hasValidPlayer) {
    return null;
  }

  const isFirstUser = players.length === 0;

  return (
    <Dialog open={true} onOpenChange={() => {/* Cannot dismiss */}}>
      <DialogContent 
        className="sm:max-w-md bg-background border-border"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Welcome to the Session
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center mt-2">
            {isFirstUser 
              ? "You're the first to join! Set up your details below."
              : "Join the ongoing session by selecting your role."}
          </p>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Username Input */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">
              Username *
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={50}
              className="bg-background"
              autoFocus
            />
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Select your role(s) *
            </Label>
            <p className="text-xs text-muted-foreground">
              You can select multiple roles
            </p>

            <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/20">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={role.id}
                    checked={selectedRoleIds.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                  />
                  <label
                    htmlFor={role.id}
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                  >
                    <div
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="font-medium">{role.name}</span>
                    {role.isSystem && (
                      <span className="text-xs text-muted-foreground">(System)</span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !username.trim() || selectedRoleIds.length === 0}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? 'Joining...' : 'Enter Session'}
          </Button>

          {/* Info text */}
          <p className="text-xs text-muted-foreground text-center">
            Your selection determines what you can see and control in the session
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
