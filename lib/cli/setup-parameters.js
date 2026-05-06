/**
 * @fileoverview parameters subcommand (validate kv:// catalog coverage)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { handleCommandError } = require('../utils/cli-utils');
const { handleParametersValidate } = require('../commands/parameters-validate');

/**
 * @param {import('commander').Command} program - Commander program
 */
function setupParametersCommands(program) {
  const parameters = program
    .command('parameters')
    .description('Infra parameter catalog (kv:// keys, generators, Azure naming hints)');

  parameters
    .command('validate')
    .description(
      'Validate builder/*/env.template kv:// references against infra.parameter.yaml'
    )
    .option('--catalog <path>', 'Override path to infra.parameter.yaml')
    .option('--verbose', 'Print scanned files and scan summary')
    .addHelpText(
      'after',
      `
Examples:
  aifabrix parameters validate
  aifabrix parameters validate --verbose
  aifabrix parameters validate --catalog ./lib/schema/infra.parameter.yaml

Notes:
  - Scans builder/* apps only (integration/* is intentionally skipped).
  - Extracts kv://KEY references from env.template and checks KEY coverage in the catalog.
`
    )
    .action(async(opts) => {
      try {
        const result = await handleParametersValidate({
          catalogPath: opts.catalog,
          verbose: Boolean(opts.verbose)
        });
        if (!result.valid) process.exit(1);
      } catch (error) {
        handleCommandError(error, 'parameters validate');
      }
    });
}

module.exports = { setupParametersCommands };
