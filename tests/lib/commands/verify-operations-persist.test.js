/**
 * @fileoverview Tests for verify-operations lifecycle persist (plan 150.0).
 */

'use strict';

jest.mock('../../../lib/commands/test-e2e-external', () => ({
  resolveExternalIntegrationContext: jest.fn()
}));
jest.mock('../../../lib/external-system/test-auth', () => ({
  setupIntegrationTestAuth: jest.fn()
}));
jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn().mockResolvedValue({})
}));
jest.mock('../../../lib/api/validation-run.api', () => ({
  postValidationRun: jest.fn()
}));

const { resolveExternalIntegrationContext } = require('../../../lib/commands/test-e2e-external');
const { setupIntegrationTestAuth } = require('../../../lib/external-system/test-auth');
const { postValidationRun } = require('../../../lib/api/validation-run.api');
const {
  persistOperationsForSystem,
  buildUnitTestSummary
} = require('../../../lib/commands/verify-operations-persist');

describe('verify-operations-persist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveExternalIntegrationContext.mockReturnValue({
      systemKey: 'acme-crm',
      keys: ['acme-crm-contacts', 'acme-crm-companies']
    });
    setupIntegrationTestAuth.mockResolvedValue({
      authConfig: { type: 'bearer', token: 't' },
      dataplaneUrl: 'http://localhost:3611'
    });
    postValidationRun.mockResolvedValue({ success: true, data: {} });
  });

  it('buildUnitTestSummary returns counts when unit step passed', () => {
    expect(buildUnitTestSummary({ unit: true })).toEqual({
      passed: 1,
      failed: 0,
      skipped: 0
    });
    expect(buildUnitTestSummary({ unit: false })).toBeUndefined();
  });

  it('posts runType=operations for each datasource', async() => {
    const result = await persistOperationsForSystem(
      'acme-crm',
      { env: 'dev' },
      { unit: true }
    );

    expect(result.persisted).toBe(2);
    expect(postValidationRun).toHaveBeenCalledTimes(2);
    expect(postValidationRun.mock.calls[0][2]).toMatchObject({
      validationScope: 'externalDataSource',
      systemIdOrKey: 'acme-crm',
      datasourceKey: 'acme-crm-contacts',
      runType: 'operations',
      unitTestSummary: { passed: 1, failed: 0, skipped: 0 }
    });
  });

  it('throws when dataplane persist fails', async() => {
    postValidationRun.mockResolvedValueOnce({
      success: false,
      error: { message: 'timeout' }
    });

    await expect(
      persistOperationsForSystem('acme-crm', {}, { unit: true })
    ).rejects.toThrow('acme-crm-contacts: timeout');
  });
});
