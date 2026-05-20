/**
 * @fileoverview Tests for audit-evidence-operation-aliases
 */

'use strict';

const {
  normalizeAuditOperation,
  operationQueryVariants,
  executionsCoverExpectedOperations
} = require('../../../lib/datasource/audit-evidence-operation-aliases');
const { checkRow8CorrelationGroup } = require('../../../lib/datasource/audit-evidence-verify-helpers');

describe('audit-evidence-operation-aliases', () => {
  it('operationQueryVariants includes create alias for insert', () => {
    expect(operationQueryVariants('insert')).toEqual(
      expect.arrayContaining(['insert', 'create'])
    );
  });

  it('normalizeAuditOperation maps create and updateBasic', () => {
    expect(normalizeAuditOperation('create')).toBe('insert');
    expect(normalizeAuditOperation('updateBasic')).toBe('updatebasic');
    expect(normalizeAuditOperation('GET')).toBe('get');
  });

  it('executionsCoverExpectedOperations accepts API create labels', () => {
    const ok = executionsCoverExpectedOperations(
      [{ operation: 'create' }, { operation: 'list' }],
      ['insert', 'list']
    );
    expect(ok).toBe(true);
  });
});

describe('checkRow8CorrelationGroup', () => {
  it('passes when stored operation is create but matrix expects insert', () => {
    const row = checkRow8CorrelationGroup({
      correlationId: 'corr-1',
      executions: [{ id: 'e1', operation: 'create' }],
      expectedOperations: ['insert']
    });
    expect(row.status).toBe('passed');
    expect(row.code).toBe('correlationGroup');
  });
});
