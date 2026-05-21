/**
 * @fileoverview Extract execution ids from DatasourceTestRun debug / async E2E payloads
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { parseCapacityDetailKey } = require('../utils/load-cip-capacity-display-config');

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
 * @param {Object|null|undefined} envelope
 * @returns {Object|null}
 */
function getCapacityStepFromEnvelope(envelope) {
  const asyncDbg = envelope && envelope.debug && envelope.debug.e2eAsyncDebug;
  if (!asyncDbg || !Array.isArray(asyncDbg.stepDebug)) return null;
  return asyncDbg.stepDebug.find(s => s && s.name === 'capacity') || null;
}

/**
 * Operation names from CIP capacity evidence keys (`capacity:<op>#<index>`), without product aliases.
 * @param {*} details
 * @returns {Set<string>}
 */
function collectCipOpsFromCapabilityDetails(details) {
  const ops = new Set();
  if (!Array.isArray(details)) return ops;
  for (const ds of details) {
    if (!ds || !Array.isArray(ds.capabilityDetails)) continue;
    for (const item of ds.capabilityDetails) {
      const parsed = parseCapacityDetailKey(item && item.key);
      if (parsed && parsed.op) ops.add(parsed.op);
    }
  }
  return ops;
}

/**
 * CIP operation names from capacity step (insert, update, list, …).
 * @param {Object|null|undefined} envelope
 * @returns {string[]}
 */
function cipOperationsFromDebugEnvelope(envelope) {
  const capStep = getCapacityStepFromEnvelope(envelope);
  if (!capStep || !capStep.evidence) return [];
  return [...collectCipOpsFromCapabilityDetails(capStep.evidence.datasources)];
}

module.exports = {
  dedupeIds,
  executionIdsFromDebugEnvelope,
  cipOperationsFromDebugEnvelope,
  collectExecutionIdFields
};
