/**
 * `aifabrix resolve <app>` command wiring (split from setup-utility for file/function size limits).
 *
 * @fileoverview Resolve CLI command
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const secrets = require('../core/secrets');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const coreConfig = require('../core/config');
const { resolvePreferLocalEnvOutputPathFlag } = require('../utils/applications-config-defaults');
const { getResolveAppPath } = require('../utils/paths');

/**
 * @param {string} appName
 * @param {string} appPath
 * @param {boolean} envOnly
 * @param {string} envPath
 * @param {{ skipValidation?: boolean }} options
 * @param {{ getManifestSourcePayload: function }} manifestEmit
 * @returns {Promise<void>}
 */
async function runResolveJsonOutput(appName, appPath, envOnly, envPath, options, manifestEmit) {
  /** @type {Record<string, unknown>} */
  const payload = {
    app: appName,
    appPath,
    envOnly,
    envPath,
    manifestSource: envOnly ? null : manifestEmit.getManifestSourcePayload(appName, appPath)
  };
  if (!envOnly && !options.skipValidation) {
    const validate = require('../validation/validate');
    payload.validation = await validate.validateAppOrFile(appName);
  }
  logger.log(JSON.stringify(payload, null, 2));
  const v = payload.validation;
  if (v && typeof v === 'object' && v.valid === false) {
    process.exit(1);
  }
}

/**
 * @param {string} appName
 * @param {string} envPath
 * @param {boolean} envOnly
 * @param {{ skipValidation?: boolean }} options
 * @returns {Promise<void>}
 */
async function runResolveHumanOutput(appName, envPath, envOnly, options) {
  logger.log(`✔ Generated .env file: ${envPath}`);
  logger.log(chalk.gray('  Note: up-platform / up-miso / up-dataplane / register / build resolve secrets in memory only.'));
  logger.log(chalk.gray(`  Re-run "aifabrix resolve ${appName}" whenever you need an on-disk .env again.`));
  if (envOnly) {
    logger.log(chalk.gray('  (env-only mode: validation skipped; no application config file)'));
    return;
  }
  if (options.skipValidation) {
    return;
  }
  const validate = require('../validation/validate');
  const result = await validate.validateAppOrFile(appName);
  validate.displayValidationResults(result);
  if (!result.valid) {
    logger.log(chalk.yellow('\n⚠  Validation found errors. Fix them before deploying.'));
    process.exit(1);
  }
}

/**
 * @param {string} appName
 * @param {{ force?: boolean, skipValidation?: boolean, json?: boolean }} options
 * @returns {Promise<void>}
 */
async function runResolveAppAction(appName, options) {
  const jsonMode = options.json === true;
  const { appPath, envOnly } = await getResolveAppPath(appName);
  const manifestEmit = require('../utils/manifest-source-emit');
  manifestEmit.emitManifestMetadataLineIfTTY(logger, {
    appKey: appName,
    appPath,
    envOnly,
    json: jsonMode
  });
  const userCfg = await coreConfig.getConfig();
  const preferLocalEnvOutputPath = await resolvePreferLocalEnvOutputPathFlag(userCfg, appName);
  const envPath = await secrets.generateEnvFile(
    appName,
    undefined,
    'docker',
    options.force,
    {
      appPath,
      envOnly,
      skipOutputPath: false,
      preserveFromPath: null,
      preferLocalEnvOutputPath
    }
  );
  if (jsonMode) {
    await runResolveJsonOutput(appName, appPath, envOnly, envPath, options, manifestEmit);
    return;
  }
  await runResolveHumanOutput(appName, envPath, envOnly, options);
}

/**
 * @param {import('commander').Command} program
 * @returns {void}
 */
function setupResolveCommand(program) {
  program.command('resolve <app>')
    .description('Generate .env from template; optional validate after')
    .option('-f, --force', 'Generate missing secret keys in secrets file')
    .option('--skip-validation', 'Skip file validation after generating .env')
    .option('--json', 'Print JSON summary (envPath, manifestSource, optional validation)')
    .action(async(appName, options) => {
      try {
        await runResolveAppAction(appName, options);
      } catch (error) {
        handleCommandError(error, 'resolve');
        process.exit(1);
      }
    });
}

module.exports = { setupResolveCommand };
