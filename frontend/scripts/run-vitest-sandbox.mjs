import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sharedVitestConfig } from '../vitest.shared.mjs';

const require = createRequire(import.meta.url);
const childProcess = require('node:child_process');
const ts = require('typescript');

const emptyMap = JSON.stringify({ version: 3, sources: [], names: [], mappings: '' });

function createNoopChild() {
  const child = {
    on() {
      return child;
    },
    kill() {
      return true;
    },
    stdout: {
      on() {
        return child;
      },
      setEncoding() {
        return child;
      },
    },
    stderr: {
      on() {
        return child;
      },
      setEncoding() {
        return child;
      },
    },
  };

  return child;
}

// Vite probes `net use` on Windows before resolving config paths.
childProcess.exec = (...args) => {
  const callback = typeof args.at(-1) === 'function' ? args.at(-1) : null;
  if (callback) {
    queueMicrotask(() => callback(null, '', ''));
  }
  return createNoopChild();
};

const transpile = (code, filename) => {
  const result = ts.transpileModule(code, {
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      sourceMap: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });

  return {
    code: result.outputText,
    map: result.sourceMapText || emptyMap,
    warnings: [],
  };
};

const esbuildShim = {
  __esModule: true,
  transform: async (code, options = {}) => transpile(code, options.sourcefile || 'input.ts'),
  transformSync: (code, options = {}) => transpile(code, options.sourcefile || 'input.ts'),
};

esbuildShim.default = esbuildShim;
const esbuildPath = require.resolve('esbuild');
require.cache[esbuildPath] = {
  id: esbuildPath,
  filename: esbuildPath,
  loaded: true,
  exports: esbuildShim,
  children: [],
  paths: [],
};

syncBuiltinESMExports();

const tempConfigDir = mkdtempSync(join(tmpdir(), 'vitest-config-'));
const tempConfigFile = join(tempConfigDir, 'vitest.config.mjs');
writeFileSync(tempConfigFile, `export default ${JSON.stringify(sharedVitestConfig, null, 2)};\n`, 'utf8');

process.argv = [
  process.argv[0],
  'vitest',
  'run',
  '--root',
  process.cwd(),
  '--config',
  tempConfigFile,
  '--configLoader',
  'runner',
  ...process.argv.slice(2),
];

await import(pathToFileURL(join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs')).href);
