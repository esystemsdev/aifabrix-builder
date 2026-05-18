/**
 * @fileoverview Protection subcommand registration (keeps setupProtectionCommands under line limit).
 */

'use strict';

const logger = require('../utils/logger');
const { resolveProtectionArgument } = require('../protection/resolve');
const {
  runProtectionValidate,
  runProtectionUpload,
  runProtectionList,
  runProtectionShow,
  runProtectionDelete
} = require('../protection/run-commands');
const { runProtectionCreate } = require('../protection/run-protection-create');

const SHARED_OPTS = [
  ['-e, --env <environment>', 'Environment key'],
  ['-v, --verbose', 'Verbose output']
];

const PROTECTION_CREATE_HELP_AFTER = `

Examples:
  $ aifabrix protection create hubspot-companies --type country-sales
  $ aifabrix protection create hr-persons --type department-manager
  $ aifabrix protection create erp-projects --type project-team
  $ aifabrix protection create hubspot-companies --dimension-key country --dry-run
  $ aifabrix protection create hubspot-companies --type country-sales --force

Preset types:
  country-sales, department-manager, customer-team, project-team, static-region, owner-direct
`;

const PROTECTION_VALIDATE_HELP_AFTER = `

Examples:
  $ aifabrix protection validate hubspot-companies
  $ aifabrix protection validate hubspot-companies --simulate
  $ aifabrix protection validate hubspot-companies --warnings-as-errors
  $ aifabrix protection validate hubspot-companies --json
`;

const PROTECTION_UPLOAD_HELP_AFTER = `

Examples:
  $ aifabrix protection upload hubspot-companies
  $ aifabrix protection upload hubspot-companies --dry-run
  $ aifabrix protection upload hubspot-companies --no-sync
`;

const PROTECTION_LIST_HELP_AFTER = `

Examples:
  $ aifabrix protection list
  $ aifabrix protection list --page 1 --page-size 50
  $ aifabrix protection list --filter enabled:eq:true
  $ aifabrix protection list --json
`;

const PROTECTION_SHOW_HELP_AFTER = `

Examples:
  $ aifabrix protection show hubspot-companies
  $ aifabrix protection show hubspot-companies -v
  $ aifabrix protection show hubspot-companies --json
`;

const PROTECTION_DELETE_HELP_AFTER = `

Examples:
  $ aifabrix protection delete hubspot-companies
  $ aifabrix protection delete hubspot-companies --yes
`;

/**
 * @param {import('commander').Command} cmd
 * @param {string} name
 * @param {string} description
 * @param {Function} action
 * @param {Array<[string, string]>} extraOpts
 * @param {string} helpAfter
 */
function addProtectionLeaf(cmd, name, description, action, extraOpts = [], helpAfter = '') {
  const leaf = cmd.command(name).description(description);
  for (const [flags, desc] of [...SHARED_OPTS, ...extraOpts]) {
    leaf.option(flags, desc);
  }
  if (helpAfter) {
    leaf.addHelpText('after', helpAfter);
  }
  leaf.action(async(datasourceKey, options) => {
    try {
      const code = await action(datasourceKey, options);
      if (code && code !== 0) process.exit(code);
    } catch (err) {
      const { formatBlockingError } = require('../utils/cli-test-layout-chalk');
      logger.error(formatBlockingError(err.message || String(err)));
      process.exit(1);
    }
  });
}

/**
 * @param {import('commander').Command} protection
 */
