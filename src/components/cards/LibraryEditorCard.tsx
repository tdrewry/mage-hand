import { useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  User,
  Code2,
  Image as ImageIcon,
  AlertCircle,
  Skull,
  Trash2,
} from 'lucide-react';
import { useCreatureStore } from '@/stores/creatureStore';
import { EditableCharacterSheet } from '@/components/EditableCharacterSheet';
import { StatBlockFromJson } from '@/components/cards/MonsterStatBlockCard';
import { generateBlankTemplate } from '@/lib/characterTemplateGenerator';
import { CardSaveButton } from '@/components/cards/CardSaveButton';
import type { DndBeyondCharacter, Monster5eTools } from '@/types/creatureTypes';
import { toast } from 'sonner';
import { useGlobalConfigStore } from '@/stores/globalConfigStore';
import { compileToMonacoSchema } from '@/lib/rules-engine/schemas';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// ─── Props ────────────────────────────────────────────────────────────────────

interface LibraryEditorCardContentProps {
  entityId: string;
  entityType: 'character' | 'monster';
}

// ─── Parse helpers ────────────────────────────────────────────────────────────

function parseAsCharacter(json: string): DndBeyondCharacter | null {
  try {
    const raw = JSON.parse(json);
    if (!raw || typeof raw !== 'object') return null;
    const base = generateBlankTemplate();
    return {
      ...base,
      ...raw,
      abilities: { ...base.abilities, ...(raw.abilities ?? {}) },
      hitPoints: { ...base.hitPoints, ...(raw.hitPoints ?? {}) },
      proficiencies: { ...base.proficiencies, ...(raw.proficiencies ?? {}) },
      skills: raw.skills ?? base.skills,
      savingThrows: raw.savingThrows ?? base.savingThrows,
      actions: raw.actions ?? base.actions,
      features: raw.features ?? base.features,
      conditions: raw.conditions ?? base.conditions,
      classes: raw.classes ?? base.classes,
    };
  } catch {
    return null;
  }
}

