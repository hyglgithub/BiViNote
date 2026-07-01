/**
 * Build Script Tests
 * 验证 build.js 构建脚本的正确性
 * 运行方式: node tests/build.test.js
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
const DIST = path.join(ROOT, 'dist');
const MAIN_DIR = path.join(DIST, 'main');
const LITE_DIR = path.join(DIST, 'lite');

const build = require('../scripts/build');

// ── 测试 1: 模块导出 ──

test('模块导出', () => {
  assert(typeof build.buildMain === 'function', '应导出 buildMain 函数');
  assert(typeof build.buildLite === 'function', '应导出 buildLite 函数');
  assert(typeof build.removeDir === 'function', '应导出 removeDir 函数');
  assert(typeof build.copyDir === 'function', '应导出 copyDir 函数');
  assert(typeof build.copyFile === 'function', '应导出 copyFile 函数');
  assert(typeof build.readFile === 'function', '应导出 readFile 函数');
});

// ── 测试 2: 常量定义 ──

test('常量定义', () => {
  assert(Array.isArray(build.CORE_FILES), 'CORE_FILES 应该是数组');
  assert(build.CORE_FILES.length > 0, 'CORE_FILES 不应为空');
  assert(Array.isArray(build.SHARED_DIRS), 'SHARED_DIRS 应该是数组');
  assert(Array.isArray(build.ROOT_FILES), 'ROOT_FILES 应该是数组');
  assert(Array.isArray(build.DEEPSEEK_MODULE_FILES), 'DEEPSEEK_MODULE_FILES 应该是数组');
});

// ── 测试 3: 核心文件列表完整性 ──

test('核心文件列表完整性', () => {
  const expected = [
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
  for (const file of expected) {
    assert(build.CORE_FILES.includes(file), `CORE_FILES 应包含 ${file}`);
  }
});

// ── 测试 4: DeepSeek 模块文件列表 ──

test('DeepSeek 模块文件列表', () => {
  // Should include these files
  assert(build.DEEPSEEK_MODULE_FILES.includes('api.js'), '应包含 api.js');
  assert(build.DEEPSEEK_MODULE_FILES.includes('bridge.js'), '应包含 bridge.js');
  assert(build.DEEPSEEK_MODULE_FILES.includes('client.js'), '应包含 client.js');
  assert(build.DEEPSEEK_MODULE_FILES.includes('wasm-solver.js'), '应包含 wasm-solver.js');

  // Should NOT include background.js or panel.js (they are merged)
  assert(!build.DEEPSEEK_MODULE_FILES.includes('background.js'), '不应包含 background.js（已合并）');
  assert(!build.DEEPSEEK_MODULE_FILES.includes('panel.js'), '不应包含 panel.js（已合并）');
});

// ── 测试 5: 源文件存在性 ──

test('源文件存在性', () => {
  // Core directory
  assert(fs.existsSync(build.CORE_DIR), 'src/core/ 目录应存在');

  // Core files
  for (const file of build.CORE_FILES) {
    assert(
      fs.existsSync(path.join(build.CORE_DIR, file)),
      `src/core/${file} 应存在`
    );
  }

  // Modules directory
  assert(fs.existsSync(build.MODULES_DIR), 'src/modules/deepseek/ 目录应存在');

  // DeepSeek module files
  for (const file of build.DEEPSEEK_MODULE_FILES) {
    assert(
      fs.existsSync(path.join(build.MODULES_DIR, file)),
      `src/modules/deepseek/${file} 应存在`
    );
  }

  // DeepSeek background.js and panel.js (for merging)
  assert(
    fs.existsSync(path.join(build.MODULES_DIR, 'background.js')),
    'src/modules/deepseek/background.js 应存在'
  );
  assert(
    fs.existsSync(path.join(build.MODULES_DIR, 'panel.js')),
    'src/modules/deepseek/panel.js 应存在'
  );

  // Manifests
  assert(
    fs.existsSync(path.join(build.MANIFESTS_DIR, 'manifest-main.json')),
    'manifest-main.json 应存在'
  );
  assert(
    fs.existsSync(path.join(build.MANIFESTS_DIR, 'manifest-lite.json')),
    'manifest-lite.json 应存在'
  );

  // Shared dirs
  for (const dir of build.SHARED_DIRS) {
    assert(fs.existsSync(path.join(ROOT, dir)), `${dir}/ 目录应存在`);
  }

  // Root files (now read from src/core/)
  for (const file of build.ROOT_FILES) {
    assert(fs.existsSync(path.join(build.CORE_DIR, file)), `src/core/${file} 应存在`);
  }
});

// ── 测试 6: 构建 main 版本 ──

test('构建 main 版本', () => {
  // Clean first
  build.removeDir(MAIN_DIR);

  // Build
  build.buildMain(MAIN_DIR);

  // Output directory should exist
  assert(fs.existsSync(MAIN_DIR), 'dist/main/ 应创建');

  // background.js should exist
  assert(fs.existsSync(path.join(MAIN_DIR, 'background.js')), 'background.js 应存在');

  // content.js should exist
  assert(fs.existsSync(path.join(MAIN_DIR, 'content.js')), 'content.js 应存在');

  // manifest.json should exist
  assert(fs.existsSync(path.join(MAIN_DIR, 'manifest.json')), 'manifest.json 应存在');

  // js/ directory should have core files
  for (const file of build.CORE_FILES) {
    assert(
      fs.existsSync(path.join(MAIN_DIR, 'js', file)),
      `js/${file} 应存在`
    );
  }

  // modules/deepseek/ should have module files
  for (const file of build.DEEPSEEK_MODULE_FILES) {
    assert(
      fs.existsSync(path.join(MAIN_DIR, 'modules', 'deepseek', file)),
      `modules/deepseek/${file} 应存在`
    );
  }

  // Shared resources should be copied
  for (const dir of build.SHARED_DIRS) {
    assert(fs.existsSync(path.join(MAIN_DIR, dir)), `${dir}/ 应存在`);
  }
});

// ── 测试 7: main 版本 background.js 合并验证 ──

test('main 版本 background.js 合并验证', () => {
  const bgContent = fs.readFileSync(path.join(MAIN_DIR, 'background.js'), 'utf8');

  // Should contain core background code
  assert(bgContent.includes('registerHandler'), '应包含核心 registerHandler 函数');
  assert(bgContent.includes('fetchVideoMeta'), '应包含核心 fetchVideoMeta 函数');
  assert(bgContent.includes('isVideoPage'), '应包含核心 isVideoPage 函数');

  // Should contain DeepSeek background code
  assert(bgContent.includes('registerDeepSeekHandlers'), '应包含 DeepSeek registerDeepSeekHandlers 函数');
  assert(bgContent.includes('DS_URL'), '应包含 DeepSeek DS_URL 常量');
  assert(bgContent.includes('initDeepSeekModule'), '应包含 DeepSeek initDeepSeekModule 函数');
  assert(bgContent.includes('dsCheckLogin'), '应包含 DeepSeek dsCheckLogin 函数');
});

// ── 测试 8: main 版本 panel.js 合并验证 ──

test('main 版本 panel.js 合并验证', () => {
  const panelContent = fs.readFileSync(path.join(MAIN_DIR, 'js', 'panel.js'), 'utf8');

  // Should contain core panel code
  assert(panelContent.includes('registerTab'), '应包含核心 registerTab 函数');
  assert(panelContent.includes('BiViNote.panel'), '应包含 BiViNote.panel 接口');
  assert(panelContent.includes('toggleCollapse'), '应包含 toggleCollapse 函数');

  // Should contain DeepSeek panel code (merged)
  assert(panelContent.includes("id: 'doc'"), '应包含文档整理标签页注册');
  assert(panelContent.includes("'文档整理'"), '应包含文档整理标签页标签');
});

// ── 测试 9: main 版本 manifest 验证 ──

test('main 版本 manifest 验证', () => {
  const manifestPath = path.join(MAIN_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert(manifest.manifest_version === 3, 'manifest_version 应为 3');
  assert(manifest.name === 'BiViNote', 'name 应为 BiViNote');
  assert(typeof manifest.version === 'string', '应有 version 字段');

  // Should have DeepSeek host permission
  const hostPerms = manifest.host_permissions.join(' ');
  assert(hostPerms.includes('deepseek.com'), '应有 deepseek.com host 权限');

  // Content scripts should not include modules/deepseek/panel.js (merged)
  const jsFiles = manifest.content_scripts[0].js;
  assert(
    !jsFiles.includes('modules/deepseek/panel.js'),
    'content_scripts 不应包含 modules/deepseek/panel.js（已合并到 js/panel.js）'
  );

  // Should still include other DeepSeek module files
  assert(jsFiles.includes('modules/deepseek/client.js'), '应包含 modules/deepseek/client.js');
  assert(jsFiles.includes('modules/deepseek/api.js'), '应包含 modules/deepseek/api.js');
  assert(jsFiles.includes('modules/deepseek/bridge.js'), '应包含 modules/deepseek/bridge.js');
  assert(jsFiles.includes('modules/deepseek/wasm-solver.js'), '应包含 modules/deepseek/wasm-solver.js');

  // Should include core files
  assert(jsFiles.includes('js/panel.js'), '应包含 js/panel.js');
  assert(jsFiles.includes('js/state.js'), '应包含 js/state.js');
  assert(jsFiles.includes('content.js'), '应包含 content.js');
});

// ── 测试 10: 构建 lite 版本 ──

test('构建 lite 版本', () => {
  // Clean first
  build.removeDir(LITE_DIR);

  // Build
  build.buildLite(LITE_DIR);

  // Output directory should exist
  assert(fs.existsSync(LITE_DIR), 'dist/lite/ 应创建');

  // background.js should exist
  assert(fs.existsSync(path.join(LITE_DIR, 'background.js')), 'background.js 应存在');

  // content.js should exist
  assert(fs.existsSync(path.join(LITE_DIR, 'content.js')), 'content.js 应存在');

  // manifest.json should exist
  assert(fs.existsSync(path.join(LITE_DIR, 'manifest.json')), 'manifest.json 应存在');

  // js/ directory should have core files
  for (const file of build.CORE_FILES) {
    assert(
      fs.existsSync(path.join(LITE_DIR, 'js', file)),
      `js/${file} 应存在`
    );
  }

  // modules/deepseek/ should NOT exist for lite
  assert(
    !fs.existsSync(path.join(LITE_DIR, 'modules')),
    'modules/ 目录不应存在（lite 版本无 DeepSeek）'
  );

  // Shared resources should be copied
  for (const dir of build.SHARED_DIRS) {
    assert(fs.existsSync(path.join(LITE_DIR, dir)), `${dir}/ 应存在`);
  }
});

// ── 测试 11: lite 版本 background.js 验证 ──

test('lite 版本 background.js 验证', () => {
  const bgContent = fs.readFileSync(path.join(LITE_DIR, 'background.js'), 'utf8');

  // Should contain core background code
  assert(bgContent.includes('registerHandler'), '应包含核心 registerHandler 函数');
  assert(bgContent.includes('fetchVideoMeta'), '应包含核心 fetchVideoMeta 函数');

  // Should NOT contain DeepSeek code
  assert(!bgContent.includes('registerDeepSeekHandlers'), '不应包含 DeepSeek registerDeepSeekHandlers');
  assert(!bgContent.includes('DS_URL'), '不应包含 DeepSeek DS_URL');
  assert(!bgContent.includes('initDeepSeekModule'), '不应包含 DeepSeek initDeepSeekModule');
});

// ── 测试 12: lite 版本 panel.js 验证 ──

test('lite 版本 panel.js 验证', () => {
  const panelContent = fs.readFileSync(path.join(LITE_DIR, 'js', 'panel.js'), 'utf8');

  // Should contain core panel code
  assert(panelContent.includes('registerTab'), '应包含核心 registerTab 函数');
  assert(panelContent.includes('BiViNote.panel'), '应包含 BiViNote.panel 接口');

  // Should NOT contain DeepSeek panel code
  assert(!panelContent.includes("id: 'doc'"), '不应包含文档整理标签页注册');
  assert(!panelContent.includes("'文档整理'"), '不应包含文档整理标签页标签');
});

// ── 测试 13: lite 版本 manifest 验证 ──

test('lite 版本 manifest 验证', () => {
  const manifestPath = path.join(LITE_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert(manifest.manifest_version === 3, 'manifest_version 应为 3');
  assert(manifest.name === 'BiViNote Lite', 'name 应为 BiViNote Lite');
  assert(typeof manifest.version === 'string', '应有 version 字段');

  // Should NOT have DeepSeek host permission
  const hostPerms = manifest.host_permissions.join(' ');
  assert(!hostPerms.includes('deepseek.com'), '不应有 deepseek.com host 权限');

  // Content scripts should not include any DeepSeek files
  const jsFiles = manifest.content_scripts[0].js;
  const hasDeepSeek = jsFiles.some(f => f.includes('deepseek'));
  assert(!hasDeepSeek, 'content_scripts 不应包含任何 DeepSeek 文件');

  // Should include core files
  assert(jsFiles.includes('js/panel.js'), '应包含 js/panel.js');
  assert(jsFiles.includes('js/state.js'), '应包含 js/state.js');
  assert(jsFiles.includes('content.js'), '应包含 content.js');
});

// ── 测试 14: libs 目录内容验证 ──

test('libs 目录内容验证', () => {
  const expectedLibs = ['jszip.min.js', 'cropper.min.js', 'cropper.min.css'];

  for (const file of expectedLibs) {
    assert(
      fs.existsSync(path.join(MAIN_DIR, 'libs', file)),
      `main: libs/${file} 应存在`
    );
    assert(
      fs.existsSync(path.join(LITE_DIR, 'libs', file)),
      `lite: libs/${file} 应存在`
    );
  }
});

// ── 测试 15: icons 目录内容验证 ──

test('icons 目录内容验证', () => {
  const expectedIcons = [
    'icon-16.png',
    'icon-32.png',
    'icon-48.png',
    'icon-128.png',
    'icon-16-disabled.png',
    'icon-32-disabled.png',
    'icon-48-disabled.png',
    'icon-128-disabled.png',
  ];

  for (const file of expectedIcons) {
    assert(
      fs.existsSync(path.join(MAIN_DIR, 'icons', file)),
      `main: icons/${file} 应存在`
    );
    assert(
      fs.existsSync(path.join(LITE_DIR, 'icons', file)),
      `lite: icons/${file} 应存在`
    );
  }
});

// ── 测试 16: css 目录内容验证 ──

test('css 目录内容验证', () => {
  assert(
    fs.existsSync(path.join(MAIN_DIR, 'css', 'panel.css')),
    'main: css/panel.css 应存在'
  );
  assert(
    fs.existsSync(path.join(LITE_DIR, 'css', 'panel.css')),
    'lite: css/panel.css 应存在'
  );
});

// ── 测试 17: background.js 合并顺序验证 ──

test('background.js 合并顺序验证', () => {
  const bgContent = fs.readFileSync(path.join(MAIN_DIR, 'background.js'), 'utf8');

  // Core code should come before DeepSeek code
  const corePos = bgContent.indexOf('function registerHandler');
  const dsPos = bgContent.indexOf('function registerDeepSeekHandlers');

  assert(corePos !== -1, '应包含核心 registerHandler 定义');
  assert(dsPos !== -1, '应包含 DeepSeek registerDeepSeekHandlers 定义');
  assert(corePos < dsPos, '核心代码应在 DeepSeek 代码之前');
});

// ── 测试 18: panel.js 合并顺序验证 ──

test('panel.js 合并顺序验证', () => {
  const panelContent = fs.readFileSync(path.join(MAIN_DIR, 'js', 'panel.js'), 'utf8');

  // Core code should come before DeepSeek code
  const corePos = panelContent.indexOf('function registerTab');
  const dsPos = panelContent.indexOf("id: 'doc'");

  assert(corePos !== -1, '应包含核心 registerTab 定义');
  assert(dsPos !== -1, '应包含 DeepSeek 文档整理标签页注册');
  assert(corePos < dsPos, '核心代码应在 DeepSeek 代码之前');
});

// ── 测试 19: web_accessible_resources 验证 ──

test('web_accessible_resources 验证', () => {
  const mainManifest = JSON.parse(
    fs.readFileSync(path.join(MAIN_DIR, 'manifest.json'), 'utf8')
  );
  const liteManifest = JSON.parse(
    fs.readFileSync(path.join(LITE_DIR, 'manifest.json'), 'utf8')
  );

  // Main should have DeepSeek web resources
  const mainResources = mainManifest.web_accessible_resources[0].resources.join(' ');
  assert(mainResources.includes('modules/deepseek/'), 'main 应暴露 DeepSeek 模块资源');

  // Lite should not have DeepSeek web resources
  const liteResources = liteManifest.web_accessible_resources[0].resources.join(' ');
  assert(!liteResources.includes('modules/deepseek/'), 'lite 不应暴露 DeepSeek 模块资源');
});

// ── 测试 20: buildMain 幂等性 ──

test('buildMain 幂等性', () => {
  // Build twice - should not error
  build.buildMain(MAIN_DIR);
  assert(fs.existsSync(MAIN_DIR), '重复构建后 dist/main/ 应存在');

  // Verify file still correct
  const bgContent = fs.readFileSync(path.join(MAIN_DIR, 'background.js'), 'utf8');
  assert(bgContent.includes('registerHandler'), '重复构建后 background.js 应正确');
});

// ── 测试 21: buildLite 幂等性 ──

test('buildLite 幂等性', () => {
  // Build twice - should not error
  build.buildLite(LITE_DIR);
  assert(fs.existsSync(LITE_DIR), '重复构建后 dist/lite/ 应存在');

  // Verify file still correct
  const bgContent = fs.readFileSync(path.join(LITE_DIR, 'background.js'), 'utf8');
  assert(bgContent.includes('registerHandler'), '重复构建后 background.js 应正确');
  assert(!bgContent.includes('registerDeepSeekHandlers'), '重复构建后不应包含 DeepSeek 代码');
});

// ── 测试结果 ──

console.log('\n' + '='.repeat(50));
console.log(`Build 脚本测试结果:`);
console.log(`  通过: ${passed}`);
console.log(`  失败: ${failed}`);
console.log(`  总计: ${passed + failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
