import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Users, Crown, Shield, Globe } from 'lucide-react';
import { useSessionStore, LabelVisibility, TokenVisibility } from '../../stores/sessionStore';

interface VisibilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VisibilityModal = ({ open, onOpenChange }: VisibilityModalProps) => {
  const { 
    tokenVisibility, 
    setTokenVisibility, 
    labelVisibility, 
    setLabelVisibility, 
    currentPlayerId, 
    players 
  } = useSessionStore();
  
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isDM = currentPlayer?.roleIds?.includes('dm') || false;

  const handleTokenVisibilityChange = (value: TokenVisibility) => {
    setTokenVisibility(value);
  };

  const handleLabelVisibilityChange = (value: LabelVisibility) => {
    setLabelVisibility(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Token Visibility
          </DialogTitle>
          <DialogDescription>
            Control what tokens and labels are visible
          </DialogDescription>
        </DialogHeader>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Token Visibility Controls */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Token Visibility
                </label>
                <Select value={tokenVisibility} onValueChange={handleTokenVisibilityChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3 w-3" />
                        All Tokens
                      </div>
                    </SelectItem>
                    <SelectItem value="owned">
                      <div className="flex items-center gap-2">
                        <Crown className="h-3 w-3" />
                        Owned Tokens
                      </div>
                    </SelectItem>
                    {isDM && (
                      <SelectItem value="dm-only">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3" />
                          DM Only
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Label Visibility Controls */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Label Visibility
                </label>
                <Select value={labelVisibility} onValueChange={handleLabelVisibilityChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="show">
                      <div className="flex items-center gap-2">
                        <Eye className="h-3 w-3" />
                        Show All
                      </div>
                    </SelectItem>
                    <SelectItem value="hide">
                      <div className="flex items-center gap-2">
                        <EyeOff className="h-3 w-3" />
                        Hide All
                      </div>
                    </SelectItem>
                    <SelectItem value="selected">
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        Selected Only
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-xs text-muted-foreground border-t pt-2">
                Role: {isDM ? 'Dungeon Master' : 'Player'}
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};