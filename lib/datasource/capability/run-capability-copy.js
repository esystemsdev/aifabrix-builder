/**
 * File-backed capability copy with validation, backup, and atomic write.
 *
 * @fileoverview Run datasource capability copy CLI operation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('node:fs');
const path = require('path');
const { writeBackup } = require('../../utils/integration-file-backup');
const {
  resolveValidateInputPath,
  validateDatasourceParsed
} = require('../validate');
const { normalizeCapabilityKey } = require('./capability-key');
const { applyCapabilityCreate } = require('./create-operations');

/**
 * Resolve an existing JSON file path using real disk (`node:fs`). Other suites often
 * `jest.mock('fs')`; `require('fs')` would see the mock and break existsSync/read here.
 * @param {string} identifier - Trimmed path or datasource key
 * @returns {string} Absolute path to file
 */
function resolveCapabilityCopyInputPath(identifier) {
  const trimmed = String(identifier || '').trim();
  if (!trimmed) {
    throw new Error('File path is required and must be a string');
  }
  const candidates = [...new Set([trimmed, path.resolve(trimmed)])];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      try {
        const st = fs.statSync(p);
        if (st && typeof st.isFile === 'function' && st.isFile()) {
          return path.resolve(p);
        }
      } catch {
        return path.resolve(p);
      }
    } catch {
      /* ignore */
    }
  }
  return resolveValidateInputPath(trimmed);
}

/**
 * @param {string} filePath
 * @param {object} obj
 * @returns {void}
 */
function atomicWriteJson(filePath, obj) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  const payload = `${JSON.stringify(obj, null, 2)}\n`;
  fs.writeFileSync(tmp, payload, 'utf8');
  fs.renameSync(tmp, filePath);
}

/**
 * @typedef {object} RunCapabilityCopyOpts
 * @property {string} fileOrKey - Path or datasource key
 * @property {string} from
 * @property {string} as - Target capability key
 * @property {boolean} [dryRun=false]
 * @property {boolean} [overwrite=false]
 * @property {boolean} [noBackup=false]
 * @property {boolean} [basicExposure=false] - Programmatic only: minimal exposed.profiles from metadataSchema (CLI always passes false)
 * @property {boolean} [includeTestPayload=false] - Also clone testPayload.scenarios rows matching the source operation (`--test` on CLI)
 * @property {string} [openApiOperationId] - Create without --from: match openapi.operations[].operationId
 * @property {string} [template] - Create without --from: template name under capability/templates/
 */

/**
 * Execute capability copy on disk (or dry-run).
 *
 * @param {RunCapabilityCopyOpts} opts
 * @returns {Promise<{
 *   dryRun: boolean,
 *   resolvedPath: string,
 *   resolvedAs: string,
 *   patchOperations: object[],
 *   updatedSections: string[],
 *   backupPath: string|null,
 *   validation: object
 * }>}
 */
async function runCapabilityCopy(opts) {
  const resolvedPath = resolveCapabilityCopyInputPath(opts.fileOrKey.trim());
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw);

  const to = normalizeCapabilityKey(opts.as, 'Target (--as)');
  const fromRaw = opts.from !== undefined && opts.from !== null ? String(opts.from).trim() : '';
  const from = fromRaw ? normalizeCapabilityKey(fromRaw, 'Source (--from)') : '';
  const oidRaw =
    opts.openApiOperationId !== undefined && opts.openApiOperationId !== null
      ? String(opts.openApiOperationId).trim()
      : '';
  const tplRaw =
    opts.template !== undefined && opts.template !== null ? String(opts.template).trim() : '';

  const result = applyCapabilityCreate(parsed, {
    from: from || undefined,
    to,
    openApiOperationId: oidRaw || undefined,
    template: tplRaw || undefined,
    overwrite: Boolean(opts.overwrite),
    basicExposure: Boolean(opts.basicExposure),
    includeTestPayload: Boolean(opts.includeTestPayload)
  });

  const validation = validateDatasourceParsed(result.doc);
  if (!validation.valid) {
    const err = new Error(validation.errors.join('\n'));
    err.validationErrors = validation.errors;
    throw err;
  }

  if (opts.dryRun) {
    return {
      dryRun: true,
      resolvedPath,
      resolvedAs: result.resolvedAs,
      patchOperations: result.patchOperations,
      updatedSections: result.updatedSections,
      backupPath: null,
      validation
    };
  }

  const backupPath = writeBackup(resolvedPath, Boolean(opts.noBackup));
  atomicWriteJson(resolvedPath, result.doc);

  return {
    dryRun: false,
    resolvedPath,
    resolvedAs: result.resolvedAs,
    patchOperations: result.patchOperations,
    updatedSections: result.updatedSections,
    backupPath,
    validation
  };
}

module.exports = {
  runCapabilityCopy,
  writeBackup,
  atomicWriteJson
};
