import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCardStore } from '@/stores/cardStore';
import { ChatCardContent } from './ChatCard';
import { HistoryCard } from './HistoryCard';
import { DiceCardContent } from './DiceCard';
import { ActionCardContent } from './ActionCard';
import { MessageSquare, ScrollText, Dices, Swords } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PlayCardContentProps {
  cardId: string;
}

export function PlayCardContent({ cardId }: PlayCardContentProps) {
  const card = useCardStore((state) => state.getCard(cardId));
  const isDocked = card?.dockPosition !== 'floating';

  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'dice' | 'action'>('chat');

  // If floating, split into 2 panes: Left (Chat/History) & Right (Dice/Actions)
  if (!isDocked) {
    return (
      <div className="flex h-full w-full gap-4">
        {/* Left Column: Chat & Log */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-border pr-4 shrink-0">
          <Tabs value={['chat', 'history'].includes(activeTab) ? activeTab : 'chat'} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="chat" className="gap-2"><MessageSquare className="w-4 h-4" /> Chat</TabsTrigger>
              <TabsTrigger value="history" className="gap-2"><ScrollText className="w-4 h-4" /> History</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col m-0 p-0">
              <ChatCardContent />
            </TabsContent>
            <TabsContent value="history" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
              <HistoryCard />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Active Play Tools */}
        <div className="w-[380px] flex flex-col min-h-0 relative">
          <Tabs value={['dice', 'action'].includes(activeTab) ? activeTab : 'dice'} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50">
              <TabsTrigger value="dice" className="gap-2"><Dices className="w-4 h-4" /> Dice</TabsTrigger>
              <TabsTrigger value="action" className="gap-2"><Swords className="w-4 h-4" /> Actions</TabsTrigger>
            </TabsList>
            <TabsContent value="dice" className="flex-1 min-h-0 overflow-y-auto m-0 p-0 bg-background/50 rounded-lg p-2 border">
              <DiceCardContent />
            </TabsContent>
            <TabsContent value="action" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
              <ActionCardContent />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // If Docked, single column stack of tabs
  return (
    <div className="flex flex-col h-full w-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-4 mb-2 h-auto py-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="chat" className="p-1 px-2"><MessageSquare className="w-4 h-4" /></TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Chat</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="history" className="p-1 px-2"><ScrollText className="w-4 h-4" /></TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>History</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="dice" className="p-1 px-2"><Dices className="w-4 h-4" /></TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Dice</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="action" className="p-1 px-2"><Swords className="w-4 h-4" /></TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Actions</TooltipContent>
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
        <TabsContent value="action" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <ActionCardContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
