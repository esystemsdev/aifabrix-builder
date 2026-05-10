/**
 * @fileoverview `aifabrix doctor` action: environment validation + optional infra health.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const {
  sectionTitle,
  formatBulletSection,
  formatDatasourceListRow,
  formatWarningLine,
  metadata
} = require('../utils/cli-test-layout-chalk');
const validator = require('../validation/validator');
const config = require('../core/config');
const infra = require('../infrastructure');
const logger = require('../utils/logger');

/**
 * @param {string} label
 * @param {'ok'|'warning'|'fail'} variant
 * @param {{ ok?: string, warn?: string, fail?: string }} text
 * @returns {string}
 */
function formatDoctorEnvSummaryLine(label, variant, text) {
  const base = chalk.gray(`${label}:`);
  if (variant === 'ok') return `${base} ${chalk.green('✔')} ${chalk.white(text.ok || '')}`;
  if (variant === 'warning') return `${base} ${chalk.yellow('⚠')} ${chalk.white(text.warn || '')}`;
  return `${base} ${chalk.red('✖')} ${chalk.white(text.fail || '')}`;
}

/**
 * @param {string} statusRaw
 * @returns {'ok'|'warn'|'fail'}
 */
function doctorInfraRowAggregate(statusRaw) {
  const s = String(statusRaw).trim().toLowerCase();
  if (s === 'healthy') return 'ok';
  if (s === 'unknown') return 'warn';
  return 'fail';
}

/**
 * @param {Object} result - `validator.checkEnvironment()` payload
 */
function logDoctorEnvironmentSection(result) {
  logger.log('');
  logger.log(sectionTitle('Environment check'));
  logger.log('');
  logger.log(
    formatDoctorEnvSummaryLine(
      'Docker',
      result.docker === 'ok' ? 'ok' : 'fail',
      { ok: 'Running', fail: 'Not available' }
    )
  );
  logger.log(
    formatDoctorEnvSummaryLine(
      'Ports',
      result.ports === 'ok' ? 'ok' : 'warning',
      { ok: 'Available', warn: 'Some ports in use' }
    )
  );
  logger.log(
    formatDoctorEnvSummaryLine(
      'Secrets',
      result.secrets === 'ok' ? 'ok' : 'fail',
      { ok: 'Configured', fail: 'Missing' }
    )
  );
  if (result.recommendations.length > 0) {
    logger.log('');
    logger.log(formatBulletSection('Recommendations:', result.recommendations));
  }
}

/**
 * @param {Object} result - `validator.checkEnvironment()` payload
 */
async function logDoctorInfraHealthSection(result) {
  if (result.docker !== 'ok') {
    logger.log('');
    logger.log(metadata('Infrastructure health skipped (Docker not available).'));
    return;
  }
  try {
    const cfg = await config.getConfig();
    const health = await infra.checkInfraHealth(null, {
      pgadmin: cfg.pgadmin !== false,
      redisCommander: cfg.redisCommander !== false,
      traefik: !!cfg.traefik
    });
    logger.log('');
    logger.log(sectionTitle('Infrastructure health'));
    Object.entries(health).forEach(([service, status]) => {
      const agg = doctorInfraRowAggregate(status);
      logger.log(formatDatasourceListRow(agg, `${service}: ${status}`, null));
    });
  } catch (_err) {
    logger.log('');
    logger.log(formatWarningLine('Infrastructure is not running or health could not be read.'));
  }
}

/**
 * Runs the doctor checks and prints the TTY summary.
 * @returns {Promise<void>}
 */
async function runDoctorCheck() {
  const result = await validator.checkEnvironment();
  logDoctorEnvironmentSection(result);
  await logDoctorInfraHealthSection(result);
  logger.log('');
}

module.exports = { runDoctorCheck };
