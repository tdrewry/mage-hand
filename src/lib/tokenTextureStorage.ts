/**
 * @deprecated — Use '@/lib/textureStorage' directly.
 * This module is a re-export shim for backward compatibility.
 * All texture storage (tokens, regions, effects, map objects) is unified
 * in a single service sharing one IndexedDB database.
 */
export {
  hashImageData,
  saveTokenTexture,
  loadTokenTexture,
  loadTextureByHash,
  saveTextureByHash,
  saveVariantTexture,
  removeTokenTexture,
  getCachedTexture,
  getAllTokenTextures,
  clearUnusedTokenTextures,
  getAllTokenMappings,
  importTokenTextures,
  type TokenTextureDetails,
} from './textureStorage';
