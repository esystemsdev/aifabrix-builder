/**
 * Runs in Jest setupFiles (before the framework and test mocks). Captures native node:fs
 * sync method references so later jest.mock('fs') / spyOn cannot replace what production
 * reads via __AIFABRIX_NODE_FS_UNMOCKED__ (bind(fs) would still call the mocked property).
 * @fileoverview
 */
'use strict';

// Plain require — setupFiles run before test mocks; avoid jest.requireActual edge cases.
const fs = require('node:fs');

// Freeze references at setup time — do not use fs.existsSync.bind(fs); tests replace
// fs.existsSync on the module object, and bound wrappers would then invoke mocks.
const realExistsSync = fs.existsSync;
const realReadFileSync = fs.readFileSync;
const realWriteFileSync = fs.writeFileSync;
const realMkdirSync = fs.mkdirSync;
const realReaddirSync = fs.readdirSync;
const realStatSync = fs.statSync;
const realMkdtempSync = fs.mkdtempSync;
const realRmSync = fs.rmSync;

// Sync helpers only: tests spy on fs.promises.* and expect those spies to intercept production code.
global.__AIFABRIX_NODE_FS_UNMOCKED__ = {
  existsSync: (p) => realExistsSync(p),
  readFileSync: (...args) => realReadFileSync(...args),
  writeFileSync: (...args) => realWriteFileSync(...args),
  mkdirSync: (...args) => realMkdirSync(...args),
  readdirSync: (...args) => realReaddirSync(...args),
  statSync: (...args) => realStatSync(...args),
  mkdtempSync: (...args) => realMkdtempSync(...args),
  rmSync: (...args) => realRmSync(...args)
};
