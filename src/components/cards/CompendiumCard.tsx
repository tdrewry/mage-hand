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

  // If floating, we show a multi-column master-detail layout where necessary,
  // but allow full-width components (like Effects) to span the whole card.
  if (!isDocked) {
    const renderMasterDetail = (tabValue: 'characters' | 'monsters' | 'items') => (
      <TabsContent value={tabValue} className="flex-1 min-h-0 flex gap-4 m-0 p-0">
        <div className="w-[380px] flex flex-col min-h-0 border-r border-border pr-4 shrink-0">
          <CreatureLibraryCardContent 
            cardId={cardId} 
            forcedTab={tabValue}
            onSelectEntity={(id, type) => setSelectedEntity({ id, type: type as any })} 
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0 relative bg-background/50 rounded-lg">
          {selectedEntity ? (
            <LibraryEditorCardContent 
              entityId={selectedEntity.id} 
              entityType={selectedEntity.type} 
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <LayoutPanelLeft className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a creature or character from the compendium to view details</p>
            </div>
          )}
        </div>
      </TabsContent>
    );

    return (
      <div className="flex flex-col h-full w-full min-h-0">
        <Tabs value={activeMasterTab} onValueChange={(v) => setActiveMasterTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-5 mb-4 h-auto p-1 shrink-0">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="characters" className="p-2" aria-label="Characters"><Users className="w-4 h-4" /></TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Characters</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="monsters" className="p-2" aria-label="Monsters"><Ghost className="w-4 h-4" /></TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Monsters</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="items" className="p-2" aria-label="Items"><Backpack className="w-4 h-4" /></TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Items</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="effects" className="p-2" aria-label="Effects"><Sparkles className="w-4 h-4" /></TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Effects</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="tokens" className="p-2" aria-label="Tokens"><CircleUser className="w-4 h-4" /></TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Tokens</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TabsList>

          {renderMasterDetail('characters')}
          {renderMasterDetail('monsters')}
          {renderMasterDetail('items')}

          <TabsContent value="effects" className="flex-1 min-h-0 h-full data-[state=active]:flex flex-col m-0 p-0">
            <EffectsCardContent />
          </TabsContent>

          <TabsContent value="tokens" className="flex-1 min-h-0 h-full data-[state=active]:flex gap-4 m-0 p-0">
            <div className="w-[380px] flex flex-col min-h-0 h-full border-r border-border pr-4 shrink-0">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Custom Tokens</h3>
              <div className="flex-1 min-h-0 overflow-y-auto"><TokenPanelCardContent onAddToken={onAddToken} /></div>
            </div>
            <div className="flex-1 flex flex-col min-h-0 relative bg-background/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4">Token Groups</h3>
              <div className="flex-1 min-h-0 overflow-y-auto"><TokenGroupManagerCardContent /></div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // If Docked, we show a strict compact layout with tooltips
  return (
    <div className="flex flex-col h-full w-full">
      <Tabs value={activeMasterTab} onValueChange={(v) => setActiveMasterTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-5 mb-2 h-auto py-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="characters" className="p-1 px-2"><Users className="w-4 h-4" /></TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Characters</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="monsters" className="p-1 px-2"><Ghost className="w-4 h-4" /></TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Monsters</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="items" className="p-1 px-2"><Backpack className="w-4 h-4" /></TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Items</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="effects" className="p-1 px-2"><Sparkles className="w-4 h-4" /></TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Effects</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="tokens" className="p-1 px-2"><CircleUser className="w-4 h-4" /></TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Tokens</TooltipContent>
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
