import React from 'react';
import { cn } from '@/lib/utils';

interface ToolbarSeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const ToolbarSeparator: React.FC<ToolbarSeparatorProps> = ({
  orientation = 'vertical',
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-border',
        orientation === 'vertical' ? 'w-px h-8' : 'h-px w-8',
        className
      )}
    />
  );
};
