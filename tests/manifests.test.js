/**
 * Manifest Files Tests
 * 验证 main 和 lite 版本的 manifest.json 文件
 * 运行方式: node tests/manifests.test.js
 */

const fs = require('fs');
const path = require('path');

// 测试计数器
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ ${message}`);
    failed++;
  }
}

function test(name, fn) {
  console.log(`\n测试: ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`✗ ${name} - 异常: ${err.message}`);
    failed++;
  }
}

// ── 加载 manifest 文件 ──

const manifestsDir = path.join(__dirname, '..', 'src', 'manifests');
const mainManifestPath = path.join(manifestsDir, 'manifest-main.json');
const liteManifestPath = path.join(manifestsDir, 'manifest-lite.json');

let mainManifest, liteManifest;

// ── 测试 1: 文件存在性 ──

test('文件存在性', () => {
  assert(fs.existsSync(mainManifestPath), 'manifest-main.json 应该存在');
  assert(fs.existsSync(liteManifestPath), 'manifest-lite.json 应该存在');
});

// ── 测试 2: JSON 解析 ──

test('JSON 解析', () => {
  try {
    const mainContent = fs.readFileSync(mainManifestPath, 'utf8');
    mainManifest = JSON.parse(mainContent);
    assert(true, 'manifest-main.json 应该是有效的 JSON');
  } catch (err) {
    assert(false, `manifest-main.json 解析失败: ${err.message}`);
  }

  try {
    const liteContent = fs.readFileSync(liteManifestPath, 'utf8');
    liteManifest = JSON.parse(liteContent);
    assert(true, 'manifest-lite.json 应该是有效的 JSON');
  } catch (err) {
    assert(false, `manifest-lite.json 解析失败: ${err.message}`);
  }
});

// ── 测试 3: 必需字段 ──

test('必需字段', () => {
  assert(mainManifest.manifest_version === 3, 'main 应该有 manifest_version: 3');
  assert(liteManifest.manifest_version === 3, 'lite 应该有 manifest_version: 3');

  assert(typeof mainManifest.name === 'string' && mainManifest.name.length > 0, 'main 应该有 name 字段');
  assert(typeof liteManifest.name === 'string' && liteManifest.name.length > 0, 'lite 应该有 name 字段');

  assert(typeof mainManifest.version === 'string' && mainManifest.version.length > 0, 'main 应该有 version 字段');
  assert(typeof liteManifest.version === 'string' && liteManifest.version.length > 0, 'lite 应该有 version 字段');

  assert(typeof mainManifest.description === 'string', 'main 应该有 description 字段');
  assert(typeof liteManifest.description === 'string', 'lite 应该有 description 字段');
});

// ── 测试 4: 版本名称区分 ──

test('版本名称区分', () => {
  assert(mainManifest.name === 'BiViNote', 'main 版本名称应该是 BiViNote');
  assert(liteManifest.name === 'BiViNote Lite', 'lite 版本名称应该是 BiViNote Lite');
});

// ── 测试 5: 权限配置 ──

test('权限配置', () => {
  // 两个版本都应该有基本权限
  assert(Array.isArray(mainManifest.permissions), 'main 应该有 permissions 数组');
  assert(Array.isArray(liteManifest.permissions), 'lite 应该有 permissions 数组');

  assert(mainManifest.permissions.includes('storage'), 'main 应该有 storage 权限');
  assert(liteManifest.permissions.includes('storage'), 'lite 应该有 storage 权限');

  // 两个版本都应该有 bilibili host 权限
  assert(Array.isArray(mainManifest.host_permissions), 'main 应该有 host_permissions 数组');
  assert(Array.isArray(liteManifest.host_permissions), 'lite 应该有 host_permissions 数组');

  const mainHostPerms = mainManifest.host_permissions.join(' ');
  const liteHostPerms = liteManifest.host_permissions.join(' ');

  assert(mainHostPerms.includes('bilibili.com'), 'main 应该有 bilibili.com host 权限');
  assert(liteHostPerms.includes('bilibili.com'), 'lite 应该有 bilibili.com host 权限');
});

// ── 测试 6: DeepSeek 权限差异 ──

test('DeepSeek 权限差异', () => {
  const mainHostPerms = mainManifest.host_permissions.join(' ');
  const liteHostPerms = liteManifest.host_permissions.join(' ');

  assert(mainHostPerms.includes('deepseek.com'), 'main 应该有 deepseek.com host 权限');
  assert(!liteHostPerms.includes('deepseek.com'), 'lite 不应该有 deepseek.com host 权限');
});

// ── 测试 7: 后台脚本配置 ──

test('后台脚本配置', () => {
  assert(mainManifest.background && mainManifest.background.service_worker, 'main 应该有 background.service_worker');
  assert(liteManifest.background && liteManifest.background.service_worker, 'lite 应该有 background.service_worker');

  assert(mainManifest.background.service_worker === 'background.js', 'main 的 service_worker 应该是 background.js');
  assert(liteManifest.background.service_worker === 'background.js', 'lite 的 service_worker 应该是 background.js');
});

// ── 测试 8: 内容脚本配置 ──

