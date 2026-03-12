import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ArrowLeft, Users } from 'lucide-react';
import { useTokenGroupStore, Formation, FORMATION_LABELS, FORMATION_DESCRIPTIONS, getFormationOffsets, type TokenGroup } from '@/stores/tokenGroupStore';
import { useSessionStore } from '@/stores/sessionStore';
import { toast } from 'sonner';

// ============= Formation Preview =============

function FormationPreview({ formation, count }: { formation: Formation; count: number }) {
  const displayCount = Math.max(count, 3); // Show at least 3 dots for preview
  const offsets = getFormationOffsets(formation, displayCount);
  const size = 80;
  const dotR = 4;

  // Normalize offsets to fit within the preview box
  const minX = Math.min(...offsets.map((o) => o.dx));
  const maxX = Math.max(...offsets.map((o) => o.dx));
  const minY = Math.min(...offsets.map((o) => o.dy));
  const maxY = Math.max(...offsets.map((o) => o.dy));
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = Math.min((size - dotR * 4) / rangeX, (size - dotR * 4) / rangeY);

  return (
    <svg width={size} height={size} className="border border-border rounded bg-muted/30">
      {offsets.map((o, i) => {
        const cx = size / 2 + (o.dx - (minX + maxX) / 2) * scale;
        const cy = size / 2 + (o.dy - (minY + maxY) / 2) * scale;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={i === 0 ? dotR + 1 : dotR}
            className={i === 0 ? 'fill-primary' : 'fill-muted-foreground'}
            opacity={i === 0 ? 1 : 0.6}
          />
        );
      })}
    </svg>
  );
}

// ============= Group List View =============

function GroupListView({ onSelect, onCreate }: { onSelect: (id: string) => void; onCreate: () => void }) {
  const groups = useTokenGroupStore((s) => s.groups);
  const tokens = useSessionStore((s) => s.tokens);

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-foreground">Token Groups</span>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCreate}>
          <Plus className="h-3 w-3 mr-1" />
          New Group
        </Button>
      </div>

      <Separator />

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
          <Users className="h-8 w-8 opacity-40" />
          <p>No token groups yet</p>
          <p className="text-xs">Create groups like "The Party" or "Goblin Patrol"</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 pr-2">
            {groups.map((group) => {
              const memberCount = group.tokenIds.filter((id) =>
                tokens.some((t) => t.id === id)
              ).length;
              return (
                <button
                  key={group.id}
                  onClick={() => onSelect(group.id)}
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent text-left w-full transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: group.color || 'hsl(var(--primary))' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{group.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {memberCount} token{memberCount !== 1 ? 's' : ''} · {FORMATION_LABELS[group.formation]}
                    </div>
                  </div>
                  <FormationPreview formation={group.formation} count={memberCount} />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ============= Group Editor View =============

function GroupEditorView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const group = useTokenGroupStore((s) => s.groups.find((g) => g.id === groupId));
  const { updateGroup, removeGroup, addTokensToGroup, removeTokenFromGroup, setFormation } =
    useTokenGroupStore();
  const tokens = useSessionStore((s) => s.tokens);

  if (!group) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Group not found.{' '}
        <Button variant="link" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  const memberTokens = tokens.filter((t) => group.tokenIds.includes(t.id));
  const availableTokens = tokens.filter((t) => !group.tokenIds.includes(t.id));

  const handleDelete = () => {
    removeGroup(groupId);
    toast.success(`Deleted group "${group.name}"`);
    onBack();
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onBack}>
          <ArrowLeft className="h-3 w-3" />
        </Button>
        <span className="text-sm font-medium text-foreground flex-1 truncate">{group.name}</span>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={handleDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 pr-2">
          {/* Name */}
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={group.name}
              onChange={(e) => updateGroup(groupId, { name: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          {/* Color */}
          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={group.color || '#3b82f6'}
                onChange={(e) => updateGroup(groupId, { color: e.target.value })}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">Badge & identifier color</span>
            </div>
          </div>

          <Separator />

          {/* Formation */}
          <div className="space-y-2">
            <Label className="text-xs">Formation</Label>
            <div className="flex items-start gap-3">
              <FormationPreview formation={group.formation} count={group.tokenIds.length} />
              <div className="flex-1 space-y-1">
                <Select
                  value={group.formation}
                  onValueChange={(v) => setFormation(groupId, v as Formation)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FORMATION_LABELS) as Formation[]).map((f) => (
                      <SelectItem key={f} value={f}>
                        {FORMATION_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {FORMATION_DESCRIPTIONS[group.formation]}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Members */}
          <div className="space-y-2">
            <Label className="text-xs">
              Members ({memberTokens.length})
            </Label>
            {memberTokens.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No tokens in this group yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {memberTokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/50 text-sm"
                  >
                    {token.imageUrl ? (
                      <img
                        src={token.imageUrl}
                        alt={token.name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full"
                        style={{ backgroundColor: token.color || 'hsl(var(--muted-foreground))' }}
                      />
                    )}
                    <span className="flex-1 truncate">{token.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {token.roleId}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeTokenFromGroup(groupId, token.id)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Tokens */}
          {availableTokens.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Add Tokens</Label>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {availableTokens.map((token) => (
                  <button
                    key={token.id}
                    onClick={() => addTokensToGroup(groupId, [token.id])}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm text-left w-full transition-colors"
                  >
                    {token.imageUrl ? (
                      <img
                        src={token.imageUrl}
                        alt={token.name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full"
                        style={{ backgroundColor: token.color || 'hsl(var(--muted-foreground))' }}
                      />
                    )}
                    <span className="flex-1 truncate">{token.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {token.roleId}
                    </Badge>
                    <Plus className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============= Main Card Content =============

export function TokenGroupManagerCardContent() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const addGroup = useTokenGroupStore((s) => s.addGroup);

  const handleCreate = () => {
    const newGroup = addGroup('New Group');
    setSelectedGroupId(newGroup.id);
    toast.success('Created new token group');
  };

  if (selectedGroupId) {
    return (
      <GroupEditorView groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />
    );
  }

  return <GroupListView onSelect={setSelectedGroupId} onCreate={handleCreate} />;
}
