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
const path = require('path');

/**
 * Detect which package manager is being used (pnpm or npm)
 * @returns {string} 'pnpm' or 'npm'
 */
function detectPackageManager() {
  try {
    // Check if pnpm is available
    execSync('which pnpm', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return 'pnpm';
  } catch {
    // Fall back to npm
    return 'npm';
  }
}

/**
 * Get currently installed version of aifabrix CLI
 * @returns {string|null} Version string or null if not installed
 */
function getCurrentVersion() {
  try {
    const version = execSync('aifabrix --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return version;
  } catch {
    return null;
  }
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
 * Display success message with version information
 * @param {string|null} currentVersion - Version before linking
 * @param {string|null} newVersion - Version after linking
 * @returns {void}
 */
function displaySuccessMessage(currentVersion, newVersion) {
  console.log('\n✅ Successfully linked!');
  if (currentVersion && newVersion && currentVersion !== newVersion) {
    console.log(`📊 Version updated: ${currentVersion} → ${newVersion}`);
  } else if (newVersion) {
    console.log(`📊 Installed version: ${newVersion}`);
  }
  console.log('Run "aifabrix --version" to verify.');
}

/**
 * Run pnpm link --global and npm link from project root (handles pnpm global bin not set).
 * @param {string} projectRoot - Path to project root
 * @returns {void}
 * @throws {Error} If linking fails when pnpm global bin is not configured
 */
function runPnpmLink(projectRoot) {
  let pnpmLinked = false;
  try {
    execSync('pnpm link --global', { stdio: 'inherit', cwd: projectRoot });
    pnpmLinked = true;
  } catch (pnpmErr) {
    const msg = (pnpmErr.message || String(pnpmErr));
    if (msg.includes('global bin directory') || msg.includes('ERR_PNPM_NO_GLOBAL_BIN_DIR')) {
      console.log(
        '⚠️  pnpm global bin is not set up. Run "pnpm setup" and add PNPM_HOME to PATH, or we will use npm link.\n'
      );
    } else {
      throw pnpmErr;
    }
  }
  try {
    execSync('npm link', { stdio: 'inherit', cwd: projectRoot });
  } catch {
    if (!pnpmLinked) {
      console.error(
        '\n💡 To fix: run "pnpm setup" and add the suggested line to your shell config, then run install:local again.'
      );
      throw new Error('Linking failed. pnpm global bin not configured and npm link failed.');
    }
  }
}

/**
 * Install local package globally
 * @returns {void}
 */
function installLocal() {
  const pm = detectPackageManager();
  const packageVersion = getPackageVersion();
  const currentVersion = getCurrentVersion();

  console.log(`Detected package manager: ${pm}\n`);
  displayVersionInfo(currentVersion, packageVersion);
  console.log('Linking @aifabrix/builder globally...\n');

  try {
    const projectRoot = path.join(__dirname, '..');
    if (pm === 'pnpm') {
      runPnpmLink(projectRoot);
    } else {
      execSync('npm link', { stdio: 'inherit', cwd: projectRoot });
    }
    const newVersion = getCurrentVersion();
    displaySuccessMessage(currentVersion, newVersion);
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

  // Show version information before unlinking
  displayUninstallVersionInfo(currentVersion, packageVersion);

  console.log('Unlinking @aifabrix/builder globally...\n');

  try {
    if (pm === 'pnpm') {
      execSync('pnpm unlink --global @aifabrix/builder', { stdio: 'inherit' });
      displayUninstallSuccess(pm, currentVersion);
    } else {
      execSync('npm unlink -g @aifabrix/builder', { stdio: 'inherit' });
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
