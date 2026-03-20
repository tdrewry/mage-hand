/**
 * ColorPicker — shared color input with optional alpha (opacity) support.
 *
 * Accepts any CSS color string (hex3/6/8, rgba()), emits rgba() when
 * showAlpha=true or hex when showAlpha is false/undefined.
 *
 * Usage:
 *   <ColorPicker value={color} onChange={setColor} showAlpha />
 */
import React, { useCallback, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

// ─── Utilities ────────────────────────────────────────────────────────────────

export interface RgbaColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

/** Parse any CSS color string into RGBA components. Falls back to opaque black on failure. */
export function parseColorToRgba(color: string): RgbaColor {
  if (!color) return { r: 0, g: 0, b: 0, a: 1 };

  // rgba(...) or rgb(...)
  const rgbaMatch = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    return {
      r: Math.round(Number(rgbaMatch[1])),
      g: Math.round(Number(rgbaMatch[2])),
      b: Math.round(Number(rgbaMatch[3])),
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }

  // Hex — strip #
  const hex = color.replace('#', '');
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
      a: 1,
    };
  }
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  if (hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: parseInt(hex.slice(6, 8), 16) / 255,
    };
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

/** Serialize RGBA to a CSS rgba() string for Canvas / inline style use. */
export function rgbaToString({ r, g, b, a }: RgbaColor): string {
  return `rgba(${r},${g},${b},${+a.toFixed(3)})`;
}

/** Serialize RGBA to a hex string (6-char when α=1, 8-char otherwise). */
export function rgbaToHex({ r, g, b, a }: RgbaColor): string {
  const hex6 = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  if (a >= 1) return hex6;
  return hex6 + Math.round(a * 255).toString(16).padStart(2, '0');
}

/** Extract only the 6-char hex (opaque) for feeding into <input type="color">. */
function toHex6({ r, g, b }: RgbaColor): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ColorPickerProps {
  /** CSS color string — hex3/6/8 or rgba() */
  value: string;
  /** Called with rgba() string when showAlpha=true; hex string otherwise */
  onChange: (value: string) => void;
  /** Show the alpha (opacity) slider. Default false. */
  showAlpha?: boolean;
  /** Optional label rendered above the swatch. */
  label?: string;
  className?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  showAlpha = false,
  label,
  className = '',
}) => {
  const parsed = useMemo(() => parseColorToRgba(value), [value]);
  const hex6 = useMemo(() => toHex6(parsed), [parsed]);
  const alphaPercent = Math.round(parsed.a * 100);

  const emit = useCallback((next: RgbaColor) => {
    onChange(showAlpha ? rgbaToString(next) : toHex6(next));
  }, [onChange, showAlpha]);

  const onHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextHex = parseColorToRgba(e.target.value);
    emit({ ...nextHex, a: parsed.a });
  };

  const onAlphaChange = ([v]: number[]) => {
    emit({ ...parsed, a: v / 100 });
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <Label className="text-[10px]">{label}</Label>}

      <div className="flex items-center gap-2">
        {/* Checkerboard backdrop so transparency is visible */}
        <div
          className="relative h-7 w-10 rounded border border-border overflow-hidden flex-shrink-0"
          style={{
            backgroundImage:
              'linear-gradient(45deg,#888 25%,transparent 25%),' +
              'linear-gradient(-45deg,#888 25%,transparent 25%),' +
              'linear-gradient(45deg,transparent 75%,#888 75%),' +
              'linear-gradient(-45deg,transparent 75%,#888 75%)',
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0,0 4px,4px -4px,-4px 0',
          }}
        >
          {/* Colored overlay */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: rgbaToString(parsed) }}
          />
          {/* Native color wheel — invisible but full-area clickable */}
          <input
            type="color"
            value={hex6}
            onChange={onHexChange}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            title="Pick color"
          />
        </div>

        {/* Hex display */}
        <span className="text-[10px] text-muted-foreground font-mono min-w-[64px]">
          {showAlpha ? rgbaToString(parsed) : hex6}
        </span>
      </div>

      {/* Alpha slider */}
      {showAlpha && (
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">Opacity</Label>
            <span className="text-[10px] text-muted-foreground">{alphaPercent}%</span>
          </div>
          {/* Gradient track showing transparency */}
          <div
            className="relative h-2 rounded-full"
            style={{
              backgroundImage: `linear-gradient(to right, transparent, ${hex6}),` +
                'linear-gradient(45deg,#888 25%,transparent 25%),' +
                'linear-gradient(-45deg,#888 25%,transparent 25%),' +
                'linear-gradient(45deg,transparent 75%,#888 75%),' +
                'linear-gradient(-45deg,transparent 75%,#888 75%)',
              backgroundSize: 'auto,8px 8px,8px 8px,8px 8px,8px 8px',
            }}
          />
          <Slider
            value={[alphaPercent]}
            onValueChange={onAlphaChange}
            min={0}
            max={100}
            step={1}
            className="-mt-2"
          />
        </div>
      )}
    </div>
  );
};
