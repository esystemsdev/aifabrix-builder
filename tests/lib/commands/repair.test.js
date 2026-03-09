/**
 * Tests for repair command
 *
 * @fileoverview Unit tests for lib/commands/repair.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');

jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn()
}));
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn()
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn(),
  writeConfigFile: jest.fn(),
  writeYamlPreservingComments: jest.fn(),
  isYamlPath: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/generator', () => ({
  generateDeployJson: jest.fn()
}));
jest.mock('../../../lib/external-system/generator', () => ({
  buildAuthenticationFromMethod: jest.fn()
}));

const { detectAppType } = require('../../../lib/utils/paths');
const { buildAuthenticationFromMethod } = require('../../../lib/external-system/generator');
const { resolveApplicationConfigPath } = require('../../../lib/utils/app-config-resolver');
const { loadConfigFile, writeConfigFile, writeYamlPreservingComments, isYamlPath } = require('../../../lib/utils/config-format');
const generator = require('../../../lib/generator');
const {
  repairExternalIntegration,
  discoverIntegrationFiles
} = require('../../../lib/commands/repair');

describe('repair', () => {
  const appName = 'test-hubspot';
  const appPath = path.join(process.cwd(), 'integration', appName);
  const configPath = path.join(appPath, 'application.yaml');

  const mockVariables = {
    app: { key: appName, type: 'external' },
    externalIntegration: {
      schemaBasePath: './',
      systems: ['test-hubspot-system.json'],
      dataSources: ['test-hubspot-datasource-record-storage.json'],
      autopublish: true
    }
  };

  const defaultApplicationYamlContent = 'app:\n  key: test-hubspot\nexternalIntegration:\n  systems: []\n  dataSources: []\n';

  let readdirSyncSpy;
  let existsSyncSpy;
  let readFileSyncSpy;
  let renameSyncSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    detectAppType.mockResolvedValue({ appPath, isExternal: true });
    resolveApplicationConfigPath.mockReturnValue(configPath);
    isYamlPath.mockImplementation((p) => typeof p === 'string' && (p.endsWith('.yaml') || p.endsWith('.yml')));
    loadConfigFile.mockImplementation((p) => {
      const s = typeof p === 'string' ? p : '';
      if (s.endsWith('application.yaml') || s.endsWith('application.json') || s.endsWith('application.yml')) {
        return JSON.parse(JSON.stringify(mockVariables));
      }
      return { key: appName };
    });
    readdirSyncSpy = jest.spyOn(fs, 'readdirSync');
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
    renameSyncSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => {});
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((filePath, enc) => {
      if (filePath === configPath && (enc === 'utf8' || enc === undefined)) {
        return defaultApplicationYamlContent;
      }
      return '';
    });
  });

  afterEach(() => {
    readdirSyncSpy?.mockRestore();
    existsSyncSpy?.mockRestore();
    renameSyncSpy?.mockRestore();
    readFileSyncSpy?.mockRestore();
  });

  describe('discoverIntegrationFiles', () => {
    it('returns system and datasource files from directory', () => {
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.yaml',
        'test-hubspot-datasource-record-storage.yaml',
        'env.template',
        'README.md'
      ]);
      existsSyncSpy.mockReturnValue(true);
      const result = discoverIntegrationFiles(appPath);
      expect(result.systemFiles).toEqual(['test-hubspot-system.yaml']);
      expect(result.datasourceFiles).toEqual(['test-hubspot-datasource-record-storage.yaml']);
    });

    it('ignores non-config files', () => {
      readdirSyncSpy.mockReturnValue(['foo.txt', 'bar.js']);
      existsSyncSpy.mockReturnValue(true);
      const result = discoverIntegrationFiles(appPath);
      expect(result.systemFiles).toEqual([]);
      expect(result.datasourceFiles).toEqual([]);
    });

    it('returns empty arrays when path does not exist', () => {
      existsSyncSpy.mockReturnValue(false);
      const result = discoverIntegrationFiles(appPath);
      expect(result.systemFiles).toEqual([]);
      expect(result.datasourceFiles).toEqual([]);
    });

    it('discovers datasource-*.json style filenames (no system prefix)', () => {
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.json',
        'datasource-companies.json',
        'datasource-deals.json',
        'application.yaml'
      ]);
      existsSyncSpy.mockReturnValue(true);
      const result = discoverIntegrationFiles(appPath);
      expect(result.systemFiles).toEqual(['test-hubspot-system.json']);
      expect(result.datasourceFiles).toEqual(['datasource-companies.json', 'datasource-deals.json']);
    });
  });

  describe('repairExternalIntegration', () => {
    it('does not write when no changes needed', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('test-hubspot-system.json') || s.endsWith('rbac.yaml') || s.endsWith('rbac.yml') ||
          s.endsWith('test-hubspot-datasource-record-storage.json');
      });
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.json',
        'test-hubspot-datasource-record-storage.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s.endsWith('application.yaml') || s.endsWith('application.json') || s.endsWith('application.yml')) {
          return JSON.parse(JSON.stringify(mockVariables));
        }
        if (s.endsWith('test-hubspot-system.json')) {
          return { key: appName, dataSources: ['test-hubspot-record-storage'] };
        }
        if (s.endsWith('test-hubspot-datasource-record-storage.json')) {
          return {
            key: 'test-hubspot-record-storage',
            systemKey: appName,
            metadataSchema: { type: 'object', properties: { email: { type: 'string' } } },
            fieldMappings: {
              attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } },
              dimensions: { email: 'metadata.email' }
            }
          };
        }
        return { key: appName };
      });

      const result = await repairExternalIntegration(appName);
      expect(result.updated).toBe(false);
      expect(writeConfigFile).not.toHaveBeenCalled();
      expect(generator.generateDeployJson).not.toHaveBeenCalled();
    });

    it('updates application.yaml when files on disk differ from config', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('test-hubspot-system.yaml')) return true;
        if (s.endsWith('test-hubspot-datasource-record-storage.yaml')) return true;
        return false;
      });
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.yaml',
        'test-hubspot-datasource-record-storage.yaml',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s.endsWith('application.yaml') || s.endsWith('application.json') || s.endsWith('application.yml')) {
          return JSON.parse(JSON.stringify(mockVariables));
        }
        if (s.endsWith('test-hubspot-datasource-record-storage.yaml')) {
          return { key: 'test-hubspot-record-storage' };
        }
        return { key: appName };
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'test-hubspot-deploy.json'));

      const result = await repairExternalIntegration(appName);
      expect(result.updated).toBe(true);
      expect(result.systemFiles).toEqual(['test-hubspot-system.yaml']);
      expect(result.datasourceFiles).toEqual(['test-hubspot-datasource-record-storage.yaml']);
      expect(writeYamlPreservingComments).toHaveBeenCalledWith(
        configPath,
        defaultApplicationYamlContent,
        expect.objectContaining({
          externalIntegration: expect.objectContaining({
            systems: ['test-hubspot-system.yaml'],
            dataSources: ['test-hubspot-datasource-record-storage.yaml']
          })
        })
      );
      expect(generator.generateDeployJson).toHaveBeenCalledWith(appName, { appPath });
    });

    it('dry-run does not write to disk', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        return s === configPath || s === appPath || s.endsWith('test-hubspot-system.yaml');
      });
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.yaml',
        'test-hubspot-datasource-record-storage.yaml',
        'application.yaml'
      ]);

      const result = await repairExternalIntegration(appName, { dryRun: true });
      expect(writeConfigFile).not.toHaveBeenCalled();
      expect(generator.generateDeployJson).not.toHaveBeenCalled();
    });

    it('creates externalIntegration block when missing', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('test-hubspot-system.yaml')) return true;
        if (s.endsWith('test-hubspot-datasource-record-storage.yaml')) return true;
        return false;
      });
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.yaml',
        'test-hubspot-datasource-record-storage.yaml',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s.endsWith('application.yaml') || s.endsWith('application.json') || s.endsWith('application.yml')) {
          return { app: { key: appName } };
        }
        if (s.endsWith('test-hubspot-datasource-record-storage.yaml')) {
          return { key: 'test-hubspot-record-storage' };
        }
        return { key: appName };
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'test-hubspot-deploy.json'));

      const result = await repairExternalIntegration(appName);
      expect(result.updated).toBe(true);
      expect(result.changes.some(c => c.includes('externalIntegration'))).toBe(true);
      expect(writeYamlPreservingComments).toHaveBeenCalledWith(
        configPath,
        defaultApplicationYamlContent,
        expect.objectContaining({
          externalIntegration: expect.objectContaining({
            schemaBasePath: './',
            systems: ['test-hubspot-system.yaml'],
            dataSources: ['test-hubspot-datasource-record-storage.yaml']
          })
        })
      );
    });

    it('updates app.key when system.key differs', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        return false;
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        if (p === configPath) {
          return {
            app: { key: appName, type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: []
            }
          };
        }
        return { key: 'hubspot' };
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration(appName);
      expect(result.updated).toBe(true);
      expect(result.appKeyFixed).toBe(true);
      expect(writeYamlPreservingComments).toHaveBeenCalledWith(
        configPath,
        defaultApplicationYamlContent,
        expect.objectContaining({
          app: expect.objectContaining({ key: 'hubspot' })
        })
      );
    });

    it('creates rbac.yaml when missing and system has roles', async() => {
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      existsSyncSpy.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s === configPath || s === appPath) return true;
        if (s.includes('rbac')) return false;
        if (s.endsWith('test-hubspot-system.yaml')) return true;
        return false;
      });
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.yaml',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        if (p === configPath) return { ...mockVariables, externalIntegration: { ...mockVariables.externalIntegration, systems: ['test-hubspot-system.yaml'], dataSources: [] } };
        return { key: appName, roles: [{ name: 'admin' }], permissions: [] };
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'test-hubspot-deploy.json'));

      const result = await repairExternalIntegration(appName);
      expect(result.rbacFileCreated).toBe(true);
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join(appPath, 'rbac.yaml'),
        expect.stringContaining('roles'),
        expect.any(Object)
      );
      writeFileSyncSpy.mockRestore();
    });

    it('throws when app is not external', async() => {
      detectAppType.mockResolvedValue({ appPath, isExternal: false });
      await expect(repairExternalIntegration(appName)).rejects.toThrow('not an external integration');
    });

    it('throws when application config not found', async() => {
      existsSyncSpy.mockReturnValue(false);
      await expect(repairExternalIntegration(appName)).rejects.toThrow('Application config not found');
    });

    it('throws when no system file on disk', async() => {
      existsSyncSpy.mockImplementation((p) => p === configPath || p === appPath);
      readdirSyncSpy.mockReturnValue(['env.template']);
      await expect(repairExternalIntegration(appName)).rejects.toThrow('No system file found');
    });

    it('fixes datasource systemKey when mismatched', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        if (s.endsWith('hubspot-datasource-deals.json')) return true;
        if (s.includes('rbac')) return false;
        return false;
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'hubspot-datasource-deals.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: ['hubspot-datasource-deals.json']
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', displayName: 'HubSpot' };
        }
        if (s.endsWith('hubspot-datasource-deals.json')) {
          return { key: 'deals', systemKey: 'wrong-key', displayName: 'Deals' };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.updated).toBe(true);
      expect(result.datasourceKeysFixed).toBe(true);
      expect(result.changes.some(c =>
        c.includes('hubspot-datasource-deals.json') &&
        c.includes('wrong-key') &&
        c.includes('hubspot')
      )).toBe(true);
      expect(writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'hubspot-datasource-deals.json'),
        expect.objectContaining({ systemKey: 'hubspot' })
      );
    });

    it('dry-run reports datasource systemKey fix but does not write datasource file', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        if (s.endsWith('hubspot-datasource-deals.json')) return true;
        if (s.includes('rbac')) return false;
        return false;
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'hubspot-datasource-deals.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: ['hubspot-datasource-deals.json']
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', displayName: 'HubSpot' };
        }
        if (s.endsWith('hubspot-datasource-deals.json')) {
          return { key: 'deals', systemKey: 'wrong-key', displayName: 'Deals' };
        }
        return {};
      });

      const result = await repairExternalIntegration('test-hubspot', { dryRun: true });

      expect(result.updated).toBe(true);
      expect(result.datasourceKeysFixed).toBe(true);
      expect(result.changes.some(c =>
        c.includes('hubspot-datasource-deals.json') &&
        c.includes('wrong-key') &&
        c.includes('hubspot')
      )).toBe(true);
      const datasourcePath = path.join(appPath, 'hubspot-datasource-deals.json');
      expect(writeConfigFile).not.toHaveBeenCalledWith(
        datasourcePath,
        expect.any(Object)
      );
    });

    it('reports no change when datasource systemKeys already aligned', async() => {
      // rbac must "exist" so createRbacFromSystemIfNeeded skips; system has no roles
      existsSyncSpy.mockImplementation((p) => {
        const base = path.basename(String(p));
        return p === configPath || p === appPath ||
          base === 'test-hubspot-system.json' ||
          base === 'test-hubspot-datasource-record-storage.json' ||
          base === 'rbac.yaml' || base === 'rbac.yml';
      });
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.json',
        'test-hubspot-datasource-record-storage.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const base = path.basename(String(p));
        if (base === 'application.yaml' || base === 'application.json' || base === 'application.yml') {
          return JSON.parse(JSON.stringify(mockVariables));
        }
        if (base === 'test-hubspot-system.json') {
          return { key: appName, displayName: 'Test', dataSources: ['record-storage'] };
        }
        if (base === 'test-hubspot-datasource-record-storage.json') {
          return {
            key: 'record-storage',
            systemKey: appName,
            metadataSchema: { type: 'object', properties: { email: { type: 'string' } } },
            fieldMappings: {
              attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } },
              dimensions: { email: 'metadata.email' }
            }
          };
        }
        return {};
      });

      const result = await repairExternalIntegration(appName);

      expect(result.updated).toBe(false);
      expect(result.datasourceKeysFixed).toBe(false);
      expect(writeConfigFile).not.toHaveBeenCalled();
    });

    it('fixes multiple datasources with mismatched systemKeys', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        if (s.endsWith('hubspot-datasource-deals.json') ||
            s.endsWith('hubspot-datasource-contacts.json')) return true;
        if (s.includes('rbac')) return false;
        return false;
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'hubspot-datasource-deals.json',
        'hubspot-datasource-contacts.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: ['hubspot-datasource-deals.json', 'hubspot-datasource-contacts.json']
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', displayName: 'HubSpot' };
        }
        if (s.endsWith('hubspot-datasource-deals.json')) {
          return { key: 'deals', systemKey: 'wrong-1', displayName: 'Deals' };
        }
        if (s.endsWith('hubspot-datasource-contacts.json')) {
          return { key: 'contacts', systemKey: 'wrong-2', displayName: 'Contacts' };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.updated).toBe(true);
      expect(result.datasourceKeysFixed).toBe(true);
      expect(result.changes.some(c =>
        c.includes('hubspot-datasource-deals.json') && c.includes('wrong-1')
      )).toBe(true);
      expect(result.changes.some(c =>
        c.includes('hubspot-datasource-contacts.json') && c.includes('wrong-2')
      )).toBe(true);
      expect(writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'hubspot-datasource-deals.json'),
        expect.objectContaining({ systemKey: 'hubspot' })
      );
      expect(writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'hubspot-datasource-contacts.json'),
        expect.objectContaining({ systemKey: 'hubspot' })
      );
    });

    it('skips datasource alignment when no datasource files', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') ||
          s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: []
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', displayName: 'HubSpot' };
        }
        return {};
      });

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.datasourceKeysFixed).toBe(false);
    });

    it('creates env.template when missing and system has auth security', async() => {
      const envTemplatePath = path.join(appPath, 'env.template');
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        if (s === envTemplatePath) return false;
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        if (s.includes('rbac')) return false;
        return false;
      });
      readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: []
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return {
            key: 'hubspot',
            displayName: 'HubSpot',
            authentication: {
              method: 'oauth2',
              security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
            },
            configuration: []
          };
        }
        return {};
      });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.envTemplateRepaired).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.changes.some(c => c.includes('env.template') && c.includes('Created'))).toBe(true);
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        envTemplatePath,
        expect.stringContaining('KV_HUBSPOT_CLIENTID=kv://hubspot/clientid'),
        expect.any(Object)
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        envTemplatePath,
        expect.stringContaining('KV_HUBSPOT_CLIENTSECRET=kv://hubspot/clientsecret'),
        expect.any(Object)
      );
      writeFileSyncSpy.mockRestore();
    });

    it('preserves existing env.template key values (does not overwrite)', async() => {
      const envTemplatePath = path.join(appPath, 'env.template');
      const existingContent = 'KV_HUBSPOT_CLIENTID=kv://hubspot-clientidKeyVault\nKV_HUBSPOT_CLIENTSECRET=kv://hubspot-clientsecretKeyVault\n';
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        if (s === envTemplatePath) return true;
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        if (s.includes('rbac')) return false;
        return false;
      });
      const readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((filePath, enc) => {
        if (String(filePath) === envTemplatePath) return existingContent;
        return '';
      });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: []
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return {
            key: 'hubspot',
            authentication: {
              method: 'oauth2',
              security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
            },
            configuration: []
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.envTemplateRepaired).toBe(false);
      const written = writeFileSyncSpy.mock.calls.find(c => c[0] === envTemplatePath);
      expect(written).toBeUndefined();
      readFileSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it('adds missing auth variable to existing env.template', async() => {
      const envTemplatePath = path.join(appPath, 'env.template');
      const contentMissingSecret = 'KV_HUBSPOT_CLIENTID=kv://hubspot/clientid\n';
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        if (s === envTemplatePath) return true;
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        if (s.includes('rbac')) return false;
        return false;
      });
      jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
        if (String(filePath) === envTemplatePath) return contentMissingSecret;
        return '';
      });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: { schemaBasePath: './', systems: ['hubspot-system.yaml'], dataSources: [] }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return {
            key: 'hubspot',
            authentication: {
              method: 'oauth2',
              security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
            },
            configuration: []
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.envTemplateRepaired).toBe(true);
      const written = writeFileSyncSpy.mock.calls.find(c => c[0] === envTemplatePath);
      expect(written[1]).toContain('KV_HUBSPOT_CLIENTSECRET=kv://hubspot/clientsecret');
      writeFileSyncSpy.mockRestore();
    });

    it('dry-run does not write env.template', async() => {
      const envTemplatePath = path.join(appPath, 'env.template');
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        if (s === envTemplatePath) return false;
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        if (s.includes('rbac')) return false;
        return false;
      });
      readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: { schemaBasePath: './', systems: ['hubspot-system.yaml'], dataSources: [] }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return {
            key: 'hubspot',
            authentication: {
              method: 'oauth2',
              security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
            },
            configuration: []
          };
        }
        return {};
      });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      await repairExternalIntegration('test-hubspot', { dryRun: true });

      expect(writeFileSyncSpy).not.toHaveBeenCalledWith(envTemplatePath, expect.any(String), expect.any(Object));
      writeFileSyncSpy.mockRestore();
    });

    it('does not repair or write when env.template already matches system', async() => {
      const envTemplatePath = path.join(appPath, 'env.template');
      const alreadyCorrect = 'KV_HUBSPOT_CLIENTID=kv://hubspot/clientid\nKV_HUBSPOT_CLIENTSECRET=kv://hubspot/clientsecret\n';
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        if (s === envTemplatePath) return true;
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        if (s.includes('rbac')) return false;
        return false;
      });
      jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
        if (String(filePath) === envTemplatePath) return alreadyCorrect;
        return '';
      });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: { schemaBasePath: './', systems: ['hubspot-system.yaml'], dataSources: [] }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return {
            key: 'hubspot',
            authentication: {
              method: 'oauth2',
              security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
            },
            configuration: []
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.envTemplateRepaired).toBe(false);
      const envWrite = writeFileSyncSpy.mock.calls.find(c => c[0] === envTemplatePath);
      expect(envWrite).toBeUndefined();
      writeFileSyncSpy.mockRestore();
    });

    it('includes non-keyvault configuration vars in repaired env.template', async() => {
      const envTemplatePath = path.join(appPath, 'env.template');
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        if (s === envTemplatePath) return false;
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        if (s.includes('rbac')) return false;
        return false;
      });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: { schemaBasePath: './', systems: ['hubspot-system.yaml'], dataSources: [] }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return {
            key: 'hubspot',
            authentication: {
              method: 'oauth2',
              security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
            },
            configuration: [
              { name: 'HUBSPOT_API_VERSION', value: 'v3', location: 'variable' },
              { name: 'MAX_PAGE_SIZE', value: '100', location: 'variable' }
            ]
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.envTemplateRepaired).toBe(true);
      const written = writeFileSyncSpy.mock.calls.find(c => c[0] === envTemplatePath);
      expect(written).toBeDefined();
      expect(written[1]).toContain('KV_HUBSPOT_CLIENTID=kv://hubspot/clientid');
      expect(written[1]).toContain('KV_HUBSPOT_CLIENTSECRET=kv://hubspot/clientsecret');
      expect(written[1]).toContain('HUBSPOT_API_VERSION=v3');
      expect(written[1]).toContain('MAX_PAGE_SIZE=100');
      writeFileSyncSpy.mockRestore();
    });

    it('preserves comments and non-config lines when repairing env.template', async() => {
      const envTemplatePath = path.join(appPath, 'env.template');
      const contentWithComment = '# My comment\nKV_HUBSPOT_CLIENTID=kv://wrong\nCUSTOM_VAR=keep-me\n';
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        if (s === envTemplatePath) return true;
        if (s === configPath || s === appPath) return true;
        if (s.endsWith('hubspot-system.yaml')) return true;
        if (s.includes('rbac')) return false;
        return false;
      });
      jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
        if (String(filePath) === envTemplatePath) return contentWithComment;
        return '';
      });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: { schemaBasePath: './', systems: ['hubspot-system.yaml'], dataSources: [] }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return {
            key: 'hubspot',
            authentication: {
              method: 'oauth2',
              security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
            },
            configuration: []
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      await repairExternalIntegration('test-hubspot');

      const written = writeFileSyncSpy.mock.calls.find(c => c[0] === envTemplatePath);
      expect(written).toBeDefined();
      expect(written[1]).toContain('# My comment');
      expect(written[1]).toContain('CUSTOM_VAR=keep-me');
      expect(written[1]).toContain('KV_HUBSPOT_CLIENTID=kv://wrong');
      expect(written[1]).toContain('KV_HUBSPOT_CLIENTSECRET=kv://hubspot/clientsecret');
      writeFileSyncSpy.mockRestore();
    });

    describe('repair --auth option', () => {
      beforeEach(() => {
        buildAuthenticationFromMethod.mockImplementation((systemKey, method) => {
          if (method === 'apikey') {
            return { method: 'apikey', variables: { baseUrl: 'https://api.example.com' }, security: { apiKey: `kv://${systemKey}/apikey` } };
          }
          if (method === 'oauth2') {
            return {
              method: 'oauth2',
              variables: { baseUrl: 'https://api.example.com', tokenUrl: 'https://api.example.com/oauth/token' },
              security: { clientId: `kv://${systemKey}/clientid`, clientSecret: `kv://${systemKey}/clientsecret` }
            };
          }
          return { method, variables: {}, security: {} };
        });
      });

      it('updates system file to apikey and env.template has KV_* for apikey when started as oauth2', async() => {
        const envTemplatePath = path.join(appPath, 'env.template');
        existsSyncSpy.mockImplementation((p) => {
          const s = String(p);
          if (s === envTemplatePath) return false;
          if (s === configPath || s === appPath) return true;
          if (s.endsWith('hubspot-system.yaml')) return true;
          if (s.includes('rbac')) return false;
          return false;
        });
        const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
        loadConfigFile.mockImplementation((p) => {
          const s = String(p);
          if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
            return {
              app: { key: 'hubspot', type: 'external' },
              externalIntegration: { schemaBasePath: './', systems: ['hubspot-system.yaml'], dataSources: [] }
            };
          }
          if (s.endsWith('hubspot-system.yaml')) {
            return {
              key: 'hubspot',
              authentication: {
                method: 'oauth2',
                security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
              },
              configuration: []
            };
          }
          return {};
        });
        generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

        const result = await repairExternalIntegration('test-hubspot', { auth: 'apikey' });

        expect(result.updated).toBe(true);
        expect(result.changes.some(c => c.includes('Set authentication method to apikey'))).toBe(true);
        expect(buildAuthenticationFromMethod).toHaveBeenCalledWith('hubspot', 'apikey');
        const systemWrite = writeConfigFile.mock.calls.find(c => c[0].endsWith('hubspot-system.yaml'));
        expect(systemWrite).toBeDefined();
        expect(systemWrite[1].authentication.method).toBe('apikey');
        expect(systemWrite[1].authentication.security.apiKey).toContain('kv://hubspot/apikey');
        const envWrite = writeFileSyncSpy.mock.calls.find(c => c[0] === envTemplatePath);
        expect(envWrite).toBeDefined();
        expect(envWrite[1]).toContain('KV_HUBSPOT_APIKEY=');
        expect(envWrite[1]).not.toMatch(/KV_HUBSPOT_CLIENTID|KV_HUBSPOT_CLIENTSECRET/);
        writeFileSyncSpy.mockRestore();
      });

      it('updates system file to oauth2 and env.template has CLIENTID/CLIENTSECRET', async() => {
        const envTemplatePath = path.join(appPath, 'env.template');
        existsSyncSpy.mockImplementation((p) => {
          const s = String(p);
          if (s === envTemplatePath) return false;
          if (s === configPath || s === appPath) return true;
          if (s.endsWith('hubspot-system.yaml')) return true;
          if (s.includes('rbac')) return false;
          return false;
        });
        const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
        loadConfigFile.mockImplementation((p) => {
          const s = String(p);
          if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
            return {
              app: { key: 'hubspot', type: 'external' },
              externalIntegration: { schemaBasePath: './', systems: ['hubspot-system.yaml'], dataSources: [] }
            };
          }
          if (s.endsWith('hubspot-system.yaml')) {
            return {
              key: 'hubspot',
              authentication: { method: 'apikey', security: { apiKey: 'kv://hubspot/apikey' } },
              configuration: []
            };
          }
          return {};
        });
        generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

        const result = await repairExternalIntegration('test-hubspot', { auth: 'oauth2' });

        expect(result.updated).toBe(true);
        expect(result.changes.some(c => c.includes('Set authentication method to oauth2'))).toBe(true);
        expect(buildAuthenticationFromMethod).toHaveBeenCalledWith('hubspot', 'oauth2');
        const envWrite = writeFileSyncSpy.mock.calls.find(c => c[0] === envTemplatePath);
        expect(envWrite).toBeDefined();
        expect(envWrite[1]).toContain('KV_HUBSPOT_CLIENTID=');
        expect(envWrite[1]).toContain('KV_HUBSPOT_CLIENTSECRET=');
        writeFileSyncSpy.mockRestore();
      });

      it('throws when --auth is invalid with message listing allowed methods', async() => {
        existsSyncSpy.mockImplementation((p) => p === configPath || p === appPath || String(p).endsWith('hubspot-system.yaml'));
        readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
        loadConfigFile.mockImplementation((p) => {
          const s = String(p);
          if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
            return { app: { key: 'hubspot' }, externalIntegration: { systems: ['hubspot-system.yaml'], dataSources: [] } };
          }
          return { key: 'hubspot' };
        });

        await expect(repairExternalIntegration('test-hubspot', { auth: 'invalid' }))
          .rejects.toThrow(/Invalid --auth "invalid". Allowed methods: oauth2, aad, apikey/);
        expect(buildAuthenticationFromMethod).not.toHaveBeenCalled();
      });

      it('dry-run with --auth reports change but does not write files', async() => {
        existsSyncSpy.mockImplementation((p) => {
          const s = String(p);
          return s === configPath || s === appPath || s.endsWith('hubspot-system.yaml') || s.includes('rbac');
        });
        readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
        loadConfigFile.mockImplementation((p) => {
          const s = String(p);
          if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
            return {
              app: { key: 'hubspot', type: 'external' },
              externalIntegration: { schemaBasePath: './', systems: ['hubspot-system.yaml'], dataSources: [] }
            };
          }
          if (s.endsWith('hubspot-system.yaml')) {
            return {
              key: 'hubspot',
              authentication: { method: 'oauth2', security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' } },
              configuration: []
            };
          }
          return {};
        });

        const result = await repairExternalIntegration('test-hubspot', { auth: 'apikey', dryRun: true });

        expect(result.updated).toBe(true);
        expect(result.changes.some(c => c.includes('Set authentication method to apikey'))).toBe(true);
        expect(buildAuthenticationFromMethod).toHaveBeenCalledWith('hubspot', 'apikey');
        expect(writeConfigFile).not.toHaveBeenCalled();
        expect(generator.generateDeployJson).not.toHaveBeenCalled();
      });
    });

    it('normalizes datasource key and filename when key has redundant -datasource', async() => {
      const oldFileName = 'hubspot-demo-datasource-companies-datasource.json';
      const newFileName = 'hubspot-demo-datasource-companies.json';
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-demo-system.yaml') ||
          s.endsWith(oldFileName) ||
          s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-demo-system.yaml',
        oldFileName,
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot-demo', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-demo-system.yaml'],
              dataSources: [oldFileName]
            }
          };
        }
        if (s.endsWith('hubspot-demo-system.yaml')) {
          return { key: 'hubspot-demo', displayName: 'HubSpot Demo', dataSources: [] };
        }
        if (s.endsWith(oldFileName)) {
          return {
            key: 'hubspot-demo-companies-datasource',
            systemKey: 'hubspot-demo',
            displayName: 'Companies'
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-demo-deploy.json'));

      const result = await repairExternalIntegration('hubspot-demo');

      expect(result.updated).toBe(true);
      expect(result.changes.some(c => c.includes('key → hubspot-demo-companies'))).toBe(true);
      expect(result.changes.some(c => c.includes('Renamed') && c.includes(newFileName))).toBe(true);
      expect(writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, oldFileName),
        expect.objectContaining({ key: 'hubspot-demo-companies' })
      );
      expect(renameSyncSpy).toHaveBeenCalledWith(
        path.join(appPath, oldFileName),
        path.join(appPath, newFileName)
      );
    });

    it('does not change key or filename when already canonical (e.g. systemKey-resourceType-extra)', async() => {
      const canonicalFileName = 'hubspot-demo-datasource-customer-extra.json';
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-demo-system.yaml') ||
          s.endsWith(canonicalFileName) ||
          s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-demo-system.yaml',
        canonicalFileName,
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot-demo', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-demo-system.yaml'],
              dataSources: [canonicalFileName]
            }
          };
        }
        if (s.endsWith('hubspot-demo-system.yaml')) {
          return { key: 'hubspot-demo', displayName: 'HubSpot Demo', dataSources: [] };
        }
        if (s.endsWith(canonicalFileName)) {
          return {
            key: 'hubspot-demo-customer-extra',
            systemKey: 'hubspot-demo',
            displayName: 'Customer Extra'
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-demo-deploy.json'));

      const result = await repairExternalIntegration('hubspot-demo');

      expect(result.changes.some(c => c.includes('key →') && c.includes('customer-extra'))).toBe(false);
      expect(result.changes.some(c => c.includes('Renamed') && c.includes('customer-extra'))).toBe(false);
      expect(renameSyncSpy).not.toHaveBeenCalled();
    });

    it('continues when manifest regeneration fails', async() => {
      loadConfigFile.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return JSON.parse(JSON.stringify({
            ...mockVariables,
            externalIntegration: {
              ...mockVariables.externalIntegration,
              systems: ['test-hubspot-system.json'],
              dataSources: ['test-hubspot-datasource-record-storage.json']
            }
          }));
        }
        return { key: appName };
      });
      existsSyncSpy.mockImplementation((p) => {
        const s = typeof p === 'string' ? p : '';
        return s === configPath || s === appPath || s.endsWith('test-hubspot-system.yaml');
      });
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.yaml',
        'test-hubspot-datasource-record-storage.yaml',
        'application.yaml'
      ]);
      generator.generateDeployJson.mockRejectedValue(new Error('Manifest failed'));

      const result = await repairExternalIntegration(appName);
      expect(writeYamlPreservingComments).toHaveBeenCalled();
      expect(result.manifestRegenerated).toBe(false);
    });

    it('aligns system file dataSources when new datasource file is discovered', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') ||
          s.endsWith('hubspot-datasource-deals.json') ||
          s.endsWith('hubspot-datasource-contacts.json') ||
          s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'hubspot-datasource-deals.json',
        'hubspot-datasource-contacts.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: ['hubspot-datasource-deals.json', 'hubspot-datasource-contacts.json']
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', displayName: 'HubSpot', dataSources: [] };
        }
        if (s.endsWith('hubspot-datasource-deals.json')) {
          return { key: 'deals', systemKey: 'hubspot' };
        }
        if (s.endsWith('hubspot-datasource-contacts.json')) {
          return { key: 'contacts', systemKey: 'hubspot' };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.updated).toBe(true);
      expect(result.changes.some(c => c.includes('dataSources') && c.includes('deals') && c.includes('contacts'))).toBe(true);
      const systemPath = path.join(appPath, 'hubspot-system.yaml');
      expect(writeConfigFile).toHaveBeenCalledWith(
        systemPath,
        expect.objectContaining({ dataSources: ['contacts', 'deals'] })
      );
    });

    it('aligns system file dataSources when datasource file is removed from disk', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') ||
          s.endsWith('hubspot-datasource-deals.json') ||
          s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'hubspot-datasource-deals.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: ['hubspot-datasource-deals.json']
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', displayName: 'HubSpot', dataSources: ['deals', 'contacts'] };
        }
        if (s.endsWith('hubspot-datasource-deals.json')) {
          return { key: 'deals', systemKey: 'hubspot' };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.updated).toBe(true);
      expect(result.changes.some(c => c.includes('dataSources') && c.includes('deals'))).toBe(true);
      expect(writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'hubspot-system.yaml'),
        expect.objectContaining({ dataSources: ['deals'] })
      );
    });

    it('dry-run reports system dataSources sync but does not write system file', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') ||
          s.endsWith('hubspot-datasource-deals.json') || s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'hubspot-datasource-deals.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: ['hubspot-datasource-deals.json']
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', dataSources: [] };
        }
        if (s.endsWith('hubspot-datasource-deals.json')) {
          return { key: 'deals', systemKey: 'hubspot' };
        }
        return {};
      });

      const result = await repairExternalIntegration('test-hubspot', { dryRun: true });

      expect(result.updated).toBe(true);
      expect(result.changes.some(c => c.includes('dataSources'))).toBe(true);
      expect(writeConfigFile).not.toHaveBeenCalledWith(
        path.join(appPath, 'hubspot-system.yaml'),
        expect.any(Object)
      );
    });

    it('removes authentication variable from configuration when duplicated from auth.variables', async() => {
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') || s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: []
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return {
            key: 'hubspot',
            authentication: {
              method: 'oauth2',
              variables: { baseUrl: 'https://api.hubspot.com', tokenUrl: 'https://token' },
              security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
            },
            configuration: [
              { name: 'HUBSPOT_API_VERSION', value: 'v3', location: 'variable' },
              { name: 'BASEURL', value: 'https://api.hubspot.com', location: 'variable' }
            ]
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.updated).toBe(true);
      expect(result.changes.some(c => c.includes('Removed authentication variable') && c.includes('BASEURL'))).toBe(true);
      expect(writeConfigFile).toHaveBeenCalledWith(
        path.join(appPath, 'hubspot-system.yaml'),
        expect.objectContaining({
          configuration: expect.arrayContaining([
            expect.objectContaining({ name: 'HUBSPOT_API_VERSION' })
          ])
        })
      );
      const written = writeConfigFile.mock.calls.find(c => c[0].endsWith('hubspot-system.yaml'));
      const configNames = written[1].configuration.map(e => e.name);
      expect(configNames).not.toContain('BASEURL');
      writeFileSyncSpy.mockRestore();
    });

    it('removes keyvault auth entries from configuration (supplied from credential at runtime)', async() => {
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') || s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: []
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return {
            key: 'hubspot',
            authentication: {
              method: 'oauth2',
              security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
            },
            configuration: [
              { name: 'KV_HUBSPOT_CLIENTID', value: 'hubspot/clientid', location: 'keyvault' },
              { name: 'KV_HUBSPOT_CLIENTSECRET', value: 'hubspot/clientsecret', location: 'keyvault' }
            ]
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.updated).toBe(true);
      expect(result.changes.some(c => c.includes('Removed authentication variable') && c.includes('KV_HUBSPOT_CLIENTID'))).toBe(true);
      const written = writeConfigFile.mock.calls.find(c => c[0].endsWith('hubspot-system.yaml'));
      expect(written).toBeDefined();
      const configNames = written[1].configuration.map(e => e.name);
      expect(configNames).not.toContain('KV_HUBSPOT_CLIENTID');
      expect(configNames).not.toContain('KV_HUBSPOT_CLIENTSECRET');
      writeFileSyncSpy.mockRestore();
    });

    it('does not remove configuration when no auth dupes present', async() => {
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') || s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue(['hubspot-system.yaml', 'application.yaml']);
      const systemConfig = {
        key: 'hubspot',
        authentication: {
          method: 'oauth2',
          security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
        },
        configuration: [
          { name: 'HUBSPOT_API_VERSION', value: 'v3', location: 'variable' },
          { name: 'MAX_PAGE_SIZE', value: '100', location: 'variable' }
        ]
      };
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: []
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { ...systemConfig };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      const written = writeConfigFile.mock.calls.find(c => c[0].endsWith('hubspot-system.yaml'));
      expect(written).toBeUndefined();
      writeFileSyncSpy.mockRestore();
    });

    it('repairs datasource dimensions and metadataSchema and writes datasource file', async() => {
      const dsPath = path.join(appPath, 'hubspot-datasource-contact.json');
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') || s.endsWith('hubspot-datasource-contact.json') ||
          s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'hubspot-datasource-contact.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: ['hubspot-datasource-contact.json']
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', displayName: 'HubSpot', dataSources: ['hubspot-contact'] };
        }
        if (s.endsWith('hubspot-datasource-contact.json')) {
          return {
            key: 'hubspot-contact',
            systemKey: 'hubspot',
            fieldMappings: {
              attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } },
              dimensions: { email: 'metadata.email', country: 'metadata.country' }
            }
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      const result = await repairExternalIntegration('test-hubspot');

      expect(result.updated).toBe(true);
      const dsWrite = writeConfigFile.mock.calls.find(c => c[0] === dsPath);
      expect(dsWrite).toBeDefined();
      expect(dsWrite[1].fieldMappings.dimensions).not.toHaveProperty('country');
      expect(dsWrite[1].fieldMappings.dimensions.email).toBe('metadata.email');
      expect(dsWrite[1].metadataSchema).toBeDefined();
      expect(dsWrite[1].metadataSchema.type).toBe('object');
    });

    it('with --expose sets exposed.attributes on datasource', async() => {
      const dsPath = path.join(appPath, 'hubspot-datasource-contact.json');
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') || s.endsWith('hubspot-datasource-contact.json') ||
          s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'hubspot-datasource-contact.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: ['hubspot-datasource-contact.json']
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', displayName: 'HubSpot', dataSources: ['hubspot-contact'] };
        }
        if (s.endsWith('hubspot-datasource-contact.json')) {
          return {
            key: 'hubspot-contact',
            systemKey: 'hubspot',
            fieldMappings: {
              attributes: { email: { expression: '{{ metadata.email }}', type: 'string' }, name: {} },
              dimensions: { email: 'metadata.email' }
            }
          };
        }
        return {};
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      await repairExternalIntegration('test-hubspot', { expose: true });

      const dsWrite = writeConfigFile.mock.calls.find(c => c[0] === dsPath);
      expect(dsWrite).toBeDefined();
      expect(dsWrite[1].exposed).toBeDefined();
      expect(dsWrite[1].exposed.attributes).toEqual(expect.arrayContaining(['email', 'name']));
    });

    it('with --rbac adds permissions and default Admin/Reader roles to rbac.yaml', async() => {
      const rbacPath = path.join(appPath, 'rbac.yaml');
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('rbac.yaml') || s.endsWith('rbac.yml')) return false;
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') || s.endsWith('hubspot-datasource-contact.json');
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'hubspot-datasource-contact.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: ['hubspot-datasource-contact.json']
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', displayName: 'HubSpot', dataSources: ['hubspot-contact'] };
        }
        if (s.endsWith('hubspot-datasource-contact.json')) {
          return {
            key: 'hubspot-contact',
            systemKey: 'hubspot',
            resourceType: 'contact',
            capabilities: ['list', 'get'],
            fieldMappings: { attributes: { email: {} }, dimensions: {} }
          };
        }
        return {};
      });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'hubspot-deploy.json'));

      await repairExternalIntegration('test-hubspot', { rbac: true });

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        rbacPath,
        expect.stringContaining('contact:list'),
        expect.any(Object)
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        rbacPath,
        expect.stringContaining('contact:get'),
        expect.any(Object)
      );
      const yamlContent = writeFileSyncSpy.mock.calls.find(c => c[0] === rbacPath)[1];
      expect(yamlContent).toMatch(/Admin|Reader|roles|permissions/);
      writeFileSyncSpy.mockRestore();
    });

    it('dry-run does not write datasource or rbac when repair would change them', async() => {
      const dsPath = path.join(appPath, 'hubspot-datasource-contact.json');
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('hubspot-system.yaml') || s.endsWith('hubspot-datasource-contact.json') ||
          s.includes('rbac');
      });
      readdirSyncSpy.mockReturnValue([
        'hubspot-system.yaml',
        'hubspot-datasource-contact.json',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        const s = String(p);
        if (s.endsWith('application.yaml') || s.endsWith('application.json')) {
          return {
            app: { key: 'hubspot', type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['hubspot-system.yaml'],
              dataSources: ['hubspot-datasource-contact.json']
            }
          };
        }
        if (s.endsWith('hubspot-system.yaml')) {
          return { key: 'hubspot', displayName: 'HubSpot', dataSources: ['hubspot-contact'] };
        }
        if (s.endsWith('hubspot-datasource-contact.json')) {
          return {
            key: 'hubspot-contact',
            systemKey: 'hubspot',
            fieldMappings: {
              attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } },
              dimensions: { country: 'metadata.country' }
            }
          };
        }
        return {};
      });

      const result = await repairExternalIntegration('test-hubspot', { dryRun: true, expose: true });

      expect(result.updated).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0);
      const dsWrite = writeConfigFile.mock.calls.find(c => c[0] === dsPath);
      expect(dsWrite).toBeUndefined();
      expect(generator.generateDeployJson).not.toHaveBeenCalled();
    });
  });
});
