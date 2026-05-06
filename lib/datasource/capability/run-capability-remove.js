/**
 * File-backed capability remove with validation, backup, and atomic write.
 *
 * @fileoverview Run datasource capability remove CLI operation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const {
  resolveValidateInputPath,
  validateDatasourceParsed
} = require('../validate');
const { normalizeCapabilityKey } = require('./capability-key');
const { applyCapabilityRemove } = require('./remove-operations');
const { writeBackup, atomicWriteJson } = require('./run-capability-copy');

/**
 * @param {{ valid: boolean, errors: string[] }} validation
 * @returns {void}
 * @throws {Error} When validation failed
 */
function assertDatasourceValid(validation) {
  if (!validation.valid) {
    const err = new Error(validation.errors.join('\n'));
    err.validationErrors = validation.errors;
    throw err;
  }
}

/**
 * @param {string} resolvedPath
 * @param {string} capability
 * @param {object} result - applyCapabilityRemove result
 * @param {object} validation
 * @param {boolean} dryRun
 * @param {string|null} backupPath
 * @returns {object}
 */
function makeRemoveResult(resolvedPath, capability, result, validation, dryRun, backupPath) {
  return {
    dryRun,
    resolvedPath,
    capability,
    removed: result.removed,
    patchOperations: result.patchOperations,
    updatedSections: result.updatedSections,
    backupPath,
    validation
  };
}

/**
 * @typedef {object} RunCapabilityRemoveOpts
 * @property {string} fileOrKey
 * @property {string} capability
 * @property {boolean} [dryRun=false]
 * @property {boolean} [noBackup=false]
 * @property {boolean} [force=false]
 */

/**
 * Execute capability remove on disk (or dry-run).
 *
 * @param {RunCapabilityRemoveOpts} opts
 * @returns {Promise<object>}
 */
async function runCapabilityRemove(opts) {
  const resolvedPath = resolveValidateInputPath(opts.fileOrKey.trim());
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw);

  const capability = normalizeCapabilityKey(opts.capability, 'Capability (--capability)');

  const result = applyCapabilityRemove(parsed, {
    capability,
    force: Boolean(opts.force)
  });

  /** Skip AJV when already absent with --force: doc is unchanged clone; no disk write; avoids CI/schema flakes. */
  let validation;
  if (opts.force && !result.removed) {
    validation = { valid: true, errors: [], warnings: [], summary: null };
  } else {
    validation = validateDatasourceParsed(result.doc);
    assertDatasourceValid(validation);
  }

  if (opts.dryRun) {
    return makeRemoveResult(resolvedPath, capability, result, validation, true, null);
  }

  if (!result.removed) {
    return makeRemoveResult(resolvedPath, capability, result, validation, false, null);
  }

  const backupPath = writeBackup(resolvedPath, Boolean(opts.noBackup));
  atomicWriteJson(resolvedPath, result.doc);

  return makeRemoveResult(resolvedPath, capability, result, validation, false, backupPath);
}

module.exports = {
  runCapabilityRemove
};
