/**
 * Pure helpers for external system readiness (Tier A publish / Tier B probe).
 * No I/O; safe for unit tests.
 *
 * @fileoverview Readiness classification and manifest-derived identity/credential intent
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Unwraps `{ success, data }` API envelope or returns object if already body.
 * @param {*} res - ApiClient / makeApiCall response
 * @returns {Object|null}
 */
function unwrapApiData(res) {
  if (!res || typeof res !== 'object') return null;
  if (res.success === false) return null;
  if (res.data !== undefined && res.data !== null) return res.data;
  return res;
}

/**
 * True if object looks like dataplane PublicationResult.
 * @param {*} obj - Parsed JSON
 * @returns {boolean}
 */
function isPublicationResultShape(obj) {
  return !!(obj && typeof obj === 'object' && (obj.uploadId || obj.system) && Array.isArray(obj.datasources));
}

/**
 * Returns publication payload from upload API response.
 * @param {*} res - Response from uploadApplicationViaPipeline
 * @returns {Object|null}
 */
function unwrapPublicationResult(res) {
  const d = unwrapApiData(res);
  return isPublicationResultShape(d) ? d : null;
}

/**
 * Tier A: readiness from published datasource row + MCP expectation.
 * Rules: inactive/archived → Failed; MCP expected but missing → Partial; draft → Partial; published/deployed + active → Ready.
 * @param {Object} ds - ExternalDataSourceResponse-like
 * @param {boolean} generateMcpContract - From application config
 * @returns {'ready'|'partial'|'failed'}
 */
function classifyDatasourceTierA(ds, generateMcpContract) {
  const active = ds.isActive !== false;
  const status = String(ds.status || '').toLowerCase();
  if (!active || status === 'archived') {
    return 'failed';
  }
  if (generateMcpContract === true && !ds.mcpContract) {
    return 'partial';
  }
  if (status === 'draft') {
    return 'partial';
  }
  if (status === 'published' || status === 'deployed') {
    return 'ready';
  }
  return 'partial';
}

/**
 * @param {Array<Object>} datasources - Datasource list
 * @param {boolean} generateMcpContract
 * @returns {{ rows: Array<{ key: string, tier: string }>, ready: number, partial: number, failed: number }}
 */
function summarizeDatasourceTiersA(datasources, generateMcpContract) {
  const rows = [];
  let ready = 0;
  let partial = 0;
  let failed = 0;
  for (const ds of datasources || []) {
    const key = ds.key || ds.sourceKey || 'unknown';
    const tier = classifyDatasourceTierA(ds, generateMcpContract);
    rows.push({ key, tier });
    if (tier === 'ready') ready += 1;
    else if (tier === 'partial') partial += 1;
    else failed += 1;
  }
  return { rows, ready, partial, failed };
}

/**
 * Aggregate verdict label for system readiness line.
 * @param {{ ready: number, partial: number, failed: number }} counts
 * @returns {'READY'|'PARTIAL'|'FAILED'}
 */
function aggregateVerdictFromCounts(counts) {
  const { ready, partial, failed } = counts;
  const total = ready + partial + failed;
  if (total === 0) return 'PARTIAL';
  if (failed === total) return 'FAILED';
  if (failed === 0 && partial === 0) return 'READY';
  return 'PARTIAL';
}

/**
 * Tier B: map validation/run per-datasource result.
 * @param {Object} row - ExternalDataSourceTestResponse-like
 * @returns {'ready'|'partial'|'failed'}
 */
function classifyDatasourceTierB(row) {
  if (!row || row.skipped) return 'partial';
  if (row.success === false) return 'failed';
  const vr = row.validationResults || {};
  if (vr.isValid === false) return 'failed';
  const warnings = vr.warnings || row.fieldMappingResults?.warnings;
  const etr = row.endpointTestResults || {};
  if (etr.success === false || etr.endpointReachable === false) return 'failed';
  if ((Array.isArray(warnings) && warnings.length > 0) || etr.warning) return 'partial';
  return 'ready';
}

