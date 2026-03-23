import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { RuleNode } from '@/lib/rules-engine/types';
import { AlertCircle, Flag, ChevronLeft, ChevronRight, Calculator, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getV3SchemaPaths } from '@/lib/rules-engine/schema-paths';
import { toast } from 'sonner';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// ---------- OUTPUT TARGET INPUT ----------

const OutputTargetInput = ({
  value,
  onChange
}: {
  value: string;
  onChange: (val: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPaths = getV3SchemaPaths().filter(p => p.toLowerCase().includes((value || '').toLowerCase()));

  const handleSelect = (path: string) => {
    onChange(path);
    setIsOpen(false);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const typeIndex = path.indexOf('<type>');
        if (typeIndex !== -1) {
          inputRef.current.setSelectionRange(typeIndex, typeIndex + 6);
        }
      }
    }, 0);
  };

  return (
    <div className="relative flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output Target (Optional)</label>
      <input 
        ref={inputRef}
        type="text" 
        value={value} 
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="e.g. damage.amount"
        autoComplete="off"
      />
      {isOpen && filteredPaths.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md p-1 top-[calc(100%+4px)] left-0">
          {filteredPaths.map((path) => (
            <li 
              key={path}
              onMouseDown={(e) => {
                 e.preventDefault();
                 handleSelect(path);
              }}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              {path}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
        Select a contract path (e.g., targetResult.damage.fire.amount) or type a temporary variable.
      </p>
    </div>
  );
};

// ---------- FUNCTION NODE INSPECTOR ----------

const FunctionNodeInspector = ({ 
  node, 
  setNodes,
  setJsonValue
}: { 
  node: RuleNode; 
  setNodes: React.Dispatch<React.SetStateAction<RuleNode[]>>;
  setJsonValue: (val: string) => void;
}) => {
  const logicMap = node.nodeData.jsonLogic || {};
  const ops = ['floor', 'ceil', 'round', 'abs', 'roll', 'custom'];
  const knownOps = ['floor', 'ceil', 'round', 'abs', 'roll'];
  const mathOps = ['floor', 'ceil', 'round', 'abs'];
  
  const logicKeys = Object.keys(logicMap);
  let currentOp = 'custom';
  let initialCustomName = 'my_custom_name';
  
  const foundKnownOp = logicKeys.find(k => knownOps.includes(k));
  if (foundKnownOp) {
      currentOp = foundKnownOp;
  } else if (logicKeys.length > 0) {
      currentOp = 'custom';
      initialCustomName = logicKeys[0];
  } else if (logicKeys.length === 0) {
      currentOp = 'floor';
  }

  let currentTarget = '';
  if (mathOps.includes(currentOp)) {
    const args = logicMap[currentOp];
    if (Array.isArray(args) && args[0] && args[0].var) {
      currentTarget = args[0].var;
    }
  }

  const getInitialJsonState = () => {
    if (currentOp === 'roll') {
      return JSON.stringify(logicMap['roll'] || [], null, 2);
    } else if (currentOp === 'custom') {
      return JSON.stringify(logicMap[initialCustomName] || [], null, 2);
    }
    return '';
  };
  
  const [localJsonValue, setLocalJsonValue] = useState(getInitialJsonState());
  const [localJsonError, setLocalJsonError] = useState<string | null>(null);
  const [customName, setCustomName] = useState(initialCustomName);

  useEffect(() => {
    const localKeys = Object.keys(logicMap);
    const localKnown = localKeys.find(k => knownOps.includes(k));
    if (!localKnown && localKeys.length > 0) {
       setCustomName(localKeys[0]);
    } else if (localKeys.length === 0) {
       setCustomName('my_custom_name');
    }
    
    setLocalJsonValue(getInitialJsonState());
    setLocalJsonError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, currentOp, JSON.stringify(logicMap)]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFunctionChange = (newOp: string, newTarget: string, newCustomName: string = customName) => {
    let payload: any = {};
    if (mathOps.includes(newOp)) {
      payload = { [newOp]: [{ "var": newTarget }] };
    } else if (newOp === 'roll') {
      let args = [];
      try { args = JSON.parse(localJsonValue || '[]'); } catch(e) {}
      payload = { "roll": args };
    } else if (newOp === 'custom') {
      let args = [];
      try { args = JSON.parse(localJsonValue || '[]'); } catch(e) {}
      payload = { [newCustomName]: args };
    }
    
    setNodes(curr => curr.map(n => 
      n.id === node.id 
        ? { ...n, nodeData: { ...n.nodeData, jsonLogic: payload } } 
        : n
    ));
    setJsonValue(JSON.stringify(payload, null, 2));
  };
  
  const handleCustomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const newName = e.target.value;
     setCustomName(newName);
     if (currentOp === 'custom') {
        let args = [];
        try { args = JSON.parse(localJsonValue || '[]'); } catch(e) {}
        const payload = { [newName]: args };
        setNodes(curr => curr.map(n => 
          n.id === node.id 
            ? { ...n, nodeData: { ...n.nodeData, jsonLogic: payload } } 
            : n
        ));
        setJsonValue(JSON.stringify(payload, null, 2));
     }
  };

  const handleLocalJsonChange = (val: string | undefined) => {
    const newVal = val ?? '';
    setLocalJsonValue(newVal);
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    debounceTimer.current = setTimeout(() => {
      try {
        if (!newVal.trim()) {
           setLocalJsonError(null);
           return; 
        }
        const parsed = JSON.parse(newVal);
        setLocalJsonError(null);
        
        let payload: any = parsed;
        if (currentOp === 'roll') {
          payload = { "roll": parsed };
        } else if (currentOp === 'custom') {
          payload = { [customName]: parsed };
        }
        
        setNodes(curr => curr.map(n => 
          n.id === node.id 
            ? { ...n, nodeData: { ...n.nodeData, jsonLogic: payload } } 
            : n
        ));
      } catch (e: any) {
        setLocalJsonError(e.message);
      }
    }, 500);
  };

  const renderPreview = () => {
     if (mathOps.includes(currentOp)) {
        return JSON.stringify({ [currentOp]: [{ "var": currentTarget }] }, null, 2);
     }
     try {
        const parsed = JSON.parse(localJsonValue || '[]');
        if (currentOp === 'roll') {
           return JSON.stringify({ "roll": parsed }, null, 2);
        } else if (currentOp === 'custom') {
           return JSON.stringify({ [customName]: parsed }, null, 2);
        }
        return JSON.stringify(parsed, null, 2);
     } catch (e) {
        return "Invalid JSON";
     }
  };

  return (
    <div className="p-4 flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex flex-col gap-1.5 shrink-0">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operation</label>
        <select 
          value={currentOp}
          onChange={(e) => handleFunctionChange(e.target.value, currentTarget)}
          className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {ops.map(op => <option key={op} value={op}>{op.toUpperCase()}</option>)}
        </select>
      </div>
      
      {mathOps.includes(currentOp) ? (
        <div className="flex flex-col gap-1.5 shrink-0">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target Variable</label>
          <input 
            type="text" 
            value={currentTarget}
            onChange={(e) => handleFunctionChange(currentOp, e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="e.g. damage.amount"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4 flex-1 min-h-[200px]">
          {currentOp === 'custom' && (
            <div className="flex flex-col gap-1.5 shrink-0">
               <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Name</label>
               <input 
                 type="text" 
                 value={customName}
                 onChange={handleCustomNameChange}
                 className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                 placeholder="e.g. my_custom_name"
               />
            </div>
          )}
        
          <div className="flex flex-col gap-1.5 flex-1 min-h-[150px]">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {currentOp === 'roll' ? 'ROLL ARGUMENTS (JSON)' : 'ARGUMENTS (JSON)'}
            </label>
            {localJsonError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="font-mono break-all">{localJsonError}</span>
              </div>
            )}
            <div className="flex-1 min-h-[100px] border border-input rounded-md overflow-hidden">
              <Suspense fallback={<div className="p-4 text-xs text-muted-foreground text-center">Loading Monaco Editor...</div>}>
                <MonacoEditor
                   height="100%"
                   language="json"
                   path={currentOp === 'roll' ? "inmemory://rule-schema-roll.json" : "inmemory://rule-schema-custom.json"}
                   value={localJsonValue}
                   onChange={handleLocalJsonChange}
                   theme="vs-dark"
                   options={{
                     minimap: { enabled: false },
                     fontSize: 12,
                     wordWrap: 'on',
                     formatOnPaste: false,
                     formatOnType: false,
                     scrollBeyondLastLine: false,
                     padding: { top: 8 }
                   }}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground p-3 rounded-md border border-border bg-black/20 font-mono break-all shrink-0">
        <span className="text-purple-400">Payload Preview:</span><br/>
        {renderPreview()}
      </div>
    </div>
  );
};

// ---------- VISUAL MODE RENDERER ----------

const MathOps = ['+', '-', '*', '/'];
const CompOps = ['==', '!=', '<', '>', '<=', '>='];
const DiceOps = ['roll'];

type VisualCategory = 'Math' | 'Comparison' | 'Dice Roll';

function parseLogicForVisualMode(logic: any) {
  if (!logic || typeof logic !== 'object' || Array.isArray(logic)) return { valid: false };
  const keys = Object.keys(logic);
  if (keys.length !== 1) return { valid: false };
  
  const op = keys[0];
  const args = logic[op];
  if (!Array.isArray(args)) return { valid: false };

  // Validate no deep nesting for simple builder (except "var": string)
  const isArgSimple = (arg: any) => {
    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean' || arg === null) return true;
    if (typeof arg === 'object' && !Array.isArray(arg)) {
      const ak = Object.keys(arg);
      if (ak.length === 1 && ak[0] === 'var' && typeof arg['var'] === 'string') return true;
    }
    return false;
  };

  if (!args.every(isArgSimple)) return { valid: false };

  if (MathOps.includes(op)) return { valid: true, category: 'Math' as VisualCategory, op, args };
  if (CompOps.includes(op)) return { valid: true, category: 'Comparison' as VisualCategory, op, args };
  if (DiceOps.includes(op)) return { valid: true, category: 'Dice Roll' as VisualCategory, op: 'roll', args };
  
  return { valid: false };
}

interface VisualArg {
  isVar: boolean;
  value: string | number;
}

const VisualModeRenderer = ({
  node,
  setNodes,
  setJsonValue
}: {
  node: RuleNode;
  setNodes: React.Dispatch<React.SetStateAction<RuleNode[]>>;
  setJsonValue: (val: string) => void;
}) => {
  const parsed = parseLogicForVisualMode(node.nodeData.jsonLogic);
  
  // Default state if empty or invalid but forced into visual mode (we clear logic when switching to visual for new nodes anyway, handled by parent)
  const category: VisualCategory = parsed.valid ? parsed.category : 'Comparison';
  const op = parsed.valid ? parsed.op : '==';
  
  const initialArgs = parsed.valid ? parsed.args.map((a: any) => {
    if (a && typeof a === 'object' && a.var !== undefined) {
      return { isVar: true, value: a.var };
    }
    return { isVar: false, value: a };
  }) : [{ isVar: true, value: '' }, { isVar: false, value: '' }];

  const [currentCategory, setCurrentCategory] = useState<VisualCategory>(category);
  const [currentOp, setCurrentOp] = useState<string>(op);
  const [args, setArgs] = useState<VisualArg[]>(initialArgs);

  // Sync to node
  useEffect(() => {
    const buildLogic = () => {
      const finalArgs = args.map(a => {
        if (a.isVar) return { "var": String(a.value) };
        const num = Number(a.value);
        return !isNaN(num) && a.value !== "" ? num : String(a.value);
      });
      return { [currentOp]: finalArgs };
    };

    const newLogic = buildLogic();
    setNodes(curr => curr.map(n => 
      n.id === node.id 
        ? { ...n, nodeData: { ...n.nodeData, jsonLogic: newLogic } } 
        : n
    ));
    setJsonValue(JSON.stringify(newLogic, null, 2));
  }, [currentCategory, currentOp, args, node.id, setNodes, setJsonValue]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value as VisualCategory;
    setCurrentCategory(newCat);
    if (newCat === 'Math') setCurrentOp('+');
    else if (newCat === 'Comparison') setCurrentOp('==');
    else if (newCat === 'Dice Roll') setCurrentOp('roll');

    // Adjust arguments length
    if (newCat === 'Dice Roll' && args.length > 1) {
      setArgs([args[0]]);
    } else if (newCat !== 'Dice Roll' && args.length < 2) {
      setArgs([...args, { isVar: false, value: '' }]);
    }
  };

  const updateArg = (index: number, changes: Partial<VisualArg>) => {
    setArgs(prev => prev.map((a, i) => i === index ? { ...a, ...changes } : a));
  };

  const addArg = () => setArgs(prev => [...prev, { isVar: false, value: '' }]);
  const removeArg = (index: number) => setArgs(prev => prev.filter((_, i) => i !== index));

  return (
    <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto min-h-0">
      <div className="flex gap-2">
        <div className="flex-1 flex flex-col gap-1.5 shrink-0">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</label>
          <select 
            value={currentCategory}
            onChange={handleCategoryChange}
            className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="Comparison">Comparison</option>
            <option value="Math">Math</option>
            <option value="Dice Roll">Dice Roll</option>
          </select>
        </div>
        
        {currentCategory !== 'Dice Roll' && (
          <div className="flex-1 flex flex-col gap-1.5 shrink-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operator</label>
            <select 
              value={currentOp}
              onChange={(e) => setCurrentOp(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {currentCategory === 'Math' && MathOps.map(o => <option key={o} value={o}>{o}</option>)}
              {currentCategory === 'Comparison' && CompOps.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Arguments</label>
        {args.map((arg, i) => (
          <div key={i} className="flex gap-2 items-center bg-black/10 p-2 rounded-md border border-border">
            <select
              value={arg.isVar ? 'var' : 'static'}
              onChange={(e) => updateArg(i, { isVar: e.target.value === 'var' })}
              className="h-8 rounded bg-background px-2 text-xs border border-border w-24 shrink-0"
            >
              <option value="var">Variable</option>
              <option value="static">Static</option>
            </select>
            
            <input 
              type="text"
              value={arg.value}
              onChange={(e) => updateArg(i, { value: e.target.value })}
              placeholder={arg.isVar ? "e.g. actor.str" : "Value"}
              className="flex-1 h-8 rounded border border-input bg-background/50 px-3 text-sm"
            />
            {args.length > 1 && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeArg(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addArg} className="mt-1 self-start h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Argument
        </Button>
      </div>
    </div>
  );
};

// ---------- MAIN RULE INSPECTOR ----------

interface RuleInspectorProps {
  selectedNode: RuleNode;
  setNodes: React.Dispatch<React.SetStateAction<RuleNode[]>>;
  entryNodeId: string | null;
  setEntryNodeId: (id: string | null) => void;
  isInspectorExpanded: boolean;
  setIsInspectorExpanded: (expanded: boolean) => void;
}

export function RuleInspector({
  selectedNode,
  setNodes,
  entryNodeId,
  setEntryNodeId,
  isInspectorExpanded,
  setIsInspectorExpanded
}: RuleInspectorProps) {

  // We maintain jsonValue in the inspector state just like before
  const [jsonValue, setJsonValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const jsonUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (selectedNode) {
      setJsonValue(JSON.stringify(selectedNode.nodeData.jsonLogic || {}, null, 2));
      setJsonError(null);
    } else {
      setJsonValue('');
      setJsonError(null);
    }
  }, [selectedNode?.id]); // Only run on node ID switch to prevent circular updates in visual mode

  const handleJsonChange = (val: string | undefined) => {
    const newVal = val ?? '';
    setJsonValue(newVal);
    
    if (jsonUpdateTimer.current) clearTimeout(jsonUpdateTimer.current);
    
    jsonUpdateTimer.current = setTimeout(() => {
      try {
        if (!newVal.trim()) return;
        const parsed = JSON.parse(newVal);
        setJsonError(null);
        
        setNodes(curr => curr.map(n => 
          n.id === selectedNode.id 
            ? { ...n, nodeData: { ...n.nodeData, jsonLogic: parsed } } 
            : n
        ));
      } catch (e: any) {
        setJsonError(e.message);
      }
    }, 500);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setNodes(curr => curr.map(n => 
      n.id === selectedNode.id 
        ? { ...n, nodeData: { ...n.nodeData, name: newName } } 
        : n
    ));
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDesc = e.target.value;
    setNodes(curr => curr.map(n => 
      n.id === selectedNode.id 
        ? { ...n, nodeData: { ...n.nodeData, description: newDesc } } 
        : n
    ));
  };

  // UI Mode Toggle Logic
  const parsed = parseLogicForVisualMode(selectedNode?.nodeData?.jsonLogic);
  const isFunctionNode = selectedNode?.nodeType === 'function_node';
  const hasComplexLogic = !isFunctionNode && !parsed.valid && Object.keys(selectedNode?.nodeData?.jsonLogic || {}).length > 0;

  // Decide initial mode
  const [mode, setMode] = useState<'Visual' | 'Expert'>(hasComplexLogic ? 'Expert' : 'Visual');

  // If node switches, reset mode correctly
  useEffect(() => {
    if (isFunctionNode) return;
    const p = parseLogicForVisualMode(selectedNode?.nodeData?.jsonLogic);
    if (!p.valid && Object.keys(selectedNode?.nodeData?.jsonLogic || {}).length > 0) {
      setMode('Expert');
    } else {
      setMode('Visual');
    }
  }, [selectedNode?.id, isFunctionNode]);

  const toggleMode = (newMode: 'Visual' | 'Expert') => {
    if (newMode === 'Visual' && hasComplexLogic) {
      toast.error('Logic is too complex for the Visual Builder. Please use Expert Mode.');
      return;
    }
    setMode(newMode);
  };

  return (
    <div className={`transition-all duration-300 flex flex-col shrink-0 bg-card border-l border-border relative ${isInspectorExpanded ? "w-[700px]" : "w-[350px]"}`}>
      <Button
        variant="outline"
        size="icon"
        className="absolute top-4 -left-3 h-6 w-6 rounded-full border border-border bg-background shadow-sm z-10 p-0 hover:bg-muted"
        onClick={() => setIsInspectorExpanded(!isInspectorExpanded)}
        title={isInspectorExpanded ? "Collapse Inspector" : "Expand Inspector"}
      >
        {isInspectorExpanded ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>
      
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
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

          <OutputTargetInput 
            value={selectedNode.nodeData.outputTarget || ''} 
            onChange={(newTarget) => {
              setNodes(curr => curr.map(n => 
                n.id === selectedNode.id 
                  ? { ...n, nodeData: { ...n.nodeData, outputTarget: newTarget } } 
                  : n
              ));
            }}
          />
        </div>

        {/* Mode Toggle for normal nodes */}
        {!isFunctionNode && (
          <div className="px-4 pt-4 shrink-0">
            <div className="flex bg-muted/80 rounded border border-border/50 p-0.5 shadow-inner">
              <button
                className={`flex-1 flex items-center justify-center px-4 py-1.5 text-xs font-medium rounded transition-all duration-200 ${mode === 'Visual' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                onClick={() => toggleMode('Visual')}
              >
                Visual
              </button>
              <button
                className={`flex-1 flex items-center justify-center px-4 py-1.5 text-xs font-medium rounded transition-all duration-200 ${mode === 'Expert' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                onClick={() => toggleMode('Expert')}
              >
                Expert
              </button>
            </div>
            {mode === 'Visual' && hasComplexLogic && (
               <div className="mt-2 text-[10px] text-destructive flex items-center gap-1">
                 <AlertCircle className="w-3 h-3" />
                 Logic too complex for Visual Builder. Use Expert Mode.
               </div>
            )}
          </div>
        )}
        
        {jsonError && mode === 'Expert' && (
          <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive shrink-0">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="font-mono break-all">{jsonError}</span>
          </div>
        )}

        <div className="flex-1 min-h-0 mt-2 border-t border-border flex flex-col">
          {isFunctionNode ? (
            <FunctionNodeInspector node={selectedNode} setNodes={setNodes} setJsonValue={setJsonValue} />
          ) : mode === 'Visual' ? (
            <VisualModeRenderer node={selectedNode} setNodes={setNodes} setJsonValue={setJsonValue} />
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
    </div>
  );
}
