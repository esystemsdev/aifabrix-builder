/**
 * @fileoverview Build per-datasource certificate verify rows for show / enrich (small helpers for lint limits).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { unwrapApiData } = require('../utils/external-system-readiness-core');
const { getActiveIntegrationCertificate, verifyIntegrationCertificate } = require('../api/certificates.api');

/**
 * @param {*} id
 * @returns {string|null}
 */
function certificateIdString(id) {
  if (id === undefined || id === null) return null;
  if (typeof id === 'string') return id.trim() || null;
  if (typeof id === 'object' && id !== null && typeof id.id === 'string') return id.id.trim() || null;
  return null;
}

/**
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {string} systemKey
 * @param {string} dk
 * @returns {Promise<Object>}
 */
async function verifyRowForDatasource(dataplaneUrl, authConfig, systemKey, dk) {
  const activeRes = await getActiveIntegrationCertificate(dataplaneUrl, authConfig, systemKey, dk);
  if (!activeRes || activeRes.success === false) {
    return { datasourceKey: dk, error: 'active_unavailable' };
  }
  const art = unwrapApiData(activeRes);
  const cid = certificateIdString(art && art.certificateId);
  if (!cid) {
    return { datasourceKey: dk, error: 'no_certificate_id' };
  }
  const verRes = await verifyIntegrationCertificate(dataplaneUrl, authConfig, {
    certificateId: cid,
    verifyHash: true,
    systemIdOrKey: systemKey,
    datasourceKey: dk
  });
  if (!verRes || verRes.success === false) {
    return { datasourceKey: dk, certificateId: cid, error: 'verify_request_failed' };
  }
  const v = unwrapApiData(verRes);
  return {
    datasourceKey: dk,
    certificateId: cid,
    overallValid: !!(v && v.overallValid),
    validSignature: !!(v && v.validSignature),
    validHash: !!(v && v.validHash),
    reasons: Array.isArray(v && v.reasons) ? v.reasons : []
  };
}

module.exports = { verifyRowForDatasource, certificateIdString };