test('内容脚本配置', () => {
  assert(Array.isArray(mainManifest.content_scripts), 'main 应该有 content_scripts 数组');
  assert(Array.isArray(liteManifest.content_scripts), 'lite 应该有 content_scripts 数组');

  assert(mainManifest.content_scripts.length > 0, 'main 应该有至少一个 content_script');
  assert(liteManifest.content_scripts.length > 0, 'lite 应该有至少一个 content_script');

  const mainContentScript = mainManifest.content_scripts[0];
  const liteContentScript = liteManifest.content_scripts[0];

  assert(mainContentScript.run_at === 'document_idle', 'main 的 content_script 应该在 document_idle 运行');
  assert(liteContentScript.run_at === 'document_idle', 'lite 的 content_script 应该在 document_idle 运行');

  assert(Array.isArray(mainContentScript.js), 'main 应该有 js 数组');
  assert(Array.isArray(liteContentScript.js), 'lite 应该有 js 数组');

  assert(Array.isArray(mainContentScript.css), 'main 应该有 css 数组');
  assert(Array.isArray(liteContentScript.css), 'lite 应该有 css 数组');
});

// ── 测试 9: 核心文件包含 ──

test('核心文件包含', () => {
  const mainJs = mainManifest.content_scripts[0].js;
  const liteJs = liteManifest.content_scripts[0].js;

  // 核心库文件
  assert(mainJs.includes('libs/jszip.min.js'), 'main 应该包含 jszip.min.js');
  assert(liteJs.includes('libs/jszip.min.js'), 'lite 应该包含 jszip.min.js');

  assert(mainJs.includes('libs/cropper.min.js'), 'main 应该包含 cropper.min.js');
  assert(liteJs.includes('libs/cropper.min.js'), 'lite 应该包含 cropper.min.js');

  // 核心模块文件
  const coreFiles = [
    'js/state.js',
    'js/panel.js',
    'js/subtitle.js',
    'js/chapter.js',
    'js/video-info.js',
    'js/capture.js',
    'js/export.js',
    'js/settings.js',
    'js/crop-viewer.js',
    'content.js'
  ];

  for (const file of coreFiles) {
    assert(mainJs.includes(file), `main 应该包含 ${file}`);
    assert(liteJs.includes(file), `lite 应该包含 ${file}`);
  }
});

// ── 测试 10: DeepSeek 文件差异 ──

test('DeepSeek 文件差异', () => {
  const mainJs = mainManifest.content_scripts[0].js;
  const liteJs = liteManifest.content_scripts[0].js;

  // DeepSeek 相关文件
  const deepseekFiles = [
    'modules/deepseek/wasm-solver.js',
    'modules/deepseek/bridge.js',
    'modules/deepseek/api.js',
    'modules/deepseek/client.js',
    'modules/deepseek/panel.js'
  ];

  for (const file of deepseekFiles) {
    assert(mainJs.includes(file), `main 应该包含 ${file}`);
    assert(!liteJs.includes(file), `lite 不应该包含 ${file}`);
  }
});

// ── 测试 11: CSS 文件 ──

test('CSS 文件', () => {
  const mainCss = mainManifest.content_scripts[0].css;
  const liteCss = liteManifest.content_scripts[0].css;

  assert(mainCss.includes('libs/cropper.min.css'), 'main 应该包含 cropper.min.css');
  assert(liteCss.includes('libs/cropper.min.css'), 'lite 应该包含 cropper.min.css');

  assert(mainCss.includes('css/panel.css'), 'main 应该包含 panel.css');
  assert(liteCss.includes('css/panel.css'), 'lite 应该包含 panel.css');
});

// ── 测试 12: 图标配置 ──

test('图标配置', () => {
  assert(mainManifest.icons, 'main 应该有 icons 配置');
  assert(liteManifest.icons, 'lite 应该有 icons 配置');

  assert(mainManifest.action, 'main 应该有 action 配置');
  assert(liteManifest.action, 'lite 应该有 action 配置');

  assert(mainManifest.action.default_icon, 'main 应该有 default_icon 配置');
  assert(liteManifest.action.default_icon, 'lite 应该有 default_icon 配置');
});

// ── 测试 13: Web Accessible Resources ──

test('Web Accessible Resources', () => {
  assert(Array.isArray(mainManifest.web_accessible_resources), 'main 应该有 web_accessible_resources 数组');
  assert(Array.isArray(liteManifest.web_accessible_resources), 'lite 应该有 web_accessible_resources 数组');

  const mainResources = mainManifest.web_accessible_resources[0].resources.join(' ');
  const liteResources = liteManifest.web_accessible_resources[0].resources.join(' ');

  assert(mainResources.includes('icons/*'), 'main 应该暴露 icons 资源');
  assert(liteResources.includes('icons/*'), 'lite 应该暴露 icons 资源');

  // DeepSeek 资源差异
  assert(mainResources.includes('modules/deepseek/'), 'main 应该暴露 DeepSeek 模块资源');
  assert(!liteResources.includes('modules/deepseek/'), 'lite 不应该暴露 DeepSeek 模块资源');
});

// ── 测试 14: 匹配模式 ──

test('匹配模式', () => {
  const mainContentScript = mainManifest.content_scripts[0];
  const liteContentScript = liteManifest.content_scripts[0];

  assert(mainContentScript.matches.includes('*://*.bilibili.com/video/*'), 'main 应该匹配 bilibili 视频页');
  assert(liteContentScript.matches.includes('*://*.bilibili.com/video/*'), 'lite 应该匹配 bilibili 视频页');

  assert(mainContentScript.matches.includes('*://*.bilibili.com/list/*'), 'main 应该匹配 bilibili 列表页');
  assert(liteContentScript.matches.includes('*://*.bilibili.com/list/*'), 'lite 应该匹配 bilibili 列表页');
});

// ── 测试结果 ──

console.log('\n' + '='.repeat(50));
console.log(`Manifest 文件测试结果:`);
console.log(`  通过: ${passed}`);
console.log(`  失败: ${failed}`);
console.log(`  总计: ${passed + failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