/**
 * True if body matches dataplane **DatasourceTestRun** (POST /validation/run success shape).
 * @param {*} obj
 * @returns {boolean}
 */
function isDatasourceTestRunEnvelope(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const ver = obj.reportVersion;
  return typeof ver === 'string' && ver.length > 0 && 'datasourceKey' in obj;
}

const CONNECTIVITY_STEP_MARKERS = ['credential', 'endpoint', 'connectivity', 'live'];

/**
 * @param {Array<*>} issues
 * @returns {{ errors: string[], warnings: string[] }}
 */
function partitionDatasourceTestRunIssues(issues) {
  const errors = [];
  const warnings = [];
  for (const i of issues) {
    if (!i || typeof i !== 'object') continue;
    const msg = i.message || i.code || '';
    const sev = String(i.severity || '').toLowerCase();
    if (sev === 'blocking') errors.push(String(msg));
    else warnings.push(String(msg));
  }
  return { errors, warnings };
}

/**
 * @param {Object} step
 * @returns {boolean}
 */
function stepFailureAffectsConnectivity(step) {
  if (!step || typeof step !== 'object' || step.success !== false) return false;
  const n = String(step.name || '').toLowerCase();
  return CONNECTIVITY_STEP_MARKERS.some(m => n.includes(m));
}

/**
 * Endpoint flags from integration + root status (legacy probe row shape).
 * @param {Object} run - DatasourceTestRun
 * @returns {{ endpointSuccess: boolean, endpointReachable: boolean, endpointWarning: boolean, endpointMessage: string|null, rootStatus: string }}
 */
function datasourceTestRunEndpointFlags(run) {
  let endpointSuccess = true;
  let endpointReachable = true;
  let endpointWarning = false;
  let endpointMessage = null;
  const integration = run.integration;
  if (integration && typeof integration === 'object') {
    const ist = String(integration.status || '').toLowerCase();
    if (ist === 'fail') {
      endpointSuccess = false;
      endpointReachable = false;
    }
    if (ist === 'warn') endpointWarning = true;
    if (integration.summary) endpointMessage = String(integration.summary);
    const steps = integration.stepResults;
    if (Array.isArray(steps) && steps.some(stepFailureAffectsConnectivity)) {
      endpointSuccess = false;
      endpointReachable = false;
    }
  }
  const rootStatus = run.status && typeof run.status === 'string' ? run.status.toLowerCase() : '';
  if (rootStatus === 'fail') {
    endpointSuccess = false;
  }
  return { endpointSuccess, endpointReachable, endpointWarning, endpointMessage, rootStatus };
}

/**
 * Map canonical DatasourceTestRun JSON into a legacy probe row for {@link summarizeProbeResults}.
 * @param {Object} run
 * @returns {Object}
 */
function datasourceTestRunToLegacyRow(run) {
  const v = run.validation;
  const vStatus = v && typeof v.status === 'string' ? v.status.toLowerCase() : '';
  const issues = Array.isArray(v?.issues) ? v.issues : [];
  const { errors, warnings } = partitionDatasourceTestRunIssues(issues);
  const isValid = vStatus !== 'fail' && errors.length === 0;
  const ep = datasourceTestRunEndpointFlags(run);
  return {
    sourceKey: run.datasourceKey,
    key: run.datasourceKey,
    success: ep.rootStatus !== 'fail',
    skipped: ep.rootStatus === 'skipped',
    validationResults: { isValid, errors, warnings },
    endpointTestResults: {
      success: ep.endpointSuccess,
      endpointReachable: ep.endpointReachable,
      message: ep.endpointMessage,
      warning: ep.endpointWarning
    }
  };
}

/**
 * Map dataplane **datasourceSummaries** item into legacy probe row shape.
 * @param {Object} summary
 * @returns {Object}
 */
