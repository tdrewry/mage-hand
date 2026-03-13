import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCardStore } from '@/stores/cardStore';
import { ChatCardContent } from './ChatCard';
import { HistoryCard } from './HistoryCard';
import { DiceCardContent } from './DiceCard';
import { ActionCardContent } from './ActionCard';
import { InitiativeTrackerCardContent } from './InitiativeTrackerCard';
import { MessageSquare, ScrollText, Dices, Swords, ShieldAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PlayCardContentProps {
  cardId: string;
}

export function PlayCardContent({ cardId }: PlayCardContentProps) {
  const card = useCardStore((state) => state.getCard(cardId));
  const isDocked = card?.dockPosition !== 'floating';

  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'dice' | 'initiative' | 'action'>('chat');

  return (
    <div className="flex flex-col h-full w-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-5 mb-2 h-auto py-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="chat" className="p-1 px-2 gap-2">
                  <MessageSquare className="w-4 h-4" />
                  {!isDocked && <span>Chat</span>}
                </TabsTrigger>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Chat</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="history" className="p-1 px-2 gap-2">
                  <ScrollText className="w-4 h-4" />
                  {!isDocked && <span>History</span>}
                </TabsTrigger>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>History</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="dice" className="p-1 px-2 gap-2">
                  <Dices className="w-4 h-4" />
                  {!isDocked && <span>Dice</span>}
                </TabsTrigger>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Dice</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="initiative" className="p-1 px-2 gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  {!isDocked && <span className="truncate">Init</span>}
                </TabsTrigger>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Initiative</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="action" className="p-1 px-2 gap-2">
                  <Swords className="w-4 h-4" />
                  {!isDocked && <span>Actions</span>}
                </TabsTrigger>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Actions</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </TabsList>
        
        <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <ChatCardContent />
        </TabsContent>
        <TabsContent value="history" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <HistoryCard />
        </TabsContent>
        <TabsContent value="dice" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <DiceCardContent />
        </TabsContent>
        <TabsContent value="initiative" className="flex-1 min-h-0 overflow-hidden m-0 p-0 flex flex-col">
          <InitiativeTrackerCardContent />
        </TabsContent>
        <TabsContent value="action" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <ActionCardContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
