/**
 * @fileoverview Map dataplane certificate artifacts into **certification** (external-system.schema.json).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/**
 * @param {unknown} id - certificateId field (string or FK-shaped object)
 * @returns {string}
 */
function certificateIdToString(id) {
  if (id === undefined || id === null) return '';
  if (typeof id === 'string') return id.trim();
  if (typeof id === 'object' && id !== null && typeof id.id === 'string') return String(id.id).trim();
  return String(id).trim();
}

/**
 * @param {string|undefined|null} s
 * @returns {string}
 */
function trimOrEmpty(s) {
  return s !== undefined && s !== null ? String(s).trim() : '';
}

/**
 * Prefer an artifact that includes PEM/JWK **publicKey** material for verify-publish.
 * @param {import('../api/types/certificates.types').CertificateArtifactResponse[]} artifacts
 * @returns {import('../api/types/certificates.types').CertificateArtifactResponse|null}
 */
function pickArtifactForCertificationMerge(artifacts) {
  const list = Array.isArray(artifacts) ? artifacts.filter((a) => a && typeof a === 'object') : [];
  if (list.length === 0) return null;
  const withKey = list.find((a) => a.publicKey && String(a.publicKey).trim());
  return withKey || list[0];
}

/**
 * @param {string} algorithmUpper
 * @param {import('../api/types/certificates.types').CertificateArtifactResponse} art
 * @returns {string}
 */
function hs256DevPublicKeyPlaceholder(algorithmUpper, art) {
  if (algorithmUpper !== 'HS256') return '';
  const cid = certificateIdToString(art.certificateId);
  return `HS256-DEV-NO-PEM:${cid || 'integration-certificate'}`;
}

/**
 * @param {import('../api/types/certificates.types').CertificateArtifactResponse} art
 * @param {Object} ex
 * @returns {string}
 */
function resolvePublicKey(art, ex) {
  const fromArt = trimOrEmpty(art.publicKey);
  if (fromArt) return fromArt;
  const fromExisting = trimOrEmpty(ex.publicKey);
  if (fromExisting) return fromExisting;
  const algorithmUpper = trimOrEmpty(art.algorithm).toUpperCase();
  return hs256DevPublicKeyPlaceholder(algorithmUpper, art);
}

/**
 * @param {import('../api/types/certificates.types').CertificateArtifactResponse} art
 * @param {Object} ex
 * @returns {string}
 */
function resolveIssuer(art, ex) {
  return (
    trimOrEmpty(art.licenseLevelIssuer) ||
    trimOrEmpty(art.issuedBy) ||
    trimOrEmpty(ex.issuer) ||
    'dataplane'
  );
}

/**
 * @param {import('../api/types/certificates.types').CertificateArtifactResponse} art
 * @param {Object} ex
 * @returns {string}
 */
function resolveVersion(art, ex) {
  return (
    trimOrEmpty(art.version) ||
    trimOrEmpty(art.certificateVersion) ||
    trimOrEmpty(ex.version) ||
    certificateIdToString(art.certificateId)
  );
}

const CERTIFICATION_LEVELS = new Set(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']);
const CERTIFICATION_STATUSES = new Set(['passed', 'not_passed', 'pending']);

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeCertificationLevel(raw) {
  const s = trimOrEmpty(raw).toUpperCase();
  return CERTIFICATION_LEVELS.has(s) ? s : '';
}

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeCertificationStatus(raw) {
  const s = trimOrEmpty(raw).toLowerCase();
  return CERTIFICATION_STATUSES.has(s) ? s : '';
}

/**
 * @param {import('../api/types/certificates.types').CertificateArtifactResponse} art
 * @param {Object} ex
 * @returns {string}
 */
function resolveLevel(art, ex) {
  return (
    normalizeCertificationLevel(ex.level) ||
    normalizeCertificationLevel(art.certificationLevel) ||
    ''
  );
}

/**
 * Prefer existing file status when valid; otherwise **passed** for an active dataplane artifact.
 *
 * @param {import('../api/types/certificates.types').CertificateArtifactResponse} art
 * @param {Object} ex
 * @returns {string}
 */
function resolveStatus(_art, ex) {
  const fromEx = normalizeCertificationStatus(ex.status);
  if (fromEx) return fromEx;
  return 'passed';
}

/**
 * Build `certification` object matching **external-system.schema.json** (required: enabled, publicKey, algorithm, issuer, version; optional status, level).
 * Fills gaps from `existingCertification` when the artifact omits publishable fields (common when dataplane redacts `publicKey`).
 * For **HS256** dev certificates with no PEM, uses a non-secret placeholder `publicKey` so the system file stays schema-valid.
 *
 * @param {import('../api/types/certificates.types').CertificateArtifactResponse|null} artifact
 * @param {Object|null|undefined} existingCertification - Current `system.certification`
 * @returns {Object|null} Full certification object, or null if **publicKey** or **version** cannot be satisfied
 */
function buildCertificationFromArtifact(artifact, existingCertification) {
  const ex = existingCertification && typeof existingCertification === 'object' ? existingCertification : {};
  const art = artifact && typeof artifact === 'object' ? artifact : null;
  if (!art) return null;

  const publicKey = resolvePublicKey(art, ex);
  if (!publicKey) return null;

  const issuer = resolveIssuer(art, ex);
  if (!issuer) return null;

  const versionStr = resolveVersion(art, ex);
  if (!versionStr) return null;

  const algorithmUpper = trimOrEmpty(art.algorithm).toUpperCase();
  const algorithm = algorithmUpper === 'HS256' ? 'HS256' : 'RS256';

  const out = {
    enabled: true,
    publicKey,
    algorithm,
    issuer,
    version: versionStr,
    status: resolveStatus(art, ex)
  };
  const level = resolveLevel(art, ex);
  if (level) {
    out.level = level;
  }
  return out;
}

module.exports = {
  buildCertificationFromArtifact,
  pickArtifactForCertificationMerge,
  certificateIdToString
};
