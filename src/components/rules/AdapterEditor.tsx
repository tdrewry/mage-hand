import React, { useState, useMemo } from 'react';
import { useAdapterStore, type AdapterDefinition } from '@/stores/adapterStore';
import { useGlobalConfigStore } from '@/stores/globalConfigStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowRight, Plug, Save, Lock, Unlock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { generatePathsFromSchema } from '@/lib/rules-engine/schema-paths';
import { MAGE_HAND_ENTITY_SCHEMA } from '@/lib/rules-engine/schemas';
import { PathSuggestInput } from './PathSuggestInput';
import { toast } from 'sonner';

export function AdapterEditor() {
  const adapters = useAdapterStore(s => s.adapters);
  const addAdapter = useAdapterStore(s => s.addAdapter);
  const updateAdapter = useAdapterStore(s => s.updateAdapter);
  const removeAdapter = useAdapterStore(s => s.removeAdapter);

  const schemas = useGlobalConfigStore(s => s.schemas);
  const schemaList = Object.values(schemas);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isTargetUnlocked, setIsTargetUnlocked] = useState(false);

  const selectedAdapter = adapters.find(a => a.id === selectedId);

  const selectedSchemaNode = selectedAdapter?.sourceId && selectedAdapter.sourceId !== 'any' 
    ? schemas[selectedAdapter.sourceId]?.rootSchema 
    : undefined;

  const selectedTargetSchemaNode = selectedAdapter?.targetId && selectedAdapter.targetId !== 'mage-hand-entity'
    ? schemas[selectedAdapter.targetId]?.rootSchema
    : MAGE_HAND_ENTITY_SCHEMA;

  const suggestPaths = useMemo(() => {
    return selectedSchemaNode ? generatePathsFromSchema(selectedSchemaNode) : [];
  }, [selectedSchemaNode]);

  const targetPaths = useMemo(() => {
    return selectedTargetSchemaNode ? generatePathsFromSchema(selectedTargetSchemaNode) : [];
  }, [selectedTargetSchemaNode]);

  const handleCreateNew = () => {
    addAdapter({
      name: 'New Adapter',
      sourceId: 'any',
      targetId: 'mage-hand-entity',
      mappings: []
    });
    // Can't easily auto-select since addAdapter is void and creates an ID internally, 
    // but the user can click it in the sidebar.
  };

  const handleUpdate = (updates: Partial<AdapterDefinition>) => {
    if (!selectedId) return;
    updateAdapter(selectedId, updates);
  };

  const handleAddMapping = () => {
    if (!selectedAdapter) return;
    handleUpdate({
      mappings: [...selectedAdapter.mappings, { sourcePath: '', mountPoint: '' }]
    });
  };

  const handleAddRawMount = () => {
    if (!selectedAdapter) return;
    handleUpdate({
      mappings: [{ sourcePath: '.', mountPoint: 'adapter.raw' }, ...selectedAdapter.mappings]
    });
  };

  const updateMapping = (index: number, field: 'sourcePath' | 'mountPoint', value: string) => {
    if (!selectedAdapter) return;
    const newMappings = [...selectedAdapter.mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    handleUpdate({ mappings: newMappings });
  };

  const deleteMapping = (index: number) => {
    if (!selectedAdapter) return;
    const newMappings = selectedAdapter.mappings.filter((_, i) => i !== index);
    handleUpdate({ mappings: newMappings });
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-muted/10 shrink-0">
        <div className="p-4 border-b border-border flex justify-between items-center bg-card">
          <h3 className="font-semibold flex items-center gap-2">
            <Plug className="w-4 h-4" /> Adapters
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCreateNew}>
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">New Adapter</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {adapters.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedId === a.id ? 'bg-primary/10 text-primary font-medium border border-primary/20' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground border border-transparent'}`}
              >
                {a.name}
              </button>
            ))}
            {adapters.length === 0 && (
              <div className="text-center p-4 text-xs text-muted-foreground">
                No adapters defined.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Detail Workspace */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">
        {selectedAdapter ? (
          <>
            <div className="p-6 border-b border-border space-y-4 shrink-0 bg-card/50">
              <div className="flex items-center justify-between">
                <Input 
                  value={selectedAdapter.name} 
                  onChange={(e) => handleUpdate({ name: e.target.value })}
                  className="text-2xl font-bold border-none shadow-none h-auto px-1 py-1 focus-visible:ring-1 max-w-sm bg-transparent"
                />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => toast.success('Adapter Saved', { description: 'All changes are automatically persisted to local storage.' })}>
                    <Save className="w-4 h-4 mr-2" /> Save Adapter
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => { removeAdapter(selectedId!); setSelectedId(null); }}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Adapter
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-[auto_1fr] items-center gap-4 text-sm max-w-2xl bg-card p-4 rounded-lg border border-border mt-2 shadow-sm">
                <div className="text-muted-foreground font-medium">Source Schema</div>
                <Select value={selectedAdapter.sourceId} onValueChange={(val) => handleUpdate({ sourceId: val })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Source Schema..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Underlying Data</SelectItem>
                    {schemaList.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="text-muted-foreground font-medium">Target Context</div>
                <div className="flex items-center gap-2">
                  {isTargetUnlocked ? (
                    <Select value={selectedAdapter.targetId} onValueChange={(val) => handleUpdate({ targetId: val })}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Target Schema..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mage-hand-entity">Mage-Hand Native Entity</SelectItem>
                        {schemaList.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                      {selectedAdapter.targetId === 'mage-hand-entity' 
                        ? 'Mage-Hand Native Entity' 
                        : schemas[selectedAdapter.targetId]?.label || 'Unknown Schema'}
                    </Badge>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0" onClick={() => setIsTargetUnlocked(!isTargetUnlocked)}>
                          {isTargetUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {isTargetUnlocked ? 'Lock Target Context' : 'Unlock Target Context'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-6">
              <div className="max-w-4xl mx-auto space-y-6 pb-20">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Path Mappings</h4>
                  <Button variant="outline" size="sm" onClick={handleAddRawMount} className="bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20 hover:text-orange-700">
                    <Plug className="w-4 h-4 mr-2" /> Quick Mount Raw JSON Root
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 items-center px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    <div>Source Data Path (e.g. system.hp)</div>
                    <div className="w-8"></div>
                    <div>Evaluator Mount Point (e.g. hp.max)</div>
                    <div className="w-8"></div>
                  </div>
                  
                  {selectedAdapter.mappings.map((mapping, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 items-center bg-card border border-border rounded-md p-3 hover:border-primary/50 transition-colors group shadow-sm">
                      <PathSuggestInput 
                        placeholder="e.g. system.attributes.hp" 
                        value={mapping.sourcePath}
                        onChange={(val) => updateMapping(idx, 'sourcePath', val)}
                        options={suggestPaths}
                        className="font-mono text-sm focus-visible:ring-primary/50 w-full"
                      />
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <PathSuggestInput 
                        placeholder="e.g. hp.max" 
                        value={mapping.mountPoint}
                        onChange={(val) => updateMapping(idx, 'mountPoint', val)}
                        options={targetPaths}
                        className="font-mono text-sm focus-visible:ring-primary/50 w-full"
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-50 group-hover:opacity-100 transition-all" onClick={() => deleteMapping(idx)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Delete Mapping Row</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                  
                  {selectedAdapter.mappings.length === 0 && (
                    <div className="text-center py-12 text-sm text-muted-foreground border-2 border-dashed border-border rounded-md bg-muted/20">
                      <Plug className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      No path mappings defined.
                      <p className="mt-1 text-xs opacity-70">Add a mapping to route external data into the Rules Pipeline.</p>
                    </div>
                  )}
                </div>

                <Button variant="secondary" className="w-full mt-6 shadow-sm border border-border/50" onClick={handleAddMapping}>
                  <Plus className="w-4 h-4 mr-2" /> Add Mapping Row
                </Button>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center flex-col text-center p-8">
            <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
              <Plug className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-2xl font-semibold mb-3 tracking-tight">Select an Adapter</h3>
            <p className="text-base text-muted-foreground max-w-md leading-relaxed">
              Choose an adapter from the sidebar to edit its mapping rules, or create a new one to bridge external schemas into the context evaluation engine.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