function parseAsMonster(json: string): Monster5eTools | null {
  try {
    const raw = JSON.parse(json);
    if (!raw || typeof raw !== 'object') return null;
    return {
      id: raw.id ?? 'unknown',
      name: raw.name ?? 'Unknown',
      source: raw.source ?? 'Homebrew',
      size: raw.size ?? 'M',
      type: raw.type ?? { type: 'humanoid' },
      ac: Array.isArray(raw.ac) ? raw.ac : [{ ac: raw.ac ?? 10 }],
      hp: raw.hp ?? { average: 10, formula: '2d8+2' },
      speed: raw.speed ?? { walk: 30 },
      str: raw.str ?? 10,
      dex: raw.dex ?? 10,
      con: raw.con ?? 10,
      int: raw.int ?? 10,
      wis: raw.wis ?? 10,
      cha: raw.cha ?? 10,
      cr: raw.cr ?? '0',
      passive: raw.passive ?? 10,
      ...raw,
    } as Monster5eTools;
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function LibraryEditorCardContent({ entityId, entityType }: LibraryEditorCardContentProps) {
  const {
    getCharacterById, getMonsterById,
    updateCharacter, updateMonster,
  } = useCreatureStore();

  // Load initial entity
  const entity = entityType === 'character'
    ? getCharacterById(entityId)
    : getMonsterById(entityId);

  const initialJson = useMemo(() => {
    return entity ? JSON.stringify(entity, null, 2) : '';
  }, []); // Only compute once on mount

  const schemas = useGlobalConfigStore(s => s.schemas);

  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
  const [jsonValue, setJsonValue] = useState(initialJson);
  const [jsonSyntaxError, setJsonSyntaxError] = useState<string | null>(null);
  const [jsonSchemaError, setJsonSchemaError] = useState<string | null>(null);
  const [tokenIconUrl, setTokenIconUrl] = useState(
    entityType === 'character'
      ? (entity as DndBeyondCharacter)?.tokenIconUrl ?? (entity as DndBeyondCharacter)?.portraitUrl ?? ''
      : (entity as Monster5eTools)?.tokenIconUrl ?? (entity as Monster5eTools)?.tokenUrl ?? ''
  );

  // Parse for form display
  const parsedCharacter = useMemo(() => {
    if (entityType !== 'character' || !jsonValue.trim()) return null;
    return parseAsCharacter(jsonValue);
  }, [jsonValue, entityType]);

  const parsedMonster = useMemo(() => {
    if (entityType !== 'monster' || !jsonValue.trim()) return null;
    return parseAsMonster(jsonValue);
  }, [jsonValue, entityType]);

  // Validate JSON
  useMemo(() => {
    if (!jsonValue.trim()) { setJsonSyntaxError(null); return; }
    try { JSON.parse(jsonValue); setJsonSyntaxError(null); }
    catch (e: any) { setJsonSyntaxError(e.message); }
  }, [jsonValue]);

  const handleJsonChange = useCallback((value: string | undefined) => {
    const val = value ?? '';
    setJsonValue(val);
    try { JSON.parse(val); setJsonSyntaxError(null); }
    catch (e: any) { setJsonSyntaxError(e.message); }
  }, []);

  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    const matchingSchemaConfig = Object.values(schemas).find(s => s.role === entityType);
    if (matchingSchemaConfig) {
      const compiledJsonSchema = compileToMonacoSchema(matchingSchemaConfig.rootSchema);
      const monacoLangs = monaco.languages as any;
      if (monacoLangs.json) {
        monacoLangs.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          schemas: [{
            uri: `inmemory://${entityId}-schema.json`,
            fileMatch: [`inmemory://${entityId}.json`],
            schema: compiledJsonSchema
          }]
        });
      }
    }

    monaco.editor.onDidChangeMarkers((uris: any[]) => {
      const activeUri = editor.getModel()?.uri;
      if (activeUri && uris.find((u: any) => u.toString() === activeUri.toString())) {
        const markers = monaco.editor.getModelMarkers({ resource: activeUri });
        const errors = markers.filter((m: any) => m.severity === monaco.MarkerSeverity.Error);
        if (errors.length > 0) {
          setJsonSchemaError(`Schema Error (Line ${errors[0].startLineNumber}): ${errors[0].message}`);
        } else {
          setJsonSchemaError(null);
        }
      }
    });
  }, [entityId, entityType, schemas]);

  // Character form → JSON sync
  const handleCharacterChange = useCallback((updated: DndBeyondCharacter) => {
    // Preserve tokenIconUrl in JSON
    updated.tokenIconUrl = tokenIconUrl || undefined;
    setJsonValue(JSON.stringify(updated, null, 2));
    setJsonSyntaxError(null);
  }, [tokenIconUrl]);

  // Save to store
  const handleSave = useCallback(() => {
    if (jsonSyntaxError || jsonSchemaError) {
      toast.error('Fix JSON errors before saving');
      return;
    }

    try {
      const parsed = JSON.parse(jsonValue);

      if (entityType === 'character') {
        const char = parseAsCharacter(jsonValue);
        if (char) {
          char.tokenIconUrl = tokenIconUrl || undefined;
          updateCharacter(entityId, char);
          toast.success(`${char.name} saved`);
        }
      } else {
        const monster = parseAsMonster(jsonValue);
        if (monster) {
          monster.tokenIconUrl = tokenIconUrl || undefined;
          updateMonster(entityId, monster);
          toast.success(`${monster.name} saved`);
        }
      }
    } catch {
      toast.error('Invalid JSON');
    }
  }, [jsonValue, jsonSyntaxError, jsonSchemaError, entityId, entityType, tokenIconUrl, updateCharacter, updateMonster]);

  if (!entity) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        {entityType === 'character' ? 'Character' : 'Monster'} not found
      </div>
    );
  }

  const entityName = entityType === 'character'
    ? (entity as DndBeyondCharacter).name
    : (entity as Monster5eTools).name;

  return (
    <div className="flex flex-col h-full">
      {/* Header with token icon */}
      <div className="px-4 pt-3 pb-2 border-b border-border flex items-center gap-3 shrink-0">
        {/* Token icon preview */}
        <div className="relative group">
          <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center overflow-hidden bg-muted shrink-0">
            {tokenIconUrl ? (
              <img src={tokenIconUrl} alt="Token" className="w-full h-full object-cover" />
            ) : entityType === 'character' ? (
              <User className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Skull className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{entityName}</p>
          <p className="text-xs text-muted-foreground capitalize">{entityType}</p>
        </div>
      </div>

      {/* Token icon URL */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 shrink-0">
        <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <Input
          value={tokenIconUrl}
          onChange={(e) => setTokenIconUrl(e.target.value)}
          placeholder="Token icon URL..."
          className="h-7 text-xs flex-1"
        />
        {tokenIconUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setTokenIconUrl('')}
          >
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-4 mt-2 grid grid-cols-2 shrink-0">
          <TabsTrigger value="form" className="text-xs gap-1">
            {entityType === 'character' ? <User className="w-3 h-3" /> : <Skull className="w-3 h-3" />}
            {entityType === 'character' ? 'Character' : 'Stat Block'}
          </TabsTrigger>
          <TabsTrigger value="json" className="text-xs gap-1">
            <Code2 className="w-3 h-3" /> JSON
          </TabsTrigger>
        </TabsList>

        {/* Form tab */}
        <TabsContent value="form" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            {entityType === 'character' && parsedCharacter ? (
              <EditableCharacterSheet character={parsedCharacter} onChange={handleCharacterChange} />
            ) : entityType === 'monster' && parsedMonster ? (
              <StatBlockFromJson data={parsedMonster} />
            ) : (
              <div className="p-6 text-center text-muted-foreground text-sm space-y-3">
                {(jsonSyntaxError || jsonSchemaError) ? (
                  <>
                    <AlertCircle className="w-8 h-8 mx-auto text-destructive/50" />
                    <p>Fix the JSON errors to view the {entityType}.</p>
                  </>
                ) : (
                  <p>No valid data found. Edit the JSON tab.</p>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* JSON tab */}
        <TabsContent value="json" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0 flex flex-col">
          {(jsonSyntaxError || jsonSchemaError) && (
            <div className="mx-4 mt-2 mb-1 flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive shrink-0">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="font-mono break-all">{jsonSyntaxError || jsonSchemaError}</span>
            </div>
          )}
          <div className="flex-1 min-h-0 border-y border-border overflow-hidden mt-2" onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()}>
            <Suspense fallback={
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Loading editor…
              </div>
            }>
              <MonacoEditor
                height="100%"
                language="json"
                value={jsonValue}
                path={`inmemory://${entityId}.json`}
                onChange={handleJsonChange}
                onMount={handleEditorMount}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  folding: true,
                  renderLineHighlight: 'all',
                  overviewRulerLanes: 0,
                  padding: { top: 16, bottom: 16 },
                }}
              />
            </Suspense>
          </div>
        </TabsContent>
      </Tabs>

      {/* Save button */}
      <div className="px-4 py-2 border-t border-border shrink-0">
        <CardSaveButton
          context={{ type: entityType === 'character' ? 'character' : 'monster', id: entityId }}
          onSave={handleSave}
          disabled={!!(jsonSyntaxError || jsonSchemaError)}
        />
      </div>
    </div>
  );
}
