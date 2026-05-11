/**
 * Interactive edit of one capability slice in a datasource JSON file.
 *
 * @fileoverview capability edit (inquirer + atomic write)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const {
  resolveValidateInputPath,
  validateDatasourceParsed
} = require('../validate');
const { normalizeCapabilityKey } = require('./capability-key');
const {
  resolveLogicalNameForRemove,
  resolveSingleOpsKey,
  resolveProfileKeyForLogical
} = require('./capability-resolve');
const { writeBackup, atomicWriteJson } = require('./run-capability-copy');

/**
 * @typedef {object} RunCapabilityEditOpts
 * @property {string} fileOrKey
 * @property {string} [capability]
 * @property {'openapi'|'cip'|'profile'} [section]
 * @property {string} [profile]
 * @property {boolean} [noBackup=false]
 */

/**
 * @param {object} doc
 * @returns {string[]}
 */
function collectCapabilityKeys(doc) {
  const s = new Set();
  if (Array.isArray(doc.capabilities)) {
    doc.capabilities.forEach((c) => s.add(String(c)));
  }
  if (doc.openapi?.operations) {
    Object.keys(doc.openapi.operations).forEach((k) => s.add(k));
  }
  if (doc.execution?.cip?.operations) {
    Object.keys(doc.execution.cip.operations).forEach((k) => s.add(k));
  }
  return [...s].sort();
}

/**
 * @param {string[]} keys
 * @param {string} [preset]
 * @returns {Promise<string>}
 */
async function promptCapabilityKey(keys, preset) {
  if (preset && preset.trim()) {
    return normalizeCapabilityKey(preset.trim(), '--capability');
  }
  const { key } = await inquirer.prompt([
    {
      type: 'list',
      name: 'key',
      message: 'Which capability?',
      choices: keys,
      pageSize: 15
    }
  ]);
  return normalizeCapabilityKey(key, 'capability');
}

/**
 * Resolve openapi/cip operations object key (exact or case-insensitive) for editing.
 *
 * @param {object} doc
 * @param {string} logicalKey - Canonical name from capabilities[] when possible
 * @param {'openapi'|'cip'} section
 * @returns {string}
 */
function resolveOpsKeyForEdit(doc, logicalKey, section) {
  const ops =
    section === 'openapi' ? doc.openapi?.operations : doc.execution?.cip?.operations;
  const label = section === 'openapi' ? 'openapi.operations' : 'execution.cip.operations';
  const k = resolveSingleOpsKey(ops, logicalKey, label);
  if (!k) {
    throw new Error(
      `Missing ${label} entry for capability "${logicalKey}" (no exact or case-insensitive key match).`
    );
  }
  return k;
}

/**
 * @param {string} [preset]
 * @returns {Promise<'openapi'|'cip'|'profile'>}
 */
async function promptSection(preset) {
  const allowed = ['openapi', 'cip', 'profile'];
  if (preset && allowed.includes(preset)) {
    return preset;
  }
  const { section } = await inquirer.prompt([
    {
      type: 'list',
      name: 'section',
      message: 'Which slice to edit?',
      choices: [
        { name: 'openapi.operations.<key> (JSON)', value: 'openapi' },
        { name: 'execution.cip.operations.<key> (JSON)', value: 'cip' },
        { name: 'exposed.profiles.<profile> (JSON)', value: 'profile' }
      ]
    }
  ]);
  return section;
}

/**
 * If EDITOR/VISUAL unset, prefer nano when available on PATH (common on minimal Linux images).
 *
 * @returns {void}
 */
function ensureDefaultEditorFallback() {
  if (process.env.VISUAL && String(process.env.VISUAL).trim()) {
    return;
  }
  if (process.env.EDITOR && String(process.env.EDITOR).trim()) {
    return;
  }
  try {
    execSync('command -v nano', { stdio: 'ignore' });
    process.env.EDITOR = 'nano';
  } catch {
    /* fall through to vi / platform default */
  }
}

/**
 * @param {object} doc
 * @param {string} [preset]
 * @param {boolean} [capabilityFromCli=false] - If true and no profile matches the capability, throw (do not list).
 * @param {string} [logicalCapKey]
 * @returns {Promise<string>}
 */
async function promptProfileKey(doc, preset, capabilityFromCli, logicalCapKey) {
  const keys = doc.exposed?.profiles ? Object.keys(doc.exposed.profiles).sort() : [];
  if (keys.length === 0) {
    throw new Error('No exposed.profiles in this datasource');
  }
  if (preset && preset.trim()) {
    const k = preset.trim();
    if (!keys.includes(k)) {
      throw new Error(`exposed.profiles.${k} not found (available: ${keys.join(', ')})`);
    }
    return k;
  }
  if (logicalCapKey) {
    const pk = resolveProfileKeyForLogical(doc, logicalCapKey);
    if (pk !== null && doc.exposed?.profiles?.[pk] !== undefined) {
      return pk;
    }
  }
  if (capabilityFromCli && logicalCapKey) {
    throw new Error(
      `No exposed.profiles row matches capability "${logicalCapKey}" for -c / --capability. ` +
        `Pass --profile <key> or choose from: ${keys.join(', ')}`
    );
  }
  const { pk } = await inquirer.prompt([
    {
      type: 'list',
      name: 'pk',
      message: 'Which exposure profile?',
      choices: keys,
      pageSize: 15
    }
  ]);
  return pk;
}

/**
 * @param {string} initialJson
 * @returns {Promise<string>}
 */
async function promptEditorJson(initialJson) {
  ensureDefaultEditorFallback();
  const { body } = await inquirer.prompt([
    {
      type: 'editor',
      name: 'body',
      message: 'Edit JSON (save and close editor to continue)',
      default: initialJson,
      postfix: '.json'
    }
  ]);
  return body;
}

/**
 * @param {object} doc
 * @param {string} capKey
 * @param {'openapi'|'cip'|'profile'} section
 * @param {string} profileKey
 * @returns {string}
 */
function getEditableJson(doc, logicalCapKey, section, profileKey) {
  if (section === 'openapi') {
    const k = resolveOpsKeyForEdit(doc, logicalCapKey, 'openapi');
    const v = doc.openapi.operations[k];
    return JSON.stringify(v, null, 2);
  }
  if (section === 'cip') {
    const k = resolveOpsKeyForEdit(doc, logicalCapKey, 'cip');
    const v = doc.execution.cip.operations[k];
    return JSON.stringify(v, null, 2);
  }
  const pk =
    profileKey && profileKey.trim()
      ? profileKey.trim()
      : resolveProfileKeyForLogical(doc, logicalCapKey);
  if (!pk || doc.exposed?.profiles?.[pk] === undefined) {
    throw new Error(
      `Missing exposed.profiles.${profileKey || logicalCapKey} (no matching profile key).`
    );
  }
  const v = doc.exposed.profiles[pk];
  return JSON.stringify(v, null, 2);
}

/**
 * @param {string} jsonBody
 * @returns {object}
 */
function parseEditorJsonPayload(jsonBody) {
  try {
    return JSON.parse(jsonBody);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
}

/**
 * @param {object} doc
 * @param {string} capKey
 * @param {object} value
 * @returns {void}
 */
function assignOpenapiOperation(doc, capKey, value) {
  if (!doc.openapi) {
    doc.openapi = {};
  }
  if (!doc.openapi.operations) {
    doc.openapi.operations = {};
  }
  doc.openapi.operations[capKey] = value;
}

/**
 * @param {object} doc
 * @param {string} capKey
 * @param {object} value
 * @returns {void}
 */
function assignCipOperation(doc, capKey, value) {
  if (!doc.execution) {
    doc.execution = {};
  }
  if (!doc.execution.cip) {
    doc.execution.cip = {};
  }
  if (!doc.execution.cip.operations) {
    doc.execution.cip.operations = {};
  }
  doc.execution.cip.operations[capKey] = value;
}

/**
 * @param {object} doc
 * @param {string} profileKey
 * @param {object} value
 * @returns {void}
 */
function assignExposedProfile(doc, profileKey, value) {
  if (!doc.exposed) {
    doc.exposed = {};
  }
  if (!doc.exposed.profiles) {
    doc.exposed.profiles = {};
  }
  doc.exposed.profiles[profileKey] = value;
}

/**
 * @param {object} doc
 * @param {string} capKey
 * @param {'openapi'|'cip'|'profile'} section
 * @param {string} profileKey
 * @param {string} jsonBody
 * @returns {void}
 */
function applyEditedJson(doc, logicalCapKey, section, profileKey, jsonBody) {
  const parsed = parseEditorJsonPayload(jsonBody);
  if (section === 'openapi') {
    const k = resolveOpsKeyForEdit(doc, logicalCapKey, 'openapi');
    assignOpenapiOperation(doc, k, parsed);
    return;
  }
  if (section === 'cip') {
    const k = resolveOpsKeyForEdit(doc, logicalCapKey, 'cip');
    assignCipOperation(doc, k, parsed);
    return;
  }
  const pk =
    profileKey && profileKey.trim()
      ? profileKey.trim()
      : resolveProfileKeyForLogical(doc, logicalCapKey);
  if (!pk) {
    throw new Error(`Cannot resolve exposed.profiles key for "${logicalCapKey}".`);
  }
  assignExposedProfile(doc, pk, parsed);
}

/**
 * @param {object} doc
 * @param {RunCapabilityEditOpts} opts
 * @returns {Promise<{ capKey: string, section: string, profileKey: string }>}
 */
async function resolveEditTargets(doc, opts) {
  const keys = collectCapabilityKeys(doc);
  if (keys.length === 0) {
    throw new Error(
      'No capability keys found (check capabilities[], openapi.operations, execution.cip.operations)'
    );
  }
  const capKeyRaw = await promptCapabilityKey(keys, opts.capability);
  const capKey = resolveLogicalNameForRemove(doc, capKeyRaw);
  const section = await promptSection(opts.section);
  let profileKey = '';
  if (section === 'profile') {
    const capabilityFromCli = Boolean(opts.capability && String(opts.capability).trim());
    profileKey = await promptProfileKey(doc, opts.profile, capabilityFromCli, capKey);
  }
  return { capKey, section, profileKey };
}

/**
 * @param {RunCapabilityEditOpts} opts
 * @returns {Promise<{ resolvedPath: string, backupPath: string|null }>}
 */
async function runCapabilityEdit(opts) {
  if (!process.stdin.isTTY) {
    throw new Error('capability edit requires an interactive terminal (TTY). Use a terminal or SSH with -t.');
  }
  const resolvedPath = resolveValidateInputPath(opts.fileOrKey.trim());
  const doc = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const { capKey, section, profileKey } = await resolveEditTargets(doc, opts);
  const initial = getEditableJson(doc, capKey, section, profileKey);
  const body = await promptEditorJson(initial);
  applyEditedJson(doc, capKey, section, profileKey, body);

  const validation = validateDatasourceParsed(doc);
  if (!validation.valid) {
    const err = new Error(validation.errors.join('\n'));
    err.validationErrors = validation.errors;
    throw err;
  }

  const backupPath = writeBackup(resolvedPath, Boolean(opts.noBackup));
  atomicWriteJson(resolvedPath, doc);

  return { resolvedPath, backupPath };
}

module.exports = {
  runCapabilityEdit,
  collectCapabilityKeys,
  resolveOpsKeyForEdit
};
