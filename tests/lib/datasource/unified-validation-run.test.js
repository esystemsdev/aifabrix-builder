/**
 * @fileoverview Tests for unified-validation-run.js (--sync publish path).
 */

'use strict';

jest.mock('../../../lib/datasource/resolve-app', () => ({
  resolveAppKeyForDatasource: jest.fn()
}));
jest.mock('../../../lib/external-system/test-auth', () => ({
  setupIntegrationTestAuth: jest.fn()
}));
jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn()
}));
jest.mock('../../../lib/datasource/integration-context', () => ({
  getSystemKeyFromAppKey: jest.fn(),
  findDatasourceFileByKey: jest.fn()
}));
jest.mock('../../../lib/datasource/unified-validation-run-resolve', () => ({
  loadDatasourceForApp: jest.fn()
}));
jest.mock('../../../lib/datasource/unified-validation-run-body', () => ({
  buildUnifiedValidationBody: jest.fn()
}));
jest.mock('../../../lib/datasource/unified-validation-run-post', () => ({
  postValidationRunAndOptionalPoll: jest.fn()
}));
jest.mock('../../../lib/api/pipeline.api', () => ({
  publishDatasourceViaPipeline: jest.fn()
}));
jest.mock('../../../lib/utils/token-manager', () => ({
  requireBearerForDataplanePipeline: jest.fn()
}));
jest.mock('../../../lib/utils/api-error-handler', () => ({
  formatApiError: jest.fn(() => 'formatted-api-error')
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

const { resolveAppKeyForDatasource } = require('../../../lib/datasource/resolve-app');
const { setupIntegrationTestAuth } = require('../../../lib/external-system/test-auth');
const { getConfig } = require('../../../lib/core/config');
const { getSystemKeyFromAppKey } = require('../../../lib/datasource/integration-context');
const { loadDatasourceForApp } = require('../../../lib/datasource/unified-validation-run-resolve');
const { buildUnifiedValidationBody } = require('../../../lib/datasource/unified-validation-run-body');
const { postValidationRunAndOptionalPoll } = require('../../../lib/datasource/unified-validation-run-post');
const { publishDatasourceViaPipeline } = require('../../../lib/api/pipeline.api');
const { requireBearerForDataplanePipeline } = require('../../../lib/utils/token-manager');

const { runUnifiedDatasourceValidation } = require('../../../lib/datasource/unified-validation-run');

describe('unified-validation-run', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveAppKeyForDatasource.mockResolvedValue({ appKey: 'app-one' });
    getSystemKeyFromAppKey.mockResolvedValue('sys-one');
    loadDatasourceForApp.mockReturnValue({ datasource: { key: 'ds-one', systemKey: 'sys-one' } });
    getConfig.mockResolvedValue({});
    setupIntegrationTestAuth.mockResolvedValue({
      authConfig: { token: 't' },
      dataplaneUrl: 'http://dp'
    });
    buildUnifiedValidationBody.mockResolvedValue({ runType: 'test' });
    postValidationRunAndOptionalPoll.mockResolvedValue({
      envelope: { status: 'ok' },
      apiError: null,
      pollTimedOut: false,
      incompleteNoAsync: false
    });
  });

  it('calls publishDatasourceViaPipeline before validation when sync is true', async() => {
    publishDatasourceViaPipeline.mockResolvedValue({ success: true });

    await runUnifiedDatasourceValidation('ds-one', {
      app: 'app-one',
      runType: 'test',
      sync: true
    });

    expect(requireBearerForDataplanePipeline).toHaveBeenCalledWith({ token: 't' });
    expect(publishDatasourceViaPipeline).toHaveBeenCalledTimes(1);
    expect(publishDatasourceViaPipeline).toHaveBeenCalledWith(
      'http://dp',
      'sys-one',
      { token: 't' },
      { key: 'ds-one', systemKey: 'sys-one' }
    );
    expect(postValidationRunAndOptionalPoll).toHaveBeenCalled();
  });

  it('forwards verbosePoll when verbose is true', async() => {
    await runUnifiedDatasourceValidation('ds-one', { app: 'app-one', runType: 'test', verbose: true });
    expect(postValidationRunAndOptionalPoll).toHaveBeenCalledWith(
      expect.objectContaining({ verbosePoll: true })
    );
  });

  it('does not publish when sync is false or omitted', async() => {
    publishDatasourceViaPipeline.mockResolvedValue({ success: true });

    await runUnifiedDatasourceValidation('ds-one', { app: 'app-one', runType: 'test' });

    expect(publishDatasourceViaPipeline).not.toHaveBeenCalled();
    expect(postValidationRunAndOptionalPoll).toHaveBeenCalled();
  });

  it('throws when publish returns success false', async() => {
    publishDatasourceViaPipeline.mockResolvedValue({
      success: false,
      formattedError: 'no access'
    });

    await expect(
      runUnifiedDatasourceValidation('ds-one', { app: 'app-one', runType: 'test', sync: true })
    ).rejects.toThrow(/Sync failed: no access/);

    expect(postValidationRunAndOptionalPoll).not.toHaveBeenCalled();
  });
});
