/**
 * File-backed capability relate (foreignKeys metadata).
 *
 * @fileoverview runCapabilityRelate
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const {
  resolveValidateInputPath,
  validateDatasourceParsed
} = require('../validate');
const { applyCapabilityRelate } = require('./relate-operations');
const { validateRelateSemantics } = require('./relate-validate');
const { writeBackup, atomicWriteJson } = require('./run-capability-copy');
const { tryResolveDatasourceKeyToLocalPath, readJsonFile } = require('../../resolvers/datasource-resolver');
const { tryFetchDatasourceConfig } = require('../../resolvers/manifest-resolver');

function resolveSystemKeyForAuth(sourceDoc) {
  return typeof sourceDoc?.systemKey === 'string' ? sourceDoc.systemKey.trim() : '';
}

function loadTargetDocLocal(targetDatasourceKey) {
  const localTarget = tryResolveDatasourceKeyToLocalPath(targetDatasourceKey);
  return localTarget.ok ? readJsonFile(localTarget.path) : null;
}

async function maybeFetchRemoteTargetConfig({ systemKeyForAuth, targetDatasourceKey }) {
  const remoteFetchMeta = { attempted: false, ok: false, notAuthenticated: false };
  if (!systemKeyForAuth) {
    return { remoteTargetConfig: null, remoteFetchMeta };
  }
  remoteFetchMeta.attempted = true;
  const remote = await tryFetchDatasourceConfig(systemKeyForAuth, targetDatasourceKey, { silent: true });
  if (remote.ok) {
    return {
      remoteTargetConfig: remote.datasourceConfig,
      remoteFetchMeta: { attempted: true, ok: true, notAuthenticated: false }
    };
  }
  if (remote.code === 'not_authenticated') {
    remoteFetchMeta.notAuthenticated = true;
  }
  return { remoteTargetConfig: null, remoteFetchMeta };
}

function runSemanticValidation({ sourceDoc, targetDocLocal, remoteTargetConfig, opts, remoteFetchMeta }) {
  const semantic = validateRelateSemantics({
    localContext: {
      sourceDoc,
      targetDocLocal,
      targetDatasourceKey: opts.targetDatasource,
      fields: opts.fields,
      targetFields: opts.targetFields
    },
    remoteManifest: remoteTargetConfig
  });
  if (!semantic.ok) {
    const err = new Error(semantic.errors.join('\n'));
    err.validationErrors = semantic.errors;
    err.validationWarnings = semantic.warnings;
    err.remoteValidation = remoteFetchMeta;
    throw err;
  }
  return semantic;
}

function buildRelateResultEnvelope({ dryRun, resolvedPath, result, backupPath, validation, semanticWarnings, remoteValidation }) {
  return {
    dryRun,
    resolvedPath,
    patchOperations: result.patchOperations,
    updatedSections: result.updatedSections,
    backupPath,
    validation,
    semanticWarnings,
    remoteValidation
  };
}

function applyRelateAndValidateSchema(parsed, opts, semanticWarnings, remoteValidation) {
  const result = applyCapabilityRelate(parsed, {
    relationName: opts.relationName,
    targetDatasource: opts.targetDatasource,
    fields: opts.fields,
    targetFields: opts.targetFields,
    // Optional enrichment for metadataSchema.properties.<relationName> generation
    targetDoc: opts.targetDoc,
    resolvedTargetFields: opts.resolvedTargetFields,
    required: opts.required,
    description: opts.description,
    overwrite: Boolean(opts.overwrite),
    addMetadataProperty: opts.addMetadataProperty !== false
  });

  const validation = validateDatasourceParsed(result.doc);
  if (!validation.valid) {
    const err = new Error(validation.errors.join('\n'));
    err.validationErrors = validation.errors;
    err.validationWarnings = semanticWarnings;
    err.remoteValidation = remoteValidation;
    throw err;
  }

  return { result, validation };
}

/**
 * @typedef {object} RunCapabilityRelateOpts
 * @property {string} fileOrKey
 * @property {string} relationName
 * @property {string} targetDatasource
 * @property {string[]} fields
 * @property {string[]|undefined} targetFields
 * @property {boolean|undefined} [required]
 * @property {string|undefined} [description]
 * @property {boolean} [dryRun=false]
 * @property {boolean} [noBackup=false]
 * @property {boolean} [overwrite=false]
 * @property {boolean} [addMetadataProperty=true]
 */

/**
 * @param {RunCapabilityRelateOpts} opts
 * @returns {Promise<{
 *   dryRun: boolean,
 *   resolvedPath: string,
 *   patchOperations: object[],
 *   updatedSections: string[],
 *   backupPath: string|null,
 *   validation: object
 * }>}
 */
async function runCapabilityRelate(opts) {
  const resolvedPath = resolveValidateInputPath(opts.fileOrKey.trim());
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw);

  const targetDocLocal = loadTargetDocLocal(opts.targetDatasource);
  const systemKeyForAuth = resolveSystemKeyForAuth(parsed);
  const { remoteTargetConfig, remoteFetchMeta } = await maybeFetchRemoteTargetConfig({
    systemKeyForAuth,
    targetDatasourceKey: opts.targetDatasource
  });
  const semantic = runSemanticValidation({
    sourceDoc: parsed,
    targetDocLocal,
    remoteTargetConfig,
    opts,
    remoteFetchMeta
  });

  // Feed resolved target metadata into metadataSchema relation-property generation.
  opts.targetDoc = semantic?.resolved?.targetDoc || null;
  opts.resolvedTargetFields = semantic?.resolved?.resolvedTargetFields || null;

  const { result, validation } = applyRelateAndValidateSchema(
    parsed,
    opts,
    semantic.warnings,
    remoteFetchMeta
  );

  if (opts.dryRun) {
    return buildRelateResultEnvelope({
      dryRun: true,
      resolvedPath,
      result,
      backupPath: null,
      validation,
      semanticWarnings: semantic.warnings,
      remoteValidation: remoteFetchMeta
    });
  }

  const backupPath = writeBackup(resolvedPath, Boolean(opts.noBackup));
  atomicWriteJson(resolvedPath, result.doc);

  return buildRelateResultEnvelope({
    dryRun: false,
    resolvedPath,
    result,
    backupPath,
    validation,
    semanticWarnings: semantic.warnings,
    remoteValidation: remoteFetchMeta
  });
}

module.exports = {
  runCapabilityRelate
};
