/**
 * Tests for lib/app/show-display.js
 *
 * @fileoverview Unit tests for show display (unified display function)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.gray = (text) => text;
  return mockChalk;
});

const logger = require('../../../lib/utils/logger');
const { display } = require('../../../lib/app/show-display');

describe('lib/app/show-display.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.log.mockImplementation(() => {});
  });

  it('should display offline source and application', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {
        key: 'myapp',
        displayName: 'My App',
        description: 'Desc',
        type: 'webapp',
        port: 3000
      },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith('🔴 Source: offline (builder/myapp)');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('📱 Application'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('myapp'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('My App'));
  });

  it('should display online source and application', () => {
    const summary = {
      source: 'online',
      controllerUrl: 'http://localhost:3000',
      appKey: 'myapp',
      application: {
        key: 'myapp',
        displayName: 'My App',
        type: 'webapp',
        status: 'active',
        url: 'http://127.0.0.1:3000',
        port: 3000
      },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith('🟢 Source: online (http://localhost:3000)');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Status:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('URL:'));
  });

  it('should display internalUrl when present', () => {
    const summary = {
      source: 'online',
      controllerUrl: 'http://localhost:3600',
      appKey: 'dataplane',
      application: {
        key: 'dataplane',
        displayName: 'Dataplane',
        type: 'webapp',
        status: 'active',
        url: 'http://localhost:3001',
        internalUrl: 'http://dataplane:3001',
        port: 3001
      },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Internal URL:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('http://dataplane:3001'));
  });

  it('should display application with deploymentKey image healthCheck build', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {
        key: 'myapp',
        displayName: 'My App',
        type: 'webapp',
        deploymentKey: 'a1b2c3...',
        image: 'reg/myapp:latest',
        registryMode: 'acr',
        port: 3000,
        healthCheck: '/health (interval 30s)',
        build: 'dockerfile, envOutputPath: .env'
      },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Deployment:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Image:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Registry:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Health:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Build:'));
  });

  it('should display roles with description and groups', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [
        { name: 'Admin', value: 'admin', description: 'Administrator role', groups: ['Admins'] }
      ],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('👥 Roles'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Admin (admin)'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/\tAdministrator role/));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('groups: [Admins]'));
  });

  it('should not display permissions when permissionsOnly is not set', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [],
      permissions: [
        { name: 'read', roles: ['admin', 'user'], description: 'Read access' }
      ],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('🛡️ Permissions'));
  });

  it('should display only permissions when permissionsOnly option is true', () => {
    const summary = {
      source: 'online',
      controllerUrl: 'http://localhost:3000',
      appKey: 'myapp',
      application: { key: 'myapp', displayName: 'My App', type: 'webapp' },
      roles: [{ name: 'admin', value: 'admin' }],
      permissions: [
        { name: 'applications:read', roles: ['admin'], description: 'Read apps' }
      ],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary, { permissionsOnly: true });
    expect(logger.log).toHaveBeenCalledWith('🟢 Source: online (http://localhost:3000)');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('🛡️ Permissions'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('applications:read'));
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('📱 Application'));
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('👥 Roles'));
  });

  it('should display (none) when permissionsOnly and permissions empty', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: { key: 'myapp' },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary, { permissionsOnly: true });
    expect(logger.log).toHaveBeenCalledWith('🔴 Source: offline (builder/myapp)');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('🛡️ Permissions'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('(none)'));
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('📱 Application'));
  });

  it('should display authentication', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [],
      permissions: [],
      authentication: { enableSSO: true, type: 'azure', requiredRoles: ['aifabrix-user'] },
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('🔐 Authentication'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('SSO: enabled'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('type: azure'));
  });

  it('should display authentication with SSO disabled', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [],
      permissions: [],
      authentication: { enableSSO: false, type: 'basic', requiredRoles: [] },
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('SSO: disabled'));
  });

  it('should display portal input configurations', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [],
      permissions: [],
      portalInputConfigurations: [
        { label: 'API Key', value: '***' },
        { label: 'Log Level', name: 'LOG_LEVEL', value: 'info' }
      ],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('📝 Configurations'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('API Key'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Log Level'));
  });

  it('should display databases', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: ['myapp', 'myapp-logs']
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('🗄️ Databases'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('myapp, myapp-logs'));
  });

  it('should display databases from array of objects', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: [{ name: 'db1' }, { name: 'db2' }]
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('db1, db2'));
  });

  it('should display external integration when isExternal', () => {
    const summary = {
      source: 'offline',
      path: 'integration/hubspot',
      appKey: 'hubspot',
      isExternal: true,
      application: {
        key: 'hubspot',
        displayName: 'HubSpot',
        type: 'external',
        externalIntegration: {
          schemaBasePath: './',
          systems: ['hubspot-system.json'],
          dataSources: ['hubspot-datasource.json']
        }
      },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('External integration:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('schemaBasePath'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('hubspot-system.json'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('For external system data'));
  });

  it('should display externalSystem error when dataplane unreachable', () => {
    const summary = {
      source: 'online',
      controllerUrl: 'http://localhost:3000',
      appKey: 'hubspot',
      application: { key: 'hubspot', type: 'external' },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: [],
      externalSystem: { error: 'dataplane unreachable' }
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('not available'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('dataplane unreachable'));
  });

  it('should display full externalSystem when dataplane returns data', () => {
    const summary = {
      source: 'online',
      controllerUrl: 'http://localhost:3000',
      appKey: 'hubspot',
      isExternal: true,
      application: {
        key: 'hubspot',
        type: 'external',
        externalIntegration: { schemaBasePath: './', systems: ['hubspot-system.json'], dataSources: ['contacts.json'] }
      },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: [],
      externalSystem: {
        dataplaneUrl: 'http://dataplane:4000',
        systemKey: 'hubspot',
        displayName: 'HubSpot',
        type: 'openapi',
        status: 'published',
        version: '1.0.0',
        credentialId: 'hubspot-cred',
        dataSources: [
          { key: 'contacts', displayName: 'Contacts', systemKey: 'hubspot' }
        ],
        application: { key: 'hubspot', displayName: 'HubSpot', type: 'openapi', roles: ['admin'], permissions: ['read'] },
        openapiFiles: [{ name: 'spec.json' }],
        openapiEndpoints: [
          { method: 'GET', path: '/contacts' },
          { method: 'POST', path: '/contacts' }
        ]
      }
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('🧷 Application - external'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('🧩 Dataplane'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Version:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Credential:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Status:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('API docs:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('MCP server:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('OpenAPI spec:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('External integration'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('hubspot-system.json'));
  });

  it('should use application.roles and application.permissions when summary level missing', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {
        key: 'myapp',
        roles: [{ name: 'user', value: 'user' }],
        permissions: [{ name: 'read', roles: ['user'] }]
      },
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('👥 Roles'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('• user'));
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('🛡️ Permissions'));
  });

  it('should display role as string (not object)', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: ['viewer'],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('👥 Roles'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('• viewer (viewer)'));
  });

  it('should display permission without description when permissionsOnly is true', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [],
      permissions: [{ name: 'write', roles: ['admin'] }],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary, { permissionsOnly: true });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('🛡️ Permissions'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('• write'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('roles: [admin]'));
  });

  it('should not display Service links when externalSystem has no OpenAPI and no dataSources', () => {
    const summary = {
      source: 'online',
      controllerUrl: 'http://localhost:3000',
      appKey: 'hubspot',
      application: { key: 'hubspot', type: 'external' },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: [],
      externalSystem: {
        dataplaneUrl: 'http://dataplane:4000',
        systemKey: 'hubspot',
        displayName: 'HubSpot',
        type: 'custom',
        status: 'draft',
        dataSources: [],
        application: {},
        openapiFiles: [],
        openapiEndpoints: []
      }
    };
    display(summary);
    const logCalls = logger.log.mock.calls.map((c) => c[0]);
    expect(logCalls.some((s) => String(s).includes('Service links:'))).toBe(false);
  });

  it('should display externalSystem with more than 3 openAPI endpoints (ellipsis)', () => {
    const summary = {
      source: 'online',
      controllerUrl: 'http://localhost:3000',
      appKey: 'hubspot',
      application: { key: 'hubspot', type: 'external' },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: [],
      externalSystem: {
        dataplaneUrl: 'http://dataplane:4000',
        systemKey: 'hubspot',
        displayName: 'HubSpot',
        type: 'openapi',
        status: 'published',
        dataSources: [],
        application: {},
        openapiFiles: [],
        openapiEndpoints: [
          { method: 'GET', path: '/a' },
          { method: 'GET', path: '/b' },
          { method: 'GET', path: '/c' },
          { method: 'POST', path: '/d' }
        ]
      }
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('OpenAPI endpoints: 4'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(' …'));
  });

  it('should display externalSystem application with roles/permissions as non-array', () => {
    const summary = {
      source: 'online',
      controllerUrl: 'http://localhost:3000',
      appKey: 'hubspot',
      application: { key: 'hubspot', type: 'external' },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: [],
      externalSystem: {
        dataplaneUrl: 'http://dataplane:4000',
        systemKey: 'hubspot',
        displayName: 'HubSpot',
        type: 'openapi',
        status: 'published',
        dataSources: [],
        application: { key: 'hubspot', displayName: 'HubSpot', type: 'openapi', roles: 'admin', permissions: 'read' },
        openapiFiles: [],
        openapiEndpoints: []
      }
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application (from dataplane)'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('roles:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('permissions:'));
  });

  it('should display port as dash when null or undefined', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: { key: 'myapp', displayName: 'My App', type: 'webapp', port: null },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Port:          —'));
  });

  it('should display source path as dash when empty', () => {
    const summary = {
      source: 'offline',
      path: '',
      appKey: 'myapp',
      application: { key: 'myapp', displayName: 'My App', type: 'webapp' },
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith('🔴 Source: offline (—)');
  });

  it('should display config label from name when label missing', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [],
      permissions: [],
      portalInputConfigurations: [{ label: '—', name: 'ENV_VAR', value: 'x' }],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('📝 Configurations'));
  });

  it('should display role with value only when name missing', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [{ value: 'editor' }],
      permissions: [],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('• editor (editor)'));
  });

  it('should not show databases section when databases is not array', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [],
      permissions: [],
      portalInputConfigurations: [],
      databases: null
    };
    display(summary);
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('🗄️ Databases'));
  });

  it('should display permission with empty roles when permissionsOnly is true', () => {
    const summary = {
      source: 'offline',
      path: 'builder/myapp',
      appKey: 'myapp',
      application: {},
      roles: [],
      permissions: [{ name: 'admin-only' }],
      portalInputConfigurations: [],
      databases: []
    };
    display(summary, { permissionsOnly: true });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('• admin-only'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('roles: []'));
  });
});
