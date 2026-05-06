/**
 * Datasource capability subcommands (copy, remove, create, diff, edit, validate).
 *
 * @fileoverview Nested `aifabrix datasource capability` CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const logger = require('../utils/logger');
const {
  formatBlockingError,
  formatBulletSection,
  formatNextActions,
  formatSuccessLine,
  headerKeyValue,
  infoLine,
  metadata
} = require('../utils/cli-test-layout-chalk');
const { validateDatasourceFile, resolveValidateInputPath } = require('../datasource/validate');
const { runCapabilityCopy } = require('../datasource/capability/run-capability-copy');
const { runCapabilityRemove } = require('../datasource/capability/run-capability-remove');
const { runCapabilityDiff } = require('../datasource/capability/run-capability-diff');
const { runCapabilityEdit } = require('../datasource/capability/run-capability-edit');
const { checkCapabilitySlices } = require('../datasource/capability/validate-capability-slice');
const { logDatasourceValidateOutcome } = require('../datasource/datasource-validate-display');
const pathMod = require('path');

const CAP_COPY_HELP = `
Examples:
  $ aifabrix datasource capability copy test-e2e-hubspot-companies --from create --as createBasicTrial --dry-run
  $ af datasource cap copy integration/myapp/x-datasource-y.json --from list --as listVerbose --dry-run

When exposed.profiles.<from> exists it is copied to exposed.profiles.<as>.
With --test, matching testPayload.scenarios rows (same operation as the source capability / openapi / CIP keys) are cloned with operation set to --as.

Next step after mutating:  aifabrix datasource validate <file-or-key>
`;

const CAP_CREATE_HELP = `
Creates a capability by cloning an existing one (same as copy). Future: --template, --openapi-operation.

  $ aifabrix datasource capability create my-datasource-key --from list --as listAlt
`;

const CAP_VALIDATE_HELP = `
  $ aifabrix datasource capability validate test-e2e-hubspot-companies
  $ af datasource cap validate ./integration/x/y-datasource-z.json --capability create
`;

const CAP_REMOVE_HELP = `
Examples:
  $ aifabrix datasource capability remove test-e2e-hubspot-companies --capability createCliGolden --dry-run
  $ af datasource cap remove ./integration/x/datasource.json --capability list

Next:  aifabrix datasource validate <file-or-key>
`;

const CAP_DIFF_HELP = `
Compare OpenAPI + CIP slices (and optional exposed.profiles) for one capability between two files.

  $ aifabrix datasource capability diff ./before.json ./after.json --capability create
  $ af datasource cap diff a.json b.json --capability-a list --capability-b listVerbose --profile list
`;

const CAP_EDIT_HELP = `
Uses $VISUAL or $EDITOR for the JSON editor; if both are unset and **nano** is on PATH, nano is used.

When **--section profile**, if **exposed.profiles** has a row for the capability you picked (interactive or **-c**), that row opens directly—no “which profile?” list. Use **--profile <key>** to edit a different row. Override the editor for one run: **--editor nano**.

  $ aifabrix datasource capability edit my-datasource-key --capability create --section openapi
  $ af datasource cap edit my-datasource-key -c updateAddress --section profile
`;

/**
 * @param {string} resolvedPath
 * @param {string[]} updatedSections
 * @param {string} [heading='Updated']
 * @returns {void}
 */
function printCapabilitySuccessFooter(resolvedPath, updatedSections, heading = 'Updated') {
  const display =
    resolvedPath.includes(' ') ? `"${resolvedPath}"` : resolvedPath;
  logger.log('');
  logger.log(formatBulletSection(`${heading}:`, updatedSections));
  logger.log('');
  logger.log(formatNextActions([`aifabrix datasource validate ${display}`]));
}

/**
 * Copy/create from CLI: always calls copy with basicExposure false (not exposed on CLI).
 *
 * @param {string} fileOrKey
 * @param {object} options - Commander options
 * @returns {Promise<void>}
 */
async function runCopyLikeAction(fileOrKey, options) {
  const result = await runCapabilityCopy({
    fileOrKey,
    from: options.from,
    as: options.as,
    dryRun: Boolean(options.dryRun),
    overwrite: Boolean(options.overwrite),
    noBackup: Boolean(options.noBackup),
    basicExposure: false,
    includeTestPayload: Boolean(options.test)
  });

  if (result.dryRun) {
    logger.log(infoLine('Dry run — planned JSON Patch operations:'));
    logger.log('');
    logger.log(JSON.stringify(result.patchOperations, null, 2));
    return;
  }

  if (result.backupPath) {
    logger.log(headerKeyValue('Backup:', result.backupPath));
  }
  printCapabilitySuccessFooter(result.resolvedPath, result.updatedSections);
}

/**
 * @param {string} fileOrKey
 * @param {object} options - Commander options
 * @returns {Promise<void>}
 */
