/**
 * Track integration files touched during repair for CLI summary output.
 *
 * @fileoverview Repair changed-file tracking
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');

/**
 * Ensures backup/repair context has changed-file buckets.
 * @param {Object} ctx - Repair backup context
 * @returns {{ changedFiles: string[], wouldChangeFiles: string[] }}
 */
function ensureChangedFileBuckets(ctx) {
  if (!ctx) return { changedFiles: [], wouldChangeFiles: [] };
  if (!Array.isArray(ctx.changedFiles)) ctx.changedFiles = [];
  if (!Array.isArray(ctx.wouldChangeFiles)) ctx.wouldChangeFiles = [];
  return { changedFiles: ctx.changedFiles, wouldChangeFiles: ctx.wouldChangeFiles };
}

/**
 * Records a file path that repair wrote or would write (dry-run).
 * @param {string} filePath - Path to file
 * @param {Object} ctx - Repair context with dryRun, changedFiles, wouldChangeFiles
 */
function trackRepairWrite(filePath, ctx) {
  if (!filePath || !ctx) return;
  const abs = path.resolve(filePath);
  const { changedFiles, wouldChangeFiles } = ensureChangedFileBuckets(ctx);
  const bucket = ctx.dryRun ? wouldChangeFiles : changedFiles;
  if (!bucket.includes(abs)) bucket.push(abs);
}

module.exports = {
  ensureChangedFileBuckets,
  trackRepairWrite
};
