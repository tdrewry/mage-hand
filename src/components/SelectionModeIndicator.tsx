import React from "react";
import { Square, CircleDot } from "lucide-react";
import { Z_INDEX } from "../lib/zIndex";

interface SelectionModeIndicatorProps {
  selectedRegionCount: number;
  selectedTokenCount: number;
}

export const SelectionModeIndicator: React.FC<SelectionModeIndicatorProps> = ({
  selectedRegionCount,
  selectedTokenCount,
}) => {
  // Don't show if nothing is selected
  if (selectedRegionCount === 0 && selectedTokenCount === 0) {
    return null;
  }

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-4 py-2 shadow-lg select-none"
      style={{ zIndex: Z_INDEX.FIXED_UI.FLOATING_MENUS }}
    >
      {selectedRegionCount > 0 && (
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Square className="h-4 w-4 text-primary" />
          <span>
            {selectedRegionCount} region{selectedRegionCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      
      {selectedRegionCount > 0 && selectedTokenCount > 0 && (
        <div className="w-px h-4 bg-border" />
      )}
      
      {selectedTokenCount > 0 && (
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CircleDot className="h-4 w-4 text-accent" />
          <span>
            {selectedTokenCount} token{selectedTokenCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      
      <div className="text-xs text-muted-foreground ml-2">
        Press Esc to deselect
      </div>
    </div>
  );
};