async function runRemoveAction(fileOrKey, options) {
  const result = await runCapabilityRemove({
    fileOrKey,
    capability: options.capability,
    dryRun: Boolean(options.dryRun),
    noBackup: Boolean(options.noBackup),
    force: Boolean(options.force)
  });

  if (result.dryRun) {
    logger.log(infoLine('Dry run — planned JSON Patch operations:'));
    logger.log('');
    logger.log(JSON.stringify(result.patchOperations, null, 2));
    if (!result.removed) {
      logger.log(metadata('(no changes; capability already absent)'));
    }
    return;
  }

  if (result.backupPath) {
    logger.log(headerKeyValue('Backup:', result.backupPath));
  }
  const heading = result.removed ? 'Removed' : 'Unchanged';
  printCapabilitySuccessFooter(result.resolvedPath, result.updatedSections, heading);
}

/**
 * @param {import('commander').Command} cap - capability command group
 * @returns {void}
 */
function setupCapabilityCopyCommand(cap) {
  cap.command('copy <file-or-key>')
    .description(
      'Clone openapi + CIP operations (lowercase keys), profiles (--as casing); optional --test for scenarios'
    )
    .requiredOption('--from <key>', 'Source capability key (must exist)')
    .requiredOption('--as <key>', 'Target capability key (must be unique unless --overwrite)')
    .option('--dry-run', 'Print JSON Patch operations; do not write')
    .option('--overwrite', 'Replace target capability and matching exposed.profiles.<as> if present')
    .option('--no-backup', 'Skip backup copy under integration/<app>/backup/')
    .option(
      '--test',
      'Also clone testPayload.scenarios rows whose operation matches the source capability'
    )
    .addHelpText('after', CAP_COPY_HELP)
    .action(async(fileOrKey, options) => {
      try {
        await runCopyLikeAction(fileOrKey, options);
      } catch (error) {
        logger.error(formatBlockingError(`capability copy failed: ${error.message}`));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} cap
 * @returns {void}
 */
function setupCapabilityRemoveCommand(cap) {
  cap.command('remove <file-or-key>')
    .description(
      'Remove one capability (capabilities[], openapi.operations, execution.cip.operations), exposed.profiles.<key>, and matching testPayload.scenarios rows'
    )
    .requiredOption('-c, --capability <key>', 'Capability key to delete')
    .option('--dry-run', 'Print JSON Patch operations; do not write')
    .option('--no-backup', 'Skip backup copy under integration/<app>/backup/')
    .option('--force', 'Succeed if capability is already absent (no file change)')
    .addHelpText('after', CAP_REMOVE_HELP)
    .action(async(fileOrKey, options) => {
      try {
        await runRemoveAction(fileOrKey, options);
      } catch (error) {
        logger.error(formatBlockingError(`capability remove failed: ${error.message}`));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} cap
 * @returns {void}
 */
function setupCapabilityCreateCommand(cap) {
  const createCmd = cap
    .command('create <file-or-key>')
    .description('Create capability by cloning --from (alias: add). Templates/OpenAPI: planned.');
  if (typeof createCmd.alias === 'function') {
    createCmd.alias('add');
  }
  createCmd
    .requiredOption('--from <key>', 'Source capability to clone')
    .requiredOption('--as <key>', 'New capability key (must be unique unless --overwrite)')
    .option('--dry-run', 'Print JSON Patch operations; do not write')
    .option('--overwrite', 'Replace target capability and matching exposed.profiles.<as> if present')
    .option('--no-backup', 'Skip backup')
    .option(
      '--test',
      'Also clone testPayload.scenarios rows whose operation matches the source capability'
    )
    .option('--template <name>', 'Reserved for future template-based create')
    .option('--openapi-operation <operationId>', 'Reserved for future OpenAPI binding')
    .addHelpText('after', CAP_CREATE_HELP)
    .action(async(fileOrKey, options) => {
      try {
        if (options.template || options.openapiOperation) {
          throw new Error(
            '--template and --openapi-operation are not implemented yet; use --from to clone an existing capability.'
          );
        }
        await runCopyLikeAction(fileOrKey, options);
      } catch (error) {
        logger.error(formatBlockingError(`capability create failed: ${error.message}`));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} cap
 * @returns {void}
 */
function setupCapabilityDiffCommand(cap) {
  cap
    .command('diff <file-a> <file-b>')
    .description(
      'Compare capability slices between two datasource JSON files (optional exposed.profiles profile)'
    )
    .option(
      '-c, --capability <key>',
      'Capability key on both sides (use --capability-a/b to compare different keys)'
    )
    .option('--capability-a <key>', 'Capability key in first file')
    .option('--capability-b <key>', 'Capability key in second file')
    .option('--profile <name>', 'Include exposed.profiles.<name> on both sides')
    .option('--profile-a <name>', 'Profile key for first file')
    .option('--profile-b <name>', 'Profile key for second file')
    .addHelpText('after', CAP_DIFF_HELP)
    .action(async(fileA, fileB, options) => {
      try {
        const { identical } = runCapabilityDiff({
          fileA,
          fileB,
          capability: options.capability,
          capabilityA: options.capabilityA,
          capabilityB: options.capabilityB,
          profile: options.profile,
          profileA: options.profileA,
          profileB: options.profileB
        });
        if (!identical) {
          process.exit(1);
        }
      } catch (error) {
        logger.error(formatBlockingError(`capability diff failed: ${error.message}`));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} cap
 * @returns {void}
 */
function setupCapabilityEditCommand(cap) {
  cap
    .command('edit <file-or-key>')
    .description(
      'Interactively edit openapi/cip/exposed profile JSON for one capability (TTY + $EDITOR / nano)'
    )
    .option('-c, --capability <key>', 'Capability key (skip prompt)')
    .option('--section <name>', 'openapi | cip | profile (skip prompt)')
    .option('--profile <name>', 'When section=profile, exposed.profiles key (skip prompt)')
    .option('--editor <cmd>', 'Editor command for this run (sets VISUAL and EDITOR)')
    .option('--no-backup', 'Skip backup copy under integration/<app>/backup/')
    .addHelpText('after', CAP_EDIT_HELP)
    .action(async(fileOrKey, options) => {
      try {
        const editorArg = options.editor !== undefined && options.editor !== null ? String(options.editor).trim() : '';
        if (editorArg) {
          process.env.VISUAL = editorArg;
          process.env.EDITOR = editorArg;
        }
        const section = normalizeCapabilityEditSection(options.section);
        const result = await runCapabilityEdit({
          fileOrKey,
          capability: options.capability,
          section,
          profile: options.profile,
          noBackup: Boolean(options.noBackup)
        });
        if (result.backupPath) {
          logger.log(headerKeyValue('Backup:', result.backupPath));
        }
        printCapabilitySuccessFooter(result.resolvedPath, ['Saved capability slice JSON'], 'Updated');
      } catch (error) {
        logger.error(formatBlockingError(`capability edit failed: ${error.message}`));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} cap
 * @returns {void}
 */
function setupCapabilityValidateCommand(cap) {
  cap.command('validate <file-or-key>')
    .description('Validate datasource JSON; optional --capability slice presence check')
    .option('-c, --capability <key>', 'Ensure capability exists in openapi + cip + capabilities[]')
    .addHelpText('after', CAP_VALIDATE_HELP)
    .action(async(fileOrKey, options) => {
      try {
        const trimmed = fileOrKey.trim();
        const result = await validateDatasourceFile(trimmed);
        const resolvedPath = result.resolvedPath;
        const argResolved = pathMod.resolve(trimmed);
        const showMapping = resolvedPath && argResolved !== resolvedPath && trimmed !== resolvedPath;
        logDatasourceValidateOutcome(result, trimmed, showMapping);

        if (!result.valid) {
          process.exit(1);
        }

        if (options.capability) {
          const readPath = resolveValidateInputPath(trimmed);
          const parsed = JSON.parse(fs.readFileSync(readPath, 'utf8'));
          const slice = checkCapabilitySlices(parsed, options.capability);
          if (slice.missing.length > 0) {
            logger.error(
              formatBlockingError(
                `Capability "${slice.key}" incomplete: ${slice.missing.join('; ')}`
              )
            );
            process.exit(1);
          }
          logger.log(formatSuccessLine(`Capability slice OK: ${slice.key}`));
        }
      } catch (error) {
        logger.error(formatBlockingError(`capability validate failed: ${error.message}`));
        process.exit(1);
      }
    });
}

/**
 * Normalize `--section` for capability edit (openapi | cip | profile).
 *
 * @param {unknown} raw - Commander option value
 * @returns {'openapi'|'cip'|'profile'|undefined}
 * @throws {Error} When value is non-empty but not allowed
 */
function normalizeCapabilityEditSection(raw) {
  const sec = raw !== undefined && raw !== null ? String(raw).trim().toLowerCase() : '';
  if (sec && !['openapi', 'cip', 'profile'].includes(sec)) {
    throw new Error('--section must be openapi, cip, or profile');
  }
  return sec || undefined;
}

/**
 * Register nested datasource capability commands.
 *
 * @param {import('commander').Command} datasource - datasource command group
 * @returns {void}
 */
function setupDatasourceCapabilityCommands(datasource) {
  const cap = datasource
    .command('capability')
    .description(
      'Copy, remove, diff, edit, or validate per-capability OpenAPI/CIP slices in datasource JSON'
    );
  if (typeof cap.alias === 'function') {
    cap.alias('cap');
  }

  setupCapabilityCopyCommand(cap);
  setupCapabilityRemoveCommand(cap);
  setupCapabilityCreateCommand(cap);
  setupCapabilityDiffCommand(cap);
  setupCapabilityEditCommand(cap);
  setupCapabilityValidateCommand(cap);
}

module.exports = {
  setupDatasourceCapabilityCommands,
  printCapabilitySuccessFooter,
  runCopyLikeAction,
  runRemoveAction,
  normalizeCapabilityEditSection
};
