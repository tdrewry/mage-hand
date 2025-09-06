import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Users, Crown } from 'lucide-react';
import { useSessionStore, LabelVisibility } from '../stores/sessionStore';

export const LabelControls = () => {
  const { labelVisibility, setLabelVisibility, currentPlayerId, players } = useSessionStore();
  
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isDM = currentPlayer?.role === 'dm';

  const handleVisibilityChange = (value: LabelVisibility) => {
    setLabelVisibility(value);
  };

  const getVisibilityIcon = (visibility: LabelVisibility) => {
    switch (visibility) {
      case 'show': return <Eye className="h-4 w-4" />;
      case 'hide': return <EyeOff className="h-4 w-4" />;
      case 'selected': return <Users className="h-4 w-4" />;
      case 'owned': return <Crown className="h-4 w-4" />;
    }
  };

  const getVisibilityLabel = (visibility: LabelVisibility) => {
    switch (visibility) {
      case 'show': return 'Show All';
      case 'hide': return 'Hide All';
      case 'selected': return 'Selected Only';
      case 'owned': return 'Owned Only';
    }
  };

  return (
    <Card className="m-4 bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-card-foreground flex items-center gap-2">
          {getVisibilityIcon(labelVisibility)}
          Labels
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              Label Visibility
            </label>
            <Select value={labelVisibility} onValueChange={handleVisibilityChange}>
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
                <SelectItem value="owned">
                  <div className="flex items-center gap-2">
                    <Crown className="h-3 w-3" />
                    Owned Only
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Role: {isDM ? 'Dungeon Master' : 'Player'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};