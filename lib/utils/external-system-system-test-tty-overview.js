/**
 * @fileoverview Plan §17 blocks: capabilities overview and integration health (split for file-size limits).
 */

'use strict';

/**
 * @param {Object|null|undefined} env
 * @returns {'ok'|'warn'|'fail'}
 */
function integrationRollupStatus(env) {
  const integ = env && env.integration;
  if (!integ || typeof integ !== 'object') return 'ok';
  if (typeof integ.status === 'string') {
    const s = integ.status.toLowerCase();
    if (s === 'fail' || s === 'failed' || s === 'error') return 'fail';
    if (s === 'warn' || s === 'warning') return 'warn';
    if (s === 'ok' || s === 'passed' || s === 'success') return 'ok';
  }
  const steps = Array.isArray(integ.stepResults) ? integ.stepResults : [];
  if (steps.some(s => s && (s.success === false || s.error))) return 'fail';
  return 'ok';
}

function buildCapabilityBlocks(rows, statusGlyph) {
  const blocks = [];
  for (const r of rows) {
    if (r && r.skipped) continue;
    const env = r && r.datasourceTestRun;
    if (!env || !Array.isArray(env.capabilities) || env.capabilities.length === 0) continue;
    const dkey = env.datasourceKey || r.key || 'datasource';
    const caps = [...env.capabilities]
      .filter(c => c && c.key)
      .sort((a, b) => String(a.key).localeCompare(String(b.key)))
      .slice(0, 4);
    const parts = caps.map(c => `${statusGlyph(c.status)} ${c.key}`);
    if (parts.length === 0) continue;
    blocks.push({ dkey: String(dkey), line: parts.join(' ') });
  }
  return blocks;
}

function emitSectionHeader(io, title) {
  const { log, metaGray, sectionTitle, SEP } = io;
  log('');
  log(metaGray(SEP));
  log('');
  log(sectionTitle(title));
  log('');
}

/**
 * @param {Array} rows
 * @param {{ log: Function, chalk: object, metaGray: Function, sectionTitle: Function, statusGlyph: Function, SEP: string }} io
 * @returns {boolean}
 */
function logCapabilitiesOverview(rows, io) {
  const blocks = buildCapabilityBlocks(rows, io.statusGlyph);
  if (blocks.length === 0) return false;
  emitSectionHeader(io, 'Capabilities overview:');
  for (const b of blocks) {
    io.log(io.chalk.white(`${b.dkey}:`));
    io.log(io.chalk.white(`  ${b.line}`));
  }
  return true;
}

function badIntegrationSteps(integ) {
  if (!integ || !Array.isArray(integ.stepResults)) return [];
  return integ.stepResults.filter(s => s && (s.success === false || s.error)).slice(0, 2);
}

function buildIntegrationBlocks(rows) {
  const blocks = [];
  for (const r of rows) {
    if (r && r.skipped) continue;
    const env = r && r.datasourceTestRun;
    if (!env) continue;
    const dkey = env.datasourceKey || r.key || 'datasource';
    const st = integrationRollupStatus(env);
    const integ = env.integration && typeof env.integration === 'object' ? env.integration : null;
    blocks.push({ dkey: String(dkey), st, badSteps: badIntegrationSteps(integ) });
  }
  return blocks;
}

function emitFailedSteps(block, io) {
  if (block.st !== 'fail' && block.st !== 'warn') return;
  const { log, chalk, statusGlyph } = io;
  for (const stp of block.badSteps) {
    const nm = stp.name || stp.step || 'step';
    const hint = stp.error || stp.message || '';
    log(chalk.white(`  ${statusGlyph('fail')} ${nm}${hint ? `: ${hint}` : ''}`));
  }
}

/**
 * @param {Array} rows
 * @param {'integration'|'e2e'} runType
 * @param {{ log: Function, chalk: object, metaGray: Function, sectionTitle: Function, statusGlyph: Function, SEP: string }} io
 * @returns {boolean}
 */
function logIntegrationHealthSection(rows, runType, io) {
  if (runType !== 'integration') return false;
  const blocks = buildIntegrationBlocks(rows);
  if (blocks.length === 0) return false;
  emitSectionHeader(io, 'Integration health:');
  const { log, chalk, statusGlyph } = io;
  for (const b of blocks) {
    log(chalk.white(`${b.dkey}: ${statusGlyph(b.st)} ${b.st}`));
    emitFailedSteps(b, io);
  }
  return true;
}

module.exports = {
  integrationRollupStatus,
  logCapabilitiesOverview,
  logIntegrationHealthSection
};
