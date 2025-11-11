# Styles Card TODO

## Completed Features
- ✅ Quick style presets (Black & White, Antique, etc.)
- ✅ Manual controls for edge style, wall thickness, detail scale
- ✅ Current style display
- ✅ Automatic canvas redraw on style changes
- ✅ Card visibility linked to toolbar

## Pending Implementation

### Light Direction and Shadow Distance
These controls are currently hidden in the Styles card UI as the rendering implementation is incomplete.

**What's needed:**
1. **Render shadows based on light direction**
   - Compute shadow geometry from wall segments
   - Apply shadow direction angle (0° = top, 90° = right, 180° = bottom, 270° = left)
   - Render shadows on the canvas layer beneath walls

2. **Shadow distance rendering**
   - Use `shadowDistance` from dungeonStore to control how far shadows extend
   - Apply shadow opacity/gradient based on distance
   - Integrate with existing `renderShadows` function in `src/lib/lightSystem.ts`

3. **Performance optimization**
   - Cache shadow geometry calculations
   - Only recompute when light direction/distance changes
   - Use requestAnimationFrame for smooth updates

**Related files:**
- `src/lib/lightSystem.ts` - Shadow rendering functions
- `src/stores/dungeonStore.ts` - Light direction and shadow distance state
- `src/components/SimpleTabletop.tsx` - Main canvas rendering loop
- `src/lib/wallGeometry.ts` - Wall geometry for shadow casting

**To enable the controls:**
1. Uncomment the Light Direction and Shadow Distance sections in `src/components/cards/StylesCard.tsx`
2. Implement shadow rendering in the main canvas loop
3. Test with different light angles and shadow distances
4. Add preview visualization in the Styles card (optional)

## Future Enhancements
- [ ] Real-time preview canvas showing style changes before applying
- [ ] Custom style presets that users can save/load
- [ ] Export/import style configurations
- [ ] Per-region style overrides
- [ ] Animated style transitions
