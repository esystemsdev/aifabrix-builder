#!/usr/bin/env node
/**
 * CI helper: fail when Builder lib/schema/datasource-test-run.schema.json drifts from Dataplane copy.
 * @fileoverview Schema sync gate (plan §8.1)
 */
/* eslint-disable no-console -- CLI script */

const path = require('path');
const { assertDatasourceTestRunSchemasInSync } = require('../lib/utils/datasource-test-run-schema-sync');

const root = path.join(__dirname, '..');
const builderSchema = path.join(root, 'lib/schema/datasource-test-run.schema.json');
const dpRoot = process.env.AIFABRIX_DATAPLANE_ROOT || path.join(root, '..', 'aifabrix-dataplane');
const dataplaneSchema = path.join(dpRoot, 'app/schemas/json/datasource-test-run.schema.json');

const strict = process.env.AIFABRIX_SCHEMA_SYNC_STRICT === '1';

try {
  const result = assertDatasourceTestRunSchemasInSync(builderSchema, dataplaneSchema);
  if (result.skipped) {
    const msg = result.reason || 'Dataplane schema path missing';
    if (strict) {
      console.error(`Schema sync failed (strict): ${msg}`);
      process.exit(1);
    }
    console.warn(`Schema sync skipped: ${msg}`);
    process.exit(0);
  }
  console.log(`DatasourceTestRun schema OK (sha256 ${result.builderSha})`);
  process.exit(0);
} catch (e) {
  console.error(e.message || String(e));
  process.exit(1);
}
