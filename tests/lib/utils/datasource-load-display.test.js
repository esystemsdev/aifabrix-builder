/**
 * @fileoverview Tests for datasource-load-display (plan 144)
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));
jest.mock('../../../lib/utils/manifest-source-emit', () => ({
  emitManifestSourceMetadata: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { displayDatasourceLoadTTY } = require('../../../lib/utils/datasource-load-display');

describe('datasource-load-display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prints failure samples when batches have per-record failures', () => {
    displayDatasourceLoadTTY(
      {
        dryRun: false,
        datasourceKey: 'ds-1',
        recordCount: 2,
        batchSize: 100,
        format: 'json',
        file: '/tmp/data.json',
        syncType: 'incremental',
        batches: [
          {
            index: 1,
            total: 1,
            failed: [{ key: 'rec-042', message: 'validation: metadata.name required' }]
          }
        ],
        totals: { insertedCount: 1, updatedCount: 0, failedCount: 1 },
        context: {
          datasourceKey: 'ds-1',
          systemKey: 'sys',
          appKey: 'sys',
          manifestPath: '/tmp/application.yaml'
        }
      },
      { environment: 'dev', verbose: false }
    );

    const output = logger.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Failures (first 5)');
    expect(output).toContain('rec-042');
    expect(output).toContain('metadata.name required');
  });
});
