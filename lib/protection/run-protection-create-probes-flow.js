/**
 * @fileoverview Collect probe TTY lines for protection create.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const {
  probeDatasourceForProtectionCreate,
  probeDimensionForProtectionCreate
} = require('./protection-create-probes');

/**
 * @param {Object} dpCtx
 * @param {Object} dimCtx
 * @param {string} dsKey
 * @param {string} dimensionKey
 * @param {boolean} verbose
 * @returns {Promise<{lines: string[], datasource: Object, dimension: Object}>}
 */
async function collectProtectionCreateProbeContext(dpCtx, dimCtx, dsKey, dimensionKey, verbose) {
  const lines = [];
  const dsProbe = await probeDatasourceForProtectionCreate(
    dpCtx.dataplaneUrl,
    dpCtx.authConfig,
    dsKey,
    { verbose }
  );
  lines.push(...dsProbe.lines);
  const dimProbe = await probeDimensionForProtectionCreate(
    dimCtx.controllerUrl,
    dimCtx.authConfig,
    dimensionKey,
    { verbose }
  );
  lines.push(...dimProbe.lines);
  return { lines, datasource: dsProbe.row, dimension: dimProbe.row };
}

module.exports = {
  collectProtectionCreateProbeContext
};
