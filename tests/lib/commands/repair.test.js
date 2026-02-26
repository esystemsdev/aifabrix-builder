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
  writeConfigFile: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/generator', () => ({
  generateDeployJson: jest.fn()
}));

const { detectAppType } = require('../../../lib/utils/paths');
const { resolveApplicationConfigPath } = require('../../../lib/utils/app-config-resolver');
const { loadConfigFile, writeConfigFile } = require('../../../lib/utils/config-format');
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

  let readdirSyncSpy;
  let existsSyncSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    detectAppType.mockResolvedValue({ appPath, isExternal: true });
    resolveApplicationConfigPath.mockReturnValue(configPath);
    loadConfigFile.mockImplementation((p) => {
      const s = typeof p === 'string' ? p : '';
      if (s.endsWith('application.yaml') || s.endsWith('application.json') || s.endsWith('application.yml')) {
        return JSON.parse(JSON.stringify(mockVariables));
      }
      return { key: appName };
    });
    readdirSyncSpy = jest.spyOn(fs, 'readdirSync');
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
  });

  afterEach(() => {
    readdirSyncSpy?.mockRestore();
    existsSyncSpy?.mockRestore();
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
  });

  describe('repairExternalIntegration', () => {
    it('does not write when no changes needed', async() => {
      existsSyncSpy.mockImplementation((p) => {
        const s = String(p);
        return s === configPath || s === appPath ||
          s.endsWith('test-hubspot-system.json') || s.endsWith('rbac.yaml') || s.endsWith('rbac.yml');
      });
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.json',
        'test-hubspot-datasource-record-storage.json',
        'application.yaml'
      ]);

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
        return false;
      });
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.yaml',
        'test-hubspot-datasource-record-storage.yaml',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        if (p === configPath) return JSON.parse(JSON.stringify(mockVariables));
        return { key: appName };
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'test-hubspot-deploy.json'));

      const result = await repairExternalIntegration(appName);
      expect(result.updated).toBe(true);
      expect(result.systemFiles).toEqual(['test-hubspot-system.yaml']);
      expect(result.datasourceFiles).toEqual(['test-hubspot-datasource-record-storage.yaml']);
      expect(writeConfigFile).toHaveBeenCalledWith(
        configPath,
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
        return false;
      });
      readdirSyncSpy.mockReturnValue([
        'test-hubspot-system.yaml',
        'test-hubspot-datasource-record-storage.yaml',
        'application.yaml'
      ]);
      loadConfigFile.mockImplementation((p) => {
        if (p === configPath) return { app: { key: appName } };
        return { key: appName };
      });
      generator.generateDeployJson.mockResolvedValue(path.join(appPath, 'test-hubspot-deploy.json'));

      const result = await repairExternalIntegration(appName);
      expect(result.updated).toBe(true);
      expect(result.changes.some(c => c.includes('externalIntegration'))).toBe(true);
      expect(writeConfigFile).toHaveBeenCalledWith(
        configPath,
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
      expect(writeConfigFile).toHaveBeenCalledWith(
        configPath,
        expect.objectContaining({
          app: expect.objectContaining({ key: 'hubspot' })
        })
      );
    });

    it('creates rbac.yaml when missing and system has roles', async() => {
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');
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
          return { key: appName, displayName: 'Test' };
        }
        if (base === 'test-hubspot-datasource-record-storage.json') {
          return { key: 'record-storage', systemKey: appName };
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
      expect(writeConfigFile).toHaveBeenCalled();
      expect(result.manifestRegenerated).toBe(false);
    });
  });
});
