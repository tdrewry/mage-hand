import React, { useState, useRef, useEffect } from 'react';
import { Suspense, lazy } from 'react';
import { GenericFlowCanvas } from '@/lib/campaign-editor/components/GenericFlowCanvas';
import { RuleNode } from '@/lib/rules-engine/types';
import { FlowNodePosition } from '@/lib/campaign-editor/types/base';
import { AlertCircle, Plus, Trash2, ArrowLeft, Save, Flag, Calculator, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRuleStore } from '@/stores/ruleStore';
import { compilePipeline, executePipeline, extractVariables, buildSkeletonFromVariables } from '@/lib/rules-engine/compiler';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useMonaco } from '@monaco-editor/react';
import { useGlobalConfigStore } from '@/stores/globalConfigStore';

function PipelineTester({ 
  nodes, 
  entryNodeId, 
  mockStateJson, 
  setMockStateJson, 
  outputState, 
  setOutputState, 
  setIsTestMode 
}: any) {
  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col pt-4">
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-6 px-6 pb-6 overflow-hidden">
        {/* Column 1: Execution Order */}
        <div className="flex flex-col min-h-0 bg-card border border-border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3 shrink-0">Execution Order</h3>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2">
            <Accordion type="multiple" className="w-full text-xs border border-border rounded bg-background/50 overflow-hidden">
              {compilePipeline(nodes, entryNodeId || undefined).map((n: any, idx: number) => {
                const reads = extractVariables(n.nodeData.jsonLogic || {});
                const writes = n.nodeData.outputTarget;
                return (
                  <AccordionItem key={n.id} value={n.id} className="border-b last:border-b-0 border-border">
                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50 transition-none border-none">
                      <div className="flex items-center gap-2 text-left w-full pr-2">
                        <span className="text-muted-foreground w-4">{idx + 1}.</span>
                        <span className="font-medium truncate flex-1">{n.nodeData.name || n.id}</span>
                        <span className="text-[10px] opacity-70 shrink-0 capitalize">{n.nodeType.replace('_', ' ')}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 pt-0 flex flex-col gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase">Reads</span>
                        <div className="flex flex-wrap gap-1">
                          {reads.length > 0 ? reads.map((r: string) => (
                            <span key={r} className="px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-mono">{r}</span>
                          )) : <span className="text-[10px] text-muted-foreground italic">None</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase">Writes To</span>
                        <div>
                          {writes ? (
                            <span className="px-1.5 py-0.5 rounded-sm bg-orange-500/10 text-orange-500 dark:text-orange-400 text-[10px] font-mono">{writes}</span>
                          ) : <span className="text-[10px] text-muted-foreground italic">None</span>}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
              {nodes.length === 0 && <div className="p-3 text-muted-foreground text-center text-xs">No nodes in pipeline.</div>}
            </Accordion>
          </div>
          <div className="pt-4 mt-auto shrink-0 border-t border-border mt-4">
            <Button 
              size="lg"
              className="w-full font-bold shadow-md h-12"
              onClick={() => {
                try {
                  const parsed = JSON.parse(mockStateJson);
                  const compiled = compilePipeline(nodes, entryNodeId || undefined);
                  const result = executePipeline(compiled, parsed);
                  setOutputState(result);
                  toast.success("Pipeline executed successfully!");
                } catch (e: any) {
                  setOutputState({ error: e.message });
                  toast.error("Execution failed: " + e.message);
                }
              }}
            >
              <Play className="w-4 h-4 mr-2 fill-current" /> RUN PIPELINE
            </Button>
          </div>
        </div>

        {/* Column 2: Mock State Input */}
        <div className="flex flex-col min-h-0 bg-card border border-border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3 shrink-0">Mock State (Input)</h3>
          <div className="flex-1 min-h-0 border border-border rounded-md overflow-hidden">
            <Suspense fallback={<div className="p-4 text-xs text-muted-foreground text-center flex items-center justify-center h-full">Loading Editor...</div>}>
              <MonacoEditor
                height="100%"
                language="json"
                value={mockStateJson}
                onChange={(val) => setMockStateJson(val || '')}
                theme="vs-dark"
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', formatOnPaste: false, formatOnType: false, padding: { top: 16 } }}
              />
            </Suspense>
          </div>
        </div>

        {/* Column 3: Output State */}
        <div className="flex flex-col min-h-0 bg-card border border-border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3 shrink-0">Output Result</h3>
          <div className="flex-1 min-h-0 bg-black/40 border border-border rounded-md overflow-y-auto p-4">
            {outputState ? (
              <pre className={`text-sm font-mono whitespace-pre-wrap ${outputState?.error ? 'text-destructive' : 'text-green-400'}`}>
                {JSON.stringify(outputState, null, 2)}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
                Run the pipeline to inspect outputs here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

const mockAdapter = { labels: { node: 'Rule' } } as any;

interface RuleGraphEditorProps {
  onBack: () => void;
  title?: string;
  pipelineId?: string;
}

export function RuleGraphEditor({ onBack, title = "Untitled Pipeline", pipelineId }: RuleGraphEditorProps) {
  const pipelines = useRuleStore(s => s.pipelines);
  const addPipeline = useRuleStore(s => s.addPipeline);
  const updatePipeline = useRuleStore(s => s.updatePipeline);
  const categories = useGlobalConfigStore(s => s.categories);
  const monaco = useMonaco();

  const [nodes, setNodes] = useState<RuleNode[]>([]);
  const [positions, setPositions] = useState<Record<string, FlowNodePosition>>({});
  const [pipelineTitle, setPipelineTitle] = useState(title);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(pipelineId || null);
  const [entryNodeId, setEntryNodeId] = useState<string | null>(null);

  const [mockStateJson, setMockStateJson] = useState('{\n  \n}');
  const [outputState, setOutputState] = useState<any>(null);
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    if (!monaco) return;

    const damageTypes = categories['damageTypes']?.items || [];
    const conditions = categories['conditions']?.items || [];
    const abilities = categories['abilities']?.items || [];

    const allEnumsSet = new Set<string>();
    [...damageTypes, ...conditions, ...abilities].forEach(item => {
      if (item.value) allEnumsSet.add(item.value);
      if (item.aliases) item.aliases.forEach(a => allEnumsSet.add(a));
    });
    const allEnums = Array.from(allEnumsSet);

    const monacoLangs = monaco.languages as any;
    if (monacoLangs.json) {
      monacoLangs.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [{
          uri: "inmemory://rule-schema.json",
          fileMatch: ["inmemory://rule-schema.json"],
          schema: {
            type: ["object", "array", "string", "number", "boolean", "null"],
            anyOf: [
              { type: "string", enum: allEnums },
              { type: "object", additionalProperties: { $ref: "#" } },
              { type: "array", items: { $ref: "#" } }
            ]
          }
        }]
      });
    }
  }, [monaco, categories]);

  useEffect(() => {
    if (pipelineId && !hasLoaded) {
      const existing = pipelines.find(p => p.id === pipelineId);
      if (existing) {
        setNodes(existing.nodes);
        setPositions(existing.positions);
        if (existing.name) setPipelineTitle(existing.name);
        if (existing.entryNodeId) setEntryNodeId(existing.entryNodeId);
        if (existing.mockStateJson) setMockStateJson(existing.mockStateJson);
      }
      setHasLoaded(true);
    } else if (!pipelineId && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [pipelineId, pipelines, hasLoaded]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Inspector state
  const [jsonValue, setJsonValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const jsonUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const node = nodes.find(n => n.id === selectedNodeId);
    if (node) {
      setJsonValue(JSON.stringify(node.nodeData.jsonLogic || {}, null, 2));
      setJsonError(null);
    } else {
      setJsonValue('');
      setJsonError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  const handleJsonChange = (val: string | undefined) => {
    const newVal = val ?? '';
    setJsonValue(newVal);
    
    if (jsonUpdateTimer.current) clearTimeout(jsonUpdateTimer.current);
    
    jsonUpdateTimer.current = setTimeout(() => {
      try {
        if (!newVal.trim()) return;
        const parsed = JSON.parse(newVal);
        setJsonError(null);
        
        if (selectedNodeId) {
          setNodes(curr => curr.map(n => 
            n.id === selectedNodeId 
              ? { ...n, nodeData: { ...n.nodeData, jsonLogic: parsed } } 
              : n
          ));
        }
      } catch (e: any) {
        setJsonError(e.message);
      }
    }, 500);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    if (selectedNodeId) {
      setNodes(curr => curr.map(n => 
        n.id === selectedNodeId 
          ? { ...n, nodeData: { ...n.nodeData, name: newName } } 
          : n
      ));
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDesc = e.target.value;
    if (selectedNodeId) {
      setNodes(curr => curr.map(n => 
        n.id === selectedNodeId 
          ? { ...n, nodeData: { ...n.nodeData, description: newDesc } } 
          : n
      ));
    }
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    
    // Sever edges and remove node
    setNodes(curr => curr.filter(n => n.id !== selectedNodeId).map(n => ({
      ...n,
      nextOnSuccess: n.nextOnSuccess.filter(id => id !== selectedNodeId),
      nextOnFailure: n.nextOnFailure === selectedNodeId ? 'end' : n.nextOnFailure
    })));
    
    setSelectedNodeId(null);
  };

  const handleNodeMove = (nodeId: string, pos: FlowNodePosition) => {
    setPositions(prev => ({ ...prev, [nodeId]: pos }));
  };

  const handleSave = () => {
    const targetId = activePipelineId || `logic-${Date.now()}`;
    const payload = {
      id: targetId,
      name: pipelineTitle || 'Untitled Pipeline',
      description: '',
      nodes,
      positions,
      entryNodeId: entryNodeId || undefined,
      mockStateJson,
      updatedAt: new Date().toISOString()
    };
    if (activePipelineId) {
      updatePipeline(payload.id, payload);
    } else {
      addPipeline(payload);
      setActivePipelineId(targetId);
    }
  };

  const handleBackClick = () => {
    handleSave();
    onBack();
  };

  const handleSaveClick = () => {
    handleSave();
    toast.success("Pipeline saved!");
  };

  const addConnection = (src: string, tgt: string, type: 'success' | 'failure') => {
    setNodes(curr => curr.map(n => {
      if (n.id === src) {
        if (type === 'success') {
          return { ...n, nextOnSuccess: [...new Set([...n.nextOnSuccess, tgt])] };
        } else {
          return { ...n, nextOnFailure: tgt };
        }
      }
      return n;
    }));
  };

  const removeConnection = (src: string, tgt: string, type: 'success' | 'failure') => {
    setNodes(curr => curr.map(n => {
      if (n.id === src) {
        if (type === 'success') {
          return { ...n, nextOnSuccess: n.nextOnSuccess.filter(id => id !== tgt) };
        } else {
          return { ...n, nextOnFailure: n.nextOnFailure === tgt ? 'end' : n.nextOnFailure };
        }
      }
      return n;
    }));
  };

  const addNode = () => {
    const id = `rule-${Date.now()}`;
    const newNode: RuleNode = {
      id,
      nodeType: 'rule',
      nodeData: { 
        name: `Rule ${nodes.length + 1}`, 
        jsonLogic: { "==": [1, 1] }, 
        gridWidth: 1, 
        gridHeight: 1, 
        terrain: [], 
        deploymentZone: { minX: 0, minY: 0, maxX: 1, maxY: 1 }, 
        objectives: [] 
      },
      nextOnSuccess: [],
      nextOnFailure: 'end',
      prerequisites: [],
      customData: {}
    };
    setNodes(prev => [...prev, newNode]);
    
    // Place roughly in center or offset
    const count = nodes.length;
    setPositions(prev => ({ ...prev, [id]: { x: 100 + count * 50, y: 100 + count * 50 } }));
    setSelectedNodeId(id);
  };

  const addFunctionNode = () => {
    const id = `func-${Date.now()}`;
    const newNode: RuleNode = {
      id,
      nodeType: 'function_node',
      nodeData: { 
        name: `Math Op ${nodes.length + 1}`, 
        jsonLogic: { "floor": [{"var": ""}] }, 
        gridWidth: 1, 
        gridHeight: 1, 
        terrain: [], 
        deploymentZone: { minX: 0, minY: 0, maxX: 1, maxY: 1 }, 
        objectives: [] 
      },
      nextOnSuccess: [],
      nextOnFailure: 'end',
      prerequisites: [],
      customData: {}
    };
    setNodes(prev => [...prev, newNode]);
    
    // Place roughly in center or offset
    const count = nodes.length;
    setPositions(prev => ({ ...prev, [id]: { x: 100 + count * 50, y: 100 + count * 50 } }));
    setSelectedNodeId(id);
  };

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border shrink-0 bg-background/50">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleBackClick} title="Save & Go Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 px-2 min-w-0">
          <input 
            value={pipelineTitle}
            onChange={(e) => setPipelineTitle(e.target.value)}
            className="text-sm font-medium w-full bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground/50 truncate"
            placeholder="Pipeline Name..."
          />
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          <Button 
            onClick={addNode} 
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            title="Add Rule Node"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Rule
          </Button>

          <Button 
            onClick={addFunctionNode} 
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
            title="Add Function Node"
          >
            <Calculator className="w-3.5 h-3.5 mr-1" /> Add Function
          </Button>

          {selectedNodeId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive"
              onClick={handleDeleteNode}
              title="Delete selected rule"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          <div className="w-px h-4 bg-border mx-1" />
          
          <div className="flex bg-muted/80 rounded border border-border/50 p-0.5 shadow-inner">
            <button
              title="Edit Pipeline"
              className={`flex items-center px-4 py-[3px] text-[11px] font-medium tracking-wide rounded transition-all duration-200 ${!isTestMode ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              onClick={() => setIsTestMode(false)}
            >
              Edit
            </button>
            <button
              title="Test Pipeline"
              className={`flex items-center px-4 py-[3px] text-[11px] font-medium tracking-wide rounded transition-all duration-200 ${isTestMode ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              onClick={() => {
                if (!isTestMode) {
                  if (mockStateJson.trim() === '{}' || mockStateJson.trim() === '{\n  \n}') {
                    const compiled = compilePipeline(nodes, entryNodeId || undefined);
                    const allVars = new Set<string>();
                    compiled.forEach(n => {
                      extractVariables(n.nodeData.jsonLogic || {}).forEach(v => allVars.add(v));
                    });
                    const skeleton = buildSkeletonFromVariables(Array.from(allVars));
                    setMockStateJson(JSON.stringify(skeleton, null, 2));
                  }
                  setIsTestMode(true);
                }
              }}
            >
              Test
            </button>
          </div>

          <Button 
            variant="default"
            size="sm"
            className="h-7 px-2 text-xs font-semibold"
            onClick={handleSaveClick}
            title="Save Pipeline"
          >
            <Save className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {isTestMode && (
          <PipelineTester 
            nodes={nodes}
            entryNodeId={entryNodeId}
            mockStateJson={mockStateJson}
            setMockStateJson={setMockStateJson}
            outputState={outputState}
            setOutputState={setOutputState}
            setIsTestMode={setIsTestMode}
          />
        )}
        
        <div className={`flex flex-1 min-h-0 relative ${isTestMode ? 'hidden' : ''}`}>
          {/* Canvas Area */}
          <div className="flex-1 relative">
          <GenericFlowCanvas
            nodes={nodes}
            positions={positions}
            selectedNodeId={selectedNodeId}
            startNodeId={entryNodeId || nodes[0]?.id || ''}
            adapter={mockAdapter}
            onNodeSelect={setSelectedNodeId}
            onNodeMove={handleNodeMove}
            onConnectionCreate={addConnection}
            onConnectionDelete={removeConnection}
          />
        </div>

        {/* Right Sidebar */}
        {selectedNode && (
          <div className="w-[350px] border-l border-border flex flex-col shrink-0 bg-card overflow-y-auto">
             <div className="p-4 border-b border-border shrink-0 flex flex-col gap-4">
               <div className="flex items-center justify-between">
                 <h3 className="font-semibold text-sm">Rule Inspector</h3>
                 <Button 
                   variant={entryNodeId === selectedNode.id ? "default" : "outline"} 
                   size="sm" 
                   className={`h-7 text-xs px-2 ${entryNodeId === selectedNode.id ? "bg-primary text-primary-foreground" : ""}`}
                   onClick={() => setEntryNodeId(selectedNode.id)}
                 >
                   <Flag className="w-3 h-3 mr-1" />
                   {entryNodeId === selectedNode.id ? "Start Node" : "Set Start"}
                 </Button>
               </div>
               
               <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Node Label</label>
                 <input 
                   type="text" 
                   value={selectedNode.nodeData.name} 
                   onChange={handleNameChange}
                   className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                   placeholder="e.g. Check Fire Resistance"
                 />
               </div>

               <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Developer Notes</label>
                 <textarea 
                   value={selectedNode.nodeData.description || ''} 
                   onChange={handleDescriptionChange}
                   className="flex min-h-[60px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                   placeholder="Why does this rule exist? What does it check?"
                 />
               </div>

               <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output Target (Optional)</label>
                 <input 
                   type="text" 
                   value={selectedNode.nodeData.outputTarget || ''} 
                   onChange={(e) => {
                     const newTarget = e.target.value;
                     if (selectedNodeId) {
                       setNodes(curr => curr.map(n => 
                         n.id === selectedNodeId 
                           ? { ...n, nodeData: { ...n.nodeData, outputTarget: newTarget } } 
                           : n
                       ));
                     }
                   }}
                   className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                   placeholder="e.g. damage.amount"
                 />
               </div>
             </div>
             
             {jsonError && (
              <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive shrink-0">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="font-mono break-all">{jsonError}</span>
              </div>
            )}

             <div className="flex-1 min-h-0 mt-2 border-t border-border flex flex-col">
               {selectedNode.nodeType === 'function_node' ? (
                 (() => {
                   const logicMap = selectedNode.nodeData.jsonLogic || {};
                   const ops = ['floor', 'ceil', 'round', 'abs', 'roll'];
                   const currentOp = Object.keys(logicMap).find(k => ops.includes(k)) || 'floor';
                   let currentTarget = '';
                   const args = logicMap[currentOp];
                   if (Array.isArray(args) && args[0] && args[0].var) {
                     currentTarget = args[0].var;
                   }

                   const handleFunctionChange = (op: string, target: string) => {
                     const payload = { [op]: [{ "var": target }] };
                     setNodes(curr => curr.map(n => 
                       n.id === selectedNode.id 
                         ? { ...n, nodeData: { ...n.nodeData, jsonLogic: payload } } 
                         : n
                     ));
                     setJsonValue(JSON.stringify(payload, null, 2));
                   };

                   return (
                     <div className="p-4 flex flex-col gap-4">
                       <div className="flex flex-col gap-1.5">
                         <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operation</label>
                         <select 
                           value={currentOp}
                           onChange={(e) => handleFunctionChange(e.target.value, currentTarget)}
                           className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                         >
                           {ops.map(op => <option key={op} value={op}>{op.toUpperCase()}</option>)}
                         </select>
                       </div>
                       <div className="flex flex-col gap-1.5">
                         <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target Variable</label>
                         <input 
                           type="text" 
                           value={currentTarget}
                           onChange={(e) => handleFunctionChange(currentOp, e.target.value)}
                           className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                           placeholder="e.g. damage.amount"
                         />
                       </div>
                       <div className="text-xs text-muted-foreground mt-4 p-3 rounded-md border border-border bg-black/20 font-mono break-all">
                         <span className="text-purple-400">Payload Preview:</span><br/>
                         {JSON.stringify({ [currentOp]: [{ "var": currentTarget }] }, null, 2)}
                       </div>
                     </div>
                   );
                 })()
               ) : (
                 <Suspense fallback={<div className="p-4 text-xs text-muted-foreground text-center">Loading Monaco Editor...</div>}>
                   <MonacoEditor
                      height="100%"
                      language="json"
                      path="inmemory://rule-schema.json"
                      value={jsonValue}
                      onChange={handleJsonChange}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        wordWrap: 'on',
                        formatOnPaste: false,
                        formatOnType: false,
                        scrollBeyondLastLine: false,
                        padding: { top: 16 }
                      }}
                   />
                 </Suspense>
               )}
              </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
