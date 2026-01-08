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
 * // Returns: '~/.aifabrix/applications-dev-1'
 */
async function copyBuilderToDevDirectory(appName, developerId) {
  const builderPath = paths.getBuilderPath(appName);

  // Ensure builder directory exists
  if (!fsSync.existsSync(builderPath)) {
    throw new Error(`Builder directory not found: ${builderPath}\nRun 'aifabrix create ${appName}' first`);
  }

  // Get base directory (applications or applications-dev-{id}) using raw developerId text
  const baseDir = paths.getApplicationsBaseDir(developerId);

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

  // Get target directory using getDevDirectory() (root of applications folder)
  const devDir = getDevDirectory(appName, developerId);

  // Create target directory
  await fs.mkdir(devDir, { recursive: true });

  // Copy files to root of applications folder (same behavior for all dev IDs)
  await copyDirectory(builderPath, devDir);

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

/**
 * Copies application template files to dev directory
 * Used when apps directory doesn't exist to ensure build can proceed
 * @async
 * @param {string} templatePath - Path to template directory
 * @param {string} devDir - Target dev directory
 * @param {string} _language - Language (typescript/python) - currently unused but kept for future use
 * @throws {Error} If copying fails
 */
async function copyTemplateFilesToDevDir(templatePath, devDir, _language) {
  if (!fsSync.existsSync(templatePath)) {
    throw new Error(`Template path not found: ${templatePath}`);
  }

  // Ensure dev directory exists before copying files
  await fs.mkdir(devDir, { recursive: true });

  const entries = await fs.readdir(templatePath);

  // Copy only application files, skip Dockerfile and docker-compose templates
  const appFiles = entries.filter(entry => {
    const lowerEntry = entry.toLowerCase();
    // Include .gitignore, exclude .hbs files and docker-related files
    if (entry === '.gitignore') {
      return true;
    }
    if (lowerEntry.endsWith('.hbs')) {
      return false;
    }
    if (lowerEntry.startsWith('dockerfile') || lowerEntry.includes('docker-compose')) {
      return false;
    }
    if (entry.startsWith('.') && entry !== '.gitignore') {
      return false;
    }
    return true;
  });

  for (const entry of appFiles) {
    const sourcePath = path.join(templatePath, entry);
    const targetPath = path.join(devDir, entry);

    // Skip if source file doesn't exist (e.g., .gitignore might not be in template)
    try {
      const entryStats = await fs.stat(sourcePath);
      if (entryStats.isFile()) {
        await fs.copyFile(sourcePath, targetPath);
      }
    } catch (error) {
      // Skip files that don't exist (e.g., .gitignore might not be in template)
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

module.exports = {
  copyBuilderToDevDirectory,
  copyAppSourceFiles,
  getDevDirectory,
  devDirectoryExists,
  copyTemplateFilesToDevDir
};

