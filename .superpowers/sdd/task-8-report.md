# Task 8 Report: 创建构建脚本

## Status: DONE

## What Was Implemented

Created a build script (`scripts/build.js`) that builds both main and lite versions of the BiViNote extension from modular source files.

### Build Script Features

1. **Core file copying**: Copies 9 core files from `src/core/` to `js/` in the output
2. **Shared resources**: Copies `libs/`, `icons/`, `css/` directories
3. **Background merging**: Concatenates `src/core/background.js` + `src/modules/deepseek/background.js` for main version
4. **Panel merging**: Concatenates `src/core/panel.js` + `src/modules/deepseek/panel.js` for main version
5. **DeepSeek module files**: Copies `api.js`, `bridge.js`, `client.js`, `wasm-solver.js` to `modules/deepseek/`
6. **Manifest handling**: Copies and adjusts manifest (removes merged `modules/deepseek/panel.js` reference)

### Usage

```bash
node scripts/build.js           # Build both versions
node scripts/build.js main      # Build main version only
node scripts/build.js lite      # Build lite version only
```

### Output Structure

```
dist/main/                     dist/lite/
├── background.js              ├── background.js
├── content.js                 ├── content.js
├── manifest.json              ├── manifest.json
├── js/                        ├── js/
│   ├── panel.js (merged)      │   ├── panel.js (core only)
│   ├── state.js               │   ├── state.js
│   ├── subtitle.js            │   ├── subtitle.js
│   └── ...                    │   └── ...
├── modules/deepseek/          ├── libs/
│   ├── api.js                 │   ├── jszip.min.js
│   ├── bridge.js              │   └── ...
│   ├── client.js              ├── icons/
│   └── wasm-solver.js         └── css/
├── libs/
├── icons/
└── css/
```

### Files Created

| File | Description |
|------|-------------|
| `scripts/build.js` | Build script (4.5 KB) |
| `tests/build.test.js` | Build script tests (21 test groups, 164 assertions) |

### Files Modified

| File | Change |
|------|--------|
| `.gitignore` | Added `dist/` to ignore build output |

## What Was Tested

All 164 tests pass:

```
build.test.js: 164 通过, 0 失败
```

### Test Coverage

1. Module exports (buildMain, buildLite, utility functions)
2. Constants definition (CORE_FILES, SHARED_DIRS, etc.)
3. Core file list completeness
4. DeepSeek module file list (excludes merged files)
5. Source file existence validation
6. Main version build output structure
7. Main background.js merge verification (core + DeepSeek code present)
8. Main panel.js merge verification (core + DeepSeek code present)
9. Main manifest validation (merged panel reference removed)
10. Lite version build output structure
11. Lite background.js verification (no DeepSeek code)
12. Lite panel.js verification (no DeepSeek code)
13. Lite manifest validation (no DeepSeek references)
14. libs/ directory content
15. icons/ directory content
16. css/ directory content
17. background.js merge order (core before DeepSeek)
18. panel.js merge order (core before DeepSeek)
19. web_accessible_resources validation
20. buildMain idempotency
21. buildLite idempotency

## Self-Review Findings

None. The implementation:

1. **Complete**: All 6 requirements from the task description implemented
2. **Correct merging**: Core code comes before DeepSeek code in merged files
3. **Manifest adjusted**: `modules/deepseek/panel.js` removed from main manifest since it's merged into `js/panel.js`
4. **Idempotent**: Building multiple times produces the same result
5. **Selective building**: Supports building main, lite, or both versions
6. **Comprehensive tests**: 164 assertions covering all aspects

## Notes

- The `libs/` directory in the project root contains some legacy DeepSeek files (deepseek-api.js, deepseek-bridge.js, wasm-solver.js) that get copied as shared resources. These are harmless extra files that the manifest doesn't reference.
- The `dist/` directory was added to `.gitignore` since it's a build artifact.
- Removed pre-existing `.gitkeep` files from `dist/main/` and `dist/lite/` since the build script creates these directories dynamically.