function datasourceSummaryToLegacyRow(summary) {
  const key = summary.datasourceKey || summary.datasource_key || 'unknown';
  const root = String(summary.status || '').toLowerCase();
  const vStat = String(summary.validationStatus || '').toLowerCase();
  const issues = Array.isArray(summary.issues) ? summary.issues : [];
  const { errors, warnings } = partitionDatasourceTestRunIssues(issues);
  if (vStat === 'warn' && warnings.length === 0) {
    warnings.push('validation warnings');
  }
  const isValid = vStat !== 'fail' && errors.length === 0;
  const cert = String(summary.certificateStatus || '').toLowerCase();
  if (cert === 'not_passed' && isValid) {
    warnings.push('certification not passed');
  }
  return {
    sourceKey: key,
    key,
    success: root !== 'fail',
    skipped: root === 'skipped',
    validationResults: { isValid, errors, warnings },
    endpointTestResults: {
      success: true,
      endpointReachable: true,
      message: null,
      warning: false
    }
  };
}

/**
 * Normalize runtime probe body for Tier B display.
 *
 * Mapping note (plan 127: "align examples to API"):
 * - **Upload** uses dataplane pipeline upload and returns **PublicationResult** with:
 *   - `uploadId`, `uploadStatus`, `system`, `datasources[]`, `generateMcpContract`
 * - **Server validation (upload --verbose)** uses pipeline validate and returns:
 *   - `warnings[]` (dry-run; no publish)
 * - **Runtime probe (--probe)** uses validation run and returns either:
 *   - legacy `{ results: ExternalDataSourceTestResponse[] }`, or
 *   - canonical **DatasourceTestRun** envelope (single success shape) which we coerce into a legacy row
 *   - optional **datasourceSummaries** on the envelope for multi-datasource system runs
 *
 * This helper intentionally accepts multiple shapes so the CLI output stays truthful across dataplane versions.
 *
 * @param {*} probeRaw - Unwrapped API data
 * @returns {Object[]}
 */
function coerceProbeRunToResultRows(probeRaw) {
  if (!probeRaw || typeof probeRaw !== 'object') return [];
  if (Array.isArray(probeRaw.results) && probeRaw.results.length > 0) return probeRaw.results;
  const summaries = probeRaw.datasourceSummaries;
  if (Array.isArray(summaries) && summaries.length > 0) {
    return summaries.map(datasourceSummaryToLegacyRow);
  }
  if (isDatasourceTestRunEnvelope(probeRaw)) return [datasourceTestRunToLegacyRow(probeRaw)];
  return [];
}

/**
 * @param {Array<Object>} results - ExternalSystemTestResponse.results
 * @returns {{ rows: Array<{ key: string, tier: string }>, ready: number, partial: number, failed: number, issues: Array<{ key: string, lines: string[] }> }}
 */
function summarizeProbeResults(results) {
  const rows = [];
  const issues = [];
  let ready = 0;
  let partial = 0;
  let failed = 0;
  for (const r of results || []) {
    const key = r.sourceKey || r.key || 'unknown';
    const tier = classifyDatasourceTierB(r);
    rows.push({ key, tier });
    if (tier === 'ready') ready += 1;
    else if (tier === 'partial') partial += 1;
    else failed += 1;
    const lines = [];
    if (r.error) lines.push(r.error);
    const vr = r.validationResults || {};
    if (Array.isArray(vr.errors)) vr.errors.forEach(e => lines.push(String(e)));
    const etr = r.endpointTestResults || {};
    if (etr.message && (tier === 'failed' || tier === 'partial')) lines.push(String(etr.message));
    if (lines.length) issues.push({ key, lines });
  }
  return { rows, ready, partial, failed, issues };
}

/**
 * Identity summary from external system manifest `system` object.
 * @param {Object} system - manifest.system
 * @returns {{ mode: string, attribution: string, tokenBroker: string }}
 */
