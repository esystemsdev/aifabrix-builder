/**
 * Runs in Jest setupFiles (before the framework and test mocks). Binds real node:fs
 * methods so lib/internal/node-fs.js can bypass jest.spyOn on the shared singleton.
 * @fileoverview
 */
'use strict';

const fs = require('node:fs');

// Sync helpers only: tests spy on fs.promises.* and expect those spies to intercept production code.
global.__AIFABRIX_NODE_FS_UNMOCKED__ = {
  existsSync: fs.existsSync.bind(fs),
  readFileSync: fs.readFileSync.bind(fs),
  writeFileSync: fs.writeFileSync.bind(fs),
  mkdirSync: fs.mkdirSync.bind(fs),
  readdirSync: fs.readdirSync.bind(fs),
  statSync: fs.statSync.bind(fs)
};
