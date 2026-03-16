import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { NumericInput } from '@/components/ui/numeric-input';
import { toast } from 'sonner';
import {
  type Token,
  type LabelPosition,
  type PathStyle,
  type FootprintType,
  type AppearanceVariant,
  useSessionStore
} from '@/stores/sessionStore';
import { FOOTPRINT_TYPES, PATH_STYLES } from '@/lib/footprintShapes';
import { TokenPathPreviewCanvas } from '../TokenPathPreviewCanvas';
import { ImageImportModal, type ImageImportResult } from './ImageImportModal';
import {
  Bookmark,
  Footprints,
  Upload,
  X,
  Plus,
  Save,
  Dices
} from 'lucide-react';
import { useTextureLoader } from '@/hooks/useTextureLoader';

// Label style presets - each has a text color and background color
const labelStylePresets = [
  { name: 'Default', labelColor: '#FFFFFF', bgColor: 'rgba(30, 30, 30, 0.75)' },
  { name: 'Hostile', labelColor: '#FFFFFF', bgColor: 'rgba(180, 40, 40, 0.85)' },
  { name: 'Friendly', labelColor: '#FFFFFF', bgColor: 'rgba(40, 120, 40, 0.85)' },
  { name: 'Neutral', labelColor: '#FFFFFF', bgColor: 'rgba(40, 80, 140, 0.85)' },
  { name: 'Warning', labelColor: '#1a1a1a', bgColor: 'rgba(240, 180, 40, 0.9)' },
  { name: 'Stealth', labelColor: '#a0a0a0', bgColor: 'rgba(20, 20, 20, 0.6)' },
];

// Using standard random name generator functions
const ADJECTIVES = ['Ancient', 'Swift', 'Dark', 'Luminous', 'Silent', 'Fierce', 'Shadow', 'Crimson', 'Azure', 'Golden', 'Mystic', 'Crystal'];
const NOUNS = ['Wolf', 'Blade', 'Strider', 'Wind', 'Storm', 'Fang', 'Claw', 'Heart', 'Soul', 'Weaver', 'Walker', 'Dancer'];

export function generateFantasyName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

const SIZE_PRESETS = [
  { name: 'Tiny', gridWidth: 0.5, gridHeight: 0.5 },
  { name: 'Medium', gridWidth: 1, gridHeight: 1 },
  { name: 'Large', gridWidth: 2, gridHeight: 2 },
  { name: 'Huge', gridWidth: 3, gridHeight: 3 },
  { name: 'Gargantuan', gridWidth: 4, gridHeight: 4 },
];

interface TokenEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTokens: Token[];
  onUpdateCanvas?: () => void;
}

type TabType = 'label' | 'style' | 'appearance';

