/**
 * @fileoverview Tests for lib/utils/load-cip-capacity-display-config.js
 */

const path = require('path');
const fs = require('fs');

const {
  extractStandardOperationOrderFromSchema,
  parseCapacityDetailKey,
  standardOperationRank,
  clearCipCapacityDisplayConfigCacheForTests
} = require('../../../lib/utils/load-cip-capacity-display-config');

describe('load-cip-capacity-display-config', () => {
  afterEach(() => {
    clearCipCapacityDisplayConfigCacheForTests();
  });

  it('extractStandardOperationOrderFromSchema matches cipDefinition.operations.properties key order', () => {
    const schemaPath = path.join(
      __dirname,
      '../../../../aifabrix-dataplane/app/schemas/json/external-datasource.schema.json'
    );
    if (!fs.existsSync(schemaPath)) {
      // Monorepo sibling optional in CI
      return;
    }
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const keys = extractStandardOperationOrderFromSchema(schema);
    expect(keys).toEqual(['list', 'get', 'create', 'update', 'delete']);
  });

  it('parseCapacityDetailKey reads scenario index', () => {
    expect(parseCapacityDetailKey('capacity:syncFoo#2')).toEqual({ op: 'syncfoo', index: 2 });
    expect(parseCapacityDetailKey('capacity:delete')).toEqual({ op: 'delete', index: 0 });
  });

  it('standardOperationRank orders known ops before custom', () => {
    expect(standardOperationRank(['list', 'get'], 'list')).toBe(0);
    expect(standardOperationRank(['list', 'get'], 'customOp')).toBe(500);
    expect(standardOperationRank(['list', 'get'], 'get')).toBe(1);
  });
});
