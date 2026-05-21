/**
 * @fileoverview Convert all protection manifests in `.protection/` between JSON and YAML.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const { existsSync, unlinkSync } = require('../internal/fs-real-sync');
const { getProtectionRoot } = require('./paths');
const { listProtectionManifestPaths } = require('./resolve');
const { promptConfirm, targetFileName, convertOneFile } = require('../commands/convert');

/**
 * @param {string} root
 * @param {string} format
 * @returns {string[]}
 */
function listFilesNeedingConvert(root, format) {
  const targetExt = format === 'json' ? '.json' : '.yaml';
  return listProtectionManifestPaths(root).filter((p) => {
    return path.extname(p).toLowerCase() !== targetExt;
  });
}

/**
 * @param {string[]} toConvert
 * @param {string} format
 * @param {boolean} force
 * @returns {Promise<void>}
 */
async function confirmProtectionConvert(toConvert, format, force) {
  if (force) {
    return;
  }
  const lines = toConvert.map((p) => `  • ${path.basename(p)} → ${targetFileName(p, format)}`);
  const confirmed = await promptConfirm(
    `Convert all protection manifests to ${format}?\n${lines.join('\n')}\nAre you sure? (y/N) `
  );
  if (!confirmed) {
    throw new Error('Convert cancelled.');
  }
}

/**
 * @param {string} root
 * @param {string[]} toConvert
 * @param {string} format
 * @returns {{ converted: string[], deleted: string[] }}
 */
function convertProtectionFiles(root, toConvert, format) {
  const converted = [];
  const deleted = [];
  for (const sourcePath of toConvert) {
    const targetPath = path.join(root, targetFileName(sourcePath, format));
    convertOneFile(sourcePath, targetPath, format);
    converted.push(targetPath);
    if (path.normalize(sourcePath) !== path.normalize(targetPath)) {
      unlinkSync(sourcePath);
      deleted.push(sourcePath);
    }
  }
  return { converted, deleted };
}

/**
 * @param {string} format - `yaml` | `json`
 * @param {Object} opts
 * @returns {Promise<{ converted: string[], deleted: string[] }>}
 */
async function runConvertProtectionBatch(format, opts = {}) {
  const root = opts.root || getProtectionRoot();
  if (!existsSync(root)) {
    throw new Error(`Protection folder not found: ${root}`);
  }
  const toConvert = listFilesNeedingConvert(root, format);
  if (!toConvert.length) {
    return { converted: [], deleted: [] };
  }
  await confirmProtectionConvert(toConvert, format, opts.force === true);
  return convertProtectionFiles(root, toConvert, format);
}

module.exports = {
  runConvertProtectionBatch,
  listFilesNeedingConvert,
  confirmProtectionConvert,
  convertProtectionFiles
};
