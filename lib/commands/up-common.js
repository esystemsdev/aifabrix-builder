/**
 * AI Fabrix Builder - Up Commands Shared Helpers
 *
 * Shared logic for up-miso and up-dataplane (ensure app from template).
 *
 * @fileoverview Shared helpers for up-miso and up-dataplane commands
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const logger = require('../utils/logger');
const pathsUtil = require('../utils/paths');
const { copyTemplateFiles } = require('../validation/template');

/**
 * Copy template to a target path if variables.yaml is missing there.
 * @param {string} appName - Application name
 * @param {string} targetAppPath - Target directory (e.g. builder/keycloak)
 * @returns {Promise<boolean>} True if template was copied, false if already present
 */
async function ensureTemplateAtPath(appName, targetAppPath) {
  const variablesPath = path.join(targetAppPath, 'variables.yaml');
  if (fs.existsSync(variablesPath)) {
    return false;
  }
  await copyTemplateFiles(appName, targetAppPath);
  return true;
}

/**
 * Ensures builder app directory exists from template if variables.yaml is missing.
 * If builder/<appName>/variables.yaml does not exist, copies from templates/applications/<appName>.
 * Uses AIFABRIX_BUILDER_DIR when set (e.g. by up-miso/up-dataplane from config aifabrix-env-config).
 * When using a custom builder dir, also populates cwd/builder/<appName> so the repo's builder/ is not empty.
 *
 * @async
 * @function ensureAppFromTemplate
 * @param {string} appName - Application name (keycloak, miso-controller, dataplane)
 * @returns {Promise<boolean>} True if template was copied (in either location), false if both already existed
 * @throws {Error} If template copy fails
 *
 * @example
 * await ensureAppFromTemplate('keycloak');
 */
async function ensureAppFromTemplate(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required and must be a string');
  }

  const appPath = pathsUtil.getBuilderPath(appName);
  const primaryCopied = await ensureTemplateAtPath(appName, appPath);
  if (primaryCopied) {
    logger.log(chalk.blue(`Creating builder/${appName} from template...`));
    logger.log(chalk.green(`✓ Copied template for ${appName}`));
  }

  const cwdBuilderPath = path.join(process.cwd(), 'builder', appName);
  if (path.resolve(cwdBuilderPath) !== path.resolve(appPath)) {
    const cwdCopied = await ensureTemplateAtPath(appName, cwdBuilderPath);
    if (cwdCopied) {
      logger.log(chalk.blue(`Creating builder/${appName} in project (from template)...`));
      logger.log(chalk.green(`✓ Copied template for ${appName} into builder/`));
    }
  }

  return primaryCopied;
}

module.exports = { ensureAppFromTemplate };
