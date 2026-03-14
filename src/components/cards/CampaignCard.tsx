import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CampaignEditorCardContent } from './CampaignEditorCard';
import { HandoutCatalogCardContent } from './HandoutCatalogCard';
import { ArtApprovalCardContent } from './ArtApprovalCard';
import { useCardStore } from '@/stores/cardStore';
import { Feather, FileText, Image as ImageIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CampaignCardContentProps {
  cardId: string;
}

export function CampaignCardContent({ cardId }: CampaignCardContentProps) {
  const card = useCardStore((state) => state.getCard(cardId));
  const isDocked = card?.dockPosition !== 'floating';
  const [activeTab, setActiveTab] = useState<'editor' | 'handouts' | 'art'>('editor');

  return (
    <div className="flex flex-col h-full w-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 mb-2 h-auto py-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="editor" className="w-full p-1 px-2 gap-2">
                    <Feather className="w-4 h-4" />
                    {!isDocked && <span>Campaign Editor</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Campaign Editor</TooltipContent>}
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="handouts" className="w-full p-1 px-2 gap-2">
                    <FileText className="w-4 h-4" />
                    {!isDocked && <span>Handouts</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Handouts</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="art" className="w-full p-1 px-2 gap-2">
                    <ImageIcon className="w-4 h-4" />
                    {!isDocked && <span>Art Approval</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Art Approval</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </TabsList>
        
        <TabsContent value="editor" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <CampaignEditorCardContent />
        </TabsContent>

        <TabsContent value="handouts" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <HandoutCatalogCardContent />
        </TabsContent>
        
        <TabsContent value="art" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <ArtApprovalCardContent />
        </TabsContent>
        
      </Tabs>
    </div>
  );
}
