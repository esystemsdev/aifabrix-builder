/**
 * Synchronous fs helpers that use `global.__AIFABRIX_NODE_FS_UNMOCKED__` from
 * `tests/capture-real-fs.js` when present so Jest `jest.mock('fs')` and partial
 * `jest.mock('internal/node-fs')` cannot break config, schema, or builder scans.
 *
 * @fileoverview Real filesystem sync for config, schemas, urls.local registry, url:// resolution
 */
'use strict';

/**
 * @returns {import('node:fs')|null}
 */
function unmockedFsSnapshot() {
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  return g && g.__AIFABRIX_NODE_FS_UNMOCKED__ ? g.__AIFABRIX_NODE_FS_UNMOCKED__ : null;
}

function delegate(name, args) {
  const snap = unmockedFsSnapshot();
  if (snap && typeof snap[name] === 'function') {
    return snap[name](...args);
  }
  const fs = require('node:fs');
  return fs[name](...args);
}

/**
 * @param {string} p
 * @returns {boolean}
 */
function existsSync(p) {
  return delegate('existsSync', [p]);
}

/**
 * Read file via snapshot/delegate only — not the same binding as {@link readFileSync} on `module.exports`.
 * Tests may `jest.spyOn(exports, 'readFileSync')`; this function stays the real implementation for env/PIN paths.
 * @param {string} p
 * @param {string|import('node:fs').ObjectEncodingOptions} [enc]
 * @returns {string|Buffer}
 */
function readFileSyncDirect(p, enc) {
  return delegate('readFileSync', enc !== undefined ? [p, enc] : [p]);
}

/**
 * @param {string} p
 * @param {string|import('node:fs').ObjectEncodingOptions} [enc]
 * @returns {string|Buffer}
 */
function readFileSync(p, enc) {
  return readFileSyncDirect(p, enc);
}

/**
 * @param {string} p
 * @param {string|Buffer} data
 * @param {object|string} [opts]
 * @returns {void}
 */
function writeFileSync(p, data, opts) {
  return delegate('writeFileSync', opts !== undefined ? [p, data, opts] : [p, data]);
}

/**
 * @param {string} p
 * @param {object} [opts]
 * @returns {string|undefined}
 */
function mkdirSync(p, opts) {
  return delegate('mkdirSync', opts !== undefined ? [p, opts] : [p]);
}

/**
 * @param {string} p
 * @returns {import('node:fs').Stats}
 */
function statSync(p) {
  return delegate('statSync', [p]);
}

/**
 * @param {string} p
 * @param {object} [opts]
 * @returns {string[]|import('node:fs').Dirent[]}
 */
function readdirSync(p, opts) {
  return delegate('readdirSync', opts !== undefined ? [p, opts] : [p]);
}

module.exports = {
  existsSync,
  readFileSync,
  readFileSyncDirect,
  writeFileSync,
  mkdirSync,
  statSync,
  readdirSync
};
