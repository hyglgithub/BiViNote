/**
 * Cleanup Tests (Task 12)
 * 验证旧文件已清理，新架构正常工作
 * 运行方式: node tests/cleanup.test.js
 */

const fs = require('fs');
const path = require('path');

// 测试计数器
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function test(name, fn) {
  console.log(`\n测试: ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`  ✗ ${name} - 异常: ${err.message}`);
    failed++;
  }
}

// ── 路径常量 ──

const ROOT = path.resolve(__dirname, '..');
const build = require('../scripts/build');

// ── 测试 1: 旧文件已删除 ──

test('旧文件已删除 - background.js', () => {
  const filePath = path.join(ROOT, 'background.js');
  assert(!fs.existsSync(filePath), '根目录 background.js 应不存在');
});

test('旧文件已删除 - content.js', () => {
  const filePath = path.join(ROOT, 'content.js');
  assert(!fs.existsSync(filePath), '根目录 content.js 应不存在');
});

test('旧文件已删除 - manifest.json', () => {
  const filePath = path.join(ROOT, 'manifest.json');
  assert(!fs.existsSync(filePath), '根目录 manifest.json 应不存在');
});

test('旧文件已删除 - js/ 目录', () => {
  const dirPath = path.join(ROOT, 'js');
  assert(!fs.existsSync(dirPath), 'js/ 目录应不存在');
});

test('旧文件已删除 - DeepSeek 库文件', () => {
  const files = [
    'libs/deepseek-api.js',
    'libs/deepseek-bridge.js',
    'libs/wasm-solver.js',
  ];
  for (const file of files) {
    const filePath = path.join(ROOT, file);
    assert(!fs.existsSync(filePath), `${file} 应不存在`);
  }
});

// ── 测试 2: 新文件存在于 src/core/ ──

test('content.js 已移动到 src/core/', () => {
  const filePath = path.join(ROOT, 'src', 'core', 'content.js');
  assert(fs.existsSync(filePath), 'src/core/content.js 应存在');
});

test('src/core/ 包含所有核心文件', () => {
  const expectedFiles = [
    'background.js',
    'content.js',
    'state.js',
    'panel.js',
    'subtitle.js',
    'chapter.js',
    'video-info.js',
    'capture.js',
    'export.js',
    'settings.js',
    'crop-viewer.js',
    'message-bus.js',
  ];
  for (const file of expectedFiles) {
    const filePath = path.join(ROOT, 'src', 'core', file);
    assert(fs.existsSync(filePath), `src/core/${file} 应存在`);
  }
});

// ── 测试 3: 保留的库文件仍存在 ──

test('libs/ 目录保留必要的库文件', () => {
  const expectedFiles = [
    'libs/jszip.min.js',
    'libs/cropper.min.js',
    'libs/cropper.min.css',
  ];
  for (const file of expectedFiles) {
    const filePath = path.join(ROOT, file);
    assert(fs.existsSync(filePath), `${file} 应存在`);
  }
});

// ── 测试 4: 构建脚本更新 ──

test('构建脚本应从 src/core/ 读取 content.js', () => {
  // 读取构建脚本源码
  const buildSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'build.js'), 'utf8');
  // 验证 ROOT_FILES 从 CORE_DIR 读取（不是从 ROOT）
  assert(buildSrc.includes("path.join(CORE_DIR, file)"), '应从 CORE_DIR 读取文件');
  // 应引用 content.js
  assert(buildSrc.includes("'content.js'") || buildSrc.includes('"content.js"'), '应引用 content.js');
});

// ── 测试 5: 构建仍然正常工作 ──

test('构建 main 版本仍然正常', () => {
  const outputDir = path.join(ROOT, 'dist', 'test-main');
  try {
    // 清理测试目录
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }

    // 执行构建
    build.buildMain(outputDir);

    // 验证关键文件存在
    assert(fs.existsSync(path.join(outputDir, 'background.js')), 'background.js 应存在');
    assert(fs.existsSync(path.join(outputDir, 'content.js')), 'content.js 应存在');
    assert(fs.existsSync(path.join(outputDir, 'manifest.json')), 'manifest.json 应存在');
    assert(fs.existsSync(path.join(outputDir, 'js', 'panel.js')), 'js/panel.js 应存在');
    assert(fs.existsSync(path.join(outputDir, 'js', 'state.js')), 'js/state.js 应存在');

    // 验证 DeepSeek 模块
    assert(fs.existsSync(path.join(outputDir, 'modules', 'deepseek', 'api.js')), 'modules/deepseek/api.js 应存在');
    assert(fs.existsSync(path.join(outputDir, 'modules', 'deepseek', 'bridge.js')), 'modules/deepseek/bridge.js 应存在');

    // 验证 libs 目录
    assert(fs.existsSync(path.join(outputDir, 'libs', 'jszip.min.js')), 'libs/jszip.min.js 应存在');
    assert(fs.existsSync(path.join(outputDir, 'libs', 'cropper.min.js')), 'libs/cropper.min.js 应存在');
  } finally {
    // 清理测试目录
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }
  }
});

test('构建 lite 版本仍然正常', () => {
  const outputDir = path.join(ROOT, 'dist', 'test-lite');
  try {
    // 清理测试目录
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }

    // 执行构建
    build.buildLite(outputDir);

    // 验证关键文件存在
    assert(fs.existsSync(path.join(outputDir, 'background.js')), 'background.js 应存在');
    assert(fs.existsSync(path.join(outputDir, 'content.js')), 'content.js 应存在');
    assert(fs.existsSync(path.join(outputDir, 'manifest.json')), 'manifest.json 应存在');
    assert(fs.existsSync(path.join(outputDir, 'js', 'panel.js')), 'js/panel.js 应存在');

    // 验证没有 DeepSeek 模块
    assert(!fs.existsSync(path.join(outputDir, 'modules')), 'modules/ 目录不应存在');

    // 验证 libs 目录
    assert(fs.existsSync(path.join(outputDir, 'libs', 'jszip.min.js')), 'libs/jszip.min.js 应存在');
  } finally {
    // 清理测试目录
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }
  }
});

// ── 测试 6: backup 目录存在 ──

test('backup 目录应存在', () => {
  const backupDir = path.join(ROOT, 'backup');
  assert(fs.existsSync(backupDir), 'backup/ 目录应存在');
});

test('backup 包含旧文件', () => {
  const backupDir = path.join(ROOT, 'backup');
  assert(fs.existsSync(path.join(backupDir, 'background.js')), 'backup/background.js 应存在');
  assert(fs.existsSync(path.join(backupDir, 'content.js')), 'backup/content.js 应存在');
  assert(fs.existsSync(path.join(backupDir, 'manifest.json')), 'backup/manifest.json 应存在');
});

// ── 测试结果 ──

console.log(`\n${'='.repeat(50)}`);
console.log(`清理测试结果:`);
console.log(`  通过: ${passed}`);
console.log(`  失败: ${failed}`);
console.log(`  总计: ${passed + failed}`);
console.log(`${'='.repeat(50)}`);

if (failed > 0) {
  process.exit(1);
}
