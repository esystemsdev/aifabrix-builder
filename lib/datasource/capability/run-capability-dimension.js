/**
 * File-backed capability dimension (root dimensions binding) with semantic validation, backup, and atomic write.
 *
 * @fileoverview runCapabilityDimension
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const { resolveControllerUrl } = require('../../utils/controller-url');
const { normalizeControllerUrl } = require('../../core/config');
const { getOrRefreshDeviceToken } = require('../../utils/token-manager');
const { listDimensions } = require('../../api/dimensions.api');
const {
  resolveValidateInputPath,
  validateDatasourceParsed
} = require('../validate');
const { applyCapabilityDimension } = require('./dimension-operations');
const { validateDimensionSemantics } = require('./dimension-validate');
const { writeBackup, atomicWriteJson } = require('./run-capability-copy');
const { tryResolveDatasourceKeyToLocalPath, readJsonFile } = require('../../resolvers/datasource-resolver');
const { tryFetchDatasourceConfig } = require('../../resolvers/manifest-resolver');

function resolveSystemKeyForAuth(sourceDoc) {
  return typeof sourceDoc?.systemKey === 'string' ? sourceDoc.systemKey.trim() : '';
}

async function maybeLoadDimensionCatalogKeys() {
  try {
    const controllerUrl = await resolveControllerUrl();
    if (!controllerUrl) {
      return { ok: false, notAuthenticated: true, keys: null, reason: 'controller_url_missing' };
    }
    const normalized = normalizeControllerUrl(controllerUrl);
    const deviceToken = await getOrRefreshDeviceToken(normalized);
    if (!deviceToken || !deviceToken.token) {
      return { ok: false, notAuthenticated: true, keys: null, reason: 'no_token' };
    }
    const authConfig = { type: 'bearer', token: deviceToken.token };
    const res = await listDimensions(deviceToken.controller || normalized, authConfig, {
      page: 1,
      pageSize: 500
    });
    const items = res?.data?.items || res?.data?.data?.items || res?.items || [];
    const keys = new Set(
      Array.isArray(items) ? items.map((d) => String(d?.key || '').trim()).filter(Boolean) : []
    );
    return { ok: true, notAuthenticated: false, keys, reason: undefined };
  } catch (e) {
    const msg = e?.message || String(e);
    const notAuthenticated = /Not authenticated|Authentication required|login/i.test(msg);
    return { ok: false, notAuthenticated, keys: null, reason: msg };
  }
}

function parseViaList(via) {
  const out = [];
  for (const raw of Array.isArray(via) ? via : []) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const idx = s.indexOf(':');
    if (idx <= 0 || idx >= s.length - 1) {
      throw new Error(`--via must be in form <fkName>:<dimensionKey>, got "${s}"`);
    }
    out.push({ fk: s.slice(0, idx).trim(), dimension: s.slice(idx + 1).trim() });
  }
  return out;
}

function collectTargetDatasourceKeysForVia(sourceDoc, via) {
  const fks = Array.isArray(sourceDoc?.foreignKeys) ? sourceDoc.foreignKeys : [];
  const byName = new Map();
  for (const fk of fks) {
    const name = typeof fk?.name === 'string' ? fk.name.trim() : '';
    if (name) byName.set(name, fk);
  }
  const targets = new Set();
  for (const hop of via) {
    const fkRow = byName.get(String(hop?.fk || '').trim());
    const t = typeof fkRow?.targetDatasource === 'string' ? fkRow.targetDatasource.trim() : '';
    if (t) targets.add(t);
  }
  return [...targets];
}

async function loadRemoteTargetsByKey({ sourceDoc, via, systemKeyForAuth }) {
  /** @type {Record<string, any>} */
  const remoteTargetsByKey = {};
  const meta = { attempted: false, ok: false, notAuthenticated: false, fetchedKeys: [] };

  const targetDatasourceKeys = collectTargetDatasourceKeysForVia(sourceDoc, via);
  if (targetDatasourceKeys.length === 0) {
    return { remoteTargetsByKey, remoteFetchMeta: meta };
  }

  _loadTargetsFromDisk(targetDatasourceKeys, remoteTargetsByKey);
  await _maybeFetchTargetsRemote(targetDatasourceKeys, remoteTargetsByKey, systemKeyForAuth, meta);
  return { remoteTargetsByKey, remoteFetchMeta: meta };
}

function _loadTargetsFromDisk(targetDatasourceKeys, remoteTargetsByKey) {
  targetDatasourceKeys.forEach((dsKey) => {
    const local = tryResolveDatasourceKeyToLocalPath(dsKey);
    if (local.ok) {
      remoteTargetsByKey[dsKey] = readJsonFile(local.path);
    }
  });
}

async function _maybeFetchTargetsRemote(targetDatasourceKeys, remoteTargetsByKey, systemKeyForAuth, meta) {
  if (!systemKeyForAuth) return;
  const remaining = targetDatasourceKeys.filter((k) => !remoteTargetsByKey[k]);
  if (remaining.length === 0) {
    meta.ok = true;
    meta.fetchedKeys = targetDatasourceKeys;
    return;
  }
  meta.attempted = true;
  await _fetchRemainingTargets(remaining, remoteTargetsByKey, systemKeyForAuth, meta);
  meta.ok = meta.fetchedKeys.length > 0 && !meta.notAuthenticated;
}

