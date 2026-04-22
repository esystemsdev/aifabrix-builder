/**
 * @fileoverview SHA-256 compare Builder vs Dataplane DatasourceTestRun JSON Schema (plan §8.1).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const crypto = require('crypto');
const { nodeFs } = require('../internal/node-fs');

/**
 * @param {string} filePath - Absolute path to file
 * @returns {string} Lowercase hex SHA-256 of file bytes
 */
function sha256FileSync(filePath) {
  const buf = nodeFs().readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Compare two schema files; throws on mismatch when both exist.
 * @param {string} builderSchemaPath
 * @param {string} dataplaneSchemaPath
 * @returns {{ skipped: boolean, reason?: string, builderSha?: string, dataplaneSha?: string }}
 */
function assertDatasourceTestRunSchemasInSync(builderSchemaPath, dataplaneSchemaPath) {
  if (!nodeFs().existsSync(builderSchemaPath)) {
    throw new Error(`Builder schema not found: ${builderSchemaPath}`);
  }
  if (!nodeFs().existsSync(dataplaneSchemaPath)) {
    return {
      skipped: true,
      reason: `Dataplane schema not found (set AIFABRIX_DATAPLANE_ROOT or checkout sibling repo): ${dataplaneSchemaPath}`
    };
  }
  const builderSha = sha256FileSync(builderSchemaPath);
  let dataplaneSha;
  try {
    dataplaneSha = sha256FileSync(dataplaneSchemaPath);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return {
        skipped: true,
        reason: `Dataplane schema not found (set AIFABRIX_DATAPLANE_ROOT or checkout sibling repo): ${dataplaneSchemaPath}`
      };
    }
    throw err;
  }
  if (builderSha !== dataplaneSha) {
    throw new Error(
      `DatasourceTestRun schema drift: builder ${builderSha} ≠ dataplane ${dataplaneSha}`
    );
  }
  return { skipped: false, builderSha, dataplaneSha };
}

module.exports = {
  sha256FileSync,
  assertDatasourceTestRunSchemasInSync
};
