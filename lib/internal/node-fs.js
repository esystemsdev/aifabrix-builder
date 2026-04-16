/**
 * @fileoverview Filesystem helpers that ignore jest.spyOn on require('node:fs') for sync reads.
 * Uses jest.requireActual when Jest is active so .bind() captures native implementations even if
 * this module loads after another suite spied fs. watch still delegates to live fs so tests can spy it.
 */

'use strict';

/**
 * Bound native fs from tests/capture-real-fs.js (Jest setupFiles, before mocks).
 * @returns {Record<string, unknown>|null}
 */
function getUnmockedFsSnapshot() {
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  return g && g.__AIFABRIX_NODE_FS_UNMOCKED__ ? g.__AIFABRIX_NODE_FS_UNMOCKED__ : null;
}

function getRealFs() {
  const snap = getUnmockedFsSnapshot();
  if (snap) {
    return snap;
  }
  // When Jest is active, bypass manual module mocks (singleton may still carry spyOn).
  if (typeof jest !== 'undefined' && typeof jest.requireActual === 'function') {
    return jest.requireActual('node:fs');
  }
  return require('node:fs');
}

/**
 * @param {import('node:fs')} fsModule
 * @param {string} name
 * @returns {unknown}
 */
function bindSync(fsModule, name) {
  const fn = fsModule[name];
  return typeof fn === 'function' ? fn.bind(fsModule) : fn;
}

function liveFs() {
  return require('node:fs');
}

/**
 * Resolve real fs on each access so callers still see the filesystem after other
 * suites replace require('fs') with mocks (schema-loader, schema sync helpers).
 * @returns {typeof import('node:fs')}
 */
function freshRealFs() {
  return getRealFs();
}

/**
 * @returns {Record<string, unknown>}
 */
function buildBoundFs() {
  const snap = getUnmockedFsSnapshot();
  const rf = freshRealFs();
  const live = liveFs();
  const promiseHost = live.promises || {};
  const boundPromises = {
    mkdir: bindSync(promiseHost, 'mkdir'),
    writeFile: bindSync(promiseHost, 'writeFile'),
    appendFile: bindSync(promiseHost, 'appendFile'),
    readFile: bindSync(promiseHost, 'readFile')
  };
  if (snap) {
    return {
      existsSync: snap.existsSync,
      readFileSync: snap.readFileSync,
      writeFileSync: snap.writeFileSync,
      mkdirSync: snap.mkdirSync,
      readdirSync: snap.readdirSync,
      statSync: snap.statSync,
      watch: (...args) => live.watch(...args),
      promises: boundPromises
    };
  }
  return {
    existsSync: bindSync(rf, 'existsSync'),
    readFileSync: bindSync(rf, 'readFileSync'),
    writeFileSync: bindSync(rf, 'writeFileSync'),
    mkdirSync: bindSync(rf, 'mkdirSync'),
    readdirSync: bindSync(rf, 'readdirSync'),
    statSync: bindSync(rf, 'statSync'),
    watch: (...args) => live.watch(...args),
    promises: boundPromises
  };
}

/**
 * @returns {ReturnType<typeof buildBoundFs>}
 */
function nodeFs() {
  return buildBoundFs();
}

module.exports = { nodeFs };