function extractIdentitySummary(system) {
  const ip = system?.identityPropagation || {};
  const mode = ip.mode || ip.executionMode || 'system';
  const attr = ip.attribution;
  let attribution = 'disabled';
  if (attr && typeof attr === 'object' && attr.enabled === true) attribution = 'enabled';
  else if (attr === true) attribution = 'enabled';
  const tb = ip.tokenBroker;
  let tokenBroker = 'not configured';
  if (tb && typeof tb === 'object' && Object.keys(tb).length > 0) {
    tokenBroker = 'configured';
  }
  return { mode: String(mode), attribution, tokenBroker };
}

/**
 * Resolves GET test URL display from authentication.variables (apikey, oauth2, etc.).
 * @param {Object} system - manifest.system
 * @returns {string|null} Full URL or null
 */
function resolveCredentialTestEndpointDisplay(system) {
  const auth = system?.authentication;
  if (!auth || typeof auth !== 'object') return null;
  const vars = auth.variables || {};
  const baseUrl = typeof vars.baseUrl === 'string' ? vars.baseUrl.replace(/\/$/, '') : '';
  const testPath = vars.testEndpoint;
  if (!testPath) return baseUrl ? `${baseUrl}/health` : null;
  if (/^https?:\/\//i.test(testPath)) return testPath;
  if (!baseUrl) return testPath;
  const path = testPath.startsWith('/') ? testPath : `/${testPath}`;
  return `${baseUrl}${path}`;
}

/**
 * Human-readable reason for dataplane fetch errors (no stack).
 * @param {Error} err - Network or API error
 * @param {string} dataplaneUrl - Base URL for context
 * @returns {string}
 */
function formatDataplaneFetchReason(err, dataplaneUrl) {
  const msg = err && err.message ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('econnrefused') || lower.includes('connection refused')) {
    return `connection refused (${dataplaneUrl})`;
  }
  if (lower.includes('enotfound') || lower.includes('getaddrinfo')) {
    return `host not reachable (${dataplaneUrl})`;
  }
  if (lower.includes('401') || lower.includes('unauthorized')) {
    return 'authentication failed (401)';
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return 'forbidden (403)';
  }
  if (lower.includes('404')) {
    return 'not found (404)';
  }
  return msg.split('\n')[0].slice(0, 200);
}

/**
 * Next-action hints from Tier A summary.
 * @param {string} systemKey
 * @param {{ rows: Array<{ key: string, tier: string }> }} summary
 * @param {boolean} generateMcpContract
 * @returns {string[]}
 */
function buildNextActionsTierA(systemKey, summary, generateMcpContract) {
  const lines = [];
  const failed = summary.rows.filter(r => r.tier === 'failed').map(r => r.key);
  const partial = summary.rows.filter(r => r.tier === 'partial').map(r => r.key);
  if (failed.length > 0) {
    lines.push(`Investigate failed datasource: ${failed.join(', ')}`);
    lines.push(`Run: aifabrix datasource test-e2e ${failed[0]} --app ${systemKey}`);
  } else if (partial.length > 0) {
    lines.push(`Review partial datasource(s): ${partial.join(', ')}`);
    lines.push('Run: aifabrix upload ' + systemKey + ' --probe');
  }
  if (generateMcpContract && partial.length > 0) {
    lines.push('If MCP is missing on a datasource, check generateMcpContract and datasource config.');
  }
  if (lines.length === 0) {
    lines.push('Use --probe for runtime verification against the live API.');
  }
  return lines;
}

module.exports = {
  unwrapApiData,
  unwrapPublicationResult,
  isPublicationResultShape,
  classifyDatasourceTierA,
  summarizeDatasourceTiersA,
  aggregateVerdictFromCounts,
  classifyDatasourceTierB,
  summarizeProbeResults,
  coerceProbeRunToResultRows,
  isDatasourceTestRunEnvelope,
  datasourceTestRunToLegacyRow,
  extractIdentitySummary,
  resolveCredentialTestEndpointDisplay,
  formatDataplaneFetchReason,
  buildNextActionsTierA
};