export function TokenEditModal({
  open,
  onOpenChange,
  targetTokens,
  onUpdateCanvas
}: TokenEditModalProps) {
  const isMultiSelection = targetTokens.length > 1;
  const currentToken = targetTokens.length === 1 ? targetTokens[0] : null;

  const [activeTab, setActiveTab] = useState<TabType>('label');
  const [randomizeNames, setRandomizeNames] = useState(false);

  const { saveTokenTexture } = useTextureLoader();

  // Field states
  const [nameValue, setNameValue] = useState('');
  const [labelValue, setLabelValue] = useState('');
  const [labelPositionValue, setLabelPositionValue] = useState<LabelPosition>('below');
  const [labelColorValue, setLabelColorValue] = useState('#FFFFFF');
  const [labelBackgroundValue, setLabelBackgroundValue] = useState('#00000080');
  const [tokenColorValue, setTokenColorValue] = useState('#FF6B6B');
  
  // Path styles
  const [pathStyleValue, setPathStyleValue] = useState<PathStyle>('dashed');
  const [footprintTypeValue, setFootprintTypeValue] = useState<FootprintType>('barefoot');
  const [pathColorValue, setPathColorValue] = useState('#000000');
  const [useTokenColorForPath, setUseTokenColorForPath] = useState(true);
  const [pathWeightValue, setPathWeightValue] = useState(3);
  const [pathOpacityValue, setPathOpacityValue] = useState(0.5);
  const [pathGaitWidthValue, setPathGaitWidthValue] = useState(0.3);

  // Appearance
  const [imageUrlValue, setImageUrlValue] = useState('');
  const [imageHashValue, setImageHashValue] = useState<string | undefined>();
  const [imageScaleValue, setImageScaleValue] = useState(1);
  const [imageOffsetXValue, setImageOffsetXValue] = useState(0);
  const [imageOffsetYValue, setImageOffsetYValue] = useState(0);
  const [gridWidthValue, setGridWidthValue] = useState(1);
  const [gridHeightValue, setGridHeightValue] = useState(1);

  // Variants
  const [showSaveVariantInput, setShowSaveVariantInput] = useState(false);
  const [variantNameInput, setVariantNameInput] = useState('');

  // Image Import
  const [showImageImportModal, setShowImageImportModal] = useState(false);

  const handleImageImportConfirm = async (result: ImageImportResult) => {
    let hash = result.imageHash;
    if (!hash && result.imageUrl.startsWith('data:')) {
      if (currentToken) {
        hash = await saveTokenTexture(currentToken.id, result.imageUrl);
      }
    }

    setImageUrlValue(result.imageUrl);
    setImageHashValue(hash);
    setImageScaleValue(result.scale);
    setImageOffsetXValue(result.offsetX);
    setImageOffsetYValue(result.offsetY);
  };

  const handleImageImportMultipleConfirm = async (images: { url: string; hash?: string }[]) => {
    if (images.length === 0) return;
    
    // Pre-hash images that don't have a hash yet, to avoid OOM from hashing 2MB images 400 times
    // in the tight token assignment loop below.
    const processedImages = await Promise.all(images.map(async (img) => {
      if (img.hash) return img;
      if (img.url.startsWith('data:')) {
        // We use a dummy ID to run the texture save/hash logic ONCE per unique image.
        // It's safe since textureStorage deduplicates by hash anyway.
        const generatedHash = await saveTokenTexture(`batch-import-${Date.now()}-${Math.random()}`, img.url);
        return { ...img, hash: generatedHash };
      }
      return img;
    }));

    // Shuffle the pre-hashed images array
    const shuffledImages = [...processedImages].sort(() => Math.random() - 0.5);
    
    const updates: Partial<Token>[] = [];
    const ids = targetTokens.map(t => t.id);
    for (const t of targetTokens) {
      const index = ids.indexOf(t.id);
      const img = shuffledImages[index % shuffledImages.length];
      
      updates.push({ ...t, imageUrl: img.url, imageHash: img.hash });
    }

    // Update store directly for each token
    useSessionStore.setState((state) => ({
      tokens: state.tokens.map((t) => {
        const update = updates.find(u => u.id === t.id);
        if (update) {
          return { ...t, imageUrl: update.imageUrl, imageHash: update.imageHash };
        }
        return t;
      }),
    }));
    
    toast.success(`Assigned ${images.length} images across ${ids.length} tokens`);
    onUpdateCanvas?.();
  };

  const openImageImport = () => {
    setShowImageImportModal(true);
  };

  const prevOpenRef = useRef(false);
  const prevIdsRef = useRef("");

  // Reset state when tokens change or modal opens
  useEffect(() => {
    const currentIds = targetTokens.map(t => t.id).sort().join(',');
    const isNewSession = open && (!prevOpenRef.current || prevIdsRef.current !== currentIds);
    
    prevOpenRef.current = open;
    prevIdsRef.current = currentIds;

    if (isNewSession && targetTokens.length > 0) {
      setRandomizeNames(false);
      setActiveTab('label');
      
      if (isMultiSelection) {
        // Multi-select: start with empty/default values
        setNameValue('');
        setLabelValue('');
        // Take values from first token as baseline for style and appearance
        const t = targetTokens[0];
        setLabelPositionValue(t.labelPosition || 'below');
        setLabelColorValue(t.labelColor || '#FFFFFF');
        setLabelBackgroundValue(t.labelBackgroundColor || '#00000080');
        setTokenColorValue(t.color || '#FF6B6B');
        
        setPathStyleValue(t.pathStyle || 'dashed');
        setFootprintTypeValue(t.footprintType || 'barefoot');
        setPathColorValue(t.pathColor || '#000000');
        setUseTokenColorForPath(t.pathColor === undefined);
        setPathWeightValue(t.pathWeight ?? 3);
        setPathOpacityValue(t.pathOpacity ?? 0.5);
        setPathGaitWidthValue(t.pathGaitWidth ?? 0.3);

        setImageUrlValue(''); // Keep empty, handled separately
        setImageHashValue(undefined);
        setGridWidthValue(t.gridWidth || 1);
        setGridHeightValue(t.gridHeight || 1);
      } else if (currentToken) {
        // Single select: populate fields
        setNameValue(currentToken.name || '');
        setLabelValue(currentToken.label || '');
        setLabelPositionValue(currentToken.labelPosition || 'below');
        setLabelColorValue(currentToken.labelColor || '#FFFFFF');
        setLabelBackgroundValue(currentToken.labelBackgroundColor || '#00000080');
        setTokenColorValue(currentToken.color || '#FF6B6B');
        
        setPathStyleValue(currentToken.pathStyle || 'dashed');
        setFootprintTypeValue(currentToken.footprintType || 'barefoot');
        setPathColorValue(currentToken.pathColor || '#000000');
        setUseTokenColorForPath(currentToken.pathColor === undefined);
        setPathWeightValue(currentToken.pathWeight ?? 3);
        setPathOpacityValue(currentToken.pathOpacity ?? 0.5);
        setPathGaitWidthValue(currentToken.pathGaitWidth ?? 0.3);

        setImageUrlValue(currentToken.imageUrl || '');
        setImageHashValue(currentToken.imageHash);
        setImageScaleValue(currentToken.imageScale || 1);
        setImageOffsetXValue(currentToken.imageOffsetX || 0);
        setImageOffsetYValue(currentToken.imageOffsetY || 0);
        setGridWidthValue(currentToken.gridWidth || 1);
        setGridHeightValue(currentToken.gridHeight || 1);
      }
    }
  }, [open, targetTokens, isMultiSelection, currentToken]);

  const handleDieClick = () => {
    if (isMultiSelection) {
      setRandomizeNames((prev) => !prev);
    } else {
      const generated = generateFantasyName();
      setNameValue(generated);
      setLabelValue(generated);
    }
  };

  const handleClearImage = () => {
    setImageUrlValue('');
    setImageHashValue(undefined);
    if (!isMultiSelection && currentToken) {
      applyUpdatesToStore([currentToken.id], { imageUrl: '', imageHash: undefined });
    }
  };

  // Helper that batches zustand updates
  const applyUpdatesToStore = (ids: string[], updates: Partial<Token>) => {
    useSessionStore.setState((state) => ({
      tokens: state.tokens.map((t) => (ids.includes(t.id) ? { ...t, ...updates } : t)),
    }));
    onUpdateCanvas?.();
  };

  const applyChanges = () => {
    // When editing MULTIPLE tokens via the Apply button
    const ids = targetTokens.map((t) => t.id);
    
    // We construct the updates per token to handle randomizeNames
    useSessionStore.setState((state) => {
      return {
        tokens: state.tokens.map((t) => {
          if (ids.includes(t.id)) {
            let nextName = t.name;
            let nextLabel = t.label;

            if (randomizeNames) {
              const r = generateFantasyName();
              nextName = r;
              nextLabel = r;
            } else {
               if (nameValue !== '') nextName = nameValue;
               if (labelValue !== '') nextLabel = labelValue;
            }
            
            return {
              ...t,
              name: nextName,
              label: nextLabel,
              labelPosition: labelPositionValue,
              labelColor: labelColorValue,
              labelBackgroundColor: labelBackgroundValue,
              color: tokenColorValue,
              pathStyle: pathStyleValue,
              footprintType: footprintTypeValue,
              pathColor: useTokenColorForPath ? undefined : pathColorValue,
              pathWeight: pathWeightValue,
              pathOpacity: pathOpacityValue,
              pathGaitWidth: pathGaitWidthValue,
              gridWidth: gridWidthValue,
              gridHeight: gridHeightValue
            };
          }
          return t;
        })
      };
    });

    toast.success(`Updated ${targetTokens.length} token(s)`);
    onOpenChange(false);
    onUpdateCanvas?.();
  };

  const handleSaveVariant = () => {
     // TODO: move variant saving logic here or keep it simple for now
     // For this modal, it may be easier to extract just the ui 
     // since it requires `currentToken` which we have.
     if (!currentToken || !variantNameInput.trim()) return;

     const newVariant = {
        id: `variant-${Date.now()}`,
        name: variantNameInput.trim(),
        gridWidth: gridWidthValue,
        gridHeight: gridHeightValue,
        imageUrl: imageUrlValue,
        imageHash: imageHashValue,
        imageScale: imageScaleValue,
        imageOffsetX: imageOffsetXValue,
        imageOffsetY: imageOffsetYValue,
     };

     const updatedVariants = [...(currentToken.appearanceVariants || []), newVariant];

     applyUpdatesToStore([currentToken.id], {
       appearanceVariants: updatedVariants,
       activeVariantId: newVariant.id
     });

     setVariantNameInput('');
     setShowSaveVariantInput(false);
     toast.success(`Saved variant "${newVariant.name}"`);
  };

  // Debounced auto-save for single-token mode
  useEffect(() => {
     if (isMultiSelection || !open || !currentToken) return;
     const timeout = setTimeout(() => {
       applyUpdatesToStore([currentToken.id], {
         name: nameValue,
         label: labelValue,
         labelPosition: labelPositionValue,
         labelColor: labelColorValue,
         labelBackgroundColor: labelBackgroundValue,
         color: tokenColorValue,
         pathStyle: pathStyleValue,
         footprintType: footprintTypeValue,
         pathColor: useTokenColorForPath ? undefined : pathColorValue,
         pathWeight: pathWeightValue,
         pathOpacity: pathOpacityValue,
         pathGaitWidth: pathGaitWidthValue,
         gridWidth: gridWidthValue,
         gridHeight: gridHeightValue,
       });
     }, 300);
     return () => clearTimeout(timeout);
  }, [
    nameValue, labelValue, labelPositionValue, labelColorValue, labelBackgroundValue,
    tokenColorValue, pathStyleValue, footprintTypeValue, pathColorValue, useTokenColorForPath,
    pathWeightValue, pathOpacityValue, pathGaitWidthValue, gridWidthValue, gridHeightValue,
    isMultiSelection, open, currentToken?.id
  ]);

  const getCurrentSizePreset = () => {
    return SIZE_PRESETS.find(p => p.gridWidth === gridWidthValue && p.gridHeight === gridHeightValue);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) setShowSaveVariantInput(false);
    }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col pt-10">
        <DialogHeader>
          <DialogTitle>
            Edit Token{isMultiSelection ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {isMultiSelection
              ? `Edit properties for ${targetTokens.length} tokens`
              : 'Manage token label, appearance, and details'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="flex-1 overflow-hidden flex flex-col mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="label">Label</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="label" className="flex-1 overflow-y-auto space-y-4 mt-4 px-1">
            <div>
              <Label htmlFor="token-name">Token Name</Label>
              <div className="flex gap-2">
                <Input
                  id="token-name"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  placeholder={
                    isMultiSelection && randomizeNames
                      ? 'Names will be randomized'
                      : isMultiSelection
                      ? 'Enter name for all tokens'
                      : 'Enter token name'
                  }
                  disabled={randomizeNames}
                  className="flex-1"
                />
                <Button
                  variant={randomizeNames ? 'default' : 'outline'}
                  size="icon"
                  className="shrink-0"
                  onClick={handleDieClick}
                  title={isMultiSelection ? "Randomize names on save" : "Generate random name"}
                >
                  <Dices className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Internal identifier for the token</p>
            </div>
            <div>
              <Label htmlFor="token-label">Display Label</Label>
              <Input
                id="token-label"
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
                placeholder={isMultiSelection ? 'Enter label for all tokens' : 'Enter display label'}
                disabled={randomizeNames}
              />
              <p className="text-xs text-muted-foreground mt-1">Text displayed on/near the token</p>
            </div>
            <div>
              <Label>Label Position</Label>
              <div className="flex gap-2 mt-2">
                {(['above', 'center', 'below'] as LabelPosition[]).map((pos) => (
                  <Button
                    key={pos}
                    variant={labelPositionValue === pos ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLabelPositionValue(pos)}
                    className="flex-1 capitalize"
                  >
                    {pos}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Label Style</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {labelStylePresets.map((preset) => (
                  <button
                    key={preset.name}
                    className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                      labelColorValue === preset.labelColor && labelBackgroundValue === preset.bgColor
                        ? 'ring-2 ring-primary ring-offset-1'
                        : 'hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: preset.bgColor,
                      color: preset.labelColor,
                    }}
                    onClick={() => {
                      setLabelColorValue(preset.labelColor);
                      setLabelBackgroundValue(preset.bgColor);
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="style" className="flex-1 overflow-y-auto space-y-4 mt-4 px-1 pb-4">
            <div>
              <Label>Token Color</Label>
              <div className="flex gap-2 items-center mt-2">
                <Input
                  type="color"
                  value={tokenColorValue}
                  onChange={(e) => setTokenColorValue(e.target.value)}
                  className="w-14 h-10 p-1"
                />
                <span className="text-sm text-muted-foreground font-mono">
                  {tokenColorValue}
                </span>
              </div>
              <div className="grid grid-cols-8 gap-2 mt-2">
                {[
                  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
                  '#FFEAA7', '#DDA0DD', '#F8C471', '#85C1E9',
                  '#F1948A', '#82E0AA', '#BB8FCE', '#F7DC6F',
                  '#A9CCE3', '#98D8C8', '#F39C12', '#E74C3C'
                ].map((color) => (
                  <button
                    key={color}
                    className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                      tokenColorValue === color ? 'border-ring ring-2 ring-ring ring-offset-1' : 'border-border'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setTokenColorValue(color)}
                  />
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="flex items-center gap-1 mb-3">
                <Footprints className="h-3.5 w-3.5" />
                Movement Path
              </Label>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Style</Label>
                  <Select
                    value={pathStyleValue}
                    onValueChange={(v) => setPathStyleValue(v as PathStyle)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PATH_STYLES.map(({ style, label }) => (
                        <SelectItem key={style} value={style}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {pathStyleValue === 'footprint' && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Footprint Type</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {FOOTPRINT_TYPES.map(({ type, label, icon }) => (
                        <button
                          key={type}
                          className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                            footprintTypeValue === type
                              ? 'border-primary bg-primary/10 ring-1 ring-primary'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setFootprintTypeValue(type)}
                        >
                          <span className="text-xl">{icon}</span>
                          <span className="text-[10px] mt-1">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {pathStyleValue !== 'none' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Path Color</Label>
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={useTokenColorForPath}
                            onChange={(e) => setUseTokenColorForPath(e.target.checked)}
                            className="rounded"
                          />
                          Use token color
                        </label>
                      </div>
                      {!useTokenColorForPath && (
                        <div className="flex gap-2 items-center mt-2">
                          <Input
                            type="color"
                            value={pathColorValue}
                            onChange={(e) => setPathColorValue(e.target.value)}
                            className="w-14 h-8 p-1"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          {pathStyleValue === 'footprint' ? 'Footprint Size' : 'Line Weight'}
                        </Label>
                        <span className="text-xs font-mono">{pathWeightValue}</span>
                      </div>
                      <Slider
                        value={[pathWeightValue]}
                        onValueChange={(v) => setPathWeightValue(v[0])}
                        min={1}
                        max={5}
                        step={1}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Opacity</Label>
                        <span className="text-xs font-mono">{pathOpacityValue.toFixed(1)}</span>
                      </div>
                      <Slider
                        value={[pathOpacityValue]}
                        onValueChange={(v) => setPathOpacityValue(v[0])}
                        min={0.3}
                        max={1}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>
                    {pathStyleValue === 'footprint' && (
                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Gait Width</Label>
                          <span className="text-xs font-mono">{pathGaitWidthValue.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[pathGaitWidthValue]}
                          onValueChange={(v) => setPathGaitWidthValue(v[0])}
                          min={0.2}
                          max={1.0}
                          step={0.1}
                          className="mt-2"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {pathStyleValue !== 'none' && (
              <div className="border-t pt-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
                <TokenPathPreviewCanvas
                  pathStyle={pathStyleValue}
                  footprintType={footprintTypeValue}
                  pathColor={useTokenColorForPath ? tokenColorValue : pathColorValue}
                  pathWeight={pathWeightValue}
                  pathOpacity={pathOpacityValue}
                  pathGaitWidth={pathGaitWidthValue}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="appearance" className="flex-1 overflow-y-auto space-y-4 mt-4 px-1 pb-4">
            <div>
              <Label>Token Image</Label>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={openImageImport}>
                  <Upload className="mr-1 h-3 w-3" />
                  {imageUrlValue || isMultiSelection ? (isMultiSelection ? 'Assign Images' : 'Change Image') : 'Add Image'}
                </Button>
                {imageUrlValue && !isMultiSelection && (
                  <Button variant="ghost" size="sm" onClick={handleClearImage}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {imageUrlValue && !isMultiSelection && (
                <div className="mt-2 text-center">
                  <div className="border rounded-lg p-2 bg-muted/50 inline-flex justify-center items-center">
                    <div className="w-16 h-16 rounded-full overflow-hidden relative shadow-inner bg-black/20">
                      <img
                        src={imageUrlValue}
                        alt="Token preview"
                        className="w-full h-full object-cover"
                        style={{
                          transform: `translate(${((imageOffsetXValue || 0) * 100).toFixed(1)}%, ${((imageOffsetYValue || 0) * 100).toFixed(1)}%) scale(${imageScaleValue || 1})`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {isMultiSelection ? 'Select images to distribute among selected tokens' : 'Optional image for the token'}
              </p>
            </div>

            <div>
              <Label>Token Size</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {SIZE_PRESETS.map((preset) => {
                  const isSelected = gridWidthValue === preset.gridWidth && gridHeightValue === preset.gridHeight;
                  return (
                    <button
                      key={preset.name}
                      className={`px-2 py-2 rounded text-xs font-medium transition-all border ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1'
                          : 'border-border hover:border-primary/50 hover:bg-muted'
                      }`}
                      onClick={() => {
                        setGridWidthValue(preset.gridWidth);
                        setGridHeightValue(preset.gridHeight);
                      }}
                    >
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-muted-foreground">{preset.gridWidth}×{preset.gridHeight}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Custom:</span>
                <NumericInput
                  min={0.5}
                  step={0.5}
                  value={gridWidthValue}
                  onChange={(v) => setGridWidthValue(v)}
                  float
                  fallback={1}
                  className="w-16 h-8 text-center"
                />
                <span className="text-muted-foreground">×</span>
                <NumericInput
                  min={0.5}
                  step={0.5}
                  value={gridHeightValue}
                  onChange={(v) => setGridHeightValue(v)}
                  float
                  fallback={1}
                  className="w-16 h-8 text-center"
                />
                <span className="text-xs text-muted-foreground">grid units</span>
              </div>
            </div>
            
            {!isMultiSelection && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="flex items-center gap-1">
                    <Bookmark className="h-3 w-3" />
                    Saved Variants
                  </Label>
                  {!showSaveVariantInput && (
                    <Button variant="ghost" size="sm" onClick={() => setShowSaveVariantInput(true)} className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Save Current
                    </Button>
                  )}
                </div>

                {showSaveVariantInput && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={variantNameInput}
                      onChange={(e) => setVariantNameInput(e.target.value)}
                      placeholder="Variant name (e.g., Bear Form)"
                      className="flex-1 h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveVariant();
                        if (e.key === 'Escape') {
                          setShowSaveVariantInput(false);
                          setVariantNameInput('');
                        }
                      }}
                    />
                    <Button size="sm" onClick={handleSaveVariant} className="h-8 shrink-0">
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setShowSaveVariantInput(false);
                        setVariantNameInput('');
                      }}
                      className="h-8 w-8 p-0 shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {isMultiSelection && (
          <div className="mt-4 pt-4 border-t flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={applyChanges}>
              Apply Changes
            </Button>
          </div>
        )}
      </DialogContent>

      <ImageImportModal
        open={showImageImportModal}
        onOpenChange={setShowImageImportModal}
        multiSelect={isMultiSelection}
        onConfirm={handleImageImportConfirm}
        onConfirmMultiple={handleImageImportMultipleConfirm}
        shape={{
          type: 'circle',
          width: 50, // Token diameter in pixels (approximate)
          height: 50,
        }}
        title={isMultiSelection ? "Select Token Images" : "Import Token Image"}
        description={isMultiSelection ? "Select images to distribute randomly among the selected tokens." : "Select an image and position it within the token circle."}
        initialImageUrl={imageUrlValue}
        initialScale={imageScaleValue}
        initialOffsetX={imageOffsetXValue}
        initialOffsetY={imageOffsetYValue}
      />
    </Dialog>
  );
}
