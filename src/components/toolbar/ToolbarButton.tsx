import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type ToolbarButtonVariant = 'default' | 'ghost' | 'active' | 'destructive';
export type ToolbarButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: ToolbarButtonVariant;
  size?: ToolbarButtonSize;
  disabled?: boolean;
  isActive?: boolean;
  className?: string;
  tooltipSide?: TooltipSide;
}

const sizeStyles: Record<ToolbarButtonSize, string> = {
  xs: 'w-7 h-7',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
};

const iconSizeStyles: Record<ToolbarButtonSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const variantStyles: Record<ToolbarButtonVariant, string> = {
  default: 'bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted/80',
  ghost: 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
  active: 'bg-accent text-accent-foreground border-accent hover:bg-accent/90',
  destructive: 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90',
};

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  isActive = false,
  className,
  tooltipSide = 'right',
}) => {
  const effectiveVariant = isActive ? 'active' : variant;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }}
          disabled={disabled}
          className={cn(
            'rounded-full flex items-center justify-center transition-all border-2',
            sizeStyles[size],
            variantStyles[effectiveVariant],
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <Icon className={iconSizeStyles[size]} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
};
