/**
 * Lite Version Tests
 * 验证 lite 版本构建输出的完整性和正确性，确保 DeepSeek 代码被正确排除
 * 运行方式: node tests/lite-version.test.js
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
const LITE_DIR = path.join(DIST, 'lite');

const build = require('../scripts/build');

// ── 确保构建完成 ──

test('构建 lite 版本', () => {
  build.removeDir(LITE_DIR);
  build.buildLite(LITE_DIR);
  assert(fs.existsSync(LITE_DIR), 'dist/lite/ 应创建');
});

// ── 测试 1: 文件完整性 - 根目录文件 ──

test('文件完整性 - 根目录文件', () => {
  const rootFiles = ['background.js', 'content.js', 'manifest.json'];
  for (const file of rootFiles) {
    assert(
      fs.existsSync(path.join(LITE_DIR, file)),
      `${file} 应存在`
    );
  }
});

// ── 测试 2: 文件完整性 - js 目录 ──

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
      fs.existsSync(path.join(LITE_DIR, 'js', file)),
      `js/${file} 应存在`
    );
  }
});

// ── 测试 3: DeepSeek 模块不应存在 ──

test('DeepSeek 模块不应存在', () => {
  assert(
    !fs.existsSync(path.join(LITE_DIR, 'modules')),
    'modules/ 目录不应存在'
  );
  assert(
    !fs.existsSync(path.join(LITE_DIR, 'modules', 'deepseek')),
    'modules/deepseek/ 目录不应存在'
  );
  assert(
    !fs.existsSync(path.join(LITE_DIR, 'modules', 'deepseek', 'api.js')),
    'modules/deepseek/api.js 不应存在'
  );
  assert(
    !fs.existsSync(path.join(LITE_DIR, 'modules', 'deepseek', 'bridge.js')),
    'modules/deepseek/bridge.js 不应存在'
  );
  assert(
    !fs.existsSync(path.join(LITE_DIR, 'modules', 'deepseek', 'client.js')),
    'modules/deepseek/client.js 不应存在'
  );
  assert(
    !fs.existsSync(path.join(LITE_DIR, 'modules', 'deepseek', 'wasm-solver.js')),
    'modules/deepseek/wasm-solver.js 不应存在'
  );
});

// ── 测试 4: 文件完整性 - libs 目录 ──

test('文件完整性 - libs 目录', () => {
  const libsFiles = ['jszip.min.js', 'cropper.min.js', 'cropper.min.css'];
  for (const file of libsFiles) {
    assert(
      fs.existsSync(path.join(LITE_DIR, 'libs', file)),
      `libs/${file} 应存在`
    );
  }
});

// ── 测试 5: 文件完整性 - icons 目录 ──

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
      fs.existsSync(path.join(LITE_DIR, 'icons', file)),
      `icons/${file} 应存在`
    );
  }
});

// ── 测试 6: 文件完整性 - css 目录 ──

test('文件完整性 - css 目录', () => {
  assert(
    fs.existsSync(path.join(LITE_DIR, 'css', 'panel.css')),
    'css/panel.css 应存在'
  );
});

// ── 测试 7: background.js - 核心代码存在 ──

test('background.js - 核心代码存在', () => {
  const bgContent = fs.readFileSync(path.join(LITE_DIR, 'background.js'), 'utf8');

  // 核心函数
  assert(bgContent.includes('function registerHandler'), '应包含 registerHandler 函数');
  assert(bgContent.includes('function isVideoPage'), '应包含 isVideoPage 函数');
  assert(bgContent.includes('function handleMessage'), '应包含 handleMessage 函数');
  assert(bgContent.includes('function updateIconForTab'), '应包含 updateIconForTab 函数');
});

// ── 测试 8: background.js - DeepSeek 代码不应存在 ──

test('background.js - DeepSeek 代码不应存在', () => {
  const bgContent = fs.readFileSync(path.join(LITE_DIR, 'background.js'), 'utf8');

  // DeepSeek 常量
  assert(!bgContent.includes('DS_URL'), '不应包含 DS_URL 常量');
  assert(!bgContent.includes('DS_DEFAULT_PROMPT'), '不应包含 DS_DEFAULT_PROMPT 常量');

  // DeepSeek 函数
  assert(!bgContent.includes('function registerDeepSeekHandlers'), '不应包含 registerDeepSeekHandlers 函数');
  assert(!bgContent.includes('function initDeepSeekModule'), '不应包含 initDeepSeekModule 函数');
  assert(!bgContent.includes('function dsCheckLogin'), '不应包含 dsCheckLogin 函数');
  assert(!bgContent.includes('function dsEnsureTab'), '不应包含 dsEnsureTab 函数');
  assert(!bgContent.includes('function dsHandleSend'), '不应包含 dsHandleSend 函数');
});

// ── 测试 9: background.js - 不应包含 DeepSeek 模块代码 ──

test('background.js - 不应包含 DeepSeek 模块代码', () => {
  const bgContent = fs.readFileSync(path.join(LITE_DIR, 'background.js'), 'utf8');

  // 检查 DeepSeek 模块特有的函数和常量
  assert(!bgContent.includes('DS_URL'), '不应包含 DS_URL 常量');
  assert(!bgContent.includes('DS_DEFAULT_PROMPT'), '不应包含 DS_DEFAULT_PROMPT 常量');
  assert(!bgContent.includes('registerDeepSeekHandlers'), '不应包含 registerDeepSeekHandlers 函数');
  assert(!bgContent.includes('initDeepSeekModule'), '不应包含 initDeepSeekModule 函数');
  assert(!bgContent.includes('dsCheckLogin'), '不应包含 dsCheckLogin 函数');
  assert(!bgContent.includes('dsEnsureTab'), '不应包含 dsEnsureTab 函数');
  assert(!bgContent.includes('dsHandleSend'), '不应包含 dsHandleSend 函数');
  assert(!bgContent.includes('stop_stream'), '不应包含 stop_stream API');
});

// ── 测试 10: panel.js - 核心代码存在 ──

test('panel.js - 核心代码存在', () => {
  const panelContent = fs.readFileSync(path.join(LITE_DIR, 'js', 'panel.js'), 'utf8');

  // 核心函数
  assert(panelContent.includes('function registerTab'), '应包含 registerTab 函数');
  assert(panelContent.includes('function toggleCollapse'), '应包含 toggleCollapse 函数');
  assert(panelContent.includes('BiViNote.panel'), '应包含 BiViNote.panel 接口');
});

// ── 测试 11: panel.js - DeepSeek 标签页不应存在 ──

test('panel.js - DeepSeek 标签页不应存在', () => {
  const panelContent = fs.readFileSync(path.join(LITE_DIR, 'js', 'panel.js'), 'utf8');

  // DeepSeek 标签页注册
  assert(!panelContent.includes("id: 'doc'"), '不应包含文档整理标签页注册');
  assert(!panelContent.includes("'文档整理'"), '不应包含文档整理标签页标签');
});

// ── 测试 12: panel.js - 不应包含 DeepSeek 模块代码 ──

test('panel.js - 不应包含 DeepSeek 模块代码', () => {
  const panelContent = fs.readFileSync(path.join(LITE_DIR, 'js', 'panel.js'), 'utf8');

  // 检查 DeepSeek 模块特有的函数（而非 UI 相关的 DeepSeek 引用）
  assert(!panelContent.includes('registerDeepSeekHandlers'), '不应包含 registerDeepSeekHandlers 函数');
  assert(!panelContent.includes('initDeepSeekModule'), '不应包含 initDeepSeekModule 函数');
  assert(!panelContent.includes('dsCheckLogin'), '不应包含 dsCheckLogin 函数');
  assert(!panelContent.includes('dsHandleSend'), '不应包含 dsHandleSend 函数');
});

// ── 测试 13: manifest - 基本信息 ──

test('manifest - 基本信息', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(LITE_DIR, 'manifest.json'), 'utf8'));

  assert(manifest.manifest_version === 3, 'manifest_version 应为 3');
  assert(manifest.name === 'BiViNote Lite', 'name 应为 BiViNote Lite');
  assert(typeof manifest.version === 'string', '应有 version 字段');
  assert(manifest.description.includes('B站'), 'description 应包含 B站');
});

// ── 测试 14: manifest - 权限配置 ──

test('manifest - 权限配置', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(LITE_DIR, 'manifest.json'), 'utf8'));

  // permissions
  assert(manifest.permissions.includes('storage'), '应有 storage 权限');
  assert(manifest.permissions.includes('activeTab'), '应有 activeTab 权限');
  assert(manifest.permissions.includes('scripting'), '应有 scripting 权限');
  assert(manifest.permissions.includes('tabs'), '应有 tabs 权限');

  // host_permissions - 不应包含 deepseek.com
  const hostPerms = manifest.host_permissions.join(' ');
  assert(hostPerms.includes('api.bilibili.com'), '应有 api.bilibili.com host 权限');
  assert(!hostPerms.includes('deepseek.com'), '不应有 deepseek.com host 权限');
});

// ── 测试 15: manifest - content_scripts ──

test('manifest - content_scripts', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(LITE_DIR, 'manifest.json'), 'utf8'));

  const jsFiles = manifest.content_scripts[0].js;

  // 核心文件
  assert(jsFiles.includes('js/panel.js'), '应包含 js/panel.js');
  assert(jsFiles.includes('js/state.js'), '应包含 js/state.js');
  assert(jsFiles.includes('content.js'), '应包含 content.js');

  // 不应包含任何 DeepSeek 模块文件
  assert(!jsFiles.includes('modules/deepseek/client.js'), '不应包含 modules/deepseek/client.js');
  assert(!jsFiles.includes('modules/deepseek/api.js'), '不应包含 modules/deepseek/api.js');
  assert(!jsFiles.includes('modules/deepseek/bridge.js'), '不应包含 modules/deepseek/bridge.js');
  assert(!jsFiles.includes('modules/deepseek/wasm-solver.js'), '不应包含 modules/deepseek/wasm-solver.js');

  // 检查是否没有任何 deepseek 相关文件
  const hasDeepSeek = jsFiles.some(f => f.includes('deepseek'));
  assert(!hasDeepSeek, 'content_scripts 不应包含任何 DeepSeek 文件');
});

// ── 测试 16: manifest - web_accessible_resources ──

test('manifest - web_accessible_resources', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(LITE_DIR, 'manifest.json'), 'utf8'));

  const resources = manifest.web_accessible_resources[0].resources.join(' ');
  assert(resources.includes('icons/*'), '应暴露 icons 资源');
  assert(!resources.includes('modules/deepseek/'), '不应暴露 DeepSeek 模块资源');
});

// ── 测试 17: 内容一致性 - content.js ──

test('content.js 内容一致', () => {
  const srcContent = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');
  const buildContent = fs.readFileSync(path.join(LITE_DIR, 'content.js'), 'utf8');

  assert(srcContent === buildContent, '构建的 content.js 应与源文件一致');
});

// ── 测试 18: 内容一致性 - 核心文件 ──

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
    const buildContent = fs.readFileSync(path.join(LITE_DIR, 'js', file), 'utf8');
    assert(srcContent === buildContent, `js/${file} 应与源文件一致`);
  }
});

// ── 测试 19: panel.js 应为核心版本 ──

test('panel.js 应为核心版本（非合并版本）', () => {
  const corePanel = fs.readFileSync(path.join(ROOT, 'src', 'core', 'panel.js'), 'utf8');
  const buildPanel = fs.readFileSync(path.join(LITE_DIR, 'js', 'panel.js'), 'utf8');

  assert(corePanel === buildPanel, 'panel.js 应与 src/core/panel.js 一致（非合并版本）');
});

// ── 测试 20: background.js 应为核心版本 ──

test('background.js 应为核心版本（非合并版本）', () => {
  const coreBg = fs.readFileSync(path.join(ROOT, 'src', 'core', 'background.js'), 'utf8');
  const buildBg = fs.readFileSync(path.join(LITE_DIR, 'background.js'), 'utf8');

  assert(coreBg === buildBg, 'background.js 应与 src/core/background.js 一致（非合并版本）');
});

// ── 测试 21: 文件大小验证 ──

test('文件大小验证', () => {
  // background.js 应该较小（仅核心代码）
  const bgSize = fs.statSync(path.join(LITE_DIR, 'background.js')).size;
  assert(bgSize > 1000, `background.js 应大于 1KB（实际: ${bgSize} bytes）`);
  assert(bgSize < 50000, `background.js 应小于 50KB（实际: ${bgSize} bytes）`);

  // panel.js 应该较小（仅核心代码）
  const panelSize = fs.statSync(path.join(LITE_DIR, 'js', 'panel.js')).size;
  assert(panelSize > 1000, `panel.js 应大于 1KB（实际: ${panelSize} bytes）`);
  assert(panelSize < 50000, `panel.js 应小于 50KB（实际: ${panelSize} bytes）`);

  // manifest.json 应该合理大小
  const manifestSize = fs.statSync(path.join(LITE_DIR, 'manifest.json')).size;
  assert(manifestSize > 100 && manifestSize < 10000, `manifest.json 大小应合理（实际: ${manifestSize} bytes）`);
});

// ── 测试 22: 与 main 版本对比 - background.js 应更小 ──

test('与 main 版本对比 - background.js 应更小', () => {
  const MAIN_DIR = path.join(DIST, 'main');

  // 确保 main 版本也已构建
  if (!fs.existsSync(MAIN_DIR)) {
    build.buildMain(MAIN_DIR);
  }

  const liteBgSize = fs.statSync(path.join(LITE_DIR, 'background.js')).size;
  const mainBgSize = fs.statSync(path.join(MAIN_DIR, 'background.js')).size;

  assert(liteBgSize < mainBgSize, `lite background.js (${liteBgSize}) 应小于 main background.js (${mainBgSize})`);
});

// ── 测试 23: 与 main 版本对比 - panel.js 应更小 ──

test('与 main 版本对比 - panel.js 应更小', () => {
  const MAIN_DIR = path.join(DIST, 'main');

  // 确保 main 版本也已构建
  if (!fs.existsSync(MAIN_DIR)) {
    build.buildMain(MAIN_DIR);
  }

  const litePanelSize = fs.statSync(path.join(LITE_DIR, 'js', 'panel.js')).size;
  const mainPanelSize = fs.statSync(path.join(MAIN_DIR, 'js', 'panel.js')).size;

  assert(litePanelSize < mainPanelSize, `lite panel.js (${litePanelSize}) 应小于 main panel.js (${mainPanelSize})`);
});

// ── 测试 24: 与 main 版本对比 - 文件数量应更少 ──

test('与 main 版本对比 - 文件数量应更少', () => {
  const MAIN_DIR = path.join(DIST, 'main');

  // 确保 main 版本也已构建
  if (!fs.existsSync(MAIN_DIR)) {
    build.buildMain(MAIN_DIR);
  }

  // 统计文件数量
  function countFiles(dir) {
    let count = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countFiles(fullPath);
      } else {
        count++;
      }
    }
    return count;
  }

  const liteFileCount = countFiles(LITE_DIR);
  const mainFileCount = countFiles(MAIN_DIR);

  assert(liteFileCount < mainFileCount, `lite 文件数 (${liteFileCount}) 应少于 main 文件数 (${mainFileCount})`);
});

// ── 测试 25: JavaScript 语法验证 ──

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
  ];

  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(LITE_DIR, file), 'utf8');
    // 使用 Node.js 解析器验证语法
    try {
      new Function(content);
      assert(true, `${file} 语法正确`);
    } catch (err) {
      assert(false, `${file} 语法错误: ${err.message}`);
    }
  }
});

// ── 测试 26: 边界情况 - 不存在的目录应被处理 ──

test('不存在的目录应被处理', () => {
  const tempDir = path.join(DIST, 'temp-test');
  build.removeDir(tempDir);
  assert(!fs.existsSync(tempDir), '不存在的目录应被安全处理');
});

// ── 测试 27: 幂等性验证 ──

test('幂等性验证', () => {
  // 再次构建
  build.buildLite(LITE_DIR);
  assert(fs.existsSync(LITE_DIR), '重复构建后 dist/lite/ 应存在');

  // 验证内容仍然正确
  const bgContent = fs.readFileSync(path.join(LITE_DIR, 'background.js'), 'utf8');
  assert(bgContent.includes('registerHandler'), '重复构建后 background.js 应正确');
  assert(!bgContent.includes('registerDeepSeekHandlers'), '重复构建后不应包含 DeepSeek 代码');
});

// ── 测试 28: DeepSeek 模块代码全面检查 ──

test('DeepSeek 模块代码全面检查', () => {
  // 检查所有 JS 文件是否包含 DeepSeek 模块特有的代码
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
  ];

  // DeepSeek 模块特有的函数和常量（不应出现在 lite 版本中）
  const deepseekModuleKeywords = [
    'DS_URL',
    'DS_DEFAULT_PROMPT',
    'registerDeepSeekHandlers',
    'initDeepSeekModule',
    'dsCheckLogin',
    'dsEnsureTab',
    'dsHandleSend',
    'stop_stream',
  ];

  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(LITE_DIR, file), 'utf8');
    for (const keyword of deepseekModuleKeywords) {
      assert(
        !content.includes(keyword),
        `${file} 不应包含 DeepSeek 模块代码: ${keyword}`
      );
    }
  }
});

// ── 测试结果 ──

console.log('\n' + '='.repeat(50));
console.log(`Lite 版本测试结果:`);
console.log(`  通过: ${passed}`);
console.log(`  失败: ${failed}`);
console.log(`  总计: ${passed + failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
