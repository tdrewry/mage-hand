import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const handleOpenActionsTab = () => {
      setActiveTab('action');
    };
    
    window.addEventListener('openActionsTab', handleOpenActionsTab);
    return () => window.removeEventListener('openActionsTab', handleOpenActionsTab);
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-5 mb-2 h-auto py-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="chat" className="w-full p-1 px-2 gap-2">
                    <MessageSquare className="w-4 h-4" />
                    {!isDocked && <span>Chat</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Chat</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="history" className="w-full p-1 px-2 gap-2">
                    <ScrollText className="w-4 h-4" />
                    {!isDocked && <span>History</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>History</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="dice" className="w-full p-1 px-2 gap-2">
                    <Dices className="w-4 h-4" />
                    {!isDocked && <span>Dice</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Dice</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="initiative" className="w-full p-1 px-2 gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Init</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Initiative</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="action" className="w-full p-1 px-2 gap-2">
                    <Swords className="w-4 h-4" />
                    {!isDocked && <span>Actions</span>}
                  </TabsTrigger>
                </div>
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
