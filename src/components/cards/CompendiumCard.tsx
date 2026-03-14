import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreatureLibraryCardContent } from './CreatureLibraryCard';
import { TokenPanelCardContent } from './TokenPanelCard';
import { LibraryEditorCardContent } from './LibraryEditorCard';
import { RosterCardContent } from './RosterCard';
import { EffectsCardContent } from './EffectsCard';
import { TokenGroupManagerCardContent } from './TokenGroupManagerCard';
import { useSessionStore } from '@/stores/sessionStore';
import { useCardStore } from '@/stores/cardStore';
import { cn } from '@/lib/utils';
import { Users, Ghost, Backpack, Sparkles, CircleUser, LayoutPanelLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CompendiumCardContentProps {
  cardId: string;
  onAddToken: (imageUrl: string, x?: number, y?: number, gridWidth?: number, gridHeight?: number, color?: string) => void;
}

export function CompendiumCardContent({ cardId, onAddToken }: CompendiumCardContentProps) {
  const card = useCardStore((state) => state.getCard(cardId));
  const isDocked = card?.dockPosition !== 'floating';

  const [activeMasterTab, setActiveMasterTab] = useState<'characters' | 'monsters' | 'items' | 'effects' | 'tokens'>('monsters');
  const [selectedEntity, setSelectedEntity] = useState<{ id: string; type: 'character' | 'monster' } | null>(null);

  return (
    <div className="flex flex-col h-full w-full">
      <Tabs value={activeMasterTab} onValueChange={(v) => setActiveMasterTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-5 mb-2 h-auto py-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="characters" className="w-full p-1 px-2 gap-2">
                    <Users className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Characters</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Characters</TooltipContent>}
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="monsters" className="w-full p-1 px-2 gap-2">
                    <Ghost className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Monsters</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Monsters</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="items" className="w-full p-1 px-2 gap-2">
                    <Backpack className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Items</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Items</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="effects" className="w-full p-1 px-2 gap-2">
                    <Sparkles className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Effects</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Effects</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="tokens" className="w-full p-1 px-2 gap-2">
                    <CircleUser className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Tokens</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Tokens</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </TabsList>
        
        <TabsContent value="characters" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <CreatureLibraryCardContent 
            cardId={cardId} 
            forcedTab="characters"
          />
        </TabsContent>
        <TabsContent value="monsters" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <CreatureLibraryCardContent 
            cardId={cardId} 
            forcedTab="monsters"
          />
        </TabsContent>
        
        <TabsContent value="items" className="flex-1 min-h-0 flex flex-col m-0 p-0 text-muted-foreground">
          <CreatureLibraryCardContent 
            cardId={cardId} 
            forcedTab="items"
          />
        </TabsContent>

        <TabsContent value="effects" className="flex-1 min-h-0 h-full data-[state=active]:flex flex-col m-0 p-0">
          <EffectsCardContent />
        </TabsContent>

        <TabsContent value="tokens" className="flex-1 min-h-0 h-full data-[state=active]:flex flex-col gap-4 overflow-y-auto m-0 p-0">
          <div className="flex flex-col gap-2 h-full min-h-0">
            <h3 className="text-sm font-semibold text-muted-foreground">Custom Tokens</h3>
            <TokenPanelCardContent onAddToken={onAddToken} />
            <h3 className="text-sm font-semibold text-muted-foreground mt-4">Groups</h3>
            <TokenGroupManagerCardContent />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
