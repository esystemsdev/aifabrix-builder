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
 * Updates env.template to add MISO_CLIENTID and MISO_CLIENTSECRET entries
 * @async
 * @param {string} appKey - Application key
 * @param {string} clientIdKey - Secret key for client ID (e.g., 'myapp-client-idKeyVault')
 * @param {string} clientSecretKey - Secret key for client secret (e.g., 'myapp-client-secretKeyVault')
 * @returns {Promise<void>} Resolves when template is updated
 */
async function updateEnvTemplate(appKey, clientIdKey, clientSecretKey) {
  const envTemplatePath = path.join(process.cwd(), 'builder', appKey, 'env.template');

  if (!fsSync.existsSync(envTemplatePath)) {
    logger.warn(chalk.yellow(`⚠️  env.template not found for ${appKey}, skipping update`));
    return;
  }

  try {
    let content = await fs.readFile(envTemplatePath, 'utf8');

    // Check if MISO_CLIENTID already exists
    const hasClientId = /^MISO_CLIENTID\s*=/m.test(content);
    const hasClientSecret = /^MISO_CLIENTSECRET\s*=/m.test(content);

    if (hasClientId && hasClientSecret) {
      // Update existing entries
      content = content.replace(/^MISO_CLIENTID\s*=.*$/m, `MISO_CLIENTID=kv://${clientIdKey}`);
      content = content.replace(/^MISO_CLIENTSECRET\s*=.*$/m, `MISO_CLIENTSECRET=kv://${clientSecretKey}`);
    } else {
      // Add new section if not present
      const misoSection = `# MISO Application Client Credentials (per application)
MISO_CLIENTID=kv://${clientIdKey}
MISO_CLIENTSECRET=kv://${clientSecretKey}
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
    logger.log(chalk.green(`✓ Updated env.template for ${appKey}`));
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Could not update env.template: ${error.message}`));
  }
}

module.exports = { updateEnvTemplate };

