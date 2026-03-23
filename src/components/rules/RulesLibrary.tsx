import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EffectsCatalog } from './EffectsCatalog';
import { RuleGraphEditor } from './RuleGraphEditor';
import { GlobalConfigEditor } from './GlobalConfigEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sparkles, GitMerge, Plus, Pencil, Trash2, FileCode2, Settings2, Upload, Download, Copy } from 'lucide-react';
import { useRuleStore } from '@/stores/ruleStore';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  const addPipeline = useRuleStore(s => s.addPipeline);
  const updatePipeline = useRuleStore(s => s.updatePipeline);
  const deletePipeline = useRuleStore(s => s.deletePipeline);
  
  const [activeTab, setActiveTab] = useState<'effects' | 'logic' | 'vocabulary'>('effects');
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isBulkExportOpen, setIsBulkExportOpen] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set());

  const handleOpenBulkExport = () => {
    setSelectedForExport(new Set(pipelines.map(p => p.id)));
    setIsBulkExportOpen(true);
  };

  const handleToggleExportSelection = (id: string, checked: boolean) => {
    setSelectedForExport(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkExport = () => {
    const toExport = pipelines.filter(p => selectedForExport.has(p.id));
    if (toExport.length === 0) return;

    const exportData = {
      mageHandExportVersion: 1,
      type: "logic-pipelines-bulk",
      pipelines: toExport
    };

    downloadPipelineBlob(exportData, `pipelines_bulk_export_${new Date().toISOString().split('T')[0]}.json`);
    toast.success(`Exported ${toExport.length} pipelines`);
    setIsBulkExportOpen(false);
  };

  const downloadPipelineBlob = (payload: any, filename: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingle = (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const exportData = {
      mageHandExportVersion: 1,
      type: "logic-pipeline",
      pipeline: p
    };
    downloadPipelineBlob(exportData, `${(p.name || 'pipeline').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
    toast.success("Pipeline exported");
  };

  const handleCopyPipeline = (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Create new ID and deep copy contents
    const newId = `logic-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const clonedNodes = JSON.parse(JSON.stringify(p.nodes));
    const clonedPositions = JSON.parse(JSON.stringify(p.positions));
    
    const copiedPipeline = {
      ...p,
      id: newId,
      name: `Copy of ${p.name || 'Untitled Pipeline'}`,
      nodes: clonedNodes,
      positions: clonedPositions,
      updatedAt: new Date().toISOString()
    };
    
    addPipeline(copiedPipeline);
    toast.success("Pipeline duplicated successfully!");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        let importedCount = 0;
        let updatedCount = 0;

        const processPipeline = (p: any) => {
          // If the pipeline doesn't have an ID for some reason, generate one
          const pipelineId = p.id || `logic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const existing = pipelines.find(ext => ext.id === pipelineId);
          
          if (existing) {
            // Newest wins collision handling
            const existingTime = new Date(existing.updatedAt || 0).getTime();
            const importedTime = new Date(p.updatedAt || 0).getTime();
            if (importedTime > existingTime) {
              updatePipeline(pipelineId, p);
              updatedCount++;
            }
          } else {
            addPipeline({ ...p, id: pipelineId });
            importedCount++;
          }
        };

        if (parsed.type === "logic-pipelines-bulk" && Array.isArray(parsed.pipelines)) {
          parsed.pipelines.forEach(processPipeline);
        } else if (parsed.type === "logic-pipeline" && parsed.pipeline) {
          processPipeline(parsed.pipeline);
        } else {
          throw new Error("Invalid pipeline file format");
        }
        
        toast.success(`Imported ${importedCount} new, updated ${updatedCount} existing.`);
      } catch (err: any) {
        toast.error(`Failed to import pipeline: ${err.message}`);
      }
      
      // Reset input so the same file can be imported again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

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
      <input 
        type="file" 
        accept=".json" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleImport} 
      />
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
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Pipeline
                  </Button>
                  <Button onClick={() => setIsCreatingNew(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Rule
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                    <GitMerge className="w-4 h-4" /> 
                    Saved Pipelines
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleOpenBulkExport}>
                      <Download className="w-4 h-4 mr-1" /> Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-1" /> Import
                    </Button>
                    <Button size="sm" onClick={() => setIsCreatingNew(true)}>
                      <Plus className="w-4 h-4 mr-1" /> New Pipeline
                    </Button>
                  </div>
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
                          onClick={(e) => handleExportSingle(p, e)} 
                          title="Export"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0" 
                          onClick={(e) => handleCopyPipeline(p, e)} 
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
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

      <Dialog open={isBulkExportOpen} onOpenChange={setIsBulkExportOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Bulk Export Pipelines</DialogTitle>
            <DialogDescription>
              Select the pipelines you want to export.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="flex items-center space-x-2 pb-2 border-b border-border">
              <Checkbox 
                id="select-all" 
                checked={selectedForExport.size === pipelines.length && pipelines.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedForExport(new Set(pipelines.map(p => p.id)));
                  } else {
                    setSelectedForExport(new Set());
                  }
                }}
              />
              <label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Select All
              </label>
            </div>
            {pipelines.map(p => (
              <div key={p.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`export-${p.id}`} 
                  checked={selectedForExport.has(p.id)}
                  onCheckedChange={(checked) => handleToggleExportSelection(p.id, checked as boolean)}
                />
                <label htmlFor={`export-${p.id}`} className="text-sm font-medium leading-none cursor-pointer">
                  {p.name || 'Untitled Pipeline'}
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkExportOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkExport} disabled={selectedForExport.size === 0}>
              <Download className="w-4 h-4 mr-2" /> Export {selectedForExport.size} Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
