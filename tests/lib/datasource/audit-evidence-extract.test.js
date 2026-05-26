/**
 * @fileoverview Tests for audit-evidence-extract
 */

'use strict';

const {
  extractAuditEvidenceContext,
  executionIdsFromEnvelope,
  correlationIdFromEnvelope,
  expectedOperationsFromEnvelope
} = require('../../../lib/datasource/audit-evidence-extract');
const loadCipConfig = require('../../../lib/utils/load-cip-capacity-display-config');
const { clearCipCapacityDisplayConfigCacheForTests } = loadCipConfig;
const fallbackCipConfig = require('../../../lib/schema/cip-capacity-display.fallback.json');

describe('audit-evidence-extract', () => {
  beforeEach(() => {
    delete process.env.AIFABRIX_EXTERNAL_DATASOURCE_SCHEMA;
    clearCipCapacityDisplayConfigCacheForTests();
    jest.spyOn(loadCipConfig, 'getCipCapacityDisplayConfig').mockReturnValue({
      standardOrder: fallbackCipConfig.standardOperationOrder,
      aliases: fallbackCipConfig.displayAliases || { create: 'insert (create)' }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  const sampleEnvelope = {
    datasourceKey: 'test-e2e-hubspot-companies',
    testRunId: 'run-corr-abc',
    audit: { executionIds: ['exec-a', 'exec-b'] },
    debug: { executionIds: ['exec-b', 'exec-c'] },
    capabilities: [
      { key: 'create', status: 'ok' },
      { key: 'list', status: 'skipped' },
      { key: 'get', status: 'ok' }
    ],
    integration: { sync: { status: 'ok' } }
  };

  it('parses sample validation envelope → ids + ops', () => {
    const ctx = extractAuditEvidenceContext(sampleEnvelope);
    expect(ctx.datasourceKey).toBe('test-e2e-hubspot-companies');
    expect(ctx.correlationId).toBe('run-corr-abc');
    expect(ctx.executionIds).toEqual(['exec-a', 'exec-b', 'exec-c']);
    expect(ctx.expectedOperations).toEqual(expect.arrayContaining(['create', 'get', 'list']));
  });

  it('executionIdsFromEnvelope dedupes audit and debug', () => {
    expect(executionIdsFromEnvelope(sampleEnvelope)).toEqual(['exec-a', 'exec-b', 'exec-c']);
  });

  it('correlationIdFromEnvelope prefers testRunId', () => {
    expect(correlationIdFromEnvelope({ testRunId: 't1', runId: 'r1' })).toBe('t1');
    expect(correlationIdFromEnvelope({ runId: 'r1' })).toBe('r1');
  });

  it('correlationIdFromEnvelope uses e2eAsyncDebug.requestId instead of ephemeral runId', () => {
    const uuid = '7e889f51-37da-4348-8287-58d56c295764';
    expect(
      correlationIdFromEnvelope({
        testRunId: null,
        runId: 'run-c41ae48d238e',
        debug: { e2eAsyncDebug: { requestId: uuid } }
      })
    ).toBe(uuid);
    expect(correlationIdFromEnvelope({ runId: 'run-c41ae48d238e' })).toBeNull();
  });

  it('[EDGE] missing audit.executionIds → empty ids', () => {
    const ctx = extractAuditEvidenceContext({ datasourceKey: 'ds-1', testRunId: 't1' });
    expect(ctx.executionIds).toEqual([]);
  });

  it('expectedOperationsFromEnvelope includes schema standard operations only', () => {
    const ops = expectedOperationsFromEnvelope({
      capabilities: [
        { key: 'mapping', status: 'ok' },
        { key: 'create', status: 'ok' },
        { key: 'list', status: 'skipped' }
      ]
    });
    expect(ops).toEqual(['create']);
  });

  it('[EDGE] partial external schema still allows CRUD via fallback merge', () => {
    jest.restoreAllMocks();
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const tmpSchema = path.join(os.tmpdir(), `partial-ext-ds-${Date.now()}.json`);
    fs.writeFileSync(
      tmpSchema,
      JSON.stringify({
        $defs: {
          cipDefinition: {
            properties: {
              operations: { properties: { list: {} } }
            }
          }
        }
      })
    );
    process.env.AIFABRIX_EXTERNAL_DATASOURCE_SCHEMA = tmpSchema;
    clearCipCapacityDisplayConfigCacheForTests();
    try {
      const ops = expectedOperationsFromEnvelope({
        capabilities: [
          { key: 'mapping', status: 'ok' },
          { key: 'create', status: 'ok' },
          { key: 'list', status: 'skipped' }
        ]
      });
      expect(ops).toEqual(['create']);
    } finally {
      delete process.env.AIFABRIX_EXTERNAL_DATASOURCE_SCHEMA;
      clearCipCapacityDisplayConfigCacheForTests();
      fs.unlinkSync(tmpSchema);
    }
  });

  it('cipOperationsFromDebugEnvelope parses capacity keys without product aliases', () => {
    const { cipOperationsFromDebugEnvelope } = require('../../../lib/datasource/audit-evidence-extract-debug');
    const ops = cipOperationsFromDebugEnvelope({
      debug: {
        e2eAsyncDebug: {
          stepDebug: [
            {
              name: 'capacity',
              evidence: {
                datasources: [
                  {
                    capabilityDetails: [
                      { key: 'capacity:create#0', success: true },
                      { key: 'capacity:updateBasic#1', success: true }
                    ]
                  }
                ]
              }
            }
          ]
        }
      }
    });
    expect(ops).toEqual(expect.arrayContaining(['create', 'updatebasic']));
    expect(ops).not.toContain('insert');
  });
});
