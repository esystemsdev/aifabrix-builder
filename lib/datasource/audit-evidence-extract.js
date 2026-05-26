/**
 * @fileoverview Extract audit evidence inputs from DatasourceTestRun envelope or debug log
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const fsp = require('node:fs').promises;
const { getIntegrationPath } = require('../utils/paths');
const { resolveAppKeyForDatasource } = require('./resolve-app');
const { getLatestLogPath } = require('./log-viewer');
const {
  executionIdsFromDebugEnvelope,
  cipOperationsFromDebugEnvelope,
  dedupeIds: dedupeIdsFromDebug
} = require('./audit-evidence-extract-debug');
const loadCipCapacityDisplayConfig = require('../utils/load-cip-capacity-display-config');

/** @param {Array<*>} ids @returns {string[]} */
function dedupeIds(ids) {
  return dedupeIdsFromDebug(ids);
}

/**
 * @param {Object|null|undefined} envelope
 * @returns {string[]}
 */
function executionIdsFromEnvelope(envelope) {
  const audit = envelope && envelope.audit;
  const merged = [
    ...(audit && audit.executionIds ? audit.executionIds : []),
    ...executionIdsFromDebugEnvelope(envelope)
  ];
  return dedupeIds(merged);
}

/**
 * E2E uses testRunId as CipExecution.correlationId (see external_data_e2e_helpers).
 * @param {Object|null|undefined} envelope
 * @returns {string|null}
 */
function correlationIdFromAsyncDebug(envelope) {
  const dbg = envelope && envelope.debug;
  const asyncDbg = dbg && dbg.e2eAsyncDebug;
  if (!asyncDbg || typeof asyncDbg !== 'object') return null;
  const requestId =
    asyncDbg.requestId !== undefined && asyncDbg.requestId !== null
      ? String(asyncDbg.requestId).trim()
      : '';
  if (requestId) return requestId;
  const nested =
    asyncDbg.testRunId !== undefined && asyncDbg.testRunId !== null
      ? String(asyncDbg.testRunId).trim()
      : '';
  return nested || null;
}

/**
 * Ephemeral envelope runId (run-*) is not stored as CipExecution.correlationId.
 * @param {string} runId
 * @returns {boolean}
 */
function isEphemeralEnvelopeRunId(runId) {
  return /^run-[a-f0-9]{12}$/i.test(runId);
}

function correlationIdFromEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return null;
  const testRunId =
    envelope.testRunId !== undefined && envelope.testRunId !== null
      ? String(envelope.testRunId).trim()
      : '';
  if (testRunId && !isEphemeralEnvelopeRunId(testRunId)) return testRunId;
  const fromDebug = correlationIdFromAsyncDebug(envelope);
  if (fromDebug) return fromDebug;
  const runId =
    envelope.runId !== undefined && envelope.runId !== null ? String(envelope.runId).trim() : '';
  if (runId && !isEphemeralEnvelopeRunId(runId)) return runId;
  return null;
}

/**
 * Expected capacity/sync operations for matrix rows 1 and 8.
 * @param {Object|null|undefined} envelope
 * @returns {string[]}
 */
function expectedOperationsFromEnvelope(envelope) {
  const fromCapacity = cipOperationsFromDebugEnvelope(envelope);
  if (fromCapacity.length) return fromCapacity;
  const { standardOrder } = loadCipCapacityDisplayConfig.getCipCapacityDisplayConfig();
  const allowed = new Set(
    (standardOrder || []).map(op => String(op).trim().toLowerCase()).filter(Boolean)
  );
  const ops = new Set();
  const caps = envelope && Array.isArray(envelope.capabilities) ? envelope.capabilities : [];
  for (const cap of caps) {
    if (!cap || cap.status === 'skipped' || !cap.key) continue;
    const key = String(cap.key).trim().toLowerCase();
    if (allowed.has(key)) ops.add(key);
  }
  const integration = envelope && envelope.integration;
  if (integration && integration.sync && integration.sync.status === 'ok') {
    ops.add('list');
  }
  return [...ops];
}

/**
 * @param {Object|null|undefined} envelope
 * @returns {{ datasourceKey: string, correlationId: string|null, executionIds: string[], expectedOperations: string[] }}
 */
function extractAuditEvidenceContext(envelope, opts = {}) {
  if (!envelope || typeof envelope !== 'object') {
    return {
      datasourceKey: opts.datasourceKey ? String(opts.datasourceKey).trim() : '',
      correlationId: null,
      executionIds: [],
      expectedOperations: []
    };
  }
  const datasourceKey =
    opts.datasourceKey !== undefined && opts.datasourceKey !== null
      ? String(opts.datasourceKey).trim()
      : envelope.datasourceKey !== undefined && envelope.datasourceKey !== null
        ? String(envelope.datasourceKey).trim()
        : '';
  return {
    datasourceKey,
    correlationId: correlationIdFromEnvelope(envelope),
    executionIds: executionIdsFromEnvelope(envelope),
    expectedOperations: expectedOperationsFromEnvelope(envelope)
  };
}

/**
 * @param {Object} logPayload - Saved test-e2e debug log `{ request, response }`
 * @returns {Object|null}
 */
function envelopeFromLogPayload(logPayload) {
  if (!logPayload || typeof logPayload !== 'object') return null;
  if (logPayload.response && typeof logPayload.response === 'object') {
    return logPayload.response;
  }
  return logPayload;
}

/**
 * @async
 * @param {string} datasourceKey
 * @param {Object} options
 * @param {string} [options.app]
 * @param {string} [options.file]
 * @returns {Promise<Object|null>}
 */
async function loadEnvelopeFromLatestE2eLog(datasourceKey, options = {}) {
  if (options.file) {
    const raw = await fsp.readFile(path.resolve(options.file), 'utf8');
    const parsed = JSON.parse(raw);
    return envelopeFromLogPayload(parsed);
  }
  const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
  const logsDir = path.join(getIntegrationPath(appKey), 'logs');
  const logPath = await getLatestLogPath(logsDir, 'test-e2e-');
  if (!logPath) return null;
  const raw = await fsp.readFile(logPath, 'utf8');
  const parsed = JSON.parse(raw);
  return envelopeFromLogPayload(parsed);
}

module.exports = {
  dedupeIds,
  executionIdsFromEnvelope,
  correlationIdFromEnvelope,
  expectedOperationsFromEnvelope,
  extractAuditEvidenceContext,
  envelopeFromLogPayload,
  loadEnvelopeFromLatestE2eLog
};
