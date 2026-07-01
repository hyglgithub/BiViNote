#!/usr/bin/env node
/**
 * BiViNote Build Script
 * Builds main and lite versions of the extension from modular source files.
 *
 * Usage:
 *   node scripts/build.js           # Build both versions
 *   node scripts/build.js main      # Build main version only
 *   node scripts/build.js lite      # Build lite version only
 *
 * Output:
 *   dist/main/   - Main version (core + DeepSeek)
 *   dist/lite/   - Lite version (core only)
 */

const fs = require('fs');
const path = require('path');

// ── Constants ──

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const CORE_DIR = path.join(ROOT, 'src', 'core');
const MODULES_DIR = path.join(ROOT, 'src', 'modules', 'deepseek');
const MANIFESTS_DIR = path.join(ROOT, 'src', 'manifests');

// Core files that map from src/core/ → js/ in the output
const CORE_FILES = [
  'state.js',
  'panel.js',
  'subtitle.js',
  'chapter.js',
  'video-info.js',
  'capture.js',
  'export.js',
  'settings.js',
  'crop-viewer.js',
];

// Shared resources to copy (relative to ROOT)
const SHARED_DIRS = ['libs', 'icons', 'css'];

// Core files to copy to output root (not js/) - read from src/core/
const ROOT_FILES = ['content.js'];

// DeepSeek module files (relative to modules/deepseek/) - copied as-is for main version
// Excludes background.js (merged into background.js) and panel.js (merged into js/panel.js)
const DEEPSEEK_MODULE_FILES = [
  'api.js',
  'bridge.js',
  'client.js',
  'wasm-solver.js',
];

// ── Utility Functions ──

/**
 * Recursively remove a directory
 * @param {string} dirPath - Directory path to remove
 */
function removeDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      removeDir(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }
  fs.rmdirSync(dirPath);
}

/**
 * Recursively copy a directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy a single file, creating parent directories as needed
 * @param {string} src - Source file path
 * @param {string} dest - Destination file path
 */
function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/**
 * Read a file and return its content
 * @param {string} filePath - File path
 * @returns {string} File content
 */
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// ── Build Functions ──

/**
 * Build the main version (core + DeepSeek)
 * @param {string} outputDir - Output directory
 */
function buildMain(outputDir) {
  console.log('Building main version...');

  // 1. Copy core files to js/
  for (const file of CORE_FILES) {
    const src = path.join(CORE_DIR, file);
    const dest = path.join(outputDir, 'js', file);
    copyFile(src, dest);
  }
  console.log(`  Copied ${CORE_FILES.length} core files to js/`);

  // 2. Copy shared resources (libs, icons, css)
  for (const dir of SHARED_DIRS) {
    const src = path.join(ROOT, dir);
    const dest = path.join(outputDir, dir);
    copyDir(src, dest);
  }
  console.log(`  Copied shared resources: ${SHARED_DIRS.join(', ')}`);

  // 3. Copy root files from src/core/ to output root (content.js)
  for (const file of ROOT_FILES) {
    const src = path.join(CORE_DIR, file);
    const dest = path.join(outputDir, file);
    copyFile(src, dest);
  }
  console.log(`  Copied root files: ${ROOT_FILES.join(', ')}`);

  // 4. Merge background.js (core + DeepSeek module)
  const coreBg = readFile(path.join(CORE_DIR, 'background.js'));
  const dsBg = readFile(path.join(MODULES_DIR, 'background.js'));
  const mergedBg = coreBg + '\n\n' + dsBg;
  fs.writeFileSync(path.join(outputDir, 'background.js'), mergedBg, 'utf8');
  console.log('  Merged background.js (core + DeepSeek)');

  // 5. Merge panel.js (core + DeepSeek panel)
  const corePanel = readFile(path.join(CORE_DIR, 'panel.js'));
  const dsPanel = readFile(path.join(MODULES_DIR, 'panel.js'));
  const mergedPanel = corePanel + '\n\n' + dsPanel;
  fs.writeFileSync(path.join(outputDir, 'js', 'panel.js'), mergedPanel, 'utf8');
  console.log('  Merged js/panel.js (core + DeepSeek)');

  // 6. Copy DeepSeek module files
  fs.mkdirSync(path.join(outputDir, 'modules', 'deepseek'), { recursive: true });
  for (const file of DEEPSEEK_MODULE_FILES) {
    const src = path.join(MODULES_DIR, file);
    const dest = path.join(outputDir, 'modules', 'deepseek', file);
    copyFile(src, dest);
  }
  console.log(`  Copied DeepSeek module files: ${DEEPSEEK_MODULE_FILES.join(', ')}`);

  // 7. Copy and adjust manifest
  const manifestSrc = path.join(MANIFESTS_DIR, 'manifest-main.json');
  const manifest = JSON.parse(readFile(manifestSrc));

  // Remove modules/deepseek/panel.js from content_scripts since it's merged into js/panel.js
  if (manifest.content_scripts && manifest.content_scripts[0]) {
    const scripts = manifest.content_scripts[0].js;
    const idx = scripts.indexOf('modules/deepseek/panel.js');
    if (idx !== -1) {
      scripts.splice(idx, 1);
    }
  }

  fs.writeFileSync(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );
  console.log('  Copied and adjusted manifest.json');

  console.log('Main version build complete.');
}

