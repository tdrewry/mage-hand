import React, { lazy, Suspense, useState } from 'react';
import { BookOpen, Shield, FileText, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { BUILTIN_HANDOUTS, type HandoutEntry } from '@/lib/handouts';
import { useHandoutStore } from '@/stores/handoutStore';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { toast } from 'sonner';

const ICON_MAP: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen className="h-4 w-4" />,
  Shield: <Shield className="h-4 w-4" />,
};

function getIcon(name: string) {
  return ICON_MAP[name] ?? <FileText className="h-4 w-4" />;
}

export const HandoutCatalogCardContent: React.FC = () => {
  const registerCard = useCardStore((s) => s.registerCard);
  const cards = useCardStore((s) => s.cards);
  const setVisibility = useCardStore((s) => s.setVisibility);

  const customHandouts = useHandoutStore((s) => s.customHandouts);
  const addHandout = useHandoutStore((s) => s.addHandout);
  const updateHandout = useHandoutStore((s) => s.updateHandout);
  const deleteHandout = useHandoutStore((s) => s.deleteHandout);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMarkdown, setEditMarkdown] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const openHandout = (entry: HandoutEntry) => {
    const existing = cards.find(
      (c) => c.type === CardType.HANDOUT_VIEWER && c.metadata?.handoutId === entry.id
    );
    if (existing) {
      setVisibility(existing.id, true);
      return;
    }

    registerCard({
      type: CardType.HANDOUT_VIEWER,
      title: entry.title,
      defaultPosition: {
        x: Math.min(window.innerWidth - 520, 380),
        y: 60,
      },
      defaultSize: { width: 500, height: 650 },
      minSize: { width: 360, height: 400 },
      isResizable: true,
      isClosable: true,
      defaultVisible: true,
      metadata: { handoutId: entry.id },
    });
  };

  const handleNew = () => {
    setEditingId(null);
    setEditTitle('');
    setEditMarkdown('');
    setShowPreview(false);
    setEditorOpen(true);
  };

  const handleEdit = (entry: HandoutEntry) => {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditMarkdown(entry.markdown);
    setShowPreview(false);
    setEditorOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteHandout(id);
    toast.success('Handout deleted');
  };

  const handleSave = () => {
    const title = editTitle.trim();
    if (!title) {
      toast.error('Title is required');
      return;
    }
    if (editingId) {
      updateHandout(editingId, { title, markdown: editMarkdown });
      toast.success('Handout updated');
    } else {
      addHandout(title, editMarkdown);
      toast.success('Handout created');
    }
    setEditorOpen(false);
  };

  const renderEntry = (entry: HandoutEntry, isCustom: boolean) => {
    const isOpen = cards.some(
      (c) =>
        c.type === CardType.HANDOUT_VIEWER &&
        c.metadata?.handoutId === entry.id &&
        c.isVisible
    );

    return (
      <div key={entry.id} className="flex items-center gap-1">
        <Button
          variant={isOpen ? 'default' : 'outline'}
          size="sm"
          className="flex-1 justify-start gap-2"
          onClick={() => openHandout(entry)}
        >
          {getIcon(entry.icon)}
          <span className="flex-1 text-left truncate">{entry.title}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5">
            {entry.category}
          </Badge>
        </Button>
        {isCustom && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleEdit(entry)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive"
              onClick={() => handleDelete(entry.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">
              Browse guides and reference documents.
            </p>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleNew}>
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>

          {BUILTIN_HANDOUTS.map((entry) => renderEntry(entry, false))}

          {customHandouts.length > 0 && (
            <>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground font-medium">Custom Handouts</p>
              {customHandouts.map((entry) => renderEntry(entry, true))}
            </>
          )}
        </div>
      </ScrollArea>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Handout' : 'New Handout'}</DialogTitle>
            <DialogDescription>
              Create lore documents, session notes, or reference material to share with players.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Handout title..."
                className="h-8 text-sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Content (Markdown)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showPreview ? 'Edit' : 'Preview'}
              </Button>
            </div>

            {showPreview ? (
              <ScrollArea className="flex-1 min-h-[250px] max-h-[400px] border rounded-md p-3">
                {editMarkdown.trim() ? (
                  <MarkdownRenderer content={editMarkdown} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nothing to preview.</p>
                )}
              </ScrollArea>
            ) : (
              <Textarea
                value={editMarkdown}
                onChange={(e) => setEditMarkdown(e.target.value)}
                placeholder="Write your handout content in markdown..."
                className="flex-1 min-h-[250px] max-h-[400px] text-sm font-mono resize-none"
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              {editingId ? 'Save Changes' : 'Create Handout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
