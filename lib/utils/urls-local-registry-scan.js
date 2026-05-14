/**
 * Builder-directory scan for {@link module:lib/utils/urls-local-registry} refresh.
 *
 * @fileoverview Collect application config per app key across builder roots (plan 141 P3: scan order
 *   defines precedence; later directories override earlier ones for the same `app.key`).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const fsRealSync = require('../internal/fs-real-sync');
const { resolveApplicationConfigPath } = require('./app-config-resolver');
const { loadConfigFile } = require('./config-format');

/**
 * @param {string} appDir - Absolute path to a builder app folder (directory containing application config)
 * @returns {{ doc: object }|null}
 */
function tryGetApplicationDirConfigForRegistry(appDir) {
  let cfgPath;
  try {
    cfgPath = resolveApplicationConfigPath(appDir);
  } catch {
    return null;
  }
  if (!fsRealSync.existsSync(cfgPath)) {
    return null;
  }
  let doc;
  try {
    doc = loadConfigFile(cfgPath);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== 'object') {
    return null;
  }
  return { doc };
}

/**
 * @param {string} builderDir
 * @param {import('fs').Dirent} ent
 * @param {number} dirIndex
 * @param {Map<string, { folderName: string, doc: object, dirIndex: number }>} best
 */
function maybeUpdateBestFromAppFolder(builderDir, ent, dirIndex, best) {
  const appDir = path.join(builderDir, ent.name);
  const entry = tryGetApplicationDirConfigForRegistry(appDir);
  if (!entry) {
    return;
  }
  const { doc } = entry;
  const appKey = (doc.app && doc.app.key) || ent.name;
  const cur = best.get(appKey);
  if (!cur || dirIndex > cur.dirIndex) {
    best.set(appKey, { folderName: ent.name, doc, dirIndex });
  }
}

/**
 * @param {string} builderDir
 * @param {number} dirIndex
 * @param {Map<string, { folderName: string, doc: object, dirIndex: number }>} best
 */
function mergeBuilderDirScanIntoBestMap(builderDir, dirIndex, best) {
  if (!builderDir || typeof builderDir !== 'string') {
    return;
  }
  if (!fsRealSync.existsSync(builderDir) || !fsRealSync.statSync(builderDir).isDirectory()) {
    return;
  }
  for (const ent of fsRealSync.readdirSync(builderDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) {
      continue;
    }
    maybeUpdateBestFromAppFolder(builderDir, ent, dirIndex, best);
  }
}

/**
 * When the same app exists under multiple builder roots, the **last** directory in `scanDirs`
 * wins (highest `dirIndex`). Matches plan 141 canonical precedence (checkout / cwd after system materialization).
 *
 * @param {string[]} scanDirs - Builder or `packages` directories, low → high priority
 * @returns {Array<{ folderName: string, doc: object }>}
 */
function collectLatestApplicationYamlEntriesPerApp(scanDirs) {
  /** @type {Map<string, { folderName: string, doc: object, dirIndex: number }>} */
  const best = new Map();
  scanDirs.forEach((builderDir, dirIndex) => {
    mergeBuilderDirScanIntoBestMap(builderDir, dirIndex, best);
  });
  return [...best.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => ({ folderName: v.folderName, doc: v.doc }));
}

module.exports = {
  collectLatestApplicationYamlEntriesPerApp
};
