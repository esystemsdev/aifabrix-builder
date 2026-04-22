#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Install local package globally using npm link or pnpm link
 * Automatically detects which package manager is being used
 *
 * @fileoverview Local installation script for @aifabrix/builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PACKAGE_NAME = '@aifabrix/builder';
/** Primary CLI name used for “current version” before link */
const PRIMARY_BIN = 'aifabrix';

/**
 * Default PNPM_HOME when not set in the environment (matches `pnpm setup` on Linux/macOS; Windows uses LOCALAPPDATA).
 * @returns {string} Resolved PNPM global bin home directory
 */
function defaultPnpmHome() {
  if (process.env.PNPM_HOME) {
    return process.env.PNPM_HOME;
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'pnpm');
  }
  return path.join(os.homedir(), '.local', 'share', 'pnpm');
}

/**
 * Environment with PNPM_HOME and PATH set so `pnpm link --global` can find the global bin dir
 * (same idea as aifabrix-setup/scripts/install-local.js).
 * @returns {NodeJS.ProcessEnv} Copy of process.env with pnpm paths prepended
 */
function pnpmEnv() {
  const env = { ...process.env };
  const pnpmHome = defaultPnpmHome();
  env.PNPM_HOME = pnpmHome;
  env.PATH = [pnpmHome, env.PATH].filter(Boolean).join(path.delimiter);
  return env;
}

/**
 * Detect which package manager is being used (pnpm or npm)
 * @returns {string} 'pnpm' or 'npm'
 */
function detectPackageManager() {
  try {
    execSync('which pnpm', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return 'pnpm';
  } catch {
    return 'npm';
  }
}

/**
 * Reads package.json `bin` keys (or default primary bin).
 * @returns {string[]} CLI executable names published by this package
 */
function listCliBinNames() {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const bin = packageJson.bin;
    if (!bin) return [PRIMARY_BIN];
    if (typeof bin === 'string') return [PRIMARY_BIN];
    return Object.keys(bin);
  } catch {
    return [PRIMARY_BIN];
  }
}

/**
 * @param {string} binName - CLI name on PATH
 * @param {NodeJS.ProcessEnv} [env] - Optional env (e.g. pnpm-adjusted PATH)
 * @returns {string|null} Trimmed `--version` output or null if command fails
 */
function getBinVersion(binName, env) {
  try {
    return execSync(`${binName} --version`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: env || process.env
    }).trim();
  } catch {
    return null;
  }
}

/**
 * @param {string} binName - CLI name on PATH
 * @param {NodeJS.ProcessEnv} [env] - Optional env for `which`
 * @returns {string|null} First resolved path or null
 */
