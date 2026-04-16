/**
 * Tests for credential list command
 *
 * @fileoverview Unit tests for commands/credential-list.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = (t) => t;
  mockChalk.gray = (t) => t;
  mockChalk.green = (t) => t;
  mockChalk.yellow = (t) => t;
  mockChalk.cyan = (t) => t;
  mockChalk.bold = (t) => t;
  return mockChalk;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn()
}));

jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));

jest.mock('../../../lib/core/config', () => ({
  normalizeControllerUrl: jest.fn((url) => (url ? url.replace(/\/$/, '') : url)),
  resolveEnvironment: jest.fn()
}));

jest.mock('../../../lib/utils/dataplane-resolver', () => ({
  resolveDataplaneUrl: jest.fn()
}));

jest.mock('../../../lib/api/credentials.api', () => ({
  listCredentials: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const { resolveEnvironment } = require('../../../lib/core/config');
const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
const { listCredentials } = require('../../../lib/api/credentials.api');
const { runCredentialList } = require('../../../lib/commands/credential-list');

describe('Credential list command', () => {
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({
      token: 'test-token',
      controller: 'https://controller.example.com'
    });
    resolveEnvironment.mockResolvedValue('dev');
    resolveDataplaneUrl.mockResolvedValue('https://dataplane.example.com');
    listCredentials.mockResolvedValue({
      data: { credentials: [{ key: 'cred-1', displayName: 'My Credential' }] }
    });
  });

  afterAll(() => {
    exitSpy.mockRestore();
  });

  it('should list credentials and display them', async() => {
    await runCredentialList({});

    expect(resolveControllerUrl).toHaveBeenCalled();
    expect(resolveEnvironment).toHaveBeenCalled();
    expect(resolveDataplaneUrl).toHaveBeenCalledWith(
      'https://controller.example.com',
      'dev',
      expect.objectContaining({ type: 'bearer', token: 'test-token' })
    );
    expect(listCredentials).toHaveBeenCalledWith(
      'https://dataplane.example.com',
      { type: 'bearer', token: 'test-token' },
      expect.objectContaining({ pageSize: 50 })
    );
    expect(logger.log).toHaveBeenCalled();
    expect(logger.log.mock.calls.some(c => c[0].includes('Credentials'))).toBe(true);
    expect(logger.log.mock.calls.some(c => String(c[0]).includes('cred-1'))).toBe(true);
  });

  it('should exit when controller URL is missing', async() => {
    resolveControllerUrl.mockResolvedValue(null);

    await expect(runCredentialList({})).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Controller URL is required'));
    expect(listCredentials).not.toHaveBeenCalled();
  });

  it('should exit when no auth token', async() => {
    getOrRefreshDeviceToken.mockResolvedValue(null);

    await expect(runCredentialList({})).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No authentication token'));
    expect(resolveDataplaneUrl).not.toHaveBeenCalled();
    expect(listCredentials).not.toHaveBeenCalled();
  });

  it('should pass options to listCredentials', async() => {
    await runCredentialList({ pageSize: 20, activeOnly: true });

    expect(listCredentials).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ pageSize: 20, activeOnly: true })
    );
  });

  it('should exit on API error', async() => {
    listCredentials.mockRejectedValue(new Error('Network error'));

    await expect(runCredentialList({})).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to list credentials'));
  });

  it('should display empty message when no credentials', async() => {
    listCredentials.mockResolvedValue({ data: { credentials: [] } });

    await runCredentialList({});

    expect(logger.log).toHaveBeenCalled();
    expect(logger.log.mock.calls.some(c => String(c[0]).includes('No credentials found'))).toBe(true);
  });

  it('should handle response with data.items instead of data.credentials', async() => {
    listCredentials.mockResolvedValue({
      data: { items: [{ key: 'item-1', displayName: 'Item Credential' }] }
    });

    await runCredentialList({});

    expect(logger.log).toHaveBeenCalled();
    expect(logger.log.mock.calls.some(c => String(c[0]).includes('item-1'))).toBe(true);
  });

  it('should handle paginated API shape (meta + data array)', async() => {
    listCredentials.mockResolvedValue({
      success: true,
      data: {
        meta: { totalItems: 1, currentPage: 1, pageSize: 20, type: 'CredentialResponse' },
        data: [
          { id: 'c67fb7ae03c5844a59ada1558', key: 'test-hubspot-cred', displayName: 'Test E2E HubSpot OAuth2' }
        ]
      },
      status: 200
    });

    await runCredentialList({});

    expect(logger.log).toHaveBeenCalled();
    expect(logger.log.mock.calls.some(c => String(c[0]).includes('test-hubspot-cred'))).toBe(true);
    expect(logger.log.mock.calls.some(c => String(c[0]).includes('Test E2E HubSpot OAuth2'))).toBe(true);
  });

  it('should display status icon and label when credential has status', async() => {
    listCredentials.mockResolvedValue({
      data: {
        credentials: [
          { key: 'cred-ok', displayName: 'OK Cred', status: 'verified' },
          { key: 'cred-fail', displayName: 'Fail Cred', status: 'failed' }
        ]
      }
    });

    await runCredentialList({});

    expect(logger.log).toHaveBeenCalled();
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('cred-ok');
    expect(output).toContain('cred-fail');
    expect(output).toContain(' ✔');
    expect(output).toContain(' ✖');
    expect(output).toContain(' (Valid)');
    expect(output).toContain(' (Connection failed)');
  });

  it('should display credentials without status icon when status is missing', async() => {
    listCredentials.mockResolvedValue({
      data: { credentials: [{ key: 'no-status', displayName: 'No Status Cred' }] }
    });

    await runCredentialList({});

    expect(logger.log).toHaveBeenCalled();
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('no-status');
    expect(output).toContain('No Status Cred');
    expect(output).not.toContain(' ✔');
    expect(output).not.toContain(' ✖');
  });

  it('should display credentials with alternative field names (id, credentialKey, name)', async() => {
    listCredentials.mockResolvedValue({
      data: {
        credentials: [
          { id: 'cred-by-id', name: 'Cred by ID' },
          { credentialKey: 'cred-by-key', displayName: 'Cred by Key' }
        ]
      }
    });

    await runCredentialList({});

    expect(logger.log).toHaveBeenCalled();
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('cred-by-id');
    expect(output).toContain('cred-by-key');
  });

  it('should exit when Dataplane URL cannot be resolved', async() => {
    resolveDataplaneUrl.mockRejectedValue(new Error('No dataplane for env'));

    await expect(runCredentialList({})).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Could not resolve Dataplane URL'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Could not resolve Dataplane URL'));
    expect(listCredentials).not.toHaveBeenCalled();
  });
});
