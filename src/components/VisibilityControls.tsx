import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Users, Crown, Shield, Globe } from 'lucide-react';
import { useSessionStore, LabelVisibility, TokenVisibility } from '../stores/sessionStore';

export const VisibilityControls = () => {
  const { 
    tokenVisibility, 
    setTokenVisibility, 
    labelVisibility, 
    setLabelVisibility, 
    currentPlayerId, 
    players 
  } = useSessionStore();
  
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isDM = currentPlayer?.role === 'dm';

  const handleTokenVisibilityChange = (value: TokenVisibility) => {
    setTokenVisibility(value);
  };

  const handleLabelVisibilityChange = (value: LabelVisibility) => {
    setLabelVisibility(value);
  };

  const getTokenVisibilityIcon = (visibility: TokenVisibility) => {
    switch (visibility) {
      case 'all': return <Globe className="h-4 w-4" />;
      case 'owned': return <Crown className="h-4 w-4" />;
      case 'dm-only': return <Shield className="h-4 w-4" />;
    }
  };

  const getLabelVisibilityIcon = (visibility: LabelVisibility) => {
    switch (visibility) {
      case 'show': return <Eye className="h-4 w-4" />;
      case 'hide': return <EyeOff className="h-4 w-4" />;
      case 'selected': return <Users className="h-4 w-4" />;
    }
  };

  const getTokenVisibilityLabel = (visibility: TokenVisibility) => {
    switch (visibility) {
      case 'all': return 'All Tokens';
      case 'owned': return 'Owned Tokens';
      case 'dm-only': return 'DM Only';
    }
  };

  const getLabelVisibilityLabel = (visibility: LabelVisibility) => {
    switch (visibility) {
      case 'show': return 'Show All';
      case 'hide': return 'Hide All';
      case 'selected': return 'Selected Only';
    }
  };

  return (
    <Card className="m-4 bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-card-foreground flex items-center gap-2">
          {getTokenVisibilityIcon(tokenVisibility)}
          Token Visibility
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Token Visibility Controls */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
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
            <label className="text-xs text-muted-foreground mb-2 block">
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
  );
};