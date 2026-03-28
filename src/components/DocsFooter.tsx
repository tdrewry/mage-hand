import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen, Shield } from 'lucide-react';
import { DocViewerModal, type DocEntry } from '@/components/modals/DocViewerModal';
import { USER_GUIDE_MARKDOWN } from '@/lib/handouts/userGuide';
import { DM_GUIDE_MARKDOWN } from '@/lib/handouts/dmGuide';

interface DocsFooterProps {
  /** Extra buttons to render in the left slot, before the doc links */
  leftSlot?: React.ReactNode;
  /** Extra buttons to render in the right slot */
  rightSlot?: React.ReactNode;
  /** Class applied to the outer wrapper div */
  className?: string;
}

const USER_GUIDE_DOC: DocEntry = {
  id: 'user-guide',
  title: 'Magehand User Guide',
  markdown: USER_GUIDE_MARKDOWN,
  icon: <BookOpen className="w-4 h-4 text-primary" />,
};

const DM_GUIDE_DOC: DocEntry = {
  id: 'dm-guide',
  title: 'Magehand Host & DM Guide',
  markdown: DM_GUIDE_MARKDOWN,
  icon: <Shield className="w-4 h-4 text-primary" />,
};

/**
 * Shared docs footer used on the landing screen (both the identity step
 * and the action hub step).
 *
 * Layout (single row, justify-between):
 *   LEFT  [leftSlot items] | User Guide  Host & DM Guide
 *   RIGHT [rightSlot items]
 *
 * Doc links open DocViewerModal; closing it returns to the exact UI location.
 */
export function DocsFooter({ leftSlot, rightSlot, className }: DocsFooterProps) {
  const [activeDoc, setActiveDoc] = useState<DocEntry | null>(null);

  return (
    <>
      <div
        className={`
          bg-black/20 border-t border-white/5 px-4 py-2
          flex items-center justify-between gap-1 overflow-hidden
          ${className ?? ''}
        `}
      >
        {/* Left group: caller buttons + single separator + doc links — all on one row */}
        <div className="flex items-center gap-1 min-w-0">
          {leftSlot}

          {/* Single separator between leftSlot and doc links */}
          {leftSlot && <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block shrink-0" />}

          <Button
            id="docs-user-guide-btn"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setActiveDoc(USER_GUIDE_DOC)}
          >
            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
            User Guide
          </Button>

          <Button
            id="docs-dm-guide-btn"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setActiveDoc(DM_GUIDE_DOC)}
          >
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Host &amp; DM Guide
          </Button>
        </div>

        {/* Right group: pinned to the far right on the same row */}
        {rightSlot && (
          <div className="flex items-center gap-1 shrink-0">
            {rightSlot}
          </div>
        )}
      </div>

      {/* Doc viewer — renders on top of whatever opened it */}
      <DocViewerModal
        open={activeDoc !== null}
        onOpenChange={(open) => { if (!open) setActiveDoc(null); }}
        doc={activeDoc}
      />
    </>
  );
}
