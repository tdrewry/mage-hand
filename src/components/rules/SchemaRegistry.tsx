import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useGlobalConfigStore } from '@/stores/globalConfigStore';
import { Database, Network, Lock, Save, Plus, Trash2, X } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

  const [pendingLabel, setPendingLabel] = useState('');
  const [pendingRole, setPendingRole] = useState<'character'|'creature'|'item'|'system'|'custom'>('custom');
  const [pendingVersion, setPendingVersion] = useState('');
  const [pendingSourceUrl, setPendingSourceUrl] = useState('');

  const activeSchema = isCreatingNew ? null : (schemas[activeSchemaId || ''] || null);
  const isReadOnly = activeSchema && BUILT_IN_SCHEMAS.includes(activeSchema.id);
  
  useEffect(() => {
    if (activeSchema && !isCreatingNew) {
      setEditorState(JSON.stringify(activeSchema.rootSchema, null, 2));
      setPendingLabel(activeSchema.label || '');
      setPendingRole(activeSchema.role || (BUILT_IN_SCHEMAS.includes(activeSchema.id) ? 'system' : 'custom'));
      setPendingVersion(activeSchema.version || '');
      setPendingSourceUrl(activeSchema.sourceUrl || '');
    } else if (isCreatingNew) {
      setEditorState(`{\n  "type": "object",\n  "description": "My custom system structure",\n  "properties": {\n    "exampleField": { "type": "string" }\n  }\n}`);
      setPendingLabel('');
      setPendingRole('custom');
      setPendingVersion('1.0.0');
      setPendingSourceUrl('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      addSchema(newId, newLabel, parsed, {
        role: pendingRole,
        version: pendingVersion,
        sourceUrl: pendingSourceUrl
      });
      setIsCreatingNew(false);
      setActiveSchemaId(newId);
      toast.success('Custom Schema Created!');
    } else if (activeSchema && !isReadOnly) {
      addSchema(activeSchema.id, pendingLabel, parsed, {
        role: pendingRole,
        version: pendingVersion,
        sourceUrl: pendingSourceUrl
      });
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 hover:bg-indigo-500/20 hover:text-indigo-400 text-muted-foreground"
                onClick={() => { setIsCreatingNew(true); setActiveSchemaId(null); setNewId(''); setNewLabel(''); }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create Custom Schema</TooltipContent>
          </Tooltip>
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
        <div className="flex flex-col border-b border-border bg-card/30 shrink-0">
          <div className="px-4 h-[52px] flex items-center justify-between">
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
                <div className="flex items-center gap-2">
                  {isReadOnly ? (
                    <h3 className="font-semibold text-sm">{activeSchema.label}</h3>
                  ) : (
                    <input 
                      value={pendingLabel} 
                      onChange={e => setPendingLabel(e.target.value)} 
                      className="bg-background border border-border h-8 px-2 text-sm font-semibold rounded w-48 focus:ring-1 focus:ring-emerald-500 focus:outline-none" 
                    />
                  )}
                  <span className="text-xs text-muted-foreground opacity-50 font-mono">({activeSchema.id})</span>
                </div>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {!isCreatingNew && isReadOnly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-sm border border-rose-500/20 mr-2 flex items-center gap-1.5 cursor-not-allowed">
                      <Lock className="w-3 h-3" /> System Managed (Read-Only)
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>System schemas cannot be altered directly to prevent crashing engine pipelines</TooltipContent>
                </Tooltip>
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

          {/* Metadata Row */}
          {(!isCreatingNew && !activeSchema) ? null : (
            <div className="px-4 py-2 bg-muted/20 border-t border-border flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Role:</span>
                {isReadOnly ? (
                  <Badge variant="outline" className="text-[10px] uppercase rounded-sm border-indigo-500/30 text-indigo-400 bg-indigo-500/5">{activeSchema?.role || 'System'}</Badge>
                ) : (
                  <Select value={pendingRole} onValueChange={(val: any) => setPendingRole(val)}>
                    <SelectTrigger className="h-6 text-xs w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom Module</SelectItem>
                      <SelectItem value="character">Character Data</SelectItem>
                      <SelectItem value="creature">Creature Data</SelectItem>
                      <SelectItem value="item">Item Data</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Version:</span>
                {isReadOnly ? (
                  <span className="font-mono text-muted-foreground">{activeSchema?.version || '1.0.0'}</span>
                ) : (
                  <Input 
                    value={pendingVersion} 
                    onChange={e => setPendingVersion(e.target.value)}
                    placeholder="e.g. 1.0.0"
                    className="h-6 px-2 text-xs w-[100px]"
                  />
                )}
              </div>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Source URL:</span>
                {isReadOnly ? (
                  <span className="text-muted-foreground truncate">{activeSchema?.sourceUrl || 'Internal Architecture'}</span>
                ) : (
                  <Input 
                    value={pendingSourceUrl} 
                    onChange={e => setPendingSourceUrl(e.target.value)}
                    placeholder="https://schema.org/example..."
                    className="h-6 px-2 text-xs flex-1 max-w-[400px]"
                  />
                )}
              </div>
            </div>
          )}
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
