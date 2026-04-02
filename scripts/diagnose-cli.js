#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * List every PATH hit for aifabrix / af and each --version (find duplicate installs).
 *
 * @fileoverview CLI path diagnostic for @aifabrix/builder
 */

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Reads package.json `bin` field.
 * @returns {Record<string, string>|string} Bin map or single path string
 */
function readBins() {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.bin || { aifabrix: 'bin/aifabrix.js' };
}

/**
 * Resolves every PATH directory that exposes an executable named `binName`.
 * @param {string} binName - CLI name (e.g. aifabrix)
 * @returns {Array<{ path: string, real: string }>} Deduped hits with real paths
 */
function locationsOnPath(binName) {
  if (process.platform === 'win32') {
    try {
      const out = execSync(`where ${binName}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      return out.split(/\r?\n/).filter(Boolean).map((p) => ({ path: p, real: p }));
    } catch {
      return [];
    }
  }

  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const out = [];
  const seenReal = new Set();
  for (const dir of dirs) {
    const candidate = path.join(dir, binName);
    try {
      const st = fs.lstatSync(candidate);
      if (!st.isFile() && !st.isSymbolicLink()) continue;
      fs.accessSync(candidate, fs.constants.X_OK);
      const real = fs.realpathSync(candidate);
      if (seenReal.has(real)) continue;
      seenReal.add(real);
      out.push({ path: candidate, real });
    } catch {
      // not found or not executable
    }
  }
  return out;
}

/**
 * Runs `executablePath --version` and returns stdout or null on failure.
 * @param {string} executablePath - Absolute path to the binary
 * @returns {string|null} Trimmed version output
 */
function versionAt(executablePath) {
  try {
    return execFileSync(executablePath, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Prints PNPM_HOME and npm prefix for debugging PATH issues.
 * @returns {void}
 */
function printEnvironment() {
  console.log('Environment (relevant to global CLIs)\n');
  console.log(`  PNPM_HOME     ${process.env.PNPM_HOME || '(not set)'}`);
  try {
    const prefix = execSync('npm config get prefix', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    console.log(`  npm prefix    ${prefix}`);
  } catch {
    console.log('  npm prefix    (could not read)');
  }
  console.log('');
}

/**
 * @param {string[]} names - Bin names from package.json
 * @returns {void}
 */
function printBinReports(names) {
  for (const name of names) {
    console.log(`── ${name} ──`);
    const hits = locationsOnPath(name);
    if (!hits.length) {
      console.log('  (not found on PATH)\n');
      continue;
    }
    hits.forEach((h, i) => {
      const ver = versionAt(h.path);
      const marker = i === 0 ? '  ← first on PATH (what your shell runs)' : '';
      console.log(`  [${i + 1}] ${h.path}`);
      if (h.real !== h.path) console.log(`      → ${h.real}`);
      console.log(`      --version: ${ver ?? '(failed to run)'}${marker}`);
    });
    console.log('');
  }
}

/**
 * @param {string[]} names - Bin names from package.json
 * @returns {void}
 */
function warnIfMultipleVersions(names) {
  const uniqVersions = new Set();
  for (const name of names) {
    for (const h of locationsOnPath(name)) {
      const v = versionAt(h.path);
      if (v) uniqVersions.add(v);
    }
  }
  if (uniqVersions.size > 1) {
    console.log('⚠️  Multiple distinct --version values above: remove or reorder PATH so only one install remains.');
    console.log('   Often: npm uninstall -g @aifabrix/builder, then ensure PNPM_HOME is before /usr/local/bin in PATH.\n');
  }
}

/**
 * Entry: list PATH hits and versions for each package bin.
 * @returns {void}
 */
function main() {
  const binField = readBins();
  const names = typeof binField === 'string' ? ['aifabrix'] : Object.keys(binField);
  printEnvironment();
  printBinReports(names);
  warnIfMultipleVersions(names);
}

main();
