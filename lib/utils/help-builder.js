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
 * for the help line (e.g. "down [app]"); otherwise the command name is used.
 *
 * @type {Array<{ name: string, commands: Array<{ name: string, term?: string }> }>}
 */
const CATEGORIES = [
  {
    name: 'Infrastructure (Local Development)',
    commands: [
      { name: 'up' },
      { name: 'down', term: 'down [app]' },
      { name: 'doctor' },
      { name: 'status' },
      { name: 'restart', term: 'restart <service>' }
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
      { name: 'create', term: 'create <app>' },
      { name: 'wizard' },
      { name: 'build', term: 'build <app>' },
      { name: 'run', term: 'run <app>' },
      { name: 'dockerfile', term: 'dockerfile <app>' }
    ]
  },
  {
    name: 'Deployment',
    commands: [
      { name: 'push', term: 'push <app>' },
      { name: 'deploy', term: 'deploy <app>' }
    ]
  },
  {
    name: 'Environments',
    commands: [
      { name: 'environment' },
      { name: 'env' }
    ]
  },
  {
    name: 'Application & Datasource Management',
    commands: [
      { name: 'app' },
      { name: 'datasource' }
    ]
  },
  {
    name: 'Configuration & Validation',
    commands: [
      { name: 'resolve', term: 'resolve <app>' },
      { name: 'json', term: 'json <app>' },
      { name: 'split-json', term: 'split-json <app>' },
      { name: 'genkey', term: 'genkey <app>' },
      { name: 'validate', term: 'validate <appOrFile>' },
      { name: 'diff', term: 'diff <file1> <file2>' }
    ]
  },
  {
    name: 'External Systems',
    commands: [
      { name: 'download', term: 'download <system-key>' },
      { name: 'delete', term: 'delete <system-key>' },
      { name: 'test', term: 'test <app>' },
      { name: 'test-integration', term: 'test-integration <app>' }
    ]
  },
  {
    name: 'Developer & Secrets',
    commands: [
      { name: 'dev' },
      { name: 'secrets' },
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
