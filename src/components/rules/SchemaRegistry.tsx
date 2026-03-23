import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useGlobalConfigStore } from '@/stores/globalConfigStore';
import { Database, Network, Lock, Save, Plus, Trash2, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

const BUILT_IN_SCHEMAS = ['intent', 'actor', 'action', 'target', 'targetResult'];

// Basic JSON Schema Draft to validate against our internal SchemaNode AST struct
const INTERNAL_SCHEMA_NODE_VALIDATOR = {
  uri: "inmemory://schema-node.json",
  fileMatch: ["inmemory://custom-schema.json"],
  schema: {
    type: "object",
    properties: {
      type: { enum: ['object', 'array', 'string', 'number', 'boolean', 'enum', 'any'] },
      description: { type: "string" },
      enumValues: { type: "array", items: { type: "string" } },
      items: { $ref: "#" },
      properties: { 
        type: "object", 
        additionalProperties: { $ref: "#" }
      }
    },
    required: ["type"]
  }
};

export function SchemaRegistry() {
  const schemas = useGlobalConfigStore((s) => s.schemas);
  const addSchema = useGlobalConfigStore((s) => s.addSchema);
  const removeSchema = useGlobalConfigStore((s) => s.removeSchema);
  
  const schemaList = Object.values(schemas).sort((a, b) => {
    // Force built-ins to top, custom below
    const aBuiltIn = BUILT_IN_SCHEMAS.includes(a.id);
    const bBuiltIn = BUILT_IN_SCHEMAS.includes(b.id);
    if (aBuiltIn && !bBuiltIn) return -1;
    if (!aBuiltIn && bBuiltIn) return 1;
    return a.label.localeCompare(b.label);
  });

  const [activeSchemaId, setActiveSchemaId] = useState<string | null>(schemaList[0]?.id || null);
  const [editorState, setEditorState] = useState<string>('{}');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const activeSchema = isCreatingNew ? null : (schemas[activeSchemaId || ''] || null);
  const isReadOnly = activeSchema && BUILT_IN_SCHEMAS.includes(activeSchema.id);
  
  useEffect(() => {
    if (activeSchema && !isCreatingNew) {
      setEditorState(JSON.stringify(activeSchema.rootSchema, null, 2));
    } else if (isCreatingNew) {
      setEditorState(`{\n  "type": "object",\n  "description": "My custom system structure",\n  "properties": {\n    "exampleField": { "type": "string" }\n  }\n}`);
    }
  }, [activeSchemaId, isCreatingNew]);

  const handleEditorMount = (editor: any, monaco: any) => {
    // Configure Monaco JSON language strict formatting/validation
    const monacoLangs = monaco.languages as any;
    if (monacoLangs.json) {
      monacoLangs.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [INTERNAL_SCHEMA_NODE_VALIDATOR]
      });
    }
  };

  const handleSave = () => {
    let parsed: any;
    try {
      parsed = JSON.parse(editorState);
    } catch (e) {
      toast.error('Invalid JSON. Please fix syntax errors before saving.');
      return;
    }

    if (!parsed.type) {
      toast.error('Schema must have a root "type" property (usually "object").');
      return;
    }

    if (isCreatingNew) {
      if (!newId || !newLabel) {
        toast.error('ID and Label are required for new schemas.');
        return;
      }
      if (schemas[newId] || BUILT_IN_SCHEMAS.includes(newId)) {
        toast.error('That ID is already in use by another schema.');
        return;
      }
      addSchema(newId, newLabel, parsed);
      setIsCreatingNew(false);
      setActiveSchemaId(newId);
      toast.success('Custom Schema Created!');
    } else if (activeSchema && !isReadOnly) {
      addSchema(activeSchema.id, activeSchema.label, parsed);
      toast.success('Schema Updated!');
    }
  };

  const handleDelete = () => {
    if (activeSchema && !isReadOnly) {
      if (confirm(`Are you sure you want to permanently delete custom schema '${activeSchema.id}'?`)) {
        removeSchema(activeSchema.id);
        setActiveSchemaId(schemaList[0]?.id || null);
      }
    }
  };

  return (
    <div className="flex h-full w-full bg-background rounded-md border border-border overflow-hidden m-0">
      
      {/* LEFT PANE: List of Schemas */}
      <div className="w-64 border-r border-border bg-card/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between bg-card/30">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" /> Registry
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">{schemaList.length} total active blueprints</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 hover:bg-indigo-500/20 hover:text-indigo-400 text-muted-foreground"
            onClick={() => { setIsCreatingNew(true); setActiveSchemaId(null); setNewId(''); setNewLabel(''); }}
            title="Create Custom Schema"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            
            {/* Built-ins Group */}
            <div>
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-1.5 flex items-center gap-1.5 opacity-80">
                <Lock className="w-3 h-3" /> System Core
              </h4>
              <div className="space-y-0.5">
                {schemaList.filter(s => BUILT_IN_SCHEMAS.includes(s.id)).map(s => (
                  <button
                    key={s.id}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors truncate ${
                      activeSchemaId === s.id && !isCreatingNew 
                        ? 'bg-indigo-500/15 text-indigo-400 font-semibold' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    onClick={() => { setActiveSchemaId(s.id); setIsCreatingNew(false); }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customs Group */}
            <div>
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mt-4 mb-1.5">
                Custom Modules
              </h4>
              <div className="space-y-0.5">
                {schemaList.filter(s => !BUILT_IN_SCHEMAS.includes(s.id)).length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic px-3 py-1 opacity-50">No custom modules active...</p>
                )}
                {schemaList.filter(s => !BUILT_IN_SCHEMAS.includes(s.id)).map(s => (
                  <button
                    key={s.id}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors truncate ${
                      activeSchemaId === s.id && !isCreatingNew   
                        ? 'bg-emerald-500/15 text-emerald-400 font-semibold' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    onClick={() => { setActiveSchemaId(s.id); setIsCreatingNew(false); }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </ScrollArea>
      </div>

      {/* RIGHT PANE: Monaco Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        
        {/* Editor Toolbar */}
        <div className="px-4 h-[52px] border-b border-border bg-card/30 flex items-center justify-between shrink-0">
          {isCreatingNew ? (
            <div className="flex items-center gap-3 w-full max-w-xl">
              <Network className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <input 
                  placeholder="ID (e.g. 'mech', 'vehicle')" 
                  value={newId} 
                  onChange={e => setNewId(e.target.value)} 
                  className="bg-background border border-border h-8 px-2 text-xs rounded font-mono w-48 focus:ring-1 focus:ring-emerald-500 focus:outline-none" 
                  autoFocus 
                />
                <input 
                  placeholder="Label (e.g. 'Lancer Mech')" 
                  value={newLabel} 
                  onChange={e => setNewLabel(e.target.value)} 
                  className="bg-background border border-border h-8 px-2 text-xs rounded flex-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none" 
                />
              </div>
            </div>
          ) : activeSchema ? (
            <div className="flex items-center gap-3">
              <Network className={`w-5 h-5 ${isReadOnly ? 'text-indigo-400' : 'text-emerald-400'}`} />
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  {activeSchema.label} 
                  <span className="text-xs text-muted-foreground opacity-50 font-mono">({activeSchema.id})</span>
                </h3>
              </div>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {!isCreatingNew && isReadOnly && (
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-sm border border-rose-500/20 mr-2 flex items-center gap-1.5 cursor-not-allowed" title="System schemas cannot be altered directly to prevent crashing engine pipelines">
                <Lock className="w-3 h-3" /> System Managed (Read-Only)
              </span>
            )}

            {!isCreatingNew && !isReadOnly && activeSchema && (
              <Button onClick={handleDelete} variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete
              </Button>
            )}

            {isCreatingNew && (
              <Button onClick={() => setIsCreatingNew(false)} variant="ghost" size="sm" className="h-8 text-muted-foreground">
                Cancel
              </Button>
            )}

            {(!isReadOnly || isCreatingNew) && (
              <Button onClick={handleSave} size="sm" className={`h-8 px-4 font-semibold ${isCreatingNew ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : ''}`}>
                <Save className="w-4 h-4 mr-1.5" /> Save Configuration
              </Button>
            )}
          </div>
        </div>

        {/* Monaco Canvas */}
        <div className="flex-1 relative bg-[#1e1e1e]">
          <Suspense fallback={<div className="flex items-center justify-center p-12 text-muted-foreground">Loading Editor...</div>}>
            <MonacoEditor
              language="json"
              theme="vs-dark"
              value={editorState}
              path="inmemory://custom-schema.json" /* Magic path allows the strict validating to trigger over this buffer */
              onChange={(v) => (!isReadOnly && v !== undefined) && setEditorState(v)}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                wordWrap: 'on',
                formatOnPaste: true,
                padding: { top: 16, bottom: 16 },
                readOnly: isReadOnly,
                cursorBlinking: isReadOnly ? 'solid' : 'blink',
                matchBrackets: 'always',
                renderLineHighlight: isReadOnly ? 'none' : 'all',
                colorDecorators: true
              }}
            />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
