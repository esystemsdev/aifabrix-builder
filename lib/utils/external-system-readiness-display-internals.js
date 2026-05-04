/**
 * Shared chalk helpers for external system readiness CLI blocks.
 *
 * @fileoverview Internals for upload and deploy readiness display
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { failureGlyph, successGlyph } = require('./cli-test-layout-chalk');
const logger = require('./logger');
const { extractIdentitySummary, resolveCredentialTestEndpointDisplay } = require('./external-system-readiness-core');

const SEP = chalk.gray('────────────────────────────────');

/**
 * @param {string} title
 */
function logSectionTitle(title) {
  logger.log('');
  logger.log(chalk.bold(title));
}

function logSeparator() {
  logger.log('');
  logger.log(SEP);
}

/**
 * @param {'ready'|'partial'|'failed'} tier
 * @returns {string}
 */
function tierGlyph(tier) {
  if (tier === 'ready') return successGlyph();
  if (tier === 'failed') return failureGlyph();
  return chalk.yellow('⚠');
}

/**
 * @param {'READY'|'PARTIAL'|'FAILED'} v
 * @returns {string}
 */
function verdictLine(v) {
  const label = chalk.bold('System Readiness: ');
  if (v === 'READY') return label + chalk.green('READY');
  if (v === 'FAILED') return label + chalk.red('FAILED');
  return label + chalk.yellow('PARTIAL');
}

/**
 * @param {Array<{ key: string, tier: string }>} rows
 * @param {{ ready: number, partial: number, failed: number }} counts
 * @param {string} [title]
 */
function logDatasourceTable(rows, counts, title) {
  logSectionTitle(title && String(title).trim() ? String(title).trim() : 'Datasources:');
  for (const r of rows) {
    const statusLabel = r.tier === 'ready' ? 'Ready' : r.tier === 'failed' ? 'Failed' : 'Partial';
    logger.log(
      `${tierGlyph(r.tier)} ${r.key.padEnd(14, ' ')} ${chalk.gray('(' + statusLabel + ')')}`
    );
  }
  logger.log('');
  logger.log(
    chalk.gray('Summary:') +
      ` ${chalk.green('Ready: ' + counts.ready)} · ${chalk.yellow('Partial: ' + counts.partial)} · ${chalk.red('Failed: ' + counts.failed)}`
  );
}

/**
 * @param {Object} system - manifest.system
 */
function logIdentityBlock(system) {
  const { mode, attribution, tokenBroker } = extractIdentitySummary(system || {});
  logSectionTitle('Identity:');
  logger.log(`${chalk.gray('Mode:')} ${mode}`);
  const attrColor = attribution === 'enabled' ? chalk.white : chalk.yellow;
  logger.log(`${chalk.gray('Attribution:')} ${attrColor(attribution)}`);
  logger.log(`${chalk.gray('Token broker:')} ${tokenBroker === 'configured' ? chalk.white(tokenBroker) : chalk.gray(tokenBroker)}`);
}

/**
 * @param {Object} system - manifest.system
 * @param {boolean} probed
 * @param {boolean} [willProbe] - True when caller will run --probe immediately after this block
 */
function logCredentialIntentBlock(system, probed, willProbe = false) {
  const url = resolveCredentialTestEndpointDisplay(system || {});
  logSectionTitle('Credential (intent):');
  if (url) {
    logger.log(chalk.gray('Test endpoint:'));
    logger.log(chalk.cyan(`GET ${url}`));
  } else {
    logger.log(chalk.gray('Test endpoint: (not configured — defaults may apply on server)'));
  }
  if (!probed) {
    if (willProbe) {
      logger.log(chalk.gray('⏳ Connectivity will be tested next (--probe)'));
    } else {
      logger.log(chalk.yellow('⚠ Connectivity not tested (use --probe)'));
    }
  }
}

/**
 * @param {string[]} actions
 * @param {string} [extraLine]
 */
function logNextActions(actions, extraLine) {
  logSectionTitle('Next actions:');
  for (const a of actions) {
    if (a.startsWith('Run:')) {
      logger.log(chalk.cyan('- ') + chalk.white(a));
    } else {
      logger.log(chalk.cyan('- ') + a);
    }
  }
  if (extraLine) {
    logger.log(chalk.cyan('- ') + chalk.white(extraLine));
  }
}

/**
 * @param {Object} sys - ExternalSystemResponse
 */
function logDocsBlock(sys) {
  if (!sys) return;
  const urls = [];
  if (sys.openApiDocsPageUrl) urls.push({ label: 'OpenAPI Docs Page', url: sys.openApiDocsPageUrl });
  if (sys.apiDocumentUrl) urls.push({ label: 'API Docs', url: sys.apiDocumentUrl });
  if (sys.mcpServerUrl) urls.push({ label: 'MCP Server', url: sys.mcpServerUrl });
  if (urls.length === 0) return;
  logSeparator();
  logSectionTitle('Docs:');
  for (const { label, url } of urls) {
    logger.log(`${chalk.gray(label + ':')} ${chalk.cyan(url)}`);
  }
}

module.exports = {
  SEP,
  logSeparator,
  logSectionTitle,
  tierGlyph,
  verdictLine,
  logDatasourceTable,
  logIdentityBlock,
  logCredentialIntentBlock,
  logNextActions,
  logDocsBlock
};
