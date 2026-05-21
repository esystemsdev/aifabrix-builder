/**
 * `aifabrix validate` and `diff` command wiring (split from setup-utility for size limits).
 *
 * @fileoverview Validate and diff CLI commands
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { VALIDATE_HELP_AFTER } = require('./setup-utility-help-after');

/**
 * @param {string} appOrFile
 * @param {object} result
 * @param {string} outFormat
 */
function emitManifestAfterValidateIfApplicable(appOrFile, result, outFormat) {
  if (outFormat === 'json' || !result?.appPath || !appOrFile || typeof appOrFile !== 'string') {
    return;
  }
  try {
    if (fs.existsSync(appOrFile) && fs.statSync(appOrFile).isFile()) {
      return;
    }
    const { emitManifestMetadataLineIfTTY } = require('../utils/manifest-source-emit');
    emitManifestMetadataLineIfTTY(logger, {
      appKey: appOrFile,
      appPath: result.appPath,
      envOnly: false,
      json: false
    });
  } catch {
    /* ignore emit failures */
  }
}

/**
 * @param {object} validate
 * @param {object} opts
 * @returns {Promise<boolean>}
 */
async function runValidateBatchBranch(validate, opts) {
  const integration = opts.integration === true;
  const builder = opts.builder === true;
  if (!integration && !builder) {
    return false;
  }
  const outFormat = (opts.format || 'default').toLowerCase();
  const batchResult = integration && builder
    ? await validate.validateAll(opts)
    : integration
      ? await validate.validateAllIntegrations(opts)
      : await validate.validateAllBuilderApps(opts);
  if (outFormat === 'json') {
    logger.log(JSON.stringify(batchResult, null, 2));
  } else {
    validate.displayBatchValidationResults(batchResult);
  }
  if (!batchResult.valid) process.exit(1);
  return true;
}

/**
 * @param {string} appOrFile
 * @param {object} opts
 * @returns {Promise<void>}
 */
async function runProtectionValidateBranch(appOrFile, opts) {
  const { validateProtectionBatchCommand } = require('../protection/validate-batch');
  const code = await validateProtectionBatchCommand(
    {
      env: opts.env,
      json: (opts.format || '').toLowerCase() === 'json',
      warningsAsErrors: opts.warningsAsErrors === true,
      simulate: opts.simulate === true,
      verbose: opts.verbose === true
    },
    logger
  );
  if (code !== 0) {
    process.exit(code);
  }
}

/**
 * @param {object} result
 * @param {string} appOrFile
 * @returns {object}
 */
function buildValidateJsonPayload(result, appOrFile) {
  let payload = result;
  try {
    if (result?.appPath && appOrFile && typeof appOrFile === 'string') {
      if (!(fs.existsSync(appOrFile) && fs.statSync(appOrFile).isFile())) {
        const { getManifestSourcePayload } = require('../utils/manifest-source-emit');
        payload = { ...result, manifestSource: getManifestSourcePayload(appOrFile, result.appPath) };
      }
    }
  } catch {
    /* keep plain result */
  }
  return payload;
}

/**
 * @param {string} appOrFile
 * @param {object} result
 * @param {string} outFormat
 * @param {object} validate
 */
function displaySingleValidateResult(appOrFile, result, outFormat, validate) {
  emitManifestAfterValidateIfApplicable(appOrFile, result, outFormat);
  if (outFormat === 'json') {
    logger.log(JSON.stringify(buildValidateJsonPayload(result, appOrFile), null, 2));
    return;
  }
  validate.displayValidationResults(result);
}

/**
 * @param {string} appOrFile
 * @param {object} options
 * @returns {Promise<void>}
 */
async function runValidateCommand(appOrFile, options) {
  const validate = require('../validation/validate');
  const opts = options.opts ? options.opts() : options;
  const { isProtectionScope } = require('../protection/scope');
  if (isProtectionScope(appOrFile)) {
    await runProtectionValidateBranch(appOrFile, opts);
    return;
  }
  if (await runValidateBatchBranch(validate, opts)) {
    return;
  }
  const outFormat = (opts.format || 'default').toLowerCase();
  if (!appOrFile || typeof appOrFile !== 'string') {
    logger.log(chalk.red('App name or file path is required, or use --integration / --builder'));
    process.exit(1);
  }
  const result = await validate.validateAppOrFile(appOrFile, {
    ...opts,
    certSync: opts.certSync === true
  });
  displaySingleValidateResult(appOrFile, result, outFormat, validate);
  if (!result.valid) process.exit(1);
}

/**
 * @param {import('commander').Command} program
 */
function setupValidateDiffCommands(program) {
  program.command('validate [appKey|systemKey|file]')
    .description('Validate appKey, systemKey, file path, .protection batch, or all under integration/ and builder/')
    .addHelpText('after', VALIDATE_HELP_AFTER)
    .option('--format <format>', 'Output format: json | default (human-readable)')
    .option('--integration', 'Validate all applications under integration/')
    .option('--builder', 'Validate all applications under builder/')
    .option('--warnings-as-errors', 'For .protection: pass strict=true to dataplane validate')
    .option('--simulate', 'For .protection: run simulate after validate')
    .option(
      '--cert-sync',
      'After successful validation of an external integration, refresh the system file certification block from the dataplane (requires login)'
    )
    .action((appOrFile, options) => {
      runValidateCommand(appOrFile, options).catch((error) => {
        handleCommandError(error, 'validate');
        process.exit(1);
      });
    });

  program.command('diff <file1> <file2>')
    .description('Diff two config files (optional schema validate)')
    .option('--no-validate', 'Skip schema validation (type check still applied)')
    .action(async(file1, file2, cmd) => {
      try {
        const diff = require('../core/diff');
        const opts = cmd.opts();
        const result = await diff.compareFiles(file1, file2, { validate: opts.validate !== false });
        diff.formatDiffOutput(result);
        if (!result.identical) process.exit(1);
      } catch (error) {
        handleCommandError(error, 'diff');
        process.exit(1);
      }
    });
}

module.exports = {
  setupValidateDiffCommands,
  runValidateCommand
};
