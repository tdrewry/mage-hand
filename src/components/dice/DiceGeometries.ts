/**
 * Polyhedral dice geometry generators using Three.js built-in geometries.
 * Maps die sides → appropriate polyhedron.
 */
import * as THREE from 'three';

/** Create the geometry for a given die type */
export function createDieGeometry(sides: number): THREE.BufferGeometry {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(0.7);
    case 6:
      return new THREE.BoxGeometry(0.9, 0.9, 0.9);
    case 8:
      return new THREE.OctahedronGeometry(0.7);
    case 10:
      // d10 approximated as a dodecahedron scaled
      return new THREE.DodecahedronGeometry(0.65);
    case 12:
      return new THREE.DodecahedronGeometry(0.7);
    case 20:
      return new THREE.IcosahedronGeometry(0.7);
    case 100:
      // d100 = percentile, show as icosahedron with different scale
      return new THREE.IcosahedronGeometry(0.75);
    default:
      // Fallback: icosahedron for any unusual die
      return new THREE.IcosahedronGeometry(0.7);
  }
}

/** Get a color for each die type for visual variety */
export function getDieColor(sides: number): string {
  switch (sides) {
    case 4: return '#e74c3c';    // red
    case 6: return '#3498db';    // blue
    case 8: return '#2ecc71';    // green
    case 10: return '#9b59b6';   // purple
    case 12: return '#e67e22';   // orange
    case 20: return '#f1c40f';   // gold
    case 100: return '#1abc9c';  // teal
    default: return '#95a5a6';   // grey
  }
}

/** Get an emissive glow color (lighter variant) */
export function getDieEmissive(sides: number): string {
  switch (sides) {
    case 4: return '#ff6b6b';
    case 6: return '#74b9ff';
    case 8: return '#55efc4';
    case 10: return '#a29bfe';
    case 12: return '#ffeaa7';
    case 20: return '#fdcb6e';
    case 100: return '#81ecec';
    default: return '#dfe6e9';
  }
}
