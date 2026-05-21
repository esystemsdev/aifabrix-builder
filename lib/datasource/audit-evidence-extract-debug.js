/**
 * @fileoverview Extract execution ids from DatasourceTestRun debug / async E2E payloads
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {Array<*>} ids
 * @returns {string[]}
 */
function dedupeIds(ids) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of ids) {
    const id = raw !== null && raw !== undefined ? String(raw).trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * @param {*} node
 * @param {string[]} out
 */
function collectExecutionIdFields(node, out) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.executionId === 'string' && node.executionId.trim()) {
    out.push(node.executionId.trim());
  }
  if (Array.isArray(node.jobs)) {
    for (const job of node.jobs) collectExecutionIdFields(job, out);
  }
  if (Array.isArray(node.datasources)) {
    for (const ds of node.datasources) collectExecutionIdFields(ds, out);
  }
  if (node.audit && typeof node.audit === 'object') {
    collectExecutionIdFields(node.audit, out);
  }
  if (node.evidence && typeof node.evidence === 'object') {
    collectExecutionIdFields(node.evidence, out);
  }
}

/**
 * @param {Object|null|undefined} envelope
 * @returns {string[]}
 */
function executionIdsFromDebugEnvelope(envelope) {
  const dbg = envelope && envelope.debug;
  if (!dbg || typeof dbg !== 'object') return [];
  const found = [];
  if (dbg.executionIds) {
    found.push(...(Array.isArray(dbg.executionIds) ? dbg.executionIds : [dbg.executionIds]));
  }
  const asyncDbg = dbg.e2eAsyncDebug;
  if (asyncDbg && Array.isArray(asyncDbg.stepDebug)) {
    for (const step of asyncDbg.stepDebug) {
      if (step && step.evidence) collectExecutionIdFields(step.evidence, found);
    }
  }
  return dedupeIds(found);
}

/**
 * CIP operation names from capacity step (insert, update, list, …).
 * @param {Object|null|undefined} envelope
 * @returns {string[]}
 */
function cipOperationsFromDebugEnvelope(envelope) {
  const dbg = envelope && envelope.debug;
  const asyncDbg = dbg && dbg.e2eAsyncDebug;
  if (!asyncDbg || !Array.isArray(asyncDbg.stepDebug)) return [];
  const capStep = asyncDbg.stepDebug.find(s => s && s.name === 'capacity');
  if (!capStep || !capStep.evidence) return [];
  const ops = new Set();
  const details = capStep.evidence.datasources;
  if (!Array.isArray(details)) return [];
  for (const ds of details) {
    if (!ds || !Array.isArray(ds.capabilityDetails)) continue;
    for (const item of ds.capabilityDetails) {
      const key = item && item.key ? String(item.key) : '';
      const m = key.match(/^capacity:([a-zA-Z]+)/);
      if (m && m[1]) {
        let op = m[1] === 'updateBasic' ? 'updatebasic' : m[1].toLowerCase();
        if (op === 'create') op = 'insert';
        ops.add(op);
      }
    }
  }
  return [...ops];
}

module.exports = {
  dedupeIds,
  executionIdsFromDebugEnvelope,
  cipOperationsFromDebugEnvelope,
  collectExecutionIdFields
};
