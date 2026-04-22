/**
 * Derive PREFIX_HOST, PREFIX_PORT, PREFIX_PUBLIC_PORT from each builder app application.yaml.
 * Merged after infra + legacy static fallbacks so workspace manifests override hardcoded defaults.
 *
 * @fileoverview Plan 126 — app connectivity from YAML when present
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const yaml = require('js-yaml');
const fsRealSync = require('../internal/fs-real-sync');
const { localHostPort } = require('./declarative-url-ports');

/**
 * Maps application.yaml `app.key` to env var prefix (MISO_HOST, DATAPLANE_PORT, …).
 * Generic keys not listed are skipped (no guessed PREFIX).
 */
const APP_KEY_TO_ENV_PREFIX = Object.freeze({
  dataplane: 'DATAPLANE',
  keycloak: 'KEYCLOAK',
  'miso-controller': 'MISO',
  'mori-controller': 'MORI',
  openwebui: 'OPENWEBUI',
  flowise: 'FLOWISE'
});

/**
 * @param {object|null|undefined} doc
 * @returns {number|null}
 */
function manifestPortOrNull(doc) {
  if (!doc || typeof doc !== 'object') {
    return null;
  }
  if (typeof doc.port === 'number' && doc.port > 0) {
    return doc.port;
  }
  if (typeof doc.port === 'string' && /^\d+$/.test(doc.port.trim())) {
    return parseInt(doc.port.trim(), 10);
  }
  return null;
}

/**
 * In-container listen port (same rules as port-resolver; no require to avoid infra↔resolver cycle).
 * @param {object} doc
 * @param {number} manifestPort
 * @returns {number}
 */
function containerListenFromDoc(doc, manifestPort) {
  const cp = doc.build && doc.build.containerPort;
  const useMain =
    cp === undefined ||
    cp === null ||
    (typeof cp === 'string' && cp.trim() === '');
  if (!useMain && typeof cp === 'number' && cp > 0) {
    return cp;
  }
  if (!useMain && typeof cp === 'string' && /^\d+$/.test(cp.trim())) {
    return parseInt(cp.trim(), 10);
  }
  return manifestPort;
}

/**
 * Local workstation ports: manifest-only when published ≠ container (e.g. Keycloak); else port+10 rule.
 * @param {object} doc
 * @returns {{ port: number, publicPort: number }}
 */
function localWorkstationPortsForDoc(doc) {
  const manifest = manifestPortOrNull(doc);
  if (manifest === null) {
    return { port: 0, publicPort: 0 };
  }
  const container = containerListenFromDoc(doc, manifest);
  if (container === manifest) {
    const p = localHostPort(manifest, 0);
    return { port: p, publicPort: p };
  }
  return { port: manifest, publicPort: manifest };
}

/**
 * @param {Record<string, unknown>} overlayDocker
 * @param {Record<string, unknown>} overlayLocal
 * @param {object} doc
 * @param {string} folderName
 */
function mergeDocIntoOverlay(overlayDocker, overlayLocal, doc, folderName) {
  const appKey = (doc.app && doc.app.key) || folderName;
  const prefix = APP_KEY_TO_ENV_PREFIX[appKey];
  if (!prefix) {
    return;
  }
  const manifestPort = manifestPortOrNull(doc);
  if (manifestPort === null || manifestPort <= 0) {
    return;
  }
  const containerPort = containerListenFromDoc(doc, manifestPort);
  const localP = localWorkstationPortsForDoc(doc);
  overlayDocker[`${prefix}_HOST`] = appKey;
  overlayDocker[`${prefix}_PORT`] = containerPort;
  overlayDocker[`${prefix}_PUBLIC_PORT`] = manifestPort;
  overlayLocal[`${prefix}_HOST`] = 'localhost';
  overlayLocal[`${prefix}_PORT`] = localP.port;
  overlayLocal[`${prefix}_PUBLIC_PORT`] = localP.publicPort;
}

/**
 * @param {string} projectRoot
 * @returns {Array<{ doc: object, folderName: string }>}
 */
function listBuilderApplicationDocs(projectRoot) {
  const builderDir = path.join(projectRoot, 'builder');
  if (!fsRealSync.existsSync(builderDir) || !fsRealSync.statSync(builderDir).isDirectory()) {
    return [];
  }
  const out = [];
  for (const ent of fsRealSync.readdirSync(builderDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) {
      continue;
    }
    const cfg = path.join(builderDir, ent.name, 'application.yaml');
    if (!fsRealSync.existsSync(cfg)) {
      continue;
    }
    let doc;
    try {
      doc = yaml.load(fsRealSync.readFileSync(cfg, 'utf8'));
    } catch {
      continue;
    }
    if (doc && typeof doc === 'object') {
      out.push({ doc, folderName: ent.name });
    }
  }
  return out;
}

/**
 * @param {string|null|undefined} projectRoot
 * @returns {{ docker: Record<string, unknown>, local: Record<string, unknown> }}
 */
function buildAppServiceEnvOverlay(projectRoot) {
  const overlayDocker = {};
  const overlayLocal = {};
  if (!projectRoot || !fsRealSync.existsSync(projectRoot)) {
    return { docker: overlayDocker, local: overlayLocal };
  }
  for (const { doc, folderName } of listBuilderApplicationDocs(projectRoot)) {
    mergeDocIntoOverlay(overlayDocker, overlayLocal, doc, folderName);
  }
  return { docker: overlayDocker, local: overlayLocal };
}

module.exports = {
  APP_KEY_TO_ENV_PREFIX,
  buildAppServiceEnvOverlay,
  localWorkstationPortsForDoc,
  manifestPortOrNull
};
