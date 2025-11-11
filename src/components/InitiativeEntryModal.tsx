import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Token } from '@/stores/sessionStore';
import { Dices, Check, X } from 'lucide-react';

interface InitiativeEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokens: Token[];
  onAddToInitiative: (tokenId: string, initiative: number) => void;
}

export const InitiativeEntryModal: React.FC<InitiativeEntryModalProps> = ({
  open,
  onOpenChange,
  tokens,
  onAddToInitiative
}) => {
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [initiativeValues, setInitiativeValues] = useState<{ [tokenId: string]: string }>({});

  const handleTokenToggle = (tokenId: string) => {
    setSelectedTokenIds(prev => 
      prev.includes(tokenId) 
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  const handleRoll = (tokenId: string, modifier: number = 0) => {
    const roll = Math.floor(Math.random() * 20) + 1 + modifier;
    setInitiativeValues(prev => ({ ...prev, [tokenId]: roll.toString() }));
  };

  const handleAddSelected = () => {
    selectedTokenIds.forEach(tokenId => {
      const value = parseInt(initiativeValues[tokenId] || '0');
      onAddToInitiative(tokenId, value);
    });
    
    // Reset
    setSelectedTokenIds([]);
    setInitiativeValues({});
    onOpenChange(false);
  };

  const handleSelectAll = () => {
    if (selectedTokenIds.length === tokens.length) {
      setSelectedTokenIds([]);
    } else {
      setSelectedTokenIds(tokens.map(t => t.id));
    }
  };

  const handleRollAll = () => {
    const newValues: { [tokenId: string]: string } = {};
    tokens.forEach(token => {
      const roll = Math.floor(Math.random() * 20) + 1;
      newValues[token.id] = roll.toString();
    });
    setInitiativeValues(newValues);
    setSelectedTokenIds(tokens.map(t => t.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Add Tokens to Initiative</DialogTitle>
              <DialogDescription>
                Select tokens and set their initiative values
              </DialogDescription>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAddSelected}
                disabled={selectedTokenIds.length === 0}
                className="h-8 w-8 hover:bg-green-500/20 text-green-600 hover:text-green-600"
                title="Add to Initiative"
              >
                <Check className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 hover:bg-red-500/20 text-red-600 hover:text-red-600"
                title="Cancel"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bulk Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedTokenIds.length === tokens.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRollAll}
            >
              <Dices className="mr-2 h-4 w-4" />
              Roll All
            </Button>
          </div>

          {/* Token List */}
          <div className="space-y-2">
            {tokens.map(token => (
              <div
                key={token.id}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                  selectedTokenIds.includes(token.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedTokenIds.includes(token.id)}
                  onChange={() => handleTokenToggle(token.id)}
                  className="w-4 h-4"
                />

                {/* Token Preview */}
                <div className="w-10 h-10 rounded border-2 border-border overflow-hidden flex-shrink-0">
                  {token.imageUrl ? (
                    <img
                      src={token.imageUrl}
                      alt={token.label || token.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: token.color || '#888' }}
                    />
                  )}
                </div>

                {/* Token Name */}
                <div className="flex-1 font-medium">
                  {token.label || token.name}
                </div>

                {/* Initiative Input */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">
                    Initiative:
                  </Label>
                  <Input
                    type="number"
                    value={initiativeValues[token.id] || ''}
                    onChange={(e) => setInitiativeValues(prev => ({
                      ...prev,
                      [token.id]: e.target.value
                    }))}
                    placeholder="0"
                    className="w-20"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRoll(token.id)}
                  >
                    <Dices className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
