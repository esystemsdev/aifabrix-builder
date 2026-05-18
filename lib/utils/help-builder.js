/**
 * Categorized help builder for AI Fabrix Builder CLI
 *
 * Groups commands into logical categories and outputs a user-friendly help.
 *
 * @fileoverview Categorized CLI help
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { Help } = require('commander');

/**
 * Command categories and order. Each command can have an optional `term` override
 * for the help line (e.g. "down [service|app]"); otherwise the command name is used.
 *
 * @type {Array<{ name: string, commands: Array<{ name: string, term?: string }> }>}
 */
const CATEGORIES = [
  {
    name: 'Infrastructure (Local Development)',
    commands: [
      { name: 'setup' },
      { name: 'teardown' },
      { name: 'up-infra' },
      { name: 'up-platform' },
      { name: 'up-miso' },
      { name: 'up-dataplane' },
      { name: 'down-infra', term: 'down-infra [service|appKey]' },
      { name: 'doctor' },
      { name: 'status' },
      { name: 'restart', term: 'restart <service|appKey>' }
    ]
  },
  {
    name: 'Authentication',
    commands: [
      { name: 'login' },
      { name: 'logout' },
      { name: 'auth' }
    ]
  },
  {
    name: 'Applications (Create & Develop)',
    commands: [
      { name: 'create', term: 'create <appKey|systemKey>' },
      { name: 'build', term: 'build <appKey>' },
      { name: 'run', term: 'run <appKey>' },
      { name: 'shell', term: 'shell <appKey>' },
      { name: 'install', term: 'install <appKey>' },
      { name: 'lint', term: 'lint <appKey>' },
      { name: 'logs', term: 'logs <appKey>' },
      { name: 'stop', term: 'stop <appKey>' },
      { name: 'dockerfile', term: 'dockerfile <appKey>' }
    ]
  },
  {
    name: 'Deployment',
    commands: [
      { name: 'push', term: 'push <appKey>' },
      { name: 'deploy', term: 'deploy <appKey|systemKey>' }
    ]
  },
  {
    name: 'Environments',
    commands: [
      { name: 'env' }
    ]
  },
  {
    name: 'Application & Management',
    commands: [
      { name: 'app' },
      { name: 'credential' },
      { name: 'deployment' },
      { name: 'integration-client' }
    ]
  },
  {
    name: 'Configuration & Validation',
    commands: [
      { name: 'resolve', term: 'resolve <appKey|systemKey>' },
      { name: 'json', term: 'json <appKey|systemKey>' },
      { name: 'split-json', term: 'split-json <appKey|systemKey>' },
      { name: 'convert', term: 'convert <appKey|systemKey>' },
      { name: 'show', term: 'show <appKey|systemKey>' },
      { name: 'validate', term: 'validate [appKey|systemKey|file]' },
      { name: 'parameters', term: 'parameters validate' },
      { name: 'diff', term: 'diff <file1> <file2>' }
    ]
  },
  {
    name: 'External Systems',
    commands: [
      { name: 'wizard', term: 'wizard [systemKey]' },
      { name: 'download', term: 'download <systemKey>' },
      { name: 'upload', term: 'upload <systemKey>' },
      { name: 'delete', term: 'delete <systemKey>' },
      { name: 'repair', term: 'repair <systemKey>' },
      { name: 'datasource' },
      { name: 'dimension' },
      { name: 'dimension-value' },
      { name: 'protection' },
      { name: 'test', term: 'test <appKey|systemKey>' },
      { name: 'test-e2e', term: 'test-e2e <appKey|systemKey>' },
      { name: 'test-trust', term: 'test-trust <appKey|systemKey>' },
      { name: 'test-integration', term: 'test-integration <appKey|systemKey>' }
    ]
  },
  {
    name: 'Developer & Secrets',
    commands: [
      { name: 'dev' },
      { name: 'secret' },
      { name: 'secure' }
    ]
  }
];

/**
 * @param {object} helper - Commander Help instance
 * @param {import('commander').Command} program
 * @returns {string[]}
 */
function formatHeader(helper, program) {
  const out = [`Usage: ${helper.commandUsage(program)}`, ''];
  const desc = helper.commandDescription(program);
  if (desc && String(desc).length > 0) {
    out.push(helper.wrap(String(desc), helper.helpWidth || 80, 0), '');
  }
  return out;
}

/**
 * @param {object} helper - Commander Help instance
 * @param {import('commander').Command} program
 * @returns {string[]}
 */
function formatOptions(helper, program) {
  const options = helper.visibleOptions(program);
  if (options.length === 0) return [];
  const optTermWidth = options.reduce((max, o) => Math.max(max, helper.optionTerm(o).length), 0);
  const out = ['Options:'];
  for (const opt of options) {
    out.push(`  ${helper.optionTerm(opt).padEnd(optTermWidth + 2)}${helper.optionDescription(opt)}`);
  }
  out.push('');
  return out;
}

/**
 * @param {object} helper - Commander Help instance
 * @param {import('commander').Command} program
 * @returns {{ categorized: Array<{ name: string, lines: Array<{ term: string, desc: string }> }>, pad: number }}
 */
function buildCategorizedWithPad(helper, program) {
  const nameToCmd = new Map(program.commands.map((c) => [c.name(), c]));
  const categorized = [];
  let maxTermLen = 'help [command]'.length;

  for (const cat of CATEGORIES) {
    const lines = [];
    for (const spec of cat.commands) {
      const cmd = nameToCmd.get(spec.name);
      if (!cmd) continue;
      const term = spec.term || cmd.name();
      maxTermLen = Math.max(maxTermLen, term.length);
      const descText = helper.subcommandDescription(cmd) || cmd.description() || '';
      lines.push({ term, desc: descText });
    }
    if (lines.length > 0) categorized.push({ name: cat.name, lines });
  }
  return { categorized, pad: maxTermLen + 2 };
}

/**
 * @param {object} helper - Commander Help instance
 * @param {import('commander').Command} program
 * @returns {string[]}
 */
function formatCommandCategories(helper, program) {
  const { categorized, pad } = buildCategorizedWithPad(helper, program);
  const out = [];
  for (const { name, lines } of categorized) {
    out.push(name + ':');
    for (const { term, desc: d } of lines) out.push(`  ${term.padEnd(pad)}${d}`);
    out.push('');
  }
  out.push('Help:');
  out.push(`  ${'help [command]'.padEnd(pad)}display help for command`);
  out.push('');
  out.push(`  ${''.padEnd(pad)}Tip: aifabrix <command> --help for flags and examples`);
  out.push('');
  return out;
}

/**
 * Build the full categorized help string for the program.
 *
 * @param {import('commander').Command} program - Commander program
 * @returns {string} Formatted help text
 */
function buildCategorizedHelp(program) {
  const helper = new Help();
  const output = [
    ...formatHeader(helper, program),
    ...formatOptions(helper, program),
    ...formatCommandCategories(helper, program)
  ];
  return output.join('\n');
}

module.exports = { buildCategorizedHelp, CATEGORIES };
