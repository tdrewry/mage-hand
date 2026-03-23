import React, { useState, useRef, useEffect } from 'react';
import { Suspense, lazy } from 'react';
import { GenericFlowCanvas } from '@/lib/campaign-editor/components/GenericFlowCanvas';
import { RuleNode } from '@/lib/rules-engine/types';
import { FlowNodePosition } from '@/lib/campaign-editor/types/base';
import { AlertCircle, Plus, Trash2, ArrowLeft, Save, Flag, Calculator, Play, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRuleStore } from '@/stores/ruleStore';
import { compilePipeline, executePipeline, extractVariables, buildSkeletonFromVariables } from '@/lib/rules-engine/compiler';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useMonaco } from '@monaco-editor/react';
import { useGlobalConfigStore } from '@/stores/globalConfigStore';
import { PipelineTester } from './PipelineTester';
import { getV3SchemaPaths } from '@/lib/rules-engine/schema-paths';
import { RuleInspector } from './RuleInspector';
import { DataDictionaryTab } from './DataDictionaryTab';



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
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(false);

  const [mockStateJson, setMockStateJson] = useState('{\n  \n}');
  const [outputState, setOutputState] = useState<any>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [isDictionaryMode, setIsDictionaryMode] = useState(false);

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

  const handleExportClick = () => {
    const exportData = {
      mageHandExportVersion: 1,
      type: "logic-pipeline",
      pipeline: {
        name: pipelineTitle || 'Untitled Pipeline',
        description: '', // Graph doesn't currently keep a local description state at top level component
        nodes,
        positions,
        entryNodeId: entryNodeId || undefined,
        mockStateJson
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(pipelineTitle || 'pipeline').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Pipeline exported successfully");
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleBackClick}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Save & Go Back</TooltipContent>
        </Tooltip>
        <div className="flex-1 px-2 min-w-0">
          <input 
            value={pipelineTitle}
            onChange={(e) => setPipelineTitle(e.target.value)}
            className="text-sm font-medium w-full bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground/50 truncate"
            placeholder="Pipeline Name..."
          />
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={addNode} 
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Rule
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Add Rule Node</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={addFunctionNode} 
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
              >
                <Calculator className="w-3.5 h-3.5 mr-1" /> Add Function
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Add Function Node</TooltipContent>
          </Tooltip>

          {selectedNodeId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={handleDeleteNode}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Delete selected rule</TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-4 bg-border mx-1" />
          
          <div className="flex bg-muted/80 rounded border border-border/50 p-0.5 shadow-inner">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`flex items-center px-4 py-[3px] text-[11px] font-medium tracking-wide rounded transition-all duration-200 ${!isTestMode && !isDictionaryMode ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  onClick={() => { setIsTestMode(false); setIsDictionaryMode(false); }}
                >
                  Edit
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Edit Pipeline</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`flex items-center px-4 py-[3px] text-[11px] font-medium tracking-wide rounded transition-all duration-200 ${isDictionaryMode ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  onClick={() => { setIsTestMode(false); setIsDictionaryMode(true); }}
                >
                  Dictionary
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Data Dictionary</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
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
                      setIsDictionaryMode(false);
                      setIsTestMode(true);
                    }
                  }}
                >
                  Test
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Test Pipeline</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleExportClick}
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Export
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Export Pipeline to JSON</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="default"
                size="sm"
                className="h-7 px-2 text-xs font-semibold"
                onClick={handleSaveClick}
              >
                <Save className="w-3.5 h-3.5 mr-1" /> Save
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Save Pipeline</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {isTestMode && !isDictionaryMode && (
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

        {isDictionaryMode && (
          <div className="flex-1 min-w-0 w-full">
            <DataDictionaryTab />
          </div>
        )}
        
        <div className={`flex flex-1 min-h-0 relative ${isTestMode || isDictionaryMode ? 'hidden' : ''}`}>
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
          <RuleInspector 
            selectedNode={selectedNode}
            setNodes={setNodes}
            entryNodeId={entryNodeId}
            setEntryNodeId={setEntryNodeId}
            isInspectorExpanded={isInspectorExpanded}
            setIsInspectorExpanded={setIsInspectorExpanded}
          />
        )}
      </div>
    </div>
    </div>
  );
}
