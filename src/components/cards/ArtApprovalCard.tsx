import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Check, X, Trash2, Image as ImageIcon } from 'lucide-react';
import { useArtSubmissionStore, type ArtSubmission } from '@/stores/artSubmissionStore';
import {
  emitArtAccepted,
  emitArtRejected,
} from '@/lib/net/ephemeral/miscHandlers';

function SubmissionItem({ submission }: { submission: ArtSubmission }) {
  const acceptSubmission = useArtSubmissionStore((s) => s.acceptSubmission);
  const rejectSubmission = useArtSubmissionStore((s) => s.rejectSubmission);
  const removeSubmission = useArtSubmissionStore((s) => s.removeSubmission);

  const handleAccept = () => {
    acceptSubmission(submission.id);
    emitArtAccepted({
      id: submission.id,
      targetType: submission.targetType,
      targetId: submission.targetId,
      textureHash: submission.textureHash,
      textureDataUrl: submission.textureDataUrl,
    });
  };

  const handleReject = () => {
    rejectSubmission(submission.id);
    emitArtRejected(submission.id);
  };

  const statusColors = {
    pending: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
    accepted: 'bg-primary/20 text-primary border-primary/30',
    rejected: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  return (
    <div className="rounded-lg border border-border bg-card/50 p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded border border-border bg-muted shrink-0 overflow-hidden">
          {submission.textureDataUrl ? (
            <img
              src={submission.textureDataUrl}
              alt="Submission preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-foreground truncate">
              {submission.playerName}
            </span>
            <Badge
              variant="outline"
              className={`text-[9px] h-4 px-1 ${statusColors[submission.status]}`}
            >
              {submission.status}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground truncate">
            → {submission.targetType}: {submission.targetName}
          </p>
          <p className="text-[9px] text-muted-foreground/60">
            {new Date(submission.submittedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Actions */}
        {submission.status === 'pending' ? (
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/20"
              onClick={handleAccept}
              title="Accept"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/20"
              onClick={handleReject}
              title="Reject"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={() => removeSubmission(submission.id)}
            title="Dismiss"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export const ArtApprovalCardContent: React.FC = () => {
  const submissions = useArtSubmissionStore((s) => s.submissions);
  const clearResolved = useArtSubmissionStore((s) => s.clearResolved);

  const pending = useMemo(
    () => submissions.filter((s) => s.status === 'pending'),
    [submissions]
  );
  const resolved = useMemo(
    () => submissions.filter((s) => s.status !== 'pending'),
    [submissions]
  );

  const handleAcceptAll = () => {
    const store = useArtSubmissionStore.getState();
    for (const sub of pending) {
      store.acceptSubmission(sub.id);
      emitArtAccepted({
        id: sub.id,
        targetType: sub.targetType,
        targetId: sub.targetId,
        textureHash: sub.textureHash,
        textureDataUrl: sub.textureDataUrl,
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header actions */}
      {pending.length > 0 && (
        <div className="p-2 flex items-center gap-2 border-b border-border">
          <Badge variant="secondary" className="text-xs">
            {pending.length} pending
          </Badge>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={handleAcceptAll}
          >
            <Check className="h-3 w-3 mr-1" />
            Accept All
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-2">
          {submissions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ImageIcon className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-xs">No art submissions</p>
              <p className="text-[10px] opacity-60">
                Player art submissions will appear here for your review
              </p>
            </div>
          )}

          {/* Pending first */}
          {pending.map((sub) => (
            <SubmissionItem key={sub.id} submission={sub} />
          ))}

          {/* Resolved */}
          {resolved.length > 0 && pending.length > 0 && (
            <Separator className="my-2" />
          )}
          {resolved.map((sub) => (
            <SubmissionItem key={sub.id} submission={sub} />
          ))}

          {resolved.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-[10px] text-muted-foreground h-6"
              onClick={clearResolved}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear resolved
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
