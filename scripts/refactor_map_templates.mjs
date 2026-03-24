import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '../src');

// Replaces to run across file contents
const REPLACEMENTS = [
  { from: /\bEffectTemplate\b/g, to: 'MapTemplateDefinition' },
  { from: /\bPlacedEffect\b/g, to: 'PlacedMapTemplate' },
  { from: /\buseEffectStore\b/g, to: 'useMapTemplateStore' },
  { from: /\beffectStore\b/g, to: 'mapTemplateStore' },
  { from: /\beffectTemplateId\b/g, to: 'mapTemplateId' },
  { from: /\bplacedEffectId\b/g, to: 'placedMapTemplateId' },
  { from: /\beffectHitTesting\b/g, to: 'mapTemplateHitTesting' },
  { from: /\beffectRenderer\b/g, to: 'mapTemplateRenderer' },
  { from: /\beffectHandlers\b/g, to: 'mapTemplateHandlers' },
  { from: /\beffectTemplateLibrary\b/g, to: 'mapTemplateLibrary' },
  { from: /'EffectContextMenu'/g, to: "'MapTemplateContextMenu'" },
  { from: /"EffectContextMenu"/g, to: '"MapTemplateContextMenu"' },
  { from: /\/effectStore/g, to: '/mapTemplateStore' },
  { from: /\/EffectContextMenu/g, to: '/MapTemplateContextMenu' },
  { from: /\/effectHitTesting/g, to: '/mapTemplateHitTesting' },
  { from: /\/effectTemplateLibrary/g, to: '/mapTemplateLibrary' },
  { from: /\/effectHandlers/g, to: '/mapTemplateHandlers' },
  { from: /\/effectRenderer/g, to: '/mapTemplateRenderer' },
  { from: /\/EffectsCatalog/g, to: '/MapTemplatesCatalog' },
];

// Files to rename
const RENAMES = [
  { old: 'src/stores/effectStore.ts', new: 'src/stores/mapTemplateStore.ts' },
  { old: 'src/components/EffectContextMenu.tsx', new: 'src/components/MapTemplateContextMenu.tsx' },
  { old: 'src/lib/effectHitTesting.ts', new: 'src/lib/mapTemplateHitTesting.ts' },
  { old: 'src/lib/__tests__/effectHitTesting.test.ts', new: 'src/lib/__tests__/mapTemplateHitTesting.test.ts' },
  { old: 'src/lib/effectTemplateLibrary.ts', new: 'src/lib/mapTemplateLibrary.ts' },
  { old: 'src/lib/net/ephemeral/effectHandlers.ts', new: 'src/lib/net/ephemeral/mapTemplateHandlers.ts' },
  { old: 'src/lib/effectRenderer.ts', new: 'src/lib/mapTemplateRenderer.ts' },
  { old: 'src/components/rules/EffectsCatalog.tsx', new: 'src/components/rules/MapTemplatesCatalog.tsx' }
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.match(/\.(ts|tsx)$/)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      for (const { from, to } of REPLACEMENTS) {
        if (content.match(from)) {
          content = content.replace(from, to);
          modified = true;
        }
      }
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated content: ${fullPath}`);
      }
    }
  }
}

console.log('--- Processing File Contents ---');
processDirectory(SRC_DIR);

console.log('\n--- Renaming Files ---');
const projectRoot = path.join(__dirname, '..');
for (const r of RENAMES) {
  const oldPath = path.join(projectRoot, r.old);
  const newPath = path.join(projectRoot, r.new);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`Renamed: ${r.old} -> ${r.new}`);
  } else {
    console.warn(`File not found for rename: ${oldPath}`);
  }
}

console.log('\n--- Refactoring Complete ---');
