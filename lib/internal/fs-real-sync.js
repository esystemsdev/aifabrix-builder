/**
 * Synchronous `existsSync` / `readFileSync` that ignore Jest's `jest.mock('fs')` on the shared
 * `require('fs')` singleton. Uses `global.__AIFABRIX_NODE_FS_UNMOCKED__` from
 * `tests/capture-real-fs.js` when present; otherwise `node:fs`.
 *
 * @fileoverview Real filesystem sync reads for config + bundled schema paths
 */
'use strict';

/**
 * @returns {import('node:fs')|null}
 */
function unmockedFsSnapshot() {
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  return g && g.__AIFABRIX_NODE_FS_UNMOCKED__ ? g.__AIFABRIX_NODE_FS_UNMOCKED__ : null;
}

/**
 * @param {string} p
 * @returns {boolean}
 */
function existsSync(p) {
  const snap = unmockedFsSnapshot();
  if (snap && typeof snap.existsSync === 'function') {
    return snap.existsSync(p);
  }
  return require('node:fs').existsSync(p);
}

/**
 * @param {string} p
 * @param {string} [enc]
 * @returns {string|Buffer}
 */
function readFileSync(p, enc) {
  const snap = unmockedFsSnapshot();
  if (snap && typeof snap.readFileSync === 'function') {
    return snap.readFileSync(p, enc);
  }
  return require('node:fs').readFileSync(p, enc);
}

module.exports = { existsSync, readFileSync };
