/**
 * @fileoverview Tests for audit-evidence-verify matrix (mocked audit API)
 */

'use strict';

jest.mock('../../../lib/api/audit.api');

const auditApi = require('../../../lib/api/audit.api');
const { verifyAuditEvidenceMatrix } = require('../../../lib/datasource/audit-evidence-verify');
const {
  checkRow1ExecutionsByDatasource,
  checkRow2RbacDecisionsList
} = require('../../../lib/datasource/audit-evidence-matrix-rows');

const capturedExecution = {
  id: 'exec-1',
  operation: 'insert',
  rbacAuditStatus: 'captured',
  abacAuditStatus: 'captured',
  rbacDecision: { id: 'rbac-1' },
  abacTrace: { id: 'abac-1' }
};

describe('audit-evidence-matrix-rows', () => {
  it('matrix row 1 pass when captured executions meet minimum', () => {
    const row = checkRow1ExecutionsByDatasource({
      executions: [capturedExecution],
      totalItems: 1,
      minExpected: 1
    });
    expect(row.status).toBe('passed');
  });

  it('matrix row 1 fail when status disabled', () => {
    const row = checkRow1ExecutionsByDatasource({
      executions: [
        {
          ...capturedExecution,
          rbacAuditStatus: 'disabled',
          rbacDecision: null
        }
      ],
      totalItems: 1,
      minExpected: 1
    });
    expect(row.status).toBe('failed');
    expect(row.code).toBe('executionsNotCaptured');
  });

  it('[EDGE] RBAC list empty → row 2 fail with rbacListEmpty', () => {
    const row = checkRow2RbacDecisionsList({ rbacItems: [], totalItems: 0 });
    expect(row.status).toBe('failed');
    expect(row.code).toBe('rbacListEmpty');
  });
});

describe('verifyAuditEvidenceMatrix', () => {
  const baseCtx = {
    dataplaneUrl: 'https://dp.example',
    authConfig: { type: 'bearer', token: 't' },
    datasourceKey: 'test-ds',
    correlationId: 'corr-1',
    executionIds: ['exec-1'],
    expectedOperations: ['insert'],
    maxWaitMs: 100,
    intervalMs: 10
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auditApi.queryExecutions.mockImplementation((_url, _auth, query) => {
      if (query && query.correlationId) {
        const data = [{ ...capturedExecution, id: 'exec-1', operation: 'insert' }];
        return Promise.resolve({ data, meta: { totalItems: data.length } });
      }
      return Promise.resolve({
        data: [capturedExecution],
        meta: { totalItems: 1 }
      });
    });
    auditApi.queryRbacDecisions.mockResolvedValue({
      data: [
        {
          id: 'rbac-1',
          executionId: { id: 'exec-1' },
          reason: 'rbacAuditInternalPath'
        }
      ],
      meta: { totalItems: 1 }
    });
    auditApi.queryAbacTraces.mockResolvedValue({
      data: [
        {
          id: 'abac-1',
          executionId: { id: 'exec-1' },
          decision: 'skipped',
          reason: 'abacModeDisabled'
        }
      ],
      meta: { totalItems: 1 }
    });
    auditApi.getExecutionRbac.mockResolvedValue({ id: 'rbac-1', decision: 'allow' });
    auditApi.getExecutionAbac.mockResolvedValue({ id: 'abac-1', decision: 'skipped' });
    auditApi.getExecutionErrors.mockResolvedValue([]);
    auditApi.getExecutionSteps.mockResolvedValue([{ step: 'cip' }]);
    auditApi.getExecutionTrace.mockResolvedValue({ id: 'trace-1', executionId: 'exec-1' });
  });

  it('passes full matrix with captured fixtures', async() => {
    const result = await verifyAuditEvidenceMatrix(baseCtx);
    expect(result.status).toBe('passed');
    expect(result.matrix.filter(r => r.status === 'passed').length).toBe(result.matrix.length);
  });

  it('row 8 uses executionIds when correlation query returns unrelated ops', async() => {
    auditApi.queryExecutions.mockImplementation((_url, _auth, query) => {
      if (query && query.correlationId && query.operation) {
        const op = String(query.operation);
        if (op === 'insert' || op === 'create') {
          return Promise.resolve({
            data: [{ ...capturedExecution, id: 'exec-1', operation: 'create' }],
            meta: { totalItems: 1 }
          });
        }
        return Promise.resolve({ data: [], meta: { totalItems: 0 } });
      }
      if (query && query.correlationId) {
        return Promise.resolve({
          data: [{ id: 'wrong', operation: 'list' }],
          meta: { totalItems: 1 }
        });
      }
      return Promise.resolve({
        data: [
          { ...capturedExecution, id: 'exec-1', operation: 'create' },
          { ...capturedExecution, id: 'exec-2', operation: 'list' }
        ],
        meta: { totalItems: 2 }
      });
    });
    const result = await verifyAuditEvidenceMatrix({
      ...baseCtx,
      executionIds: ['exec-1'],
      expectedOperations: ['insert']
    });
    const row8 = result.matrix.find(r => r.row === 8);
    expect(row8.status).toBe('passed');
  });

  it('[EDGE] missing audit.executionIds and correlationId fails before API calls', async() => {
    const result = await verifyAuditEvidenceMatrix({
      ...baseCtx,
      executionIds: [],
      correlationId: null
    });
    expect(result.status).toBe('failed');
    expect(result.matrix.some(r => r.code === 'auditIdsMissing')).toBe(true);
    expect(auditApi.queryExecutions).not.toHaveBeenCalled();
  });
});
