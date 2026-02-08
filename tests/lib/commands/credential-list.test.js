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
  normalizeControllerUrl: jest.fn((url) => (url ? url.replace(/\/$/, '') : url))
}));

jest.mock('../../../lib/api/credentials.api', () => ({
  listCredentials: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
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
    expect(listCredentials).toHaveBeenCalledWith(
      'https://controller.example.com',
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

  it('should use controller option when provided', async() => {
    getOrRefreshDeviceToken.mockResolvedValue({
      token: 'test-token',
      controller: 'https://custom.controller.com'
    });
    resolveControllerUrl.mockResolvedValue('https://fallback.example.com');

    await runCredentialList({ controller: 'https://custom.controller.com' });

    expect(listCredentials).toHaveBeenCalledWith(
      'https://custom.controller.com',
      expect.objectContaining({ type: 'bearer' }),
      expect.any(Object)
    );
  });
});
