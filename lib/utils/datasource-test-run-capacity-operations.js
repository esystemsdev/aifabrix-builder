/**
 * @fileoverview Capacity scenario outcome lines for DatasourceTestRun TTY (shared by header + debug appendix).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const { successGlyph, failureGlyph } = require('./cli-test-layout-chalk');
const {
  getCipCapacityDisplayConfig,
  standardOperationRank,
  parseCapacityDetailKey
} = require('./load-cip-capacity-display-config');

/**
 * @param {string} op
 * @returns {string}
 */
function formatCapacityOperationLabel(op) {
  const { aliases } = getCipCapacityDisplayConfig();
  return (aliases && aliases[op]) || op;
}

/**
 * @param {Object} envelope
 * @returns {object|null}
 */
function findCapacityStep(envelope) {
  const dbg = envelope && envelope.debug;
  const e2e = dbg && dbg.e2eAsyncDebug;
  const stepDebug = e2e && Array.isArray(e2e.stepDebug) ? e2e.stepDebug : [];
  return stepDebug.find(s => s && String(s.name) === 'capacity') || null;
}

/**
 * @param {object[]} rows
 * @param {string} datasourceKey
 * @returns {object[]}
 */
function filterCapacityDatasourceRows(rows, datasourceKey) {
  if (!datasourceKey) return rows;
  const matched = rows.filter(r => r && String(r.key) === datasourceKey);
  return matched.length ? matched : rows;
}

/**
 * @param {object[]} dsRows
 * @returns {Map<string, { ok: boolean, error: string, minIndex: number }>}
 */
function mergeCapacityDetailsByOp(dsRows) {
  /** @type {Map<string, { ok: boolean, error: string, minIndex: number }>} */
  const byOp = new Map();
  for (const ds of dsRows) {
    const details = ds && Array.isArray(ds.capabilityDetails) ? ds.capabilityDetails : [];
    for (const row of details) {
      if (!row || row.key === undefined || row.key === null) continue;
      const parsed = parseCapacityDetailKey(String(row.key));
      if (!parsed) continue;
      const { op, index } = parsed;
      const ok = row.success !== false && !row.error;
      const err = row.error ? String(row.error) : '';
      const prev = byOp.get(op);
      if (!prev) {
        byOp.set(op, { ok, error: ok ? '' : err, minIndex: index });
      } else {
        byOp.set(op, {
          ok: prev.ok && ok,
          error: prev.error || err,
          minIndex: Math.min(prev.minIndex, index)
        });
      }
    }
  }
  return byOp;
}

/**
 * @param {string[]} standardOrder
 * @param {Map<string, { minIndex: number }>} byOp
 * @returns {(a: string, b: string) => number}
 */
function capacityOpComparator(standardOrder, byOp) {
  return (a, b) => {
    const ia = byOp.get(a).minIndex;
    const ib = byOp.get(b).minIndex;
    if (ia !== ib) return ia - ib;
    const ra = standardOperationRank(standardOrder, a);
    const rb = standardOperationRank(standardOrder, b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  };
}

/**
 * @param {string[]} lines
 * @param {Map<string, { ok: boolean, error: string }>} byOp
 * @param {string[]} opsSorted
 */
function appendCapacityOperationsLines(lines, byOp, opsSorted) {
  lines.push('');
  lines.push(chalk.blue.bold('Capacity operations:'));
  for (const op of opsSorted) {
    const row = byOp.get(op);
    const label = formatCapacityOperationLabel(op);
    const sym = row.ok ? successGlyph() : failureGlyph();
    const tail = row.ok ? '' : chalk.red(` — ${row.error || 'failed'}`);
    lines.push(`  ${sym} ${chalk.white(label)}${tail}`);
  }
}

/**
 * List capacity scenario outcomes from the capacity step (order: scenario index `#`, then schema op order).
 * @param {string[]} lines
 * @param {Object} envelope
 */
function pushCapacityOperationsSummaryLines(lines, envelope) {
  const capStep = findCapacityStep(envelope);
  if (!capStep || !capStep.evidence || !Array.isArray(capStep.evidence.datasources)) return;

  const dk =
    envelope && envelope.datasourceKey !== undefined && envelope.datasourceKey !== null
      ? String(envelope.datasourceKey)
      : '';
  const dsRows = filterCapacityDatasourceRows(capStep.evidence.datasources, dk);
  const byOp = mergeCapacityDetailsByOp(dsRows);
  if (!byOp.size) return;

  const { standardOrder } = getCipCapacityDisplayConfig();
  const opsSorted = Array.from(byOp.keys()).sort(capacityOpComparator(standardOrder, byOp));
  appendCapacityOperationsLines(lines, byOp, opsSorted);
}

/**
 * @param {string} capacityKey
 * @returns {string|null}
 */
function parseCapacityScenarioOp(capacityKey) {
  const p = parseCapacityDetailKey(String(capacityKey));
  return p ? p.op : null;
}

module.exports = {
  pushCapacityOperationsSummaryLines,
  formatCapacityOperationLabel,
  parseCapacityScenarioOp,
  parseCapacityDetailKey
};
