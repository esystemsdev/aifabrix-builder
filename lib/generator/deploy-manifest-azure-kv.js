/**
 * Map url:// placeholders and Traefik host templates to Azure Key Vault secret names
 * in deployment manifests (Miso Controller / App Service @Microsoft.KeyVault references).
 *
 * @fileoverview Plan 122 — deploy JSON must not ship url:// or ${DEV_USERNAME} for Azure
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { parseUrlToken } = require('../utils/url-declarative-token-parse');

/**
 * @param {string|undefined} surface
 * @param {string} subject
 * @param {boolean} isPublic
 * @returns {string|undefined} Secret name when surface is vdir/host
 */
function secretNameFromSurface(surface, subject, isPublic) {
  if (surface === 'vdir') {
    return `${subject}-vdir-${isPublic ? 'public' : 'internal'}`;
  }
  if (surface === 'host') {
    return `${subject}-host-${isPublic ? 'public' : 'internal'}`;
  }
  return undefined;
}

/**
 * Key Vault secret name for a url:// token (path after url://).
 * Aligns with infrastructure/bicep (e.g. keycloak-server-url, miso-controller-web-server-url).
 *
 * @param {string} ownerAppKey - application.yaml app.key for the manifest being generated
 * @param {string} token - Token after url:// (no scheme)
 * @returns {string}
 */
function urlTokenToKeyVaultSecretName(ownerAppKey, token) {
  const selfKey = String(ownerAppKey || '').trim() || 'app';
  const t = String(token || '').trim();
  if (!t) {
    throw new Error('Empty url:// reference (expected a token after url://)');
  }
  const { targetKey, kind, surface } = parseUrlToken(t);
  const isPublic = kind === 'public';
  const subject = targetKey ? String(targetKey).trim() : selfKey;

  const fromSurface = secretNameFromSurface(surface, subject, isPublic);
  if (fromSurface !== undefined) {
    return fromSurface;
  }
  if (targetKey === 'keycloak' || (!targetKey && selfKey === 'keycloak')) {
    return isPublic ? 'keycloak-server-url' : 'keycloak-internal-server-url';
  }
  if (!targetKey) {
    return isPublic ? `${selfKey}-web-server-url` : `${selfKey}-internal-server-url`;
  }
  return isPublic ? `${subject}-web-server-url` : `${subject}-internal-server-url`;
}

/**
 * Replace Traefik-style host templates with a Key Vault secret name consumed by Azure provisioning.
 *
 * @param {Object} deployment - Deployment manifest (mutated in place)
 * @returns {void}
 */
function rewriteFrontDoorHostForAzureDeploy(deployment) {
  if (!deployment || !deployment.frontDoorRouting || typeof deployment.frontDoorRouting.host !== 'string') {
    return;
  }
  const h = deployment.frontDoorRouting.host;
  if (/\$\{(DEV_USERNAME|REMOTE_HOST)\}/.test(h)) {
    const key = deployment.key || 'app';
    deployment.frontDoorRouting.host = `${key}-frontdoor-routing-host`;
  }
}

module.exports = {
  urlTokenToKeyVaultSecretName,
  rewriteFrontDoorHostForAzureDeploy
};
