/**
 * Fog Geometry System - Paper.js-based boolean operations for fog of war
 * Handles proper union/subtract operations on explored and visible areas
 */

import paper from 'paper';
import type { Point } from './visibilityEngine';

// Dedicated paper.js scope for fog operations
let fogScope: paper.PaperScope | null = null;

/**
 * Initialize or get the paper.js scope for fog operations
 */
export function getFogScope(): paper.PaperScope {
  if (!fogScope) {
    fogScope = new paper.PaperScope();
    // Create a minimal canvas for paper.js (it won't be used for rendering)
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    fogScope.setup(canvas);
  }
  return fogScope;
}

/**
 * Clean up paper.js scope (call on unmount)
 */
export function cleanupFogGeometry() {
  if (fogScope) {
    // Remove all items from the project
    if (fogScope.project) {
      fogScope.project.clear();
    }
    fogScope = null;
  }
}

/**
 * Convert visibility polygon to paper.js Path
 */
export function visibilityPolygonToPaperPath(polygon: Point[]): paper.Path {
  const scope = getFogScope();
  
  // Activate the scope for this operation
  scope.activate();
  
  const path = new scope.Path();
  
  if (polygon.length === 0) {
    return path;
  }
  
  // Add all polygon points
  polygon.forEach(point => {
    path.add(new scope.Point(point.x, point.y));
  });
  
  // Close the path
  path.closed = true;
  
  return path;
}

/**
 * Convert paper.js Path to Path2D for canvas rendering
 */
export function paperPathToPath2D(paperPath: paper.Path | paper.CompoundPath): Path2D {
  const path2D = new Path2D();
  
  if (!paperPath) {
    return path2D;
  }
  
  // Handle CompoundPath (multiple children)
  if (paperPath instanceof paper.CompoundPath) {
    paperPath.children.forEach((child: any) => {
      if (child.segments) {
        addSegmentsToPath2D(child, path2D);
      }
    });
    return path2D;
  }
  
  // Handle single Path
  if ((paperPath as any).segments) {
    addSegmentsToPath2D(paperPath as paper.Path, path2D);
  }
  
  return path2D;
}

/**
 * Helper to add segments from a paper.js Path to a Path2D
 */
function addSegmentsToPath2D(paperPath: paper.Path, path2D: Path2D) {
  if (!paperPath.segments || paperPath.segments.length === 0) {
    return;
  }
  
  paperPath.segments.forEach((segment: any, index: number) => {
    const point = segment.point;
    
    if (index === 0) {
      path2D.moveTo(point.x, point.y);
    } else {
      // Handle curves if they exist
      const prev = paperPath.segments[index - 1];
      if (prev.handleOut && prev.handleOut.length > 0 || segment.handleIn && segment.handleIn.length > 0) {
        const cp1 = prev.point.add(prev.handleOut);
        const cp2 = point.add(segment.handleIn);
        path2D.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, point.x, point.y);
      } else {
        path2D.lineTo(point.x, point.y);
      }
    }
  });
  
  if (paperPath.closed) {
    path2D.closePath();
  }
}

/**
 * Merge current visibility into accumulated explored area using union
 * @param explored - Previously explored area (compound path)
 * @param visible - Current visibility polygon
 * @returns New compound path with visibility merged
 */
export function addVisibleToExplored(
  explored: paper.CompoundPath | null,
  visible: paper.Path
): paper.CompoundPath {
  const scope = getFogScope();
  scope.activate();
  
  if (!explored || explored.isEmpty()) {
    // First exploration - convert single path to compound path
    const compound = new scope.CompoundPath({
      children: [visible.clone()]
    });
    return compound;
  }
  
  // Perform union operation
  const union = explored.unite(visible, { insert: false });
  
  // Flatten to reduce complexity WITHOUT smoothing curves
  // This keeps sharp edges unlike simplify()
  if (union.flatten) {
    union.flatten(2); // Maximum error tolerance in pixels
  }
  
  // Ensure result is a compound path
  if (union instanceof scope.CompoundPath) {
    return union;
  } else if (union instanceof scope.Path) {
    return new scope.CompoundPath({
      children: [union]
    });
  }
  
  // Fallback - return original explored
  console.warn('Union operation failed, returning original explored area');
  return explored;
}

/**
 * Compute fog masks for rendering
 * @param explored - Accumulated explored area
 * @param visible - Current visibility area
 * @param canvasBounds - Canvas boundaries
 * @returns Three masks: unexplored, explored-only, and visible
 */
export function computeFogMasks(
  explored: paper.CompoundPath | null,
  visible: paper.Path | null,
  canvasBounds: { x: number; y: number; width: number; height: number }
): {
  unexploredMask: Path2D;
  exploredOnlyMask: Path2D;
  visibleMask: Path2D;
} {
  const scope = getFogScope();
  scope.activate();
  
  // Create canvas rectangle
  const canvasRect = new scope.Path.Rectangle({
    point: [canvasBounds.x, canvasBounds.y],
    size: [canvasBounds.width, canvasBounds.height]
  });
  
  // Default empty masks
  let unexploredMask = new Path2D();
  let exploredOnlyMask = new Path2D();
  let visibleMask = new Path2D();
  
  // 1. Unexplored = Canvas - Explored
  if (explored && !explored.isEmpty()) {
    const unexploredPaper = canvasRect.subtract(explored, { insert: false }) as any;
    unexploredMask = paperPathToPath2D(unexploredPaper);
    if (unexploredPaper.remove) unexploredPaper.remove();
  } else {
    // Nothing explored yet - entire canvas is unexplored
    unexploredMask = paperPathToPath2D(canvasRect);
  }
  
  // 2. Explored but not visible = Explored - Visible
  if (explored && !explored.isEmpty()) {
    if (visible && !visible.isEmpty()) {
      const exploredOnlyPaper = explored.subtract(visible, { insert: false }) as any;
      exploredOnlyMask = paperPathToPath2D(exploredOnlyPaper);
      if (exploredOnlyPaper.remove) exploredOnlyPaper.remove();
    } else {
      // No current visibility - all explored area is "explored only"
      exploredOnlyMask = paperPathToPath2D(explored);
    }
  }
  
  // 3. Currently visible
  if (visible && !visible.isEmpty()) {
    visibleMask = paperPathToPath2D(visible);
  }
  
  canvasRect.remove();
  
  return {
    unexploredMask,
    exploredOnlyMask,
    visibleMask
  };
}

/**
 * Create an empty explored area
 */
export function createEmptyExplored(): paper.CompoundPath {
  const scope = getFogScope();
  scope.activate();
  return new scope.CompoundPath({ children: [] });
}

/**
 * Check if a compound path is empty
 */
export function isExploredEmpty(explored: paper.CompoundPath | null): boolean {
  return !explored || explored.isEmpty();
}

/**
 * Get bounds of explored area (for optimization)
 */
export function getExploredBounds(explored: paper.CompoundPath): { 
  x: number; 
  y: number; 
  width: number; 
  height: number 
} | null {
  if (!explored || explored.isEmpty()) {
    return null;
  }
  
  const bounds = explored.bounds;
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };
}
