/**
 * Main Version Tests
 * 验证 main 版本构建输出的完整性和正确性
 * 运行方式: node tests/main-version.test.js
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

const build = require('../scripts/build');

// ── 确保构建完成 ──

test('构建 main 版本', () => {
  build.removeDir(MAIN_DIR);
  build.buildMain(MAIN_DIR);
  assert(fs.existsSync(MAIN_DIR), 'dist/main/ 应创建');
});

// ── 测试 1: 文件完整性 ──

test('文件完整性 - 根目录文件', () => {
  const rootFiles = ['background.js', 'content.js', 'manifest.json'];
  for (const file of rootFiles) {
    assert(
      fs.existsSync(path.join(MAIN_DIR, file)),
      `${file} 应存在`
    );
  }
});

test('文件完整性 - js 目录', () => {
  const jsFiles = [
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
  for (const file of jsFiles) {
    assert(
      fs.existsSync(path.join(MAIN_DIR, 'js', file)),
      `js/${file} 应存在`
    );
  }
});

test('文件完整性 - DeepSeek 模块', () => {
  const dsFiles = ['api.js', 'bridge.js', 'client.js', 'wasm-solver.js'];
  for (const file of dsFiles) {
    assert(
      fs.existsSync(path.join(MAIN_DIR, 'modules', 'deepseek', file)),
      `modules/deepseek/${file} 应存在`
    );
  }
});

test('文件完整性 - libs 目录', () => {
  const libsFiles = ['jszip.min.js', 'cropper.min.js', 'cropper.min.css'];
  for (const file of libsFiles) {
    assert(
      fs.existsSync(path.join(MAIN_DIR, 'libs', file)),
      `libs/${file} 应存在`
    );
  }
});

test('文件完整性 - icons 目录', () => {
  const iconFiles = [
    'icon-16.png',
    'icon-32.png',
    'icon-48.png',
    'icon-128.png',
    'icon-16-disabled.png',
    'icon-32-disabled.png',
    'icon-48-disabled.png',
    'icon-128-disabled.png',
  ];
  for (const file of iconFiles) {
    assert(
      fs.existsSync(path.join(MAIN_DIR, 'icons', file)),
      `icons/${file} 应存在`
    );
  }
});

test('文件完整性 - css 目录', () => {
  assert(
    fs.existsSync(path.join(MAIN_DIR, 'css', 'panel.css')),
    'css/panel.css 应存在'
  );
});

// ── 测试 2: background.js 合并验证 ──

test('background.js - 核心代码', () => {
  const bgContent = fs.readFileSync(path.join(MAIN_DIR, 'background.js'), 'utf8');

  // 核心函数
  assert(bgContent.includes('function registerHandler'), '应包含 registerHandler 函数');
  assert(bgContent.includes('function isVideoPage'), '应包含 isVideoPage 函数');
  assert(bgContent.includes('function handleMessage'), '应包含 handleMessage 函数');
  assert(bgContent.includes('function updateIconForTab'), '应包含 updateIconForTab 函数');
});

test('background.js - DeepSeek 代码', () => {
  const bgContent = fs.readFileSync(path.join(MAIN_DIR, 'background.js'), 'utf8');

  // DeepSeek 常量
  assert(bgContent.includes('DS_URL'), '应包含 DS_URL 常量');
  assert(bgContent.includes('DS_DEFAULT_PROMPT'), '应包含 DS_DEFAULT_PROMPT 常量');

  // DeepSeek 函数
  assert(bgContent.includes('function registerDeepSeekHandlers'), '应包含 registerDeepSeekHandlers 函数');
  assert(bgContent.includes('function initDeepSeekModule'), '应包含 initDeepSeekModule 函数');
  assert(bgContent.includes('function dsCheckLogin'), '应包含 dsCheckLogin 函数');
  assert(bgContent.includes('function dsEnsureTab'), '应包含 dsEnsureTab 函数');
  assert(bgContent.includes('function dsHandleSend'), '应包含 dsHandleSend 函数');
});

test('background.js - 合并顺序', () => {
  const bgContent = fs.readFileSync(path.join(MAIN_DIR, 'background.js'), 'utf8');

  const corePos = bgContent.indexOf('function registerHandler');
  const dsPos = bgContent.indexOf('function registerDeepSeekHandlers');

  assert(corePos !== -1, '应包含核心 registerHandler 定义');
  assert(dsPos !== -1, '应包含 DeepSeek registerDeepSeekHandlers 定义');
  assert(corePos < dsPos, '核心代码应在 DeepSeek 代码之前');
});

// ── 测试 3: panel.js 合并验证 ──

test('panel.js - 核心代码', () => {
  const panelContent = fs.readFileSync(path.join(MAIN_DIR, 'js', 'panel.js'), 'utf8');

  // 核心函数
  assert(panelContent.includes('function registerTab'), '应包含 registerTab 函数');
  assert(panelContent.includes('function toggleCollapse'), '应包含 toggleCollapse 函数');
  assert(panelContent.includes('BiViNote.panel'), '应包含 BiViNote.panel 接口');
});

test('panel.js - DeepSeek 标签页', () => {
  const panelContent = fs.readFileSync(path.join(MAIN_DIR, 'js', 'panel.js'), 'utf8');

  // DeepSeek 标签页注册
  assert(panelContent.includes("id: 'doc'"), '应包含文档整理标签页注册');
  assert(panelContent.includes("'文档整理'"), '应包含文档整理标签页标签');
  assert(panelContent.includes('registerTab'), '应包含 registerTab 函数');
});

test('panel.js - 合并顺序', () => {
  const panelContent = fs.readFileSync(path.join(MAIN_DIR, 'js', 'panel.js'), 'utf8');

  const corePos = panelContent.indexOf('function registerTab');
  const dsPos = panelContent.indexOf("id: 'doc'");

  assert(corePos !== -1, '应包含核心 registerTab 定义');
  assert(dsPos !== -1, '应包含 DeepSeek 文档整理标签页注册');
  assert(corePos < dsPos, '核心代码应在 DeepSeek 代码之前');
});

// ── 测试 4: manifest 验证 ──

test('manifest - 基本信息', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(MAIN_DIR, 'manifest.json'), 'utf8'));

  assert(manifest.manifest_version === 3, 'manifest_version 应为 3');
  assert(manifest.name === 'BiViNote', 'name 应为 BiViNote');
  assert(typeof manifest.version === 'string', '应有 version 字段');
  assert(manifest.description.includes('B站'), 'description 应包含 B站');
});

test('manifest - 权限配置', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(MAIN_DIR, 'manifest.json'), 'utf8'));

  // permissions
  assert(manifest.permissions.includes('storage'), '应有 storage 权限');
  assert(manifest.permissions.includes('activeTab'), '应有 activeTab 权限');
  assert(manifest.permissions.includes('scripting'), '应有 scripting 权限');
  assert(manifest.permissions.includes('tabs'), '应有 tabs 权限');

  // host_permissions
  const hostPerms = manifest.host_permissions.join(' ');
  assert(hostPerms.includes('api.bilibili.com'), '应有 api.bilibili.com host 权限');
  assert(hostPerms.includes('deepseek.com'), '应有 deepseek.com host 权限');
});

test('manifest - content_scripts', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(MAIN_DIR, 'manifest.json'), 'utf8'));

  const jsFiles = manifest.content_scripts[0].js;

  // 核心文件
  assert(jsFiles.includes('js/panel.js'), '应包含 js/panel.js');
  assert(jsFiles.includes('js/state.js'), '应包含 js/state.js');
  assert(jsFiles.includes('content.js'), '应包含 content.js');

  // DeepSeek 模块文件
  assert(jsFiles.includes('modules/deepseek/client.js'), '应包含 modules/deepseek/client.js');
  assert(jsFiles.includes('modules/deepseek/api.js'), '应包含 modules/deepseek/api.js');
  assert(jsFiles.includes('modules/deepseek/bridge.js'), '应包含 modules/deepseek/bridge.js');
  assert(jsFiles.includes('modules/deepseek/wasm-solver.js'), '应包含 modules/deepseek/wasm-solver.js');

  // 不应包含已合并的文件
  assert(!jsFiles.includes('modules/deepseek/panel.js'), '不应包含 modules/deepseek/panel.js（已合并）');
});

test('manifest - web_accessible_resources', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(MAIN_DIR, 'manifest.json'), 'utf8'));

  const resources = manifest.web_accessible_resources[0].resources.join(' ');
  assert(resources.includes('icons/*'), '应暴露 icons 资源');
  assert(resources.includes('modules/deepseek/'), '应暴露 DeepSeek 模块资源');
});

// ── 测试 5: 内容一致性 ──

test('content.js 内容一致', () => {
  const srcContent = fs.readFileSync(path.join(ROOT, 'src', 'core', 'content.js'), 'utf8');
  const buildContent = fs.readFileSync(path.join(MAIN_DIR, 'content.js'), 'utf8');

  assert(srcContent === buildContent, '构建的 content.js 应与源文件一致');
});

test('核心文件内容一致', () => {
  const coreFiles = [
    'state.js',
    'subtitle.js',
    'chapter.js',
    'video-info.js',
    'capture.js',
    'export.js',
    'settings.js',
    'crop-viewer.js',
  ];

  for (const file of coreFiles) {
    const srcContent = fs.readFileSync(path.join(ROOT, 'src', 'core', file), 'utf8');
    const buildContent = fs.readFileSync(path.join(MAIN_DIR, 'js', file), 'utf8');
    assert(srcContent === buildContent, `js/${file} 应与源文件一致`);
  }
});

test('DeepSeek 模块文件内容一致', () => {
  const dsFiles = ['api.js', 'bridge.js', 'client.js', 'wasm-solver.js'];

  for (const file of dsFiles) {
    const srcContent = fs.readFileSync(path.join(ROOT, 'src', 'modules', 'deepseek', file), 'utf8');
    const buildContent = fs.readFileSync(path.join(MAIN_DIR, 'modules', 'deepseek', file), 'utf8');
    assert(srcContent === buildContent, `modules/deepseek/${file} 应与源文件一致`);
  }
});

// ── 测试 6: 文件大小验证 ──

test('文件大小验证', () => {
  // background.js 应该较大（合并后）
  const bgSize = fs.statSync(path.join(MAIN_DIR, 'background.js')).size;
  assert(bgSize > 10000, `background.js 应大于 10KB（实际: ${bgSize} bytes）`);

  // panel.js 应该较大（合并后）
  const panelSize = fs.statSync(path.join(MAIN_DIR, 'js', 'panel.js')).size;
  assert(panelSize > 10000, `panel.js 应大于 10KB（实际: ${panelSize} bytes）`);

  // manifest.json 应该合理大小
  const manifestSize = fs.statSync(path.join(MAIN_DIR, 'manifest.json')).size;
  assert(manifestSize > 100 && manifestSize < 10000, `manifest.json 大小应合理（实际: ${manifestSize} bytes）`);
});

// ── 测试 7: 语法验证 ──

test('JavaScript 语法验证', () => {
  const jsFiles = [
    'background.js',
    'content.js',
    'js/state.js',
    'js/panel.js',
    'js/subtitle.js',
    'js/chapter.js',
    'js/video-info.js',
    'js/capture.js',
    'js/export.js',
    'js/settings.js',
    'js/crop-viewer.js',
    'modules/deepseek/client.js',
    'modules/deepseek/api.js',
    'modules/deepseek/bridge.js',
    'modules/deepseek/wasm-solver.js',
  ];

  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(MAIN_DIR, file), 'utf8');
    // 使用 Node.js 解析器验证语法
    try {
      new Function(content);
      assert(true, `${file} 语法正确`);
    } catch (err) {
      assert(false, `${file} 语法错误: ${err.message}`);
    }
  }
});

// ── 测试 8: 边界情况 ──

test('不存在的目录应被处理', () => {
  const tempDir = path.join(DIST, 'temp-test');
  build.removeDir(tempDir);
  assert(!fs.existsSync(tempDir), '不存在的目录应被安全处理');
});

test('幂等性验证', () => {
  // 再次构建
  build.buildMain(MAIN_DIR);
  assert(fs.existsSync(MAIN_DIR), '重复构建后 dist/main/ 应存在');

  // 验证内容仍然正确
  const bgContent = fs.readFileSync(path.join(MAIN_DIR, 'background.js'), 'utf8');
  assert(bgContent.includes('registerHandler'), '重复构建后 background.js 应正确');
  assert(bgContent.includes('registerDeepSeekHandlers'), '重复构建后应包含 DeepSeek 代码');
});

// ── 测试结果 ──

console.log('\n' + '='.repeat(50));
console.log(`Main 版本测试结果:`);
console.log(`  通过: ${passed}`);
console.log(`  失败: ${failed}`);
console.log(`  总计: ${passed + failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
