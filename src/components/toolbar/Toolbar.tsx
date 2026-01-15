import React from 'react';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/zIndex';

export type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right';

interface ToolbarProps {
  position: ToolbarPosition;
  children: React.ReactNode;
  className?: string;
}

const positionStyles: Record<ToolbarPosition, string> = {
  top: 'top-4 left-1/2 -translate-x-1/2 flex-row',
  bottom: 'bottom-4 left-1/2 -translate-x-1/2 flex-row',
  left: 'left-4 top-1/2 -translate-y-1/2 flex-col',
  right: 'right-4 top-1/2 -translate-y-1/2 flex-col',
};

export const Toolbar: React.FC<ToolbarProps> = ({
  position,
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'fixed flex items-center gap-2 bg-background/95 backdrop-blur border border-border rounded-full px-3 py-2 shadow-lg',
        positionStyles[position],
        className
      )}
      style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
    >
      {children}
    </div>
  );
};
