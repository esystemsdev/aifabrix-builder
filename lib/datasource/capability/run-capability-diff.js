/**
 * Compare two datasource files on one capability slice (+ optional profile).
 *
 * @fileoverview capability diff runner
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { resolveValidateInputPath } = require('../validate');
const { normalizeCapabilityKey } = require('./capability-key');
const { extractCapabilitySliceForDiff } = require('./capability-diff-slice');
const {
  compareObjects,
  identifyBreakingChanges,
  formatDiffOutput
} = require('../../core/diff');

/**
 * @typedef {object} RunCapabilityDiffOpts
 * @property {string} fileA
 * @property {string} fileB
 * @property {string} [capability] - Same key both sides
 * @property {string} [capabilityA]
 * @property {string} [capabilityB]
 * @property {string} [profile] - Same profile both sides
 * @property {string} [profileA]
 * @property {string} [profileB]
 */

/**
 * @param {object} comparison - compareObjects result
 * @param {string} label1
 * @param {string} label2
 * @returns {object}
 */
function buildSliceDiffResult(comparison, label1, label2) {
  const breakingChanges = identifyBreakingChanges(comparison);
  return {
    identical: comparison.identical,
    file1: label1,
    file2: label2,
    version1: null,
    version2: null,
    versionChanged: false,
    added: comparison.added,
    removed: comparison.removed,
    changed: comparison.changed,
    breakingChanges,
    summary: {
      totalAdded: comparison.added.length,
      totalRemoved: comparison.removed.length,
      totalChanged: comparison.changed.length,
      totalBreaking: breakingChanges.length
    }
  };
}

/**
 * Resolve capability keys for left/right files.
 *
 * @param {RunCapabilityDiffOpts} opts
 * @returns {{ capA: string, capB: string }}
 */
function resolveCapabilityKeys(opts) {
  const shared = opts.capability ? String(opts.capability).trim() : '';
  let capA = opts.capabilityA ? String(opts.capabilityA).trim() : '';
  let capB = opts.capabilityB ? String(opts.capabilityB).trim() : '';
  if (shared) {
    capA = shared;
    capB = shared;
  }
  if (!capA || !capB) {
    throw new Error(
      'Provide --capability <key> for both sides, or both --capability-a and --capability-b'
    );
  }
  return {
    capA: normalizeCapabilityKey(capA, '--capability-a'),
    capB: normalizeCapabilityKey(capB, '--capability-b')
  };
}

/**
 * @param {RunCapabilityDiffOpts} opts
 * @returns {{ profA: string|undefined, profB: string|undefined }}
 */
function resolveProfileKeys(opts) {
  const shared = opts.profile ? String(opts.profile).trim() : '';
  let profA = opts.profileA ? String(opts.profileA).trim() : '';
  let profB = opts.profileB ? String(opts.profileB).trim() : '';
  if (shared) {
    profA = shared;
    profB = shared;
  }
  const outA = profA || undefined;
  const outB = profB || undefined;
  return { profA: outA, profB: outB };
}

/**
 * Deep-compare capability slices; prints via formatDiffOutput.
 *
 * @param {RunCapabilityDiffOpts} opts
 * @returns {{ identical: boolean, diffResult: object }}
 */
function runCapabilityDiff(opts) {
  const pathA = resolveValidateInputPath(opts.fileA.trim());
  const pathB = resolveValidateInputPath(opts.fileB.trim());
  const docA = JSON.parse(fs.readFileSync(pathA, 'utf8'));
  const docB = JSON.parse(fs.readFileSync(pathB, 'utf8'));

  const { capA, capB } = resolveCapabilityKeys(opts);
  const { profA, profB } = resolveProfileKeys(opts);

  const sliceA = extractCapabilitySliceForDiff(docA, capA, profA);
  const sliceB = extractCapabilitySliceForDiff(docB, capB, profB);

  const comparison = compareObjects(sliceA, sliceB);
  const label1 = `${path.basename(pathA)} → ${capA}${profA ? ` + profile:${profA}` : ''}`;
  const label2 = `${path.basename(pathB)} → ${capB}${profB ? ` + profile:${profB}` : ''}`;
  const diffResult = buildSliceDiffResult(comparison, label1, label2);

  formatDiffOutput(diffResult);

  return { identical: comparison.identical, diffResult };
}

module.exports = {
  runCapabilityDiff,
  resolveCapabilityKeys,
  resolveProfileKeys,
  buildSliceDiffResult
};
