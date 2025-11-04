/**
 * AI Fabrix Builder Template Validation and Management
 *
 * Validates template folders and copies template files to application directories
 *
 * @fileoverview Template validation and file copying utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Validates that a template exists and contains files
 * @param {string} templateName - Template name to validate
 * @returns {Promise<boolean>} True if template is valid
 * @throws {Error} If template folder doesn't exist or is empty
 */
async function validateTemplate(templateName) {
  if (!templateName || typeof templateName !== 'string') {
    throw new Error('Template name is required and must be a string');
  }

  const templatePath = path.join(__dirname, '..', 'templates', 'applications', templateName);

  // Check if template folder exists
  if (!fsSync.existsSync(templatePath)) {
    throw new Error(`Template '${templateName}' not found. Expected folder: templates/applications/${templateName}/`);
  }

  // Check if it's a directory
  const stats = fsSync.statSync(templatePath);
  if (!stats.isDirectory()) {
    throw new Error(`Template '${templateName}' exists but is not a directory`);
  }

  // Check if folder contains at least one file
  const entries = await fs.readdir(templatePath);
  const files = entries.filter(entry => {
    const entryPath = path.join(templatePath, entry);
    const entryStats = fsSync.statSync(entryPath);
    return entryStats.isFile() && !entry.startsWith('.');
  });

  if (files.length === 0) {
    throw new Error(`Template '${templateName}' folder exists but contains no files`);
  }

  return true;
}

/**
 * Copies all files from template folder to application directory
 * Preserves directory structure and skips hidden files
 * @param {string} templateName - Template name to copy
 * @param {string} appPath - Target application directory path
 * @returns {Promise<string[]>} Array of copied file paths
 * @throws {Error} If template validation fails or copying fails
 */
async function copyTemplateFiles(templateName, appPath) {
  // Validate template first
  await validateTemplate(templateName);

  const templatePath = path.join(__dirname, '..', 'templates', 'applications', templateName);
  const copiedFiles = [];

  async function copyDirectory(sourceDir, targetDir) {
    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    const entries = await fs.readdir(sourceDir);

    for (const entry of entries) {
      // Skip hidden files and directories
      if (entry.startsWith('.')) {
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
        copiedFiles.push(targetPath);
      }
    }
  }

  await copyDirectory(templatePath, appPath);

  return copiedFiles;
}

/**
 * Copies application files from language template directory
 * Copies files like package.json, index.ts, requirements.txt, main.py from templates/{language}/
 * @param {string} language - Language name (typescript or python)
 * @param {string} appPath - Target application directory path
 * @returns {Promise<string[]>} Array of copied file paths
 * @throws {Error} If language template doesn't exist or copying fails
 */
async function copyAppFiles(language, appPath) {
  if (!language || typeof language !== 'string') {
    throw new Error('Language is required and must be a string');
  }

  const normalizedLanguage = language.toLowerCase();
  const languageTemplatePath = path.join(__dirname, '..', 'templates', normalizedLanguage);

  // Check if language template folder exists
  if (!fsSync.existsSync(languageTemplatePath)) {
    throw new Error(`Language template '${normalizedLanguage}' not found. Expected folder: templates/${normalizedLanguage}/`);
  }

  const stats = fsSync.statSync(languageTemplatePath);
  if (!stats.isDirectory()) {
    throw new Error(`Language template '${normalizedLanguage}' exists but is not a directory`);
  }

  const copiedFiles = [];
  const entries = await fs.readdir(languageTemplatePath);

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
    if (entry.startsWith('.')) {
      return false;
    }
    return true;
  });

  for (const entry of appFiles) {
    const sourcePath = path.join(languageTemplatePath, entry);
    const targetPath = path.join(appPath, entry);

    const entryStats = await fs.stat(sourcePath);
    if (entryStats.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
      copiedFiles.push(targetPath);
    }
  }

  return copiedFiles;
}

/**
 * Lists available templates
 * @returns {Promise<string[]>} Array of available template names
 */
async function listAvailableTemplates() {
  const templatesDir = path.join(__dirname, '..', 'templates', 'applications');

  if (!fsSync.existsSync(templatesDir)) {
    return [];
  }

  const entries = await fs.readdir(templatesDir);
  const templates = [];

  for (const entry of entries) {
    const entryPath = path.join(templatesDir, entry);
    const stats = fsSync.statSync(entryPath);

    if (stats.isDirectory()) {
      // Check if directory contains at least one file
      const subEntries = await fs.readdir(entryPath);
      const hasFiles = subEntries.some(subEntry => {
        const subPath = path.join(entryPath, subEntry);
        const subStats = fsSync.statSync(subPath);
        return subStats.isFile() && !subEntry.startsWith('.');
      });

      if (hasFiles) {
        templates.push(entry);
      }
    }
  }

  return templates.sort();
}

module.exports = {
  validateTemplate,
  copyTemplateFiles,
  copyAppFiles,
  listAvailableTemplates
};
