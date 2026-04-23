/**
 * @fileoverview Load local `certification` and optional dataplane verify for `aifabrix show` (external).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { resolvePrimarySystemFilePath } = require('../certification/sync-system-certification');
const { loadConfigFile } = require('../utils/config-format');
const { generateControllerManifest } = require('../generator/external-controller-manifest');
const { verifyRowForDatasource } = require('./certification-verify-rows');

const MAX_VERIFY_DATASOURCES = 12;

/**
 * @param {string} pem
 * @param {number} maxLen
 * @returns {string}
 */
function truncatePublicKeyPreview(pem, maxLen = 52) {
  if (!pem || typeof pem !== 'string') return '—';
  const s = pem.trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}… (${s.length} chars)`;
}

/**
 * @param {Object|null|undefined} cert
 * @returns {Object|null}
 */
function sanitizeCertificationForJson(cert) {
  if (!cert || typeof cert !== 'object') return null;
  const pk = cert.publicKey;
  return {
    enabled: cert.enabled,
    algorithm: cert.algorithm,
    issuer: cert.issuer,
    version: cert.version,
    publicKeyPreview: truncatePublicKeyPreview(pk, 96)
  };
}

/**
 * @param {string} appKey
 * @returns {Object|null}
 */
function loadLocalCertificationFromSystemFile(appKey) {
  const r = resolvePrimarySystemFilePath(appKey);
  if (!r || !r.systemFilePath) return null;
  try {
    const sys = loadConfigFile(r.systemFilePath);
    const c = sys && sys.certification;
    if (!c || typeof c !== 'object') return null;
    return c;
  } catch {
    return null;
  }
}

/**
 * @param {Object} summary - show summary (mutated)
 * @param {string} appKey
 */
function attachLocalCertification(summary, appKey) {
  if (!summary || !summary.isExternal) return;
  const cert = loadLocalCertificationFromSystemFile(appKey);
  if (cert) summary.localCertification = cert;
}

/**
 * Resolve dataplane URL + datasource keys for verify, or set summary errors.
 * @returns {Promise<{ dataplaneUrl: string, authConfig: Object, systemKey: string, keys: string[] }|null>}
 */
async function resolveCertificationVerifyTargets(summary, appKey, authBundle) {
  if (!authBundle || !authBundle.token || !authBundle.controllerUrl) {
    summary.certificationVerifySkipped = true;
    return null;
  }
  const { resolveEnvironment } = require('../core/config');
  const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
  const authConfig = { type: 'bearer', token: authBundle.token };
  const environment = await resolveEnvironment();
  let dataplaneUrl;
  try {
    dataplaneUrl = await resolveDataplaneUrl(authBundle.controllerUrl, environment, authConfig);
  } catch (e) {
    summary.certificationVerifyError = e.message || 'dataplane_unavailable';
    return null;
  }
  let manifest;
  try {
    manifest = await generateControllerManifest(appKey, { type: 'external' });
  } catch {
    summary.certificationVerifyError = 'manifest_unavailable';
    return null;
  }
  const systemKey = manifest.key || appKey;
  const keys = (manifest.dataSources || []).map((ds) => ds && ds.key).filter(Boolean).slice(0, MAX_VERIFY_DATASOURCES);
  return { dataplaneUrl, authConfig, systemKey, keys };
}

/**
 * Populate **certificationVerifyRows** on summary (mutates).
 *
 * @async
 * @param {Object} summary
 * @param {string} appKey
 * @param {{ token: string, controllerUrl: string }} authBundle
 * @returns {Promise<void>}
 */
async function attachCertificationVerifyFromDataplane(summary, appKey, authBundle) {
  if (!summary || !summary.isExternal) return;
  const ctx = await resolveCertificationVerifyTargets(summary, appKey, authBundle);
  if (!ctx) return;
  const rows = [];
  for (const dk of ctx.keys) {
    rows.push(await verifyRowForDatasource(ctx.dataplaneUrl, ctx.authConfig, ctx.systemKey, dk));
  }
  summary.certificationVerifyRows = rows;
}

module.exports = {
  attachLocalCertification,
  attachCertificationVerifyFromDataplane,
  sanitizeCertificationForJson,
  truncatePublicKeyPreview,
  loadLocalCertificationFromSystemFile
};
