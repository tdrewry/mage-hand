/**
 * Jazz Integration — Public API
 *
 * Re-exports everything needed by the rest of the app.
 * This module is a standalone transport — it does NOT depend on src/lib/net/.
 */

// Schema (CoMap/CoList definitions)
export {
  JazzToken,
  JazzTokenList,
  JazzMapEntry,
  JazzMapList,
  JazzDOBlob,
  JazzDOBlobList,
  JazzTextureEntry,
  JazzTextureList,
  JazzSessionRoot,
  MageHandAccount,
  MageHandAccountRoot,
  createSessionRoot,
} from "./schema";

// Provider
export { JazzSessionProvider } from "./provider";

// Bridge (Zustand ↔ Jazz sync)
export {
  isFromJazz,
  runFromJazz,
  pushAllToJazz,
  pullAllFromJazz,
  startBridge,
  stopBridge,
  getBridgedSessionRoot,
} from "./bridge";

// Session management
export {
  createJazzSession,
  joinJazzSession,
  leaveJazzSession,
  getCurrentJazzSession,
  type JazzSessionInfo,
} from "./session";

// Texture sync (FileStream-based)
export {
  pushTexturesToJazz,
  pullTexturesFromJazz,
  subscribeToTextureChanges,
  cleanupTextureSync,
  collectAllTextureHashes,
} from "./textureSync";
