/**
 * CampaignEditorCard — Campaign list/create + flow canvas + node property panel.
 * DM-only card for authoring branching story campaigns.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { BUILTIN_HANDOUTS } from '@/lib/handouts';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Play, Square, ArrowLeft, AlertTriangle, Swords, ScrollText, MessageSquare, Tent, Pencil, Check, Download, Upload, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useCampaignStore } from '@/stores/campaignStore';
import { useMapStore } from '@/stores/mapStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useTokenGroupStore } from '@/stores/tokenGroupStore';
import { GenericFlowCanvas } from '@/lib/campaign-editor/components/GenericFlowCanvas';
import { createMagehandTTRPGAdapter, MAGEHAND_NODE_TYPE_CONFIGS } from '@/lib/campaign-editor/adapters/magehand-ttrpg';
import type { BaseCampaign, BaseFlowNode, BaseNodeData, FlowNodePosition } from '@/lib/campaign-editor/types/base';

const adapter = createMagehandTTRPGAdapter();

const NODE_TYPE_ICONS: Record<string, React.ReactNode> = {
  encounter: <Swords className="h-3.5 w-3.5" />,
  narrative: <ScrollText className="h-3.5 w-3.5" />,
  dialog: <MessageSquare className="h-3.5 w-3.5" />,
  rest: <Tent className="h-3.5 w-3.5" />,
};

// ── Token Group Picker ──────────────────────────────────────────────────────

function TokenGroupPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tokenGroups = useTokenGroupStore((s) => s.groups);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Token Group (optional)</Label>
      {tokenGroups.length > 0 ? (
        <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="All player tokens" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">All player tokens</SelectItem>
            {tokenGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name} ({g.tokenIds.length} tokens)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="No groups defined — type a role name..."
          className="text-sm h-8"
        />
      )}
    </div>
  );
}

// ── Scenario List View ──────────────────────────────────────────────────────

function ScenarioListView({ onSelect }: { onSelect: (id: string) => void }) {
  const { campaigns, addCampaign, removeCampaign, updateCampaign, activeCampaignId, setActiveCampaign } = useCampaignStore();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleCreate = () => {
    const name = newName.trim() || 'Untitled Scenario';
    const now = new Date().toISOString();
    const startNodeId = `scene-${Date.now()}`;
    const campaign: BaseCampaign = {
      id: `campaign-${Date.now()}`,
      name,
      description: '',
      author: 'DM',
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      nodes: [{
        id: startNodeId,
        nodeData: { name: 'Start', gridWidth: 1, gridHeight: 1, terrain: [], deploymentZone: { minX: 0, maxX: 1, minY: 0, maxY: 1 }, objectives: [] },
        nodeType: 'encounter',
        nextOnSuccess: [],
        nextOnFailure: 'end',
        prerequisites: [],
        isStartNode: true,
        customData: {},
      }],
      startNodeId,
      tags: ['ttrpg'],
    };
    addCampaign(campaign);
    useCampaignStore.getState().setNodePosition(campaign.id, startNodeId, { x: 100, y: 100 });
    setNewName('');
    onSelect(campaign.id);
  };

  const handleExport = (e: React.MouseEvent, c: BaseCampaign) => {
    e.stopPropagation();
    const nodePos = useCampaignStore.getState().nodePositions[c.id] || {};
    const payload = {
      format: 'magehand-scenario',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      scenario: c,
      nodePositions: nodePos,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${c.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mhscenario`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported "${c.name}"`);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mhscenario,.json';
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const scenario: BaseCampaign = parsed.scenario ?? parsed;
        if (!scenario.id || !scenario.nodes || !Array.isArray(scenario.nodes)) {
          throw new Error('Invalid scenario format');
        }
        // Re-ID to avoid collisions
        const newId = `campaign-${Date.now()}`;
        const imported: BaseCampaign = {
          ...scenario,
          id: newId,
          updatedAt: new Date().toISOString(),
        };
        // Remap startNodeId is fine — node IDs stay the same within the scenario
        addCampaign(imported);
        // Restore node positions if present
        const positions = parsed.nodePositions as Record<string, FlowNodePosition> | undefined;
        if (positions) {
          Object.entries(positions).forEach(([nodeId, pos]) => {
            useCampaignStore.getState().setNodePosition(newId, nodeId, pos);
          });
        }
        toast.success(`Imported "${imported.name}" (${imported.nodes.length} scenes)`);
      } catch (err) {
        toast.error(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    input.click();
  };

  const handleToggleActive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveCampaign(activeCampaignId === id ? null : id);
  };

  const handleStartEdit = (e: React.MouseEvent, c: BaseCampaign) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditName(c.name);
    setEditDesc(c.description || '');
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingId) {
      updateCampaign(editingId, { name: editName.trim() || 'Untitled Scenario', description: editDesc.trim() });
      setEditingId(null);
    }
  };

  return (
    <div className="p-3 space-y-3">
      <p className="text-xs text-muted-foreground">Create or manage scenarios</p>
      <div className="flex gap-2">
        <Input
          placeholder="Scenario name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="text-sm"
        />
        <Button size="sm" onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
        <Button size="sm" variant="outline" onClick={handleImport} title="Import scenario (.mhscenario)">
          <Upload className="h-4 w-4" />
        </Button>
      </div>
      <Separator />
      {campaigns.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No scenarios yet</p>
      ) : (
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {campaigns.map((c) => {
              const isActive = activeCampaignId === c.id;
              const isEditing = editingId === c.id;
              return (
                <div
                  key={c.id}
                  className={`p-2 rounded-md border cursor-pointer transition-colors ${
                    isActive
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:bg-accent/50'
                  }`}
                  onClick={() => !isEditing && onSelect(c.id)}
                >
                  {isEditing ? (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm h-7"
                          placeholder="Scenario name..."
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(e as any)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={handleSaveEdit}
                          title="Save"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="text-xs min-h-[48px]"
                        placeholder="Scenario summary / brief..."
                        rows={2}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          {isActive && (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary shrink-0">
                              Running
                            </Badge>
                          )}
                        </div>
                        {c.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.description}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{c.nodes.length} scene{c.nodes.length !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={(e) => handleExport(e, c)}
                          title="Export scenario"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={(e) => handleStartEdit(e, c)}
                          title="Rename / edit brief"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={isActive ? 'default' : 'ghost'}
                          size="sm"
                          className={`h-7 w-7 p-0 ${isActive ? '' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={(e) => handleToggleActive(e, c.id)}
                          title={isActive ? 'Stop scenario' : 'Run scenario'}
                        >
                          {isActive ? <Square className="h-3 w-3" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); removeCampaign(c.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ── Node Property Panel ─────────────────────────────────────────────────────

function NodePropertyPanel({
  campaignId,
  node,
}: {
  campaignId: string;
  node: BaseFlowNode;
}) {
  const { updateNode, campaigns } = useCampaignStore();
  const maps = useMapStore((s) => s.maps);
  const mapObjects = useMapObjectStore((s) => s.mapObjects);

  const nodeType = node.nodeType || 'encounter';
  const typeConfig = MAGEHAND_NODE_TYPE_CONFIGS.find((c) => c.id === nodeType);
  const customData = (node.customData || {}) as Record<string, unknown>;

  const selectedMapId = customData.mapId as string || '';
  const deploymentZones = mapObjects.filter(
    (o) => o.category === 'deployment-zone' && o.mapId === selectedMapId
  );

  const hasNoZones = nodeType === 'encounter' && selectedMapId && deploymentZones.length === 0;

  const updateCustom = (key: string, value: unknown) => {
    updateNode(campaignId, node.id, { customData: { ...customData, [key]: value } });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          {NODE_TYPE_ICONS[nodeType]}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {typeConfig?.label || nodeType}
          </span>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input
            value={node.nodeData.name}
            onChange={(e) => updateNode(campaignId, node.id, { nodeData: { ...node.nodeData, name: e.target.value } })}
            className="text-sm h-8"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={node.nodeData.description || ''}
            onChange={(e) => updateNode(campaignId, node.id, { nodeData: { ...node.nodeData, description: e.target.value } })}
            className="text-sm min-h-[60px]"
            rows={2}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Scene Type</Label>
          <Select
            value={nodeType}
            onValueChange={(v) => updateNode(campaignId, node.id, { nodeType: v as any })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAGEHAND_NODE_TYPE_CONFIGS.map((cfg) => (
                <SelectItem key={cfg.id} value={cfg.id}>
                  <span className="flex items-center gap-2">{NODE_TYPE_ICONS[cfg.id]} {cfg.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Encounter-specific fields */}
        {nodeType === 'encounter' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Map</Label>
              <Select value={selectedMapId} onValueChange={(v) => updateCustom('mapId', v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select a map..." />
                </SelectTrigger>
                <SelectContent>
                  {maps.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMapId && (
              <div className="space-y-1.5">
                <Label className="text-xs">Deployment Zone</Label>
                {hasNoZones && (
                  <div className="flex items-center gap-1.5 text-xs text-yellow-500 dark:text-yellow-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    No deployment zones on this map
                  </div>
                )}
                <Select
                  value={customData.deploymentZoneId as string || ''}
                  onValueChange={(v) => updateCustom('deploymentZoneId', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select zone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {deploymentZones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.label || z.deploymentZoneLabel || z.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Fog Preset</Label>
              <Select
                value={customData.fogPreset as string || 'keep'}
                onValueChange={(v) => updateCustom('fogPreset', v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Keep Current</SelectItem>
                  <SelectItem value="reveal-all">Reveal All</SelectItem>
                  <SelectItem value="reset">Reset Fog</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <TokenGroupPicker
              value={customData.tokenGroupId as string || ''}
              onChange={(v) => updateCustom('tokenGroupId', v)}
            />
          </div>
        )}

        {/* Rest-specific fields */}
        {nodeType === 'rest' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Narrative Reason</Label>
            <Textarea
              value={customData.narrativeReason as string || ''}
              onChange={(e) => updateCustom('narrativeReason', e.target.value)}
              placeholder="The party rests at the inn..."
              className="text-sm min-h-[60px]"
              rows={2}
            />
          </div>
        )}

        {/* Narrative / Dialog — dialog lines */}
        {(nodeType === 'narrative' || nodeType === 'dialog') && (
          <div className="space-y-1.5">
            <Label className="text-xs">Dialog / Narrative Text</Label>
            <Textarea
              value={(node.dialogLines || []).map((l) => `${l.speaker ? `${l.speaker}: ` : ''}${l.text}`).join('\n') || ''}
              onChange={(e) => {
                const lines = e.target.value.split('\n').map((line) => {
                  const match = line.match(/^(.+?):\s*(.+)$/);
                  return match ? { speaker: match[1], text: match[2] } : { text: line };
                });
                updateNode(campaignId, node.id, { dialogLines: lines });
              }}
              placeholder="Speaker: Line of dialog..."
              className="text-sm min-h-[80px] font-mono"
              rows={4}
            />
          </div>
        )}

        {/* Dialog — decision outcomes / branches */}
        {nodeType === 'dialog' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Decision Outcomes</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs"
                onClick={() => {
                  const outcomes = [...(node.outcomes || [])];
                  outcomes.push({
                    id: `outcome-${Date.now()}`,
                    label: `Choice ${outcomes.length + 1}`,
                    color: '#3b82f6',
                  });
                  updateNode(campaignId, node.id, { outcomes });
                }}
              >
                <Plus className="h-3 w-3 mr-0.5" /> Add
              </Button>
            </div>
            {(node.outcomes || []).length === 0 && (
              <p className="text-[10px] text-muted-foreground">No outcomes yet — add choices for the DM to pick during play.</p>
            )}
            <div className="space-y-2">
              {(node.outcomes || []).map((outcome, idx) => {
                // Find all other nodes as potential targets
                const campaign = campaigns.find((c) => c.id === campaignId);
                const otherNodes = campaign?.nodes.filter((n) => n.id !== node.id) || [];
                return (
                  <div key={outcome.id} className="space-y-1 p-2 rounded border border-border bg-muted/30">
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={outcome.label}
                        onChange={(e) => {
                          const outcomes = [...(node.outcomes || [])];
                          outcomes[idx] = { ...outcomes[idx], label: e.target.value };
                          updateNode(campaignId, node.id, { outcomes });
                        }}
                        className="text-xs h-6 flex-1"
                        placeholder="Choice label..."
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => {
                          const outcomes = (node.outcomes || []).filter((_, i) => i !== idx);
                          updateNode(campaignId, node.id, { outcomes });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <Select
                      value={outcome.targetNodeId || '__none__'}
                      onValueChange={(v) => {
                        const outcomes = [...(node.outcomes || [])];
                        outcomes[idx] = { ...outcomes[idx], targetNodeId: v === '__none__' ? undefined : v };
                        updateNode(campaignId, node.id, { outcomes });
                      }}
                    >
                      <SelectTrigger className="h-6 text-[11px]">
                        <SelectValue placeholder="→ Target scene..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No target (use connections)</SelectItem>
                        {otherNodes.map((n) => (
                          <SelectItem key={n.id} value={n.id}>{n.nodeData.name || n.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Separator />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">{node.id}</Badge>
          {node.isStartNode && <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-500">Start</Badge>}
          {node.isEndNode && <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">End</Badge>}
        </div>
      </div>
    </ScrollArea>
  );
}

// ── Main Card Content ───────────────────────────────────────────────────────

export function CampaignEditorCardContent() {
  const {
    campaigns,
    nodePositions,
    setNodePosition,
    addNode,
    removeNode,
    addConnection,
    removeConnection,
    requestedEditorCampaignId,
    clearEditorRequest,
  } = useCampaignStore();

  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Auto-navigate when another component requests opening a specific campaign
  React.useEffect(() => {
    if (requestedEditorCampaignId) {
      const exists = campaigns.some((c) => c.id === requestedEditorCampaignId);
      if (exists) {
        setEditingCampaignId(requestedEditorCampaignId);
        setSelectedNodeId(null);
      }
      clearEditorRequest();
    }
  }, [requestedEditorCampaignId, campaigns, clearEditorRequest]);

  const editingCampaign = editingCampaignId ? campaigns.find((c) => c.id === editingCampaignId) : null;

  const handleBack = () => {
    setEditingCampaignId(null);
    setSelectedNodeId(null);
  };

  const handleAddNode = (typeId: string) => {
    if (!editingCampaignId) return;
    const id = `scene-${Date.now()}`;
    const positions = nodePositions[editingCampaignId] || {};
    const count = Object.keys(positions).length;
    const node: BaseFlowNode = {
      id,
      nodeData: { name: `New Scene`, gridWidth: 1, gridHeight: 1, terrain: [], deploymentZone: { minX: 0, maxX: 1, minY: 0, maxY: 1 }, objectives: [] },
      nodeType: typeId as any,
      nextOnSuccess: [],
      nextOnFailure: 'end',
      prerequisites: [],
      customData: {},
    };
    addNode(editingCampaignId, node);
    setNodePosition(editingCampaignId, id, { x: 100 + count * 220, y: 100 + (count % 3) * 120 });
    setSelectedNodeId(id);
  };

  const handleRemoveNode = () => {
    if (!editingCampaignId || !selectedNodeId) return;
    removeNode(editingCampaignId, selectedNodeId);
    setSelectedNodeId(null);
  };

  if (!editingCampaign) {
    return <ScenarioListView onSelect={(id) => setEditingCampaignId(id)} />;
  }

  const positions = nodePositions[editingCampaignId!] || {};
  const selectedNode = editingCampaign.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex flex-col h-full">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium truncate flex-1">{editingCampaign.name}</span>
        <Badge variant="outline" className="text-[10px]">{editingCampaign.nodes.length} scenes</Badge>

        {/* Add node buttons */}
        {MAGEHAND_NODE_TYPE_CONFIGS.map((cfg) => (
          <Button
            key={cfg.id}
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => handleAddNode(cfg.id)}
            title={`Add ${cfg.label}`}
          >
            {NODE_TYPE_ICONS[cfg.id]}
          </Button>
        ))}

        {selectedNodeId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive"
            onClick={handleRemoveNode}
            title="Delete selected node"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Content area: flow canvas + optional property panel */}
      <div className="flex flex-1 min-h-0">
        <div className={selectedNode ? 'flex-1' : 'w-full'} style={{ minHeight: 200 }}>
          <GenericFlowCanvas
            nodes={editingCampaign.nodes}
            positions={positions}
            selectedNodeId={selectedNodeId}
            startNodeId={editingCampaign.startNodeId}
            adapter={adapter}
            onNodeSelect={setSelectedNodeId}
            onNodeMove={(nodeId, pos) => setNodePosition(editingCampaignId!, nodeId, pos)}
            onConnectionCreate={(src, tgt, type) => addConnection(editingCampaignId!, src, tgt, type)}
            onConnectionDelete={(src, tgt, type) => removeConnection(editingCampaignId!, src, tgt, type)}
          />
        </div>

        {selectedNode && (
          <div className="w-[260px] border-l border-border shrink-0">
            <NodePropertyPanel campaignId={editingCampaignId!} node={selectedNode} />
          </div>
        )}
      </div>
    </div>
  );
}
