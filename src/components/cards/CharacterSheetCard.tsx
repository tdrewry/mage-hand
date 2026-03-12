import { useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  User,
  Code2,
  Layers,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useSessionStore, type EntityRef } from '@/stores/sessionStore';
import { useCreatureStore } from '@/stores/creatureStore';
import { LinkedCreatureSection } from '@/components/LinkedCreatureSection';
import { EditableCharacterSheet } from '@/components/EditableCharacterSheet';
import { generateBlankTemplate } from '@/lib/characterTemplateGenerator';
import { CardSaveButton } from '@/components/cards/CardSaveButton';
import type { DndBeyondCharacter } from '@/types/creatureTypes';
import { toast } from 'sonner';

// Lazy load Monaco to avoid bundle bloat
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// ─── Props ────────────────────────────────────────────────────────────────────

interface CharacterSheetCardContentProps {
  tokenId: string;
  /** Legacy: kept for backward compat when opened from creature library */
  characterId?: string;
}

// ─── Parse helpers ────────────────────────────────────────────────────────────

/** Try to parse JSON as a DndBeyondCharacter, filling defaults */
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

// ─── Main export ──────────────────────────────────────────────────────────────

export function CharacterSheetCardContent({ tokenId, characterId }: CharacterSheetCardContentProps) {
  const { tokens, updateTokenDetails, updateTokenStatBlockJson, updateTokenEntityRef } = useSessionStore();
  const { getMonsterById, getCharacterById, getCreatureType } = useCreatureStore();

  const token = useMemo(() => tokens.find(t => t.id === tokenId), [tokens, tokenId]);

  // ── Derive initial JSON from linked entity if token has no custom JSON yet ──
  const initialJson = useMemo(() => {
    if (token?.statBlockJson) return token.statBlockJson;

    const linkedId = token?.entityRef?.entityId;
    if (!linkedId) return '';

    const creatureType = getCreatureType(linkedId);
    if (creatureType === 'monster') {
      const monster = getMonsterById(linkedId);
      return monster ? JSON.stringify(monster, null, 2) : '';
    }
    if (creatureType === 'character') {
      const character = getCharacterById(linkedId);
      return character ? JSON.stringify(character, null, 2) : '';
    }
    return '';
  }, [token, getCreatureType, getMonsterById, getCharacterById]);

  // Default to "character" tab if JSON is present, otherwise "details"
  const defaultTab = initialJson.trim() ? 'character' : 'details';
  const [activeTab, setActiveTab] = useState<'character' | 'json' | 'details'>(defaultTab);
  const [jsonValue, setJsonValue] = useState(initialJson);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // ── Parse JSON for editable character ────────────────────────────────────
  const parsedCharacter = useMemo(() => {
    if (!jsonValue.trim()) return null;
    return parseAsCharacter(jsonValue);
  }, [jsonValue]);

  // Validate JSON separately
  useMemo(() => {
    if (!jsonValue.trim()) { setJsonError(null); return; }
    try {
      JSON.parse(jsonValue);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  }, [jsonValue]);

  const handleJsonChange = useCallback((value: string | undefined) => {
    const val = value ?? '';
    setJsonValue(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  }, []);

  // When character tab edits happen, sync back to JSON
  const handleCharacterChange = useCallback((updated: DndBeyondCharacter) => {
    const json = JSON.stringify(updated, null, 2);
    setJsonValue(json);
    setJsonError(null);
  }, []);

  // ── Details tab state ────────────────────────────────────────────────────
  const [notes, setNotes] = useState(token?.notes ?? '');
  const [quickRef, setQuickRef] = useState(token?.quickReferenceUrl ?? '');

  // Stub a blank character if no data exists
  const handleCreateBlank = useCallback(() => {
    const blank = generateBlankTemplate();
    blank.name = token?.name || 'Character Name';
    const json = JSON.stringify(blank, null, 2);
    setJsonValue(json);
    setJsonError(null);
    setActiveTab('character');
  }, [token]);

  /** Unified save — persists character JSON + details in one action. */
  const handleSaveAll = useCallback(() => {
    if (!token) return;
    if (jsonError) {
      toast.error('Fix JSON errors before saving');
      return;
    }
    updateTokenStatBlockJson(token.id, jsonValue);
    updateTokenDetails(token.id, notes, quickRef, jsonValue);
    toast.success('Changes saved');
  }, [token, jsonError, jsonValue, notes, quickRef, updateTokenStatBlockJson, updateTokenDetails]);

  const handleLinkCreature = (creatureId: string, creatureType: 'character' | 'monster') => {
    if (!token) return;
    updateTokenEntityRef(token.id, {
      type: 'local',
      entityId: creatureId,
      projectionType: creatureType === 'monster' ? 'stat-block' : 'character',
    });
    toast.success(`Token linked to ${creatureType}`);
  };

  const handleUnlinkCreature = () => {
    if (!token) return;
    updateTokenEntityRef(token.id, undefined);
    toast.success('Creature unlinked');
  };

  const handleOpenEditToken = useCallback(() => {
    if (!token) return;
    window.dispatchEvent(new CustomEvent('openEditTokenModal', { detail: { tokenId: token.id } }));
  }, [token?.id]);

  // ── Fallback: legacy characterId mode ───────────────────────────────────
  if (!tokenId && characterId) {
    return <LegacyCharacterSheetFallback characterId={characterId} />;
  }

  if (!token) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Token not found
      </div>
    );
  }

  const hasQuickRef = quickRef && quickRef.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Token header — click to open Edit Token modal */}
      <button
        onClick={handleOpenEditToken}
        className="px-4 pt-3 pb-2 border-b border-border flex items-center gap-3 shrink-0 w-full text-left hover:bg-muted/40 transition-colors rounded-none"
        title="Click to edit token"
      >
        {token.imageUrl ? (
          <img
            src={token.imageUrl}
            alt={token.name}
            className="w-10 h-10 rounded-full object-cover border border-border"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-sm font-bold shrink-0"
            style={{ backgroundColor: token.color ?? 'hsl(var(--muted))' }}
          >
            {token.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{token.name || 'Unnamed Token'}</p>
          {token.entityRef?.entityId ? (
            <p className="text-xs text-muted-foreground truncate">
              Linked · {token.entityRef.projectionType}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Click to edit token</p>
          )}
        </div>
        {hasQuickRef && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={(e) => { e.stopPropagation(); window.open(quickRef, '_blank'); }}
            title="Open quick reference"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
      </button>

      {/* Tabs — inactive ones collapse via data-[state=inactive]:hidden */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-4 mt-2 grid grid-cols-3 shrink-0">
          <TabsTrigger value="character" className="text-xs gap-1">
            <User className="w-3 h-3" /> Character
          </TabsTrigger>
          <TabsTrigger value="json" className="text-xs gap-1">
            <Code2 className="w-3 h-3" /> JSON
          </TabsTrigger>
          <TabsTrigger value="details" className="text-xs gap-1">
            <Layers className="w-3 h-3" /> Details
          </TabsTrigger>
        </TabsList>

        {/* ── Character (Editable Sheet) tab ────────────────────────────── */}
        <TabsContent value="character" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            {parsedCharacter ? (
              <>
                <EditableCharacterSheet character={parsedCharacter} onChange={handleCharacterChange} />
              </>
            ) : (
              <div className="p-6 text-center text-muted-foreground text-sm space-y-3">
                {jsonError ? (
                  <>
                    <AlertCircle className="w-8 h-8 mx-auto text-destructive/50" />
                    <p>Fix the JSON errors to edit the character sheet.</p>
                  </>
                ) : (
                  <>
                    <User className="w-8 h-8 mx-auto opacity-30" />
                    <p>No character data yet.</p>
                    <Button size="sm" variant="outline" onClick={handleCreateBlank}>
                      Create Blank Character Sheet
                    </Button>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── JSON Editor tab ──────────────────────────────────────────── */}
        <TabsContent value="json" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0 flex flex-col">
          {jsonError && (
            <div className="mx-4 mt-2 mb-1 flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive shrink-0">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="font-mono break-all">{jsonError}</span>
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
                onChange={handleJsonChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 11,
                  lineNumbers: 'off',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  folding: true,
                  renderLineHighlight: 'none',
                  overviewRulerLanes: 0,
                  padding: { top: 8, bottom: 8 },
                }}
              />
            </Suspense>
          </div>
        </TabsContent>

        {/* ── Details tab ──────────────────────────────────────────────── */}
        <TabsContent value="details" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0 px-4 pb-4 pt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-1">
              {/* Linked creature section */}
              <LinkedCreatureSection
                token={token}
                onViewStats={() => setActiveTab('character')}
                onUnlink={handleUnlinkCreature}
                onLinkCreature={handleLinkCreature}
              />

              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  placeholder="GM notes for this token…"
                  className="text-sm resize-none min-h-[120px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quick Reference URL</Label>
                <Input
                  placeholder="https://…"
                  className="text-sm"
                  value={quickRef}
                  onChange={(e) => setQuickRef(e.target.value)}
                />
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Unified save button — always visible at bottom */}
      <div className="px-4 py-2 border-t border-border shrink-0">
        <CardSaveButton
          context={{ type: 'token', id: token.id }}
          onSave={handleSaveAll}
          disabled={!!jsonError}
        />
      </div>
    </div>
  );
}

// ── Legacy fallback for characterId-based cards ────────────────────────────
function LegacyCharacterSheetFallback({ characterId }: { characterId: string }) {
  const { getCharacterById } = useCreatureStore();
  const character = getCharacterById(characterId);

  if (!character) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Character not found (ID: {characterId})
      </div>
    );
  }

  return (
    <div className="p-4 text-sm text-muted-foreground text-center">
      <p className="font-medium text-foreground">{character.name}</p>
      <p>Open this character's token to access the full sheet.</p>
    </div>
  );
}
