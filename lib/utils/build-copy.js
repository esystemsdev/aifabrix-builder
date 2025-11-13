/**
 * Build Copy Utilities
 *
 * This module handles copying builder files to developer-specific
 * directories for isolated builds. Ensures each developer has their
 * own build directory to prevent conflicts.
 *
 * @fileoverview Build copy utilities for developer isolation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const paths = require('./paths');

/**
 * Copies all files from builder directory to developer-specific directory
 * Preserves directory structure and skips hidden files
 *
 * @async
 * @function copyBuilderToDevDirectory
 * @param {string} appName - Application name
 * @param {number|string} developerId - Developer ID
 * @returns {Promise<string>} Path to developer-specific directory
 * @throws {Error} If copying fails
 *
 * @example
 * const devPath = await copyBuilderToDevDirectory('myapp', 1);
 * // Returns: '~/.aifabrix/applications-dev-1/myapp-dev-1'
 */
async function copyBuilderToDevDirectory(appName, developerId) {
  const builderPath = path.join(process.cwd(), 'builder', appName);

  // Ensure builder directory exists
  if (!fsSync.existsSync(builderPath)) {
    throw new Error(`Builder directory not found: ${builderPath}\nRun 'aifabrix create ${appName}' first`);
  }

  // Get base directory (applications or applications-dev-{id})
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  const baseDir = paths.getApplicationsBaseDir(idNum);

  // Clear base directory before copying (delete all files)
  if (fsSync.existsSync(baseDir)) {
    const entries = await fs.readdir(baseDir);
    for (const entry of entries) {
      const entryPath = path.join(baseDir, entry);
      const stats = await fs.stat(entryPath);
      if (stats.isDirectory()) {
        await fs.rm(entryPath, { recursive: true, force: true });
      } else {
        await fs.unlink(entryPath);
      }
    }
  }

  // Get target directory using getDevDirectory()
  const devDir = getDevDirectory(appName, developerId);

  // Create target directory
  await fs.mkdir(devDir, { recursive: true });

  // Copy files based on developer ID
  if (idNum === 0) {
    // Dev 0: Copy contents from builder/{appName}/ directly to applications/
    await copyDirectory(builderPath, devDir);
  } else {
    // Dev > 0: Copy builder/{appName}/ to applications-dev-{id}/{appName}-dev-{id}/
    await copyDirectory(builderPath, devDir);
  }

  return devDir;
}

/**
 * Recursively copies directory contents
 * @async
 * @param {string} sourceDir - Source directory
 * @param {string} targetDir - Target directory
 * @throws {Error} If copying fails
 */
async function copyDirectory(sourceDir, targetDir) {
  // Ensure target directory exists
  await fs.mkdir(targetDir, { recursive: true });

  const entries = await fs.readdir(sourceDir);

  for (const entry of entries) {
    // Skip hidden files and directories (but allow .env, .gitignore, etc.)
    if (entry.startsWith('.') && entry !== '.env' && entry !== '.gitignore') {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry);
    const targetPath = path.join(targetDir, entry);

    const stats = await fs.stat(sourcePath);

    if (stats.isDirectory()) {
      // Recursively copy subdirectories
      await copyDirectory(sourcePath, targetPath);
    } else if (stats.isFile()) {
      // Copy file
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

/**
 * Gets developer-specific directory path for an application
 * @param {string} appName - Application name
 * @param {number|string} developerId - Developer ID
 * @returns {string} Path to developer-specific directory
 */
function getDevDirectory(appName, developerId) {
  return paths.getDevDirectory(appName, developerId);

}

/**
 * Copies app source files from apps directory to dev directory
 * Used when old context format is detected to ensure source files are available
 * @async
 * @param {string} appsSourcePath - Path to apps/{appName} directory
 * @param {string} devDir - Target dev directory
 * @throws {Error} If copying fails
 */
async function copyAppSourceFiles(appsSourcePath, devDir) {
  if (!fsSync.existsSync(appsSourcePath)) {
    return; // Nothing to copy
  }

  // Copy all files from apps directory to dev directory
  await copyDirectory(appsSourcePath, devDir);
}

/**
 * Checks if developer-specific directory exists
 * @param {string} appName - Application name
 * @param {number} developerId - Developer ID
 * @returns {boolean} True if directory exists
 */
function devDirectoryExists(appName, developerId) {
  const devDir = getDevDirectory(appName, developerId);
  return fsSync.existsSync(devDir);
}

module.exports = {
  copyBuilderToDevDirectory,
  copyAppSourceFiles,
  getDevDirectory,
  devDirectoryExists
};

