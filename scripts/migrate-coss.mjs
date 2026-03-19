#!/usr/bin/env node
/**
 * Migrate @coss/style components from apps/web/src/components/ui/
 * to packages/ui/src/{atoms|molecules|organisms}/ with:
 *   - Atomic design categorization
 *   - Import path rewriting (@/lib/utils → ../../lib/utils, cross-component refs)
 *   - "use client" removal
 *   - PascalCase folder + index.ts creation per component
 */
import fs from 'fs';
import path from 'path';

const SRC_DIR = '/home/adachi/develop/adachidev/teste/hyper/monorepo/apps/web/src/components/ui';
const HOOKS_SRC = '/home/adachi/develop/adachidev/teste/hyper/monorepo/apps/web/src/hooks';
const UI_SRC = '/home/adachi/develop/adachidev/teste/hyper/monorepo/packages/ui/src';

// ─── Atomic layer categorisation ────────────────────────────────────────────
const LAYER = {
  // Atoms: primitive, largely stateless elements
  atoms: [
    'avatar', 'badge', 'button', 'checkbox', 'collapsible',
    'frame', 'group', 'input', 'kbd', 'label', 'meter',
    'progress', 'radio-group', 'scroll-area', 'separator',
    'skeleton', 'slider', 'spinner', 'switch', 'textarea', 'toggle',
  ],
  // Molecules: small compositions of atoms
  molecules: [
    'alert', 'breadcrumb', 'checkbox-group', 'empty',
    'field', 'fieldset', 'form',
    'input-group', 'input-otp', 'number-field',
    'preview-card', 'toggle-group', 'toolbar',
  ],
  // Organisms: complex, multi-part UI blocks
  organisms: [
    'accordion', 'alert-dialog', 'autocomplete', 'calendar',
    'card', 'combobox', 'command', 'dialog', 'drawer', 'menu',
    'pagination', 'popover', 'select', 'sheet', 'sidebar',
    'table', 'tabs', 'toast', 'tooltip',
  ],
};

// reverse lookup: component name → layer
const COMP_LAYER = {};
for (const [layer, comps] of Object.entries(LAYER)) {
  for (const c of comps) COMP_LAYER[c] = layer;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toPascal(kebab) {
  return kebab.replace(/(^|-)(\w)/g, (_, _sep, c) => c.toUpperCase());
}

/**
 * Given the current source component name and a referenced component name,
 * return the relative import path from the source's folder to the target's folder.
 */
function resolveCompImport(fromComp, toComp) {
  const fromLayer = COMP_LAYER[fromComp];
  const toLayer = COMP_LAYER[toComp];
  const toPascalName = toPascal(toComp);

  if (!fromLayer || !toLayer) {
    // Unknown; fall back to a sensible guess
    return `../../atoms/${toPascalName}`;
  }

  if (fromLayer === toLayer) {
    return `../${toPascalName}`;
  }

  const LAYER_DEPTH = { atoms: 0, molecules: 1, organisms: 2 };
  const fromDepth = LAYER_DEPTH[fromLayer];
  const toDepth = LAYER_DEPTH[toLayer];

  if (toDepth < fromDepth) {
    // going up: e.g. organisms → atoms
    const ups = fromDepth - toDepth;
    const prefix = '../'.repeat(ups + 1); // +1 for the component's own folder
    return `${prefix}${toLayer}/${toPascalName}`;
  } else {
    // going down or same level (unusual, but handle)
    const ups = toDepth - fromDepth;
    const prefix = '../'.repeat(ups + 1);
    return `${prefix}${toLayer}/${toPascalName}`;
  }
}

/**
 * Transform file content: remove "use client", rewrite imports.
 */
function transform(content, compName) {
  // 1. Remove "use client" (top-level Next.js directive, not needed in Vite)
  content = content.replace(/^["']use client["'];\n?/m, '');

  // 2. Rewrite @/lib/utils → ../../lib/utils
  content = content.replace(/"@\/lib\/utils"/g, '"../../lib/utils"');

  // 3. Rewrite @/components/ui/{name} → relative path
  content = content.replace(/"@\/components\/ui\/([^"]+)"/g, (_, refComp) => {
    return `"${resolveCompImport(compName, refComp)}"`;
  });

  // 4. Rewrite @/hooks/{name} → ../../lib/hooks/{name}
  content = content.replace(/"@\/hooks\/([^"]+)"/g, '"../../lib/hooks/$1"');

  return content;
}

