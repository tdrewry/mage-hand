/**
 * CampaignEditorCard — Campaign list/create + flow canvas + node property panel.
 * DM-only card for authoring branching story campaigns.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Play, ArrowLeft, AlertTriangle, Swords, ScrollText, MessageSquare, Tent } from 'lucide-react';
import { useCampaignStore } from '@/stores/campaignStore';
import { useMapStore } from '@/stores/mapStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
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

// ── Campaign List View ──────────────────────────────────────────────────────

function CampaignListView({ onSelect }: { onSelect: (id: string) => void }) {
  const { campaigns, addCampaign, removeCampaign } = useCampaignStore();
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    const name = newName.trim() || 'Untitled Campaign';
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
    // Set default position for start node
    useCampaignStore.getState().setNodePosition(campaign.id, startNodeId, { x: 100, y: 100 });
    setNewName('');
    onSelect(campaign.id);
  };

  return (
    <div className="p-3 space-y-3">
      <p className="text-xs text-muted-foreground">Create or load a campaign</p>
      <div className="flex gap-2">
        <Input
          placeholder="Campaign name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="text-sm"
        />
        <Button size="sm" onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </div>
      <Separator />
      {campaigns.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No campaigns yet</p>
      ) : (
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => onSelect(c.id)}
              >
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.nodes.length} scene{c.nodes.length !== 1 ? 's' : ''}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); removeCampaign(c.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
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
  const { updateNode } = useCampaignStore();
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
                        {z.deploymentZoneLabel || z.name || z.id}
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

            <div className="space-y-1.5">
              <Label className="text-xs">Token Group (optional)</Label>
              <Input
                value={customData.tokenGroupId as string || ''}
                onChange={(e) => updateCustom('tokenGroupId', e.target.value)}
                placeholder="Group or role name..."
                className="text-sm h-8"
              />
            </div>
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
    activeCampaignId,
    setActiveCampaign,
    nodePositions,
    setNodePosition,
    addNode,
    removeNode,
    addConnection,
    removeConnection,
  } = useCampaignStore();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId);

  const handleBack = () => {
    setActiveCampaign(null);
    setSelectedNodeId(null);
  };

  const handleAddNode = (typeId: string) => {
    if (!activeCampaignId) return;
    const id = `scene-${Date.now()}`;
    const positions = nodePositions[activeCampaignId] || {};
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
    addNode(activeCampaignId, node);
    setNodePosition(activeCampaignId, id, { x: 100 + count * 220, y: 100 + (count % 3) * 120 });
    setSelectedNodeId(id);
  };

  const handleRemoveNode = () => {
    if (!activeCampaignId || !selectedNodeId) return;
    removeNode(activeCampaignId, selectedNodeId);
    setSelectedNodeId(null);
  };

  if (!activeCampaign) {
    return <CampaignListView onSelect={(id) => setActiveCampaign(id)} />;
  }

  const positions = nodePositions[activeCampaignId!] || {};
  const selectedNode = activeCampaign.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex flex-col h-full">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium truncate flex-1">{activeCampaign.name}</span>
        <Badge variant="outline" className="text-[10px]">{activeCampaign.nodes.length} scenes</Badge>

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
            nodes={activeCampaign.nodes}
            positions={positions}
            selectedNodeId={selectedNodeId}
            startNodeId={activeCampaign.startNodeId}
            adapter={adapter}
            onNodeSelect={setSelectedNodeId}
            onNodeMove={(nodeId, pos) => setNodePosition(activeCampaignId!, nodeId, pos)}
            onConnectionCreate={(src, tgt, type) => addConnection(activeCampaignId!, src, tgt, type)}
            onConnectionDelete={(src, tgt, type) => removeConnection(activeCampaignId!, src, tgt, type)}
          />
        </div>

        {selectedNode && (
          <div className="w-[260px] border-l border-border shrink-0">
            <NodePropertyPanel campaignId={activeCampaignId!} node={selectedNode} />
          </div>
        )}
      </div>
    </div>
  );
}
