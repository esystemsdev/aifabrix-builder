/**
 * Environment Template Utilities
 *
 * Helper functions for updating env.template files
 *
 * @fileoverview Environment template update utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');

/**
 * Updates env.template to add MISO_CLIENTID, MISO_CLIENTSECRET, and MISO_CONTROLLER_URL entries
 * @async
 * @param {string} appKey - Application key
 * @param {string} clientIdKey - Secret key for client ID (e.g., 'myapp-client-idKeyVault')
 * @param {string} clientSecretKey - Secret key for client secret (e.g., 'myapp-client-secretKeyVault')
 * @param {string} _controllerUrl - Controller URL (e.g., 'http://localhost:3010' or 'https://controller.aifabrix.ai')
 *   Note: This parameter is accepted for compatibility but the template format http://${MISO_HOST}:${MISO_PORT} is used instead
 * @returns {Promise<void>} Resolves when template is updated
 */
/**
 * Checks which MISO entries exist in content
 * @function checkMisoEntries
 * @param {string} content - File content
 * @returns {Object} Object with boolean flags for each entry
 */
function checkMisoEntries(content) {
  return {
    hasClientId: /^MISO_CLIENTID\s*=/m.test(content),
    hasClientSecret: /^MISO_CLIENTSECRET\s*=/m.test(content),
    hasControllerUrl: /^MISO_CONTROLLER_URL\s*=/m.test(content)
  };
}

/**
 * Updates existing MISO entries
 * @function updateExistingMisoEntries
 * @param {string} content - File content
 * @param {string} clientIdKey - Client ID key
 * @param {string} clientSecretKey - Client secret key
 * @param {Object} entries - Entry flags
 * @returns {string} Updated content
 */
function updateExistingMisoEntries(content, clientIdKey, clientSecretKey, entries) {
  if (entries.hasClientId) {
    content = content.replace(/^MISO_CLIENTID\s*=.*$/m, `MISO_CLIENTID=kv://${clientIdKey}`);
  }
  if (entries.hasClientSecret) {
    content = content.replace(/^MISO_CLIENTSECRET\s*=.*$/m, `MISO_CLIENTSECRET=kv://${clientSecretKey}`);
  }
  if (entries.hasControllerUrl) {
    content = content.replace(/^MISO_CONTROLLER_URL\s*=.*$/m, 'MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');
  }
  return content;
}

/**
 * Builds missing MISO entries
 * @function buildMissingMisoEntries
 * @param {string} clientIdKey - Client ID key
 * @param {string} clientSecretKey - Client secret key
 * @param {Object} entries - Entry flags
 * @returns {string[]} Array of missing entries
 */
function buildMissingMisoEntries(clientIdKey, clientSecretKey, entries) {
  const missingEntries = [];
  if (!entries.hasClientId) {
    missingEntries.push(`MISO_CLIENTID=kv://${clientIdKey}`);
  }
  if (!entries.hasClientSecret) {
    missingEntries.push(`MISO_CLIENTSECRET=kv://${clientSecretKey}`);
  }
  if (!entries.hasControllerUrl) {
    missingEntries.push('MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');
  }
  return missingEntries;
}

/**
 * Inserts MISO section into content
 * @function insertMisoSection
 * @param {string} content - File content
 * @param {string[]} missingEntries - Missing entries to add
 * @returns {string} Updated content
 */
function insertMisoSection(content, missingEntries) {
  const misoSection = `# MISO Application Client Credentials (per application)
${missingEntries.join('\n')}
`;

  const lastSectionMatch = content.match(/# =+.*$/gm);
  if (lastSectionMatch && lastSectionMatch.length > 0) {
    const lastSectionIndex = content.lastIndexOf(lastSectionMatch[lastSectionMatch.length - 1]);
    const insertIndex = content.indexOf('\n', lastSectionIndex) + 1;
    return content.slice(0, insertIndex) + '\n' + misoSection + content.slice(insertIndex);
  }
  return content + '\n' + misoSection;
}

async function updateEnvTemplate(appKey, clientIdKey, clientSecretKey, _controllerUrl) {
  const envTemplatePath = path.join(process.cwd(), 'builder', appKey, 'env.template');

  if (!fsSync.existsSync(envTemplatePath)) {
    logger.warn(chalk.yellow(`⚠️  env.template not found for ${appKey}, skipping update`));
    return;
  }

  try {
    let content = await fs.readFile(envTemplatePath, 'utf8');

    const entries = checkMisoEntries(content);
    content = updateExistingMisoEntries(content, clientIdKey, clientSecretKey, entries);

    // Add missing entries
    if (!entries.hasClientId || !entries.hasClientSecret || !entries.hasControllerUrl) {
      const missingEntries = buildMissingMisoEntries(clientIdKey, clientSecretKey, entries);
      content = insertMisoSection(content, missingEntries);
    }

    await fs.writeFile(envTemplatePath, content, 'utf8');
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Could not update env.template: ${error.message}`));
  }
}

module.exports = { updateEnvTemplate };

