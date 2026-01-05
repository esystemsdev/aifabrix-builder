/**
 * Dockerfile Utility Functions
 *
 * This module handles Dockerfile template loading, rendering,
 * and path resolution. Separated from build.js to maintain
 * file size limits and improve code organization.
 *
 * @fileoverview Dockerfile utility functions for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fsSync = require('fs');
const path = require('path');
const handlebars = require('handlebars');

/**
 * Loads Dockerfile template for language
 * @function loadDockerfileTemplate
 * @param {string} language - Language ('typescript' or 'python')
 * @returns {Function} Compiled Handlebars template
 * @throws {Error} If template not found
 */
function loadDockerfileTemplate(language) {
  const templatePath = path.join(__dirname, '..', '..', 'templates', language, 'Dockerfile.hbs');

  if (!fsSync.existsSync(templatePath)) {
    throw new Error(`Template not found for language: ${language}`);
  }

  const templateContent = fsSync.readFileSync(templatePath, 'utf8');
  return handlebars.compile(templateContent);
}

/**
 * Renders Dockerfile with template variables
 * @function renderDockerfile
 * @param {Function} template - Compiled Handlebars template
 * @param {Object} templateVars - Template variables
 * @param {string} language - Language ('typescript' or 'python')
 * @param {boolean} isAppFlag - Whether --app flag was used
 * @param {string} appSourcePath - Application source path
 * @returns {string} Rendered Dockerfile content
 */
function renderDockerfile(template, templateVars, language, isAppFlag, appSourcePath) {
  let dockerfileContent = template(templateVars);

  if (!isAppFlag) {
    return dockerfileContent;
  }

  dockerfileContent = dockerfileContent.replace(
    /^COPY \. \./gm,
    `COPY ${appSourcePath} .`
  );

  if (language === 'python') {
    // Replace COPY requirements*.txt with app-specific path
    dockerfileContent = dockerfileContent.replace(
      /^COPY requirements\*\.txt \./gm,
      `COPY ${appSourcePath}requirements*.txt ./`
    );
    // Also handle case where it might be COPY requirements.txt
    dockerfileContent = dockerfileContent.replace(
      /^COPY requirements\.txt \./gm,
      `COPY ${appSourcePath}requirements.txt ./`
    );
  }

  if (language === 'typescript') {
    dockerfileContent = dockerfileContent.replace(
      /^COPY package\*\.json \./gm,
      `COPY ${appSourcePath}package*.json ./`
    );
  }

  return dockerfileContent;
}

/**
 * Checks for template Dockerfile in builder directory
 * @function checkTemplateDockerfile
 * @param {string} builderPath - Builder directory path
 * @param {string} appName - Application name
 * @param {boolean} forceTemplate - Force template flag
 * @returns {string|null} Dockerfile path or null
 */
function checkTemplateDockerfile(builderPath, appName, forceTemplate) {
  const appDockerfilePath = path.join(builderPath, 'Dockerfile');
  if (fsSync.existsSync(appDockerfilePath) && !forceTemplate) {
    return appDockerfilePath;
  }
  return null;
}

/**
 * Checks for custom Dockerfile from variables.yaml
 * @function checkProjectDockerfile
 * @param {string} builderPath - Builder directory path
 * @param {string} appName - Application name
 * @param {Object} buildConfig - Build configuration
 * @param {string} contextPath - Build context path
 * @param {boolean} forceTemplate - Force template flag
 * @returns {string|null} Dockerfile path or null
 */
function checkProjectDockerfile(builderPath, appName, buildConfig, contextPath, forceTemplate) {
  const customDockerfile = buildConfig.dockerfile;
  if (!customDockerfile || forceTemplate) {
    return null;
  }

  const customPath = path.resolve(contextPath, customDockerfile);
  if (fsSync.existsSync(customPath)) {
    return customPath;
  }

  // Use builderPath instead of process.cwd() to handle test scenarios
  const builderCustomPath = path.join(builderPath, customDockerfile);
  if (fsSync.existsSync(builderCustomPath)) {
    return builderCustomPath;
  }

  return null;
}

module.exports = {
  loadDockerfileTemplate,
  renderDockerfile,
  checkTemplateDockerfile,
  checkProjectDockerfile
};

