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
async function updateEnvTemplate(appKey, clientIdKey, clientSecretKey, _controllerUrl) {
  const envTemplatePath = path.join(process.cwd(), 'builder', appKey, 'env.template');

  if (!fsSync.existsSync(envTemplatePath)) {
    logger.warn(chalk.yellow(`⚠️  env.template not found for ${appKey}, skipping update`));
    return;
  }

  try {
    let content = await fs.readFile(envTemplatePath, 'utf8');

    // Check if entries already exist
    const hasClientId = /^MISO_CLIENTID\s*=/m.test(content);
    const hasClientSecret = /^MISO_CLIENTSECRET\s*=/m.test(content);
    const hasControllerUrl = /^MISO_CONTROLLER_URL\s*=/m.test(content);

    // Update existing entries
    if (hasClientId) {
      content = content.replace(/^MISO_CLIENTID\s*=.*$/m, `MISO_CLIENTID=kv://${clientIdKey}`);
    }

    if (hasClientSecret) {
      content = content.replace(/^MISO_CLIENTSECRET\s*=.*$/m, `MISO_CLIENTSECRET=kv://${clientSecretKey}`);
    }

    if (hasControllerUrl) {
      content = content.replace(/^MISO_CONTROLLER_URL\s*=.*$/m, 'MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');
    }

    // Add missing entries
    if (!hasClientId || !hasClientSecret || !hasControllerUrl) {
      const missingEntries = [];
      if (!hasClientId) {
        missingEntries.push(`MISO_CLIENTID=kv://${clientIdKey}`);
      }
      if (!hasClientSecret) {
        missingEntries.push(`MISO_CLIENTSECRET=kv://${clientSecretKey}`);
      }
      if (!hasControllerUrl) {
        missingEntries.push('MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');
      }

      const misoSection = `# MISO Application Client Credentials (per application)
${missingEntries.join('\n')}
`;

      // Try to find a good place to insert (after last section or at end)
      const lastSectionMatch = content.match(/# =+.*$/gm);
      if (lastSectionMatch && lastSectionMatch.length > 0) {
        const lastSectionIndex = content.lastIndexOf(lastSectionMatch[lastSectionMatch.length - 1]);
        const insertIndex = content.indexOf('\n', lastSectionIndex) + 1;
        content = content.slice(0, insertIndex) + '\n' + misoSection + content.slice(insertIndex);
      } else {
        content = content + '\n' + misoSection;
      }
    }

    await fs.writeFile(envTemplatePath, content, 'utf8');
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Could not update env.template: ${error.message}`));
  }
}

module.exports = { updateEnvTemplate };