/**
 * Create directory recursively if it doesn't exist.
 */
function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── Main migration ───────────────────────────────────────────────────────────
let migrated = 0;
let skipped = 0;

for (const [layer, comps] of Object.entries(LAYER)) {
  for (const compName of comps) {
    const srcFile = path.join(SRC_DIR, `${compName}.tsx`);
    if (!fs.existsSync(srcFile)) {
      console.warn(`  ⚠  Missing source: ${compName}.tsx`);
      skipped++;
      continue;
    }

    const pascal = toPascal(compName);
    const destDir = path.join(UI_SRC, layer, pascal);
    const destFile = path.join(destDir, `${pascal}.tsx`);
    const indexFile = path.join(destDir, 'index.ts');

    mkdirp(destDir);

    const raw = fs.readFileSync(srcFile, 'utf8');
    const transformed = transform(raw, compName);
    fs.writeFileSync(destFile, transformed, 'utf8');

    // Extract all named exports for the index.ts
    const exportMatches = [...transformed.matchAll(/^export\s+(?:(?:function|class|const|type|interface|enum)\s+(\w+)|(?:\{[^}]+\}))/mg)];
    const namedExports = [];
    const typeExports = [];

    for (const m of exportMatches) {
      const full = m[0];
      if (full.includes('{')) {
        // barrel export with braces - just re-export everything
        namedExports.push('*');
        break;
      }
      if (full.startsWith('export type ')) {
        typeExports.push(m[1]);
      } else {
        namedExports.push(m[1]);
      }
    }

    // Build index.ts content
    let indexContent;
    if (namedExports.includes('*')) {
      indexContent = `export * from './${pascal}';\n`;
    } else {
      const parts = [];
      if (typeExports.length > 0) {
        parts.push(`export type { ${typeExports.join(', ')} } from './${pascal}';`);
      }
      if (namedExports.length > 0) {
        parts.push(`export { ${namedExports.filter(Boolean).join(', ')} } from './${pascal}';`);
      }
      if (parts.length === 0) {
        parts.push(`export * from './${pascal}';`);
      }
      indexContent = parts.join('\n') + '\n';
    }

    fs.writeFileSync(indexFile, indexContent, 'utf8');
    console.log(`  ✓  ${layer}/${pascal}`);
    migrated++;
  }
}

// ─── Migrate hooks ────────────────────────────────────────────────────────────
const hooksDestDir = path.join(UI_SRC, 'lib', 'hooks');
mkdirp(hooksDestDir);

const hookFile = path.join(HOOKS_SRC, 'use-media-query.ts');
if (fs.existsSync(hookFile)) {
  let hookContent = fs.readFileSync(hookFile, 'utf8');
  hookContent = hookContent.replace(/^["']use client["'];\n?/m, '');
  fs.writeFileSync(path.join(hooksDestDir, 'use-media-query.ts'), hookContent, 'utf8');
  console.log(`  ✓  lib/hooks/use-media-query`);
}

// ─── Update layer index files ─────────────────────────────────────────────────
for (const [layer, comps] of Object.entries(LAYER)) {
  const layerIndex = path.join(UI_SRC, layer, 'index.ts');
  const existing = fs.existsSync(layerIndex) ? fs.readFileSync(layerIndex, 'utf8') : '';

  const lines = new Set(
    existing
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
  );

  for (const compName of comps) {
    const pascal = toPascal(compName);
    const srcFile = path.join(SRC_DIR, `${compName}.tsx`);
    if (!fs.existsSync(srcFile)) continue;
    lines.add(`export * from './${pascal}';`);
  }

  fs.writeFileSync(layerIndex, [...lines].sort().join('\n') + '\n', 'utf8');
  console.log(`  ✓  Updated ${layer}/index.ts`);
}

console.log(`\nDone. Migrated: ${migrated}, skipped: ${skipped}`);
