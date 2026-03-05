/**
 * Durable Object Export/Import System
 * 
 * Treats each zustand store as a discrete, versioned "Durable Object" (DO)
 * that can be independently exported, imported, and selectively merged.
 * 
 * The .mhdo archive format wraps all DOs in a manifest for portability.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface DurableObject {
  kind: string;
  version: number;
  stateHash: string;
  state: unknown;
  updatedAt: string;
}

export interface DurableObjectManifestEntry {
  kind: string;
  version: number;
  stateHash: string;
  byteSize: number;
  label: string; // Human-readable label, e.g. "Tokens (12 items)"
}

export interface DurableObjectArchive {
  format: 'magehand-durable-objects';
  formatVersion: 1;
  exportedAt: string;
  sourceSession: {
    id: string;
    name: string;
  };
  manifest: DurableObjectManifestEntry[];
  objects: Record<string, DurableObject>;
}

// ── Hash utility ───────────────────────────────────────────────────────────

/** FNV-1a 32-bit hash for fast integrity checks */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ── Registry ───────────────────────────────────────────────────────────────

export interface DORegistration {
  kind: string;
  version: number;
  label: string;
  /** Extract serializable state from the store */
  extractor: () => unknown;
  /** Hydrate the store from imported state */
  hydrator: (state: unknown) => void;
  /** Return a summary string, e.g. "12 tokens" */
  summarizer?: () => string;
}

class DurableObjectRegistryImpl {
  private registrations = new Map<string, DORegistration>();

  register(reg: DORegistration): void {
    this.registrations.set(reg.kind, reg);
  }

  getAll(): DORegistration[] {
    return Array.from(this.registrations.values());
  }

  get(kind: string): DORegistration | undefined {
    return this.registrations.get(kind);
  }

  /** Snapshot all registered DOs into an archive */
  exportAll(sessionId: string, sessionName: string): DurableObjectArchive {
    const objects: Record<string, DurableObject> = {};
    const manifest: DurableObjectManifestEntry[] = [];

    for (const reg of this.registrations.values()) {
      const state = reg.extractor();
      const stateJson = JSON.stringify(state);
      const stateHash = fnv1a(stateJson);
      const byteSize = new Blob([stateJson]).size;

      const summary = reg.summarizer ? reg.summarizer() : '';
      const label = summary ? `${reg.label} (${summary})` : reg.label;

      objects[reg.kind] = {
        kind: reg.kind,
        version: reg.version,
        stateHash,
        state,
        updatedAt: new Date().toISOString(),
      };

      manifest.push({
        kind: reg.kind,
        version: reg.version,
        stateHash,
        byteSize,
        label,
      });
    }

    return {
      format: 'magehand-durable-objects',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      sourceSession: { id: sessionId, name: sessionName },
      manifest,
      objects,
    };
  }

  /** Import selected DOs from an archive */
  importSelected(archive: DurableObjectArchive, selectedKinds: string[]): { imported: string[]; skipped: string[]; errors: string[] } {
    const imported: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const kind of selectedKinds) {
      const obj = archive.objects[kind];
      if (!obj) {
        skipped.push(kind);
        continue;
      }

      const reg = this.registrations.get(kind);
      if (!reg) {
        errors.push(`No hydrator registered for "${kind}"`);
        continue;
      }

      // Verify hash integrity
      const stateJson = JSON.stringify(obj.state);
      const computedHash = fnv1a(stateJson);
      if (computedHash !== obj.stateHash) {
        errors.push(`Hash mismatch for "${kind}" — data may be corrupted`);
        continue;
      }

      try {
        reg.hydrator(obj.state);
        imported.push(kind);
      } catch (e) {
        errors.push(`Failed to hydrate "${kind}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { imported, skipped, errors };
  }
}

export const DurableObjectRegistry = new DurableObjectRegistryImpl();

// ── File I/O ───────────────────────────────────────────────────────────────

export function exportArchiveToFile(archive: DurableObjectArchive, filename?: string): void {
  const json = JSON.stringify(archive, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `durable-objects-${Date.now()}.mhdo`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseArchiveFile(file: File): Promise<DurableObjectArchive> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') throw new Error('Failed to read file');
        const parsed = JSON.parse(text);
        if (parsed.format !== 'magehand-durable-objects') {
          throw new Error('Invalid file format — expected .mhdo archive');
        }
        if (parsed.formatVersion !== 1) {
          throw new Error(`Unsupported archive version: ${parsed.formatVersion}`);
        }
        resolve(parsed as DurableObjectArchive);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/** Format byte size for display */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