function getBinPath(binName, env) {
  try {
    const which = execSync(`which ${binName}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: env || process.env
    }).trim();
    return which || null;
  } catch {
    return null;
  }
}

/**
 * First executable `binName` on PATH (same resolution order as a POSIX shell).
 * @param {string} binName - CLI name
 * @param {string} pathString - PATH value (e.g. process.env.PATH)
 * @returns {{ candidate: string, real: string }|null} First hit or null
 */
function firstExecutableOnPath(binName, pathString) {
  if (process.platform === 'win32') {
    return null;
  }
  const dirs = (pathString || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, binName);
    try {
      const st = fs.lstatSync(candidate);
      if (!st.isFile() && !st.isSymbolicLink()) continue;
      fs.accessSync(candidate, fs.constants.X_OK);
      const real = fs.realpathSync(candidate);
      return { candidate, real };
    } catch {
      // continue
    }
  }
  return null;
}

/**
 * @param {string} executablePath - Absolute path to CLI
 * @returns {string|null} Trimmed --version or null
 */
function versionAtExecutablePath(executablePath) {
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
 * Get currently installed version of primary CLI (aifabrix)
 * @param {NodeJS.ProcessEnv} [env] - Optional env for the version probe
 * @returns {string|null} Trimmed version or null if not on PATH
 */
function getCurrentVersion(env) {
  return getBinVersion(PRIMARY_BIN, env);
}

/**
 * Get version from local package.json
 * @returns {string|null} Version string or null if not found
 */
function getPackageVersion() {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch {
    return null;
  }
}

/**
 * Display version comparison information
 * @param {string|null} currentVersion - Currently installed version
 * @param {string|null} packageVersion - Version being linked
 * @returns {void}
 */
function displayVersionInfo(currentVersion, packageVersion) {
  if (currentVersion) {
    console.log(`📦 Current installed version: ${currentVersion}`);
  } else {
    console.log('📦 No previous version detected (first install)');
  }

  if (packageVersion) {
    if (currentVersion && currentVersion !== packageVersion) {
      console.log(`🔄 Linking new version: ${packageVersion}`);
      console.log(`   Version change: ${currentVersion} → ${packageVersion}\n`);
    } else if (currentVersion && currentVersion === packageVersion) {
      console.log(`🔄 Linking version: ${packageVersion} (same version)\n`);
    } else {
      console.log(`🔄 Linking version: ${packageVersion}\n`);
    }
  }
}

/**
 * @typedef {{ name: string, path: string|null, real: string|null, version: string|null }} PathBinRow
 */

/**
 * @param {string[]} binNames - CLI names from package.json
 * @returns {PathBinRow[]} Resolution rows for current PATH
 */
function collectPathResolutionRows(binNames) {
  const rows = [];
  if (process.platform === 'win32') {
    for (const name of binNames) {
      const p = getBinPath(name, process.env);
      const version = p
        ? versionAtExecutablePath(p) || getBinVersion(name, process.env)
        : getBinVersion(name, process.env);
      rows.push({ name, path: p, real: p, version });
    }
    return rows;
  }
  for (const name of binNames) {
    const hit = firstExecutableOnPath(name, process.env.PATH);
    if (!hit) {
      rows.push({ name, path: null, real: null, version: null });
      continue;
    }
    const version =
      versionAtExecutablePath(hit.candidate) || getBinVersion(name, process.env);
    rows.push({ name, path: hit.candidate, real: hit.real, version });
  }
  return rows;
}

/**
 * @param {PathBinRow[]} rows - Rows from collectPathResolutionRows
 * @param {boolean} multipleBins - Whether package exposes more than one CLI name
 * @returns {void}
 */
function printPathResolutionTable(rows, multipleBins) {
  const label = multipleBins
    ? 'First match on your PATH for each command (what new programs see):'
    : 'First match on your PATH (what new programs see):';
  console.log(`\n${label}`);
  for (const r of rows) {
    if (!r.path) {
      console.log(`   ${r.name}: (not found on PATH)`);
      continue;
    }
    const ver = r.version !== null && r.version !== undefined ? r.version : '(could not run --version)';
    const arrow = r.real !== r.path ? ` → ${r.real}` : '';
    console.log(`   ${r.name}: ${r.path}${arrow}  →  ${ver}`);
  }
}

/**
 * @param {PathBinRow[]} rows - Rows from collectPathResolutionRows
 * @param {string|null} expectedVersion - Linked package version
 * @param {string[]} binNames - Bin names (length for multi-alias tip)
 * @returns {void}
 */
function printPathResolutionWarnings(rows, expectedVersion, binNames) {
  const versions = rows
    .map((r) => r.version)
    .filter((v) => v !== null && v !== undefined && v !== '(could not run --version)');
  const uniq = [...new Set(versions)];
  const mismatchAliases = uniq.length > 1;
  const hasStaleVers =
    Boolean(expectedVersion) &&
    rows.some(
      (r) => r.version !== null && r.version !== undefined && r.version !== expectedVersion
    );

  if (hasStaleVers) {
    console.log(`\n⚠️  At least one command above is not ${expectedVersion} (linked package version).`);
    console.log('   Another install is winning on PATH for that name — often an old npm global copy.');
    console.log('   Try:  pnpm run diagnose:cli');
    console.log(`   Then: npm uninstall -g ${PACKAGE_NAME}`);
    console.log('   Put PNPM_HOME (or ~/.local/share/pnpm) before other global bin dirs in PATH if needed.');
  }

  if (mismatchAliases) {
    console.log('\n⚠️  `af` and `aifabrix` resolve to different installs on PATH.');
    console.log('   Fix PATH as above, or if PATH looks correct, your shell may be using a stale location for one of them.');
    console.log('   Bash: hash -r    Zsh: rehash    Then run both with --version again.');
  } else if (binNames.length > 1 && expectedVersion && uniq.length === 1 && uniq[0] === expectedVersion) {
    console.log('\nTip: Bash caches `af` and `aifabrix` separately. If your terminal shows a wrong version for only one, run: hash -r');
  }
}

/**
 * Report first PATH hit per bin (matches new subprocesses). Warn on mismatch vs link or between aliases.
 * Bash/zsh cache each command name separately — `af` can stay stale while `aifabrix` updates; suggest hash -r.
 * @param {string|null} expectedVersion - Version from the linked package (pnpm env probe)
 * @param {string[]} binNames - All bin entries from package.json
 * @returns {void}
 */
function reportCliAliasesOnPath(expectedVersion, binNames) {
  if (!binNames.length) return;
  const rows = collectPathResolutionRows(binNames);
  printPathResolutionTable(rows, binNames.length > 1);
  printPathResolutionWarnings(rows, expectedVersion, binNames);
}

/**
 * Prints pnpm-specific hints when shell PATH still resolves an old binary.
 * @param {boolean} usedPnpm - Whether link used pnpm
 * @param {string|null} newVersion - Version after link
 * @param {Object} [pathInfo] - Shell vs linked path probe
 * @param {string|null} [pathInfo.versionInShell] - Version from default shell env
 * @param {string|null} [pathInfo.linkedPath] - Path under pnpm env
 * @returns {void}
 */
function printPnpmPathHints(usedPnpm, newVersion, pathInfo) {
  if (!usedPnpm) return;
  const shellVersion = pathInfo && pathInfo.versionInShell;
  const linkedPath = pathInfo && pathInfo.linkedPath;
  if (newVersion && shellVersion !== newVersion) {
    console.log(`\n⚠️  Your shell is still running an older ${PRIMARY_BIN} (${shellVersion || 'unknown'}).`);
    console.log(`   The linked binary is at: ${linkedPath || 'unknown'}`);
    console.log('   Fix: run  source ~/.bashrc  (or open a new terminal).');
    console.log('   If it still shows the old version, put pnpm\'s global bin first in PATH, or run:');
    console.log(`   npm uninstall -g ${PACKAGE_NAME}`);
  } else {
    console.log('If you still see an old version, run: source ~/.bashrc  (or open a new terminal)');
  }
}

/**
 * Display success message with version information
 * @param {string|null} currentVersion - Version before linking
 * @param {string|null} newVersion - Version after linking
 * @param {boolean} [usedPnpm] - Link used pnpm
 * @param {Object} [pathInfo] - Optional shell vs linked path info
 * @param {string|null} [pathInfo.versionInShell] - Version from default shell env
 * @param {string|null} [pathInfo.linkedPath] - Path under pnpm env
 * @param {string[]} [binNames] - Bin names from package.json
 * @returns {void}
 */
function displaySuccessMessage(currentVersion, newVersion, usedPnpm, pathInfo, binNames) {
  const bins = binNames && binNames.length ? binNames : [PRIMARY_BIN];
  console.log('\n✔ Successfully linked!');
  if (currentVersion && newVersion && currentVersion !== newVersion) {
    console.log(`📊 Version updated: ${currentVersion} → ${newVersion}`);
  } else if (newVersion) {
    console.log(`📊 Installed version: ${newVersion}`);
  }
  const verifyHint =
    bins.length > 1
      ? bins.map((b) => `${b} --version`).join('" or "')
      : `${bins[0]} --version`;
  console.log(`Run "${verifyHint}" to verify.`);
  if (bins.length > 1) {
    console.log(
      'If only one alias shows the wrong version in your terminal, clear the shell command cache (bash: hash -r, zsh: rehash).'
    );
  }

  printPnpmPathHints(usedPnpm, newVersion, pathInfo);
  reportCliAliasesOnPath(newVersion, bins);
}

/**
 * Runs global link and reports success (throws on failure).
 * @param {string} pm - 'pnpm' or 'npm'
 * @param {string|null} currentVersion - Version before link
 * @param {string[]} binNames - CLI bin names
 * @returns {void}
 */
function runGlobalLink(pm, currentVersion, binNames) {
  const projectRoot = path.join(__dirname, '..');
  const env = pm === 'pnpm' ? pnpmEnv() : undefined;
  if (pm === 'pnpm') {
    execSync('pnpm link --global', { stdio: 'inherit', cwd: projectRoot, env });
  } else {
    execSync('npm link', { stdio: 'inherit', cwd: projectRoot });
  }

  const newVersion = getCurrentVersion(env);
  let pathInfo;
  if (pm === 'pnpm') {
    pathInfo = {
      versionInShell: getCurrentVersion(),
      linkedPath: getBinPath(PRIMARY_BIN, env)
    };
  }
  displaySuccessMessage(currentVersion, newVersion, pm === 'pnpm', pathInfo, binNames);
}

/**
 * Install local package globally
 * @returns {void}
 */
function installLocal() {
  const pm = detectPackageManager();
  const packageVersion = getPackageVersion();
  const binNames = listCliBinNames();
  const currentVersion = getCurrentVersion();

  console.log(`Detected package manager: ${pm}\n`);
  displayVersionInfo(currentVersion, packageVersion);
  console.log(`Linking ${PACKAGE_NAME} globally...\n`);

  try {
    runGlobalLink(pm, currentVersion, binNames);
  } catch (error) {
    console.error('\n✖ Failed to link package:', error.message);
    process.exit(1);
  }
}

/**
 * Display version information before unlinking
 * @param {string|null} currentVersion - Currently installed version
 * @param {string|null} packageVersion - Local package version
 * @returns {void}
 */
function displayUninstallVersionInfo(currentVersion, packageVersion) {
  if (currentVersion) {
    console.log(`📦 Current installed version: ${currentVersion}`);
  } else {
    console.log('📦 No installed version detected');
  }

  if (packageVersion) {
    console.log(`📋 Local package version: ${packageVersion}`);
    if (currentVersion && currentVersion === packageVersion) {
      console.log('   (matches installed version)\n');
    } else if (currentVersion && currentVersion !== packageVersion) {
      console.log(`   (installed: ${currentVersion}, local: ${packageVersion})\n`);
    } else {
      console.log('\n');
    }
  } else {
    console.log('\n');
  }
}

/**
 * Display success message after unlinking
 * @param {string} pm - Package manager ('pnpm' or 'npm')
 * @param {string|null} currentVersion - Version that was uninstalled
 * @returns {void}
 */
function displayUninstallSuccess(pm, currentVersion) {
  console.log(`\n✔ Successfully unlinked with ${pm}!`);
  if (currentVersion) {
    console.log(`📊 Uninstalled version: ${currentVersion}`);
  }
}

/**
 * Uninstall local package from global installation
 * @returns {void}
 */
function uninstallLocal() {
  const pm = detectPackageManager();
  const currentVersion = getCurrentVersion();
  const packageVersion = getPackageVersion();

  console.log(`Detected package manager: ${pm}\n`);
  displayUninstallVersionInfo(currentVersion, packageVersion);
  console.log(`Unlinking ${PACKAGE_NAME} globally...\n`);

  try {
    if (pm === 'pnpm') {
      execSync(`pnpm unlink --global ${PACKAGE_NAME}`, { stdio: 'inherit', env: pnpmEnv() });
      displayUninstallSuccess(pm, currentVersion);
    } else {
      execSync(`npm unlink -g ${PACKAGE_NAME}`, { stdio: 'inherit' });
      displayUninstallSuccess(pm, currentVersion);
    }
  } catch (error) {
    console.error('\n✖ Failed to unlink package:', error.message);
    process.exit(1);
  }
}

// Main execution
const command = process.argv[2];

if (command === 'uninstall' || command === 'unlink') {
  uninstallLocal();
} else {
  installLocal();
}
