/**
 * Tests for integration-client command
 *
 * @fileoverview Unit tests for commands/integration-client.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = (t) => t;
  mockChalk.gray = (t) => t;
  mockChalk.cyan = (t) => t;
  mockChalk.bold = (t) => t;
  mockChalk.yellow = (t) => t;
  mockChalk.green = (t) => t;
  mockChalk.white = Object.assign((t) => t, { bold: (t) => t });
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

jest.mock('../../../lib/api/integration-clients.api', () => ({
  createIntegrationClient: jest.fn(),
  listIntegrationClients: jest.fn().mockResolvedValue({ success: true, data: { data: [] } }),
  regenerateIntegrationClientSecret: jest.fn(),
  deleteIntegrationClient: jest.fn(),
  updateIntegrationClientGroups: jest.fn(),
  updateIntegrationClientRedirectUris: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const integrationClientsApi = require('../../../lib/api/integration-clients.api');
const {
  runIntegrationClientCreate,
  runIntegrationClientList,
  runIntegrationClientRotateSecret,
  runIntegrationClientDelete,
  runIntegrationClientUpdateGroups,
  runIntegrationClientUpdateRedirectUris
} = require('../../../lib/commands/integration-client');

const {
  createIntegrationClient,
  listIntegrationClients,
  regenerateIntegrationClientSecret,
  deleteIntegrationClient,
  updateIntegrationClientGroups,
  updateIntegrationClientRedirectUris
} = integrationClientsApi;

let exitSpy;
beforeAll(() => {
  exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});
afterAll(() => {
  if (exitSpy) exitSpy.mockRestore();
});

describe('Integration client create command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({
      token: 'test-token',
      controller: 'https://controller.example.com'
    });
    createIntegrationClient.mockResolvedValue({
      success: true,
      data: {
        data: {
          integrationClient: { keycloakClientId: 'svc-id-1', key: 'api-client-001' },
          clientSecret: 'one-time-secret-value'
        }
      }
    });
  });

  const validOptions = {
    key: 'api-client-001',
    displayName: 'API client',
    redirectUris: 'https://app.example.com/callback',
    groupNames: 'AI-Fabrix-Developers'
  };

  it('should create integration client and print clientId, clientSecret, and one-time warning', async() => {
    await runIntegrationClientCreate(validOptions);

    expect(createIntegrationClient).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      expect.objectContaining({
        key: 'api-client-001',
        displayName: 'API client',
        redirectUris: ['https://app.example.com/callback'],
        groupNames: ['AI-Fabrix-Developers']
      })
    );
    expect(logger.log).toHaveBeenCalled();
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('clientId');
    expect(output).toContain('clientSecret');
    expect(output).toContain('svc-id-1');
    expect(output).toContain('Save this secret now; it will not be shown again');
  });

  it('should exit when key is missing', async() => {
    await expect(runIntegrationClientCreate({ ...validOptions, key: undefined })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Key is required'));
    expect(createIntegrationClient).not.toHaveBeenCalled();
  });

  it('should exit when key is invalid', async() => {
    await expect(runIntegrationClientCreate({ ...validOptions, key: 'Invalid_Key' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('lowercase'));
    expect(createIntegrationClient).not.toHaveBeenCalled();
  });

  it('should exit when displayName is missing', async() => {
    await expect(runIntegrationClientCreate({ ...validOptions, displayName: undefined })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Display name is required'));
    expect(createIntegrationClient).not.toHaveBeenCalled();
  });

  it('should exit when redirectUris is missing or empty', async() => {
    await expect(runIntegrationClientCreate({ ...validOptions, redirectUris: '' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('redirect URI'));
    expect(createIntegrationClient).not.toHaveBeenCalled();
  });

  it('should allow empty group names (optional groups)', async() => {
    await runIntegrationClientCreate({
      key: 'postman',
      displayName: 'Postman',
      redirectUris: 'https://oauth.pstmn.io/v1/callback',
      groupNames: ''
    });
    expect(createIntegrationClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ groupNames: [] })
    );
  });

  it('should exit when controller URL is missing', async() => {
    resolveControllerUrl.mockResolvedValue(null);

    await expect(runIntegrationClientCreate(validOptions)).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Controller URL is required'));
    expect(createIntegrationClient).not.toHaveBeenCalled();
  });

  it('should exit when no auth token', async() => {
    getOrRefreshDeviceToken.mockResolvedValue(null);

    await expect(runIntegrationClientCreate(validOptions)).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No authentication token'));
    expect(createIntegrationClient).not.toHaveBeenCalled();
  });

  it('should handle 403 with permission message', async() => {
    createIntegrationClient.mockResolvedValue({
      success: false,
      status: 403,
      formattedError: 'Forbidden'
    });

    await expect(runIntegrationClientCreate(validOptions)).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Missing permission: integration-client:create')
    );
  });

  it('should handle 400 validation error', async() => {
    createIntegrationClient.mockResolvedValue({
      success: false,
      status: 400,
      error: 'key is required'
    });

    await expect(runIntegrationClientCreate(validOptions)).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Validation error'));
  });

  it('should handle 401 unauthorized', async() => {
    createIntegrationClient.mockResolvedValue({
      success: false,
      status: 401,
      error: 'Unauthorized'
    });

    await expect(runIntegrationClientCreate(validOptions)).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unauthorized'));
  });

  it('should pass description, keycloakClientId and parse comma-separated lists', async() => {
    await runIntegrationClientCreate({
      ...validOptions,
      description: 'For pipelines',
      keycloakClientId: 'miso-postman',
      redirectUris: 'https://a.com/cb,https://b.com/cb',
      groupNames: 'AI-Fabrix-Developers,my-api-group'
    });

    expect(createIntegrationClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        key: 'api-client-001',
        displayName: 'API client',
        description: 'For pipelines',
        keycloakClientId: 'miso-postman',
        redirectUris: ['https://a.com/cb', 'https://b.com/cb'],
        groupNames: ['AI-Fabrix-Developers', 'my-api-group']
      })
    );
  });

  it('should display clientId from integrationClient when controller returns nested data', async() => {
    createIntegrationClient.mockResolvedValue({
      success: true,
      data: {
        data: {
          integrationClient: {
            id: 'ic-uuid',
            key: 'postman',
            displayName: 'Postman',
            keycloakClientId: 'miso-postman',
            status: 'active'
          },
          clientSecret: 'one-time-secret-from-controller'
        }
      }
    });

    await runIntegrationClientCreate(validOptions);

    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('miso-postman');
    expect(output).toContain('one-time-secret-from-controller');
  });
});

describe('Integration client list command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 'test-token', controller: 'https://controller.example.com' });
  });

  it('should list integration clients and display table', async() => {
    listIntegrationClients.mockResolvedValueOnce({
      success: true,
      data: {
        data: [
          { id: 'uuid-1', key: 'k1', displayName: 'D1', keycloakClientId: 'kc1', status: 'active' }
        ]
      }
    });
    await runIntegrationClientList({ controller: 'https://controller.example.com' });
    expect(listIntegrationClients).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      expect.any(Object)
    );
    expect(logger.log).toHaveBeenCalled();
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('Integration clients');
    expect(output).toContain('uuid-1');
  });

  it('should pass page, pageSize, search, sort, filter to listIntegrationClients', async() => {
    await runIntegrationClientList({
      controller: 'https://controller.example.com',
      page: 2,
      pageSize: 10,
      search: 'foo',
      sort: 'displayName',
      filter: 'active:true'
    });

    expect(listIntegrationClients).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ page: 2, pageSize: 10, search: 'foo', sort: 'displayName', filter: 'active:true' })
    );
  });

  it('should handle 403 on list with permission message', async() => {
    listIntegrationClients.mockResolvedValue({ success: false, status: 403, formattedError: 'Forbidden' });

    await expect(runIntegrationClientList({ controller: 'https://controller.example.com' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('integration-client:read'));
  });

  it('should display empty message when list is empty', async() => {
    listIntegrationClients.mockResolvedValueOnce({ success: true, data: { data: [] } });
    await runIntegrationClientList({ controller: 'https://controller.example.com' });

    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('No integration clients found');
  });
});

describe('Integration client rotate-secret command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 'test-token', controller: 'https://controller.example.com' });
    regenerateIntegrationClientSecret.mockResolvedValue({
      success: true,
      data: { data: { clientSecret: 'new-secret-rotated' } }
    });
  });

  it('should rotate secret and print clientSecret and one-time warning', async() => {
    await runIntegrationClientRotateSecret({ controller: 'https://controller.example.com', id: 'svc-uuid-1' });

    expect(regenerateIntegrationClientSecret).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      'svc-uuid-1'
    );
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('new-secret-rotated');
    expect(output).toContain('Save this secret now; it will not be shown again');
  });

  it('should exit when id is missing', async() => {
    await expect(runIntegrationClientRotateSecret({ controller: 'https://controller.example.com' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ID is required'));
    expect(regenerateIntegrationClientSecret).not.toHaveBeenCalled();
  });

  it('should handle 403 with integration-client:update message', async() => {
    regenerateIntegrationClientSecret.mockResolvedValue({ success: false, status: 403, formattedError: 'Forbidden' });

    await expect(runIntegrationClientRotateSecret({ controller: 'https://controller.example.com', id: 'svc-uuid-1' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('integration-client:update'));
  });

  it('should handle 404 when integration client not found', async() => {
    regenerateIntegrationClientSecret.mockResolvedValue({ success: false, status: 404, error: 'Not found' });

    await expect(runIntegrationClientRotateSecret({ controller: 'https://controller.example.com', id: 'svc-uuid-1' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });
});

describe('Integration client delete command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 'test-token', controller: 'https://controller.example.com' });
    deleteIntegrationClient.mockResolvedValue({ success: true, data: null });
  });

  it('should delete and print success', async() => {
    await runIntegrationClientDelete({ controller: 'https://controller.example.com', id: 'svc-uuid-2' });

    expect(deleteIntegrationClient).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      'svc-uuid-2'
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('deactivated'));
  });

  it('should exit when id is missing', async() => {
    await expect(runIntegrationClientDelete({ controller: 'https://controller.example.com' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ID is required'));
  });

  it('should handle 404', async() => {
    deleteIntegrationClient.mockResolvedValue({ success: false, status: 404, error: 'Not found' });

    await expect(runIntegrationClientDelete({ controller: 'https://controller.example.com', id: 'svc-uuid-2' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });
});

describe('Integration client update-groups command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 'test-token', controller: 'https://controller.example.com' });
    updateIntegrationClientGroups.mockResolvedValue({ success: true, data: { id: 'svc-uuid-3', groupNames: ['G1', 'G2'] } });
  });

  it('should update groups and print success', async() => {
    await runIntegrationClientUpdateGroups({
      controller: 'https://controller.example.com',
      id: 'svc-uuid-3',
      groupNames: 'G1,G2'
    });

    expect(updateIntegrationClientGroups).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      'svc-uuid-3',
      { groupNames: ['G1', 'G2'] }
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('groups updated'));
  });

  it('should exit when id is missing', async() => {
    await expect(runIntegrationClientUpdateGroups({ controller: 'https://controller.example.com', groupNames: 'G1' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ID is required'));
  });

  it('should exit when groupNames is empty', async() => {
    await expect(runIntegrationClientUpdateGroups({ controller: 'https://controller.example.com', id: 'svc-uuid-3', groupNames: '' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('group name'));
  });

  it('should handle 403 with integration-client:update message', async() => {
    updateIntegrationClientGroups.mockResolvedValue({ success: false, status: 403, formattedError: 'Forbidden' });

    await expect(runIntegrationClientUpdateGroups({
      controller: 'https://controller.example.com',
      id: 'svc-uuid-3',
      groupNames: 'G1,G2'
    })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('integration-client:update'));
  });
});

describe('Integration client update-redirect-uris command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 'test-token', controller: 'https://controller.example.com' });
    updateIntegrationClientRedirectUris.mockResolvedValue({
      success: true,
      data: { id: 'svc-uuid-4', redirectUris: ['https://app.example.com/cb'] }
    });
  });

  it('should update redirect URIs and print success', async() => {
    await runIntegrationClientUpdateRedirectUris({
      controller: 'https://controller.example.com',
      id: 'svc-uuid-4',
      redirectUris: 'https://app.example.com/cb'
    });

    expect(updateIntegrationClientRedirectUris).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      'svc-uuid-4',
      { redirectUris: ['https://app.example.com/cb'] }
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('redirect URIs updated'));
  });

  it('should exit when redirectUris is empty', async() => {
    await expect(runIntegrationClientUpdateRedirectUris({
      controller: 'https://controller.example.com',
      id: 'svc-uuid-4',
      redirectUris: ''
    })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('redirect URI'));
  });

  it('should handle 403 with integration-client:update message', async() => {
    updateIntegrationClientRedirectUris.mockResolvedValue({ success: false, status: 403, formattedError: 'Forbidden' });

    await expect(runIntegrationClientUpdateRedirectUris({
      controller: 'https://controller.example.com',
      id: 'svc-uuid-4',
      redirectUris: 'https://app.example.com/cb'
    })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('integration-client:update'));
  });
});