function registerProtectionCreate(protection) {
  const leaf = protection
    .command('create <datasourceKey>')
    .description(
      'Probe dataplane datasource + Controller dimension, then scaffold .yaml under .protection/'
    );
  for (const [flags, desc] of SHARED_OPTS) {
    leaf.option(flags, desc);
  }
  leaf
    .option('--type <type>', 'Preset type (country-sales, department-manager, customer-team, project-team, static-region, owner-direct)')
    .option('--dimension-key <key>', 'Dimension catalog key (inferred from --type when omitted)')
    .option('--field <name>', 'Metadata field used by preset value templates when needed')
    .option('--fk-name <name>', 'FK binding name in expressions (default: same as dimension key)')
    .option('--protection-key <key>', 'metadata.key (default: <datasource>-<dimension>-access)')
    .option('--display-name <text>', 'metadata.displayName')
    .option('--rule-key <key>', 'Rule key inside spec.rules[0]')
    .option('--principal-expression <expr>', 'Group principal expression (default: Sales {{fk.<fk>.metadata.iso3}} Users)')
    .option('--value-expression <expr>', 'Grant valueExpression (default: {{fk.<fk>.metadata.iso2}})')
    .option('--dry-run', 'Print YAML to stdout; do not write file')
    .option('--force', 'Overwrite existing {work}/.protection/<datasourceKey>.yaml')
    .option('--disabled', 'Set spec.enabled to false', false)
    .addHelpText('after', PROTECTION_CREATE_HELP_AFTER)
    .action(async(datasourceKey, options) => {
      try {
        const code = await runProtectionCreate(datasourceKey, {
          ...options,
          dryRun: options.dryRun === true,
          force: options.force === true,
          verbose: options.verbose === true,
          disabled: options.disabled === true
        }, logger);
        if (code && code !== 0) process.exit(code);
      } catch (err) {
        const { formatBlockingError } = require('../utils/cli-test-layout-chalk');
        if (Array.isArray(err.probeLines)) {
          for (const line of err.probeLines) {
            logger.log(line);
          }
        }
        logger.error(formatBlockingError(err.message || String(err)));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} protection
 */
function registerProtectionValidate(protection) {
  addProtectionLeaf(
    protection,
    'validate <datasourceKey>',
    'Validate protection manifest (local schema + dataplane)',
    async(datasourceKey, options) => {
      const resolved = resolveProtectionArgument(datasourceKey);
      return runProtectionValidate(resolved.datasourceKey, resolved.manifest, {
        ...options,
        manifestPath: resolved.manifestPath,
        warningsAsErrors: options.warningsAsErrors === true,
        simulate: options.simulate === true,
        json: options.json === true,
        verbose: options.verbose === true
      }, logger);
    },
    [
      ['--json', 'Output dataplane report as JSON'],
      ['--warnings-as-errors', 'Pass strict=true to dataplane validate'],
      ['--simulate', 'Run simulate after validate passes']
    ],
    PROTECTION_VALIDATE_HELP_AFTER
  );
}

/**
 * @param {import('commander').Command} protection
 */
function registerProtectionUpload(protection) {
  addProtectionLeaf(
    protection,
    'upload <datasourceKey>',
    'Validate and upload protection manifest to dataplane',
    async(datasourceKey, options) => {
      const resolved = resolveProtectionArgument(datasourceKey);
      return runProtectionUpload(resolved.datasourceKey, resolved.manifest, {
        ...options,
        manifestPath: resolved.manifestPath,
        warningsAsErrors: options.warningsAsErrors === true,
        dryRun: options.dryRun === true,
        noSync: options.noSync === true,
        verbose: options.verbose === true
      }, logger);
    },
    [
      ['--dry-run', 'Validate only; no upload or sync'],
      ['--no-sync', 'Skip datasource sync after upload']
    ],
    PROTECTION_UPLOAD_HELP_AFTER
  );
}

/**
 * @param {import('commander').Command} protection
 */
function registerProtectionList(protection) {
  const leaf = protection.command('list').description('List deployed protection manifests on dataplane');
  for (const [flags, desc] of SHARED_OPTS) {
    leaf.option(flags, desc);
  }
  leaf
    .option('--json', 'Output paginated list as JSON')
    .option('--page <n>', 'Page (1-based)', (v) => parseInt(v, 10))
    .option('--page-size <n>', 'Page size', (v) => parseInt(v, 10))
    .option('--filter <expr>', 'Filter (e.g. enabled:eq:true)')
    .addHelpText('after', PROTECTION_LIST_HELP_AFTER)
    .action(async(options) => {
      try {
        const code = await runProtectionList(
          {
            ...options,
            json: options.json === true,
            verbose: options.verbose === true
          },
          logger
        );
        if (code && code !== 0) process.exit(code);
      } catch (err) {
        const { formatBlockingError } = require('../utils/cli-test-layout-chalk');
        logger.error(formatBlockingError(err.message || String(err)));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} protection
 */
function registerProtectionShow(protection) {
  addProtectionLeaf(
    protection,
    'show <datasourceKey>',
    'Show deployed protection state from dataplane',
    async(datasourceKey, options) =>
      runProtectionShow(datasourceKey, {
        ...options,
        json: options.json === true,
        verbose: options.verbose === true
      }, logger),
    [['--json', 'Output merged manifest + status as JSON']],
    PROTECTION_SHOW_HELP_AFTER
  );
}

/**
 * @param {import('commander').Command} protection
 */
function registerProtectionDelete(protection) {
  addProtectionLeaf(
    protection,
    'delete <datasourceKey>',
    'Delete deployed protection for datasource',
    async(datasourceKey, options) =>
      runProtectionDelete(datasourceKey, {
        ...options,
        yes: options.yes === true
      }, logger),
    [['--yes', 'Skip confirmation prompt']],
    PROTECTION_DELETE_HELP_AFTER
  );
}

module.exports = {
  registerProtectionCreate,
  registerProtectionValidate,
  registerProtectionUpload,
  registerProtectionList,
  registerProtectionShow,
  registerProtectionDelete
};
