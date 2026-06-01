/**
 * @fileoverview Operational readiness metric rollup for verify-operations (422.0).
 * Human-facing labels for ICC/PDS/DTS; extraction from lifecycle reliability envelopes.
 */

'use strict';

/** @type {readonly string[]} */
const METRIC_KEYS = Object.freeze(['icc', 'pds', 'dts']);

/** @type {Readonly<Record<string, string>>} */
const OPERATIONS_METRIC_LABELS = Object.freeze({
  icc: 'Integration contract coverage',
  pds: 'Pipeline determinism',
  dts: 'Data trust'
});

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
function metricScorePercent(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const score = raw.score;
  if (typeof score === 'number' && Number.isFinite(score)) {
    return Math.max(0, Math.min(100, Math.round(score * 100)));
  }
  const pct = raw.percentage;
  if (typeof pct === 'number' && Number.isFinite(pct)) {
    return Math.max(0, Math.min(100, Math.round(pct)));
  }
  return null;
}

/**
 * @param {unknown} envelope
 * @returns {Record<string, number>|null}
 */
function metricsFromEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return null;
  }
  let metrics = envelope.metricsOutput;
  if (!metrics && envelope.validation && typeof envelope.validation === 'object') {
    metrics = envelope.validation.metricsOutput;
  }
  if (!metrics || typeof metrics !== 'object') {
    return null;
  }
  const out = {};
  for (const key of METRIC_KEYS) {
    const pct = metricScorePercent(metrics[key]);
    if (pct !== null) {
      out[key] = pct;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Conservative rollup: min(ICC,PDS,DTS) per leg across validation + integration envelopes.
 * E2E legs without metrics are ignored (runtime gate only).
 * @param {unknown} reliability
 * @returns {Record<string, number>|null}
 */
function rollupReadinessMetrics(reliability) {
  if (!reliability || typeof reliability !== 'object') {
    return null;
  }
  const legs = [reliability.validation, reliability.integration].filter(Boolean);
  const rolled = {};
  for (const key of METRIC_KEYS) {
    const values = legs
      .map(leg => metricsFromEnvelope(leg)?.[key])
      .filter(v => typeof v === 'number');
    if (values.length > 0) {
      rolled[key] = Math.min(...values);
    }
  }
  return Object.keys(rolled).length > 0 ? rolled : null;
}

/**
 * @param {Object|null} lifecycleReport
 * @returns {Record<string, number>|null}
 */
function extractReadinessMetricsFromLifecycleReport(lifecycleReport) {
  const reliability = lifecycleReport?.operations?.details?.reliability;
  return rollupReadinessMetrics(reliability);
}

module.exports = {
  METRIC_KEYS,
  OPERATIONS_METRIC_LABELS,
  metricScorePercent,
  metricsFromEnvelope,
  rollupReadinessMetrics,
  extractReadinessMetricsFromLifecycleReport
};
