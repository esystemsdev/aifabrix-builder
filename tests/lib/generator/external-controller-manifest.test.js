/**
 * Tests for External Controller Manifest Generator Module
 *
 * @fileoverview Unit tests for external-controller-manifest.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn()
  };
});
jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn()
}));
jest.mock('../../../lib/generator/external', () => ({
  loadSystemFile: jest.fn(),
  loadDatasourceFiles: jest.fn()
}));
jest.mock('../../../lib/generator/helpers', () => ({
  loadVariables: jest.fn(),
  loadRbac: jest.fn()
}));

const { detectAppType } = require('../../../lib/utils/paths');
const { loadSystemFile, loadDatasourceFiles } = require('../../../lib/generator/external');
const { loadVariables, loadRbac } = require('../../../lib/generator/helpers');

describe('External Controller Manifest Generator Module', () => {
  const appName = 'test-external-app';
  const appPath = path.join(process.cwd(), 'integration', appName);
  const variablesPath = path.join(appPath, 'application.yaml');
  const rbacPath = path.join(appPath, 'rbac.yaml');

  const mockVariables = {
    app: {
      key: 'test-external-app',
      displayName: 'Test External App',
      description: 'Test Description'
    },
    externalIntegration: {
      schemaBasePath: './',
      systems: ['test-external-app-system.json'],
      dataSources: ['test-external-app-datasource-entity1.json']
    }
  };

  const mockSystemJson = {
    key: 'test-external-app',
    displayName: 'Test System',
    type: 'openapi',
    authentication: {
      type: 'apikey',
      apiKey: 'test-key'
    }
  };

  const mockDatasourceJson = {
    key: 'test-external-app-entity1',
    systemKey: 'test-external-app',
    entityKey: 'entity1',
    displayName: 'Entity 1'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    detectAppType.mockResolvedValue({
      isExternal: true,
      appPath: appPath,
      appType: 'external',
      baseDir: 'integration'
    });
    fs.existsSync.mockReturnValue(true);
    loadVariables.mockReturnValue({ parsed: mockVariables });
    loadRbac.mockReturnValue(null);
    loadSystemFile.mockResolvedValue(mockSystemJson);
    loadDatasourceFiles.mockResolvedValue([mockDatasourceJson]);
  });

  describe('generateControllerManifest', () => {
    it('should generate controller manifest successfully', async() => {
      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      const result = await generateControllerManifest(appName);

      expect(result.key).toBe('test-external-app');
      expect(result.displayName).toBe('Test External App');
      expect(result.description).toBe('Test Description');
      expect(result.type).toBe('external');
      expect(result.system).toEqual(mockSystemJson);
      expect(result.dataSources).toEqual([mockDatasourceJson]);
      expect(loadSystemFile).toHaveBeenCalledWith(appPath, './', 'test-external-app-system.json');
      expect(loadDatasourceFiles).toHaveBeenCalledWith(appPath, './', ['test-external-app-datasource-entity1.json']);
    });

    it('should use appName as key if app.key not provided', async() => {
      const variablesWithoutAppKey = {
        ...mockVariables,
        app: {
          displayName: 'Test App'
        }
      };
      loadVariables.mockReturnValue({ parsed: variablesWithoutAppKey });

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      const result = await generateControllerManifest(appName);

      expect(result.key).toBe(appName);
      expect(result.displayName).toBe('Test App');
    });

    it('should use default description if not provided', async() => {
      const variablesWithoutDescription = {
        ...mockVariables,
        app: {
          key: 'test-external-app',
          displayName: 'Test App'
        }
      };
      loadVariables.mockReturnValue({ parsed: variablesWithoutDescription });

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      const result = await generateControllerManifest(appName);

      expect(result.description).toBe(`External system integration for ${appName}`);
    });

    it('should merge RBAC into system JSON if rbac.yaml exists', async() => {
      const mockRbac = {
        roles: [
          { name: 'Admin', value: 'admin' }
        ],
        permissions: [
          { name: 'read', roles: ['admin'] }
        ]
      };
      loadRbac.mockReturnValue(mockRbac);

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      const result = await generateControllerManifest(appName);

      expect(result.system.roles).toEqual(mockRbac.roles);
      expect(result.system.permissions).toEqual(mockRbac.permissions);
      expect(loadRbac).toHaveBeenCalledWith(rbacPath);
    });

    it('should not merge RBAC if system JSON already has roles', async() => {
      const systemWithRoles = {
        ...mockSystemJson,
        roles: [{ name: 'Existing', value: 'existing' }]
      };
      loadSystemFile.mockResolvedValue(systemWithRoles);

      const mockRbac = {
        roles: [{ name: 'Admin', value: 'admin' }]
      };
      loadRbac.mockReturnValue(mockRbac);

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      const result = await generateControllerManifest(appName);

      // Should keep existing roles, not merge from RBAC
      expect(result.system.roles).toEqual(systemWithRoles.roles);
      expect(result.system.roles).not.toEqual(mockRbac.roles);
    });

    it('should use custom schemaBasePath from application.yaml', async() => {
      const variablesWithCustomPath = {
        ...mockVariables,
        externalIntegration: {
          ...mockVariables.externalIntegration,
          schemaBasePath: './schemas'
        }
      };
      loadVariables.mockReturnValue({ parsed: variablesWithCustomPath });

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      await generateControllerManifest(appName);

      expect(loadSystemFile).toHaveBeenCalledWith(appPath, './schemas', 'test-external-app-system.json');
      expect(loadDatasourceFiles).toHaveBeenCalledWith(appPath, './schemas', ['test-external-app-datasource-entity1.json']);
    });

    it('should normalize schemaBasePath when it duplicates app path (integration/appName)', async() => {
      const variablesWithRedundantPath = {
        ...mockVariables,
        externalIntegration: {
          ...mockVariables.externalIntegration,
          schemaBasePath: 'integration/test-external-app'
        }
      };
      loadVariables.mockReturnValue({ parsed: variablesWithRedundantPath });

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      await generateControllerManifest(appName);

      expect(loadSystemFile).toHaveBeenCalledWith(appPath, './', 'test-external-app-system.json');
      expect(loadDatasourceFiles).toHaveBeenCalledWith(appPath, './', ['test-external-app-datasource-entity1.json']);
    });

    it('should handle empty datasources array', async() => {
      const variablesWithoutDatasources = {
        ...mockVariables,
        externalIntegration: {
          ...mockVariables.externalIntegration,
          dataSources: []
        }
      };
      loadVariables.mockReturnValue({ parsed: variablesWithoutDatasources });
      loadDatasourceFiles.mockResolvedValue([]);

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      const result = await generateControllerManifest(appName);

      expect(result.dataSources).toEqual([]);
      expect(loadDatasourceFiles).toHaveBeenCalledWith(appPath, './', []);
    });

    it('should handle multiple datasources', async() => {
      const multipleDatasources = [
        mockDatasourceJson,
        {
          key: 'test-external-app-entity2',
          systemKey: 'test-external-app',
          entityKey: 'entity2'
        }
      ];
      loadDatasourceFiles.mockResolvedValue(multipleDatasources);

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      const result = await generateControllerManifest(appName);

      expect(result.dataSources).toHaveLength(2);
      expect(result.dataSources).toEqual(multipleDatasources);
    });

    it('should throw error if appName is invalid', async() => {
      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      await expect(generateControllerManifest(null))
        .rejects.toThrow('App name is required and must be a string');
      await expect(generateControllerManifest(''))
        .rejects.toThrow('App name is required and must be a string');
    });

    it('should throw error if externalIntegration block is missing', async() => {
      const variablesWithoutExternalIntegration = {
        app: {
          key: 'test-external-app'
        }
      };
      loadVariables.mockReturnValue({ parsed: variablesWithoutExternalIntegration });

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      await expect(generateControllerManifest(appName))
        .rejects.toThrow('externalIntegration block not found in application.yaml');
    });

    it('should throw error if systems array is empty', async() => {
      const variablesWithoutSystems = {
        ...mockVariables,
        externalIntegration: {
          ...mockVariables.externalIntegration,
          systems: []
        }
      };
      loadVariables.mockReturnValue({ parsed: variablesWithoutSystems });

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      await expect(generateControllerManifest(appName))
        .rejects.toThrow('No system files specified in externalIntegration.systems');
    });

    it('should use app.version over externalIntegration.version', async() => {
      const variablesWithAppVersion = {
        ...mockVariables,
        app: {
          ...mockVariables.app,
          version: '2.0.0'
        },
        externalIntegration: {
          ...mockVariables.externalIntegration,
          version: '1.0.0'
        }
      };
      loadVariables.mockReturnValue({ parsed: variablesWithAppVersion });

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      const result = await generateControllerManifest(appName);

      expect(result.version).toBe('2.0.0');
      expect(result.externalIntegration.version).toBe('2.0.0');
    });

    it('should set top-level manifest.version', async() => {
      const variablesWithVersion = {
        ...mockVariables,
        externalIntegration: {
          ...mockVariables.externalIntegration,
          version: '1.5.0'
        }
      };
      loadVariables.mockReturnValue({ parsed: variablesWithVersion });

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      const result = await generateControllerManifest(appName);

      expect(result.version).toBe('1.5.0');
      expect(result.externalIntegration.version).toBe('1.5.0');
    });

    it('should use default schemaBasePath if not provided', async() => {
      const variablesWithoutSchemaBasePath = {
        ...mockVariables,
        externalIntegration: {
          systems: ['test-external-app-system.json'],
          dataSources: ['test-external-app-datasource-entity1.json']
        }
      };
      loadVariables.mockReturnValue({ parsed: variablesWithoutSchemaBasePath });

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      await generateControllerManifest(appName);

      // Should default to './'
      expect(loadSystemFile).toHaveBeenCalledWith(appPath, './', 'test-external-app-system.json');
    });

    it('should propagate errors from loadSystemFile', async() => {
      loadSystemFile.mockRejectedValue(new Error('System file not found'));

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      await expect(generateControllerManifest(appName))
        .rejects.toThrow('System file not found');
    });

    it('should propagate errors from loadDatasourceFiles', async() => {
      loadDatasourceFiles.mockRejectedValue(new Error('Datasource file not found'));

      const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
      await expect(generateControllerManifest(appName))
        .rejects.toThrow('Datasource file not found');
    });
  });
});
