import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EffectsCatalog } from './EffectsCatalog';
import { RuleGraphEditor } from './RuleGraphEditor';
import { GlobalConfigEditor } from './GlobalConfigEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sparkles, GitMerge, Plus, Pencil, Trash2, FileCode2, Settings2 } from 'lucide-react';
import { useRuleStore } from '@/stores/ruleStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function RulesLibrary() {
  const pipelines = useRuleStore(s => s.pipelines);
  const deletePipeline = useRuleStore(s => s.deletePipeline);
  
  const [activeTab, setActiveTab] = useState<'effects' | 'logic' | 'vocabulary'>('effects');
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  if (editingPipelineId || isCreatingNew) {
    return (
      <div className="flex flex-col h-full w-full">
        <div className="flex-1 min-h-0 relative">
          <RuleGraphEditor 
            pipelineId={editingPipelineId || undefined}
            onBack={() => {
              setEditingPipelineId(null);
              setIsCreatingNew(false);
            }} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0 p-4">
        <TabsList className="grid w-full max-w-[24rem] grid-cols-3 mb-4 h-auto py-1">
          <TabsTrigger value="vocabulary" className="p-1 px-2 gap-2">
            <Settings2 className="w-4 h-4" />
            <span>Vocabulary</span>
          </TabsTrigger>
          <TabsTrigger value="effects" className="p-1 px-2 gap-2">
            <Sparkles className="w-4 h-4" />
            <span>Effects</span>
          </TabsTrigger>
          <TabsTrigger value="logic" className="p-1 px-2 gap-2">
            <GitMerge className="w-4 h-4" />
            <span>Logic Pipelines</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="effects" className="flex-1 min-h-0 h-full data-[state=active]:flex flex-col m-0 p-0 border border-border rounded-md">
          <EffectsCatalog />
        </TabsContent>

        <TabsContent value="vocabulary" className="flex-1 min-h-0 h-full data-[state=active]:flex flex-col m-0 p-0 border border-border rounded-md">
          <GlobalConfigEditor />
        </TabsContent>

        <TabsContent value="logic" className="flex-1 min-h-0 h-full data-[state=active]:flex flex-col m-0 p-0">
          <ScrollArea className="flex-1 h-full pr-4">
            {pipelines.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-lg bg-background/50">
                <GitMerge className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Logic Pipelines</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                  Create custom rules and logic pipelines that trigger automatically during gameplay using the visual node editor.
                </p>
                <Button onClick={() => setIsCreatingNew(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Rule
                </Button>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                    <GitMerge className="w-4 h-4" /> 
                    Saved Pipelines
                  </h3>
                  <Button size="sm" onClick={() => setIsCreatingNew(true)}>
                    <Plus className="w-4 h-4 mr-1" /> New Pipeline
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {pipelines.map(p => (
                    <div 
                      key={p.id} 
                      className="p-3 border border-border rounded-md bg-card hover:bg-accent/50 transition-colors flex items-start justify-between group cursor-pointer"
                      onClick={() => setEditingPipelineId(p.id)}
                    >
                      <div className="flex flex-col min-w-0 pr-4">
                        <span className="font-medium text-sm truncate">{p.name || 'Untitled Pipeline'}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1.5">
                          <FileCode2 className="w-3.5 h-3.5" /> {p.nodes.length} Nodes
                          <span className="mx-1 opacity-50">•</span>
                          Edited {new Date(p.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0" 
                          onClick={() => setEditingPipelineId(p.id)} 
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" 
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Pipeline</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the pipeline "{p.name || 'Untitled Pipeline'}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deletePipeline(p.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
