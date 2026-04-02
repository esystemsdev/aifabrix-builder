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

const { execSync } = require('child_process');
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
 * If another bin name (e.g. `af`) resolves earlier on PATH to an old install, warn.
 * @param {string|null} expectedVersion - Version from the linked package (pnpm env)
 * @param {string[]} binNames - All bin entries from package.json
 * @returns {void}
 */
function warnStaleAliasBinsOnPath(expectedVersion, binNames) {
  if (!expectedVersion) return;
  const stale = [];
  for (const name of binNames) {
    const v = getBinVersion(name, process.env);
    if (v !== null && v !== undefined && v !== expectedVersion) {
      stale.push({ name, version: v, path: getBinPath(name, process.env) });
    }
  }
  if (!stale.length) return;
  console.log('\n⚠️  Some CLI aliases still point at a different install than this link:');
  for (const row of stale) {
    console.log(`   ${row.name} --version → ${row.version}  (${row.path || 'unknown'})`);
  }
  console.log(`   Linked package is ${expectedVersion}. Usually another copy is earlier on PATH (often from an old npm global).`);
  console.log('   Try:  which -a af   which -a aifabrix');
  console.log(`   Then: npm uninstall -g ${PACKAGE_NAME}   (or remove the stale path that is not under pnpm)`);
  console.log('   Or:  hash -r  and open a new terminal after fixing PATH.');
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
  console.log('\n✅ Successfully linked!');
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

  printPnpmPathHints(usedPnpm, newVersion, pathInfo);
  warnStaleAliasBinsOnPath(newVersion, bins);
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
    console.error('\n❌ Failed to link package:', error.message);
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
  console.log(`\n✅ Successfully unlinked with ${pm}!`);
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
    console.error('\n❌ Failed to unlink package:', error.message);
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