async function _fetchRemainingTargets(remaining, remoteTargetsByKey, systemKeyForAuth, meta) {
  for (const dsKey of remaining) {
    const remote = await tryFetchDatasourceConfig(systemKeyForAuth, dsKey, { silent: true });
    if (remote.ok) {
      remoteTargetsByKey[dsKey] = remote.datasourceConfig;
      meta.fetchedKeys.push(dsKey);
      continue;
    }
    if (remote.code === 'not_authenticated') {
      meta.notAuthenticated = true;
    }
  }
}

function runSemanticValidation({ sourceDoc, opts, remoteTargetsByKey, catalogKeys }) {
  const semantic = validateDimensionSemantics({
    localContext: {
      sourceDoc,
      dimensionKey: opts.dimension,
      type: opts.type,
      field: opts.field,
      via: opts.via
    },
    remoteTargetsByKey,
    catalogDimensionKeys: catalogKeys
  });
  if (!semantic.ok) {
    const err = new Error(semantic.errors.join('\n'));
    err.validationErrors = semantic.errors;
    err.validationWarnings = semantic.warnings;
    throw err;
  }
  return semantic;
}

function normalizeRunOptions(rawOpts) {
  return {
    ...rawOpts,
    fileOrKey: String(rawOpts.fileOrKey || '').trim(),
    dimension: String(rawOpts.dimension || '').trim(),
    type: /** @type {any} */ (String(rawOpts.type || '').trim()),
    field: rawOpts.field !== undefined && rawOpts.field !== null ? String(rawOpts.field).trim() : undefined,
    via: parseViaList(rawOpts.via),
    actor: rawOpts.actor !== undefined && rawOpts.actor !== null ? String(rawOpts.actor).trim() : undefined,
    operator: rawOpts.operator !== undefined && rawOpts.operator !== null ? String(rawOpts.operator).trim() : undefined,
    overwrite: Boolean(rawOpts.overwrite),
    dryRun: Boolean(rawOpts.dryRun),
    noBackup: Boolean(rawOpts.noBackup)
  };
}

function buildSemanticWarnings({ opts, semantic, catalog }) {
  const warnings = [...(Array.isArray(semantic?.warnings) ? semantic.warnings : [])];
  if (opts.type === 'fk' && (!opts.actor || !opts.actor.trim())) {
    warnings.push('dimension type=fk without actor; set --actor for predictable ABAC binding.');
  }
  if (!catalog.ok && catalog.notAuthenticated) {
    warnings.push('Dimension catalog validation skipped (not authenticated).');
  }
  return warnings;
}

function applyBindingAndValidateSchema({ parsed, opts, semanticWarnings, remoteFetchMeta }) {
  const result = applyCapabilityDimension(parsed, {
    dimension: opts.dimension,
    type: opts.type,
    field: opts.field,
    via: opts.via,
    actor: opts.actor,
    operator: opts.operator,
    required: opts.required,
    overwrite: Boolean(opts.overwrite)
  });

  const validation = validateDatasourceParsed(result.doc);
  if (!validation.valid) {
    const err = new Error(validation.errors.join('\n'));
    err.validationErrors = validation.errors;
    err.validationWarnings = semanticWarnings;
    err.remoteValidation = remoteFetchMeta;
    throw err;
  }

  return { result, validation };
}

/**
 * @typedef {object} RunCapabilityDimensionOpts
 * @property {string} fileOrKey
 * @property {string} dimension
 * @property {'local'|'fk'} type
 * @property {string|undefined} [field]
 * @property {string[]|undefined} [via] - raw CLI strings; parsed before validate
 * @property {string|undefined} [actor]
 * @property {string|undefined} [operator]
 * @property {boolean|undefined} [required]
 * @property {boolean} [dryRun=false]
 * @property {boolean} [noBackup=false]
 * @property {boolean} [overwrite=false]
 */

/**
 * @param {RunCapabilityDimensionOpts} rawOpts
 * @returns {Promise<any>}
 */
async function runCapabilityDimension(rawOpts) {
  const opts = normalizeRunOptions(rawOpts);
  const resolvedPath = resolveValidateInputPath(opts.fileOrKey);
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw);

  const systemKeyForAuth = resolveSystemKeyForAuth(parsed);
  const { remoteTargetsByKey, remoteFetchMeta } = await loadRemoteTargetsByKey({
    sourceDoc: parsed,
    via: opts.via,
    systemKeyForAuth
  });

  const catalog = await maybeLoadDimensionCatalogKeys();
  const catalogKeys = catalog.ok ? catalog.keys : null;

  const semantic = runSemanticValidation({
    sourceDoc: parsed,
    opts,
    remoteTargetsByKey,
    catalogKeys
  });
  const semanticWarnings = buildSemanticWarnings({ opts, semantic, catalog });
  const { result, validation } = applyBindingAndValidateSchema({
    parsed,
    opts,
    semanticWarnings,
    remoteFetchMeta
  });

  if (opts.dryRun) {
    return {
      dryRun: true,
      resolvedPath,
      patchOperations: result.patchOperations,
      updatedSections: result.updatedSections,
      backupPath: null,
      validation,
      semanticWarnings,
      remoteValidation: remoteFetchMeta
    };
  }

  const backupPath = writeBackup(resolvedPath, Boolean(opts.noBackup));
  atomicWriteJson(resolvedPath, result.doc);

  return {
    dryRun: false,
    resolvedPath,
    patchOperations: result.patchOperations,
    updatedSections: result.updatedSections,
    backupPath,
    validation,
    semanticWarnings,
    remoteValidation: remoteFetchMeta
  };
}

module.exports = {
  runCapabilityDimension
};