/**
 * Build the lite version (core only)
 * @param {string} outputDir - Output directory
 */
function buildLite(outputDir) {
  console.log('Building lite version...');

  // 1. Copy core files to js/
  for (const file of CORE_FILES) {
    const src = path.join(CORE_DIR, file);
    const dest = path.join(outputDir, 'js', file);
    copyFile(src, dest);
  }
  console.log(`  Copied ${CORE_FILES.length} core files to js/`);

  // 2. Copy shared resources (libs, icons, css)
  for (const dir of SHARED_DIRS) {
    const src = path.join(ROOT, dir);
    const dest = path.join(outputDir, dir);
    copyDir(src, dest);
  }
  console.log(`  Copied shared resources: ${SHARED_DIRS.join(', ')}`);

  // 3. Copy root files from src/core/ to output root (content.js)
  for (const file of ROOT_FILES) {
    const src = path.join(CORE_DIR, file);
    const dest = path.join(outputDir, file);
    copyFile(src, dest);
  }
  console.log(`  Copied root files: ${ROOT_FILES.join(', ')}`);

  // 4. Copy core background.js (no merge for lite)
  const coreBg = readFile(path.join(CORE_DIR, 'background.js'));
  fs.writeFileSync(path.join(outputDir, 'background.js'), coreBg, 'utf8');
  console.log('  Copied core background.js (no DeepSeek)');

  // 5. Copy core panel.js (no merge for lite)
  // panel.js is already copied as a core file in step 1
  console.log('  Core panel.js already copied (no DeepSeek)');

  // 6. Copy manifest
  const manifestSrc = path.join(MANIFESTS_DIR, 'manifest-lite.json');
  const manifestContent = readFile(manifestSrc);
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), manifestContent, 'utf8');
  console.log('  Copied manifest.json');

  console.log('Lite version build complete.');
}

// ── Main ──

function main() {
  const args = process.argv.slice(2);
  const target = args[0] || 'all';

  if (target !== 'main' && target !== 'lite' && target !== 'all') {
    console.error(`Unknown target: ${target}. Use "main", "lite", or "all".`);
    process.exit(1);
  }

  // Clean dist directory
  if (target === 'all' || target === 'main') {
    removeDir(path.join(DIST, 'main'));
  }
  if (target === 'all' || target === 'lite') {
    removeDir(path.join(DIST, 'lite'));
  }

  // Build
  if (target === 'all' || target === 'main') {
    buildMain(path.join(DIST, 'main'));
  }
  if (target === 'all' || target === 'lite') {
    buildLite(path.join(DIST, 'lite'));
  }

  console.log('\nBuild finished successfully.');
}

// Run if called directly (not imported for testing)
if (require.main === module) {
  main();
}

// ── Exports for testing ──

module.exports = {
  ROOT,
  DIST,
  CORE_DIR,
  MODULES_DIR,
  MANIFESTS_DIR,
  CORE_FILES,
  SHARED_DIRS,
  ROOT_FILES,
  DEEPSEEK_MODULE_FILES,
  removeDir,
  copyDir,
  copyFile,
  readFile,
  buildMain,
  buildLite,
};
