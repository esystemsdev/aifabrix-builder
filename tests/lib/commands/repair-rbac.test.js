/**
 * Tests for repair-rbac helpers
 *
 * @fileoverview Unit tests for lib/commands/repair-rbac.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn(),
  writeConfigFile: jest.fn()
}));

const { loadConfigFile, writeConfigFile } = require('../../../lib/utils/config-format');
const appConfigResolver = require('../../../lib/utils/app-config-resolver');
const {
  getCapabilitiesFromDatasource,
  mergeRbacFromDatasources
} = require('../../../lib/commands/repair-rbac');
const { migrateSystemRbacIntoRbacFile } = require('../../../lib/commands/repair-rbac-migrate');
const { extractRbacFromSystem } = require('../../../lib/commands/repair-rbac-extract');

describe('repair-rbac', () => {
  describe('getCapabilitiesFromDatasource', () => {
    it('returns array of capabilities when capabilities is array', () => {
      const parsed = { capabilities: ['list', 'get', 'create'] };
      expect(getCapabilitiesFromDatasource(parsed)).toEqual(['list', 'get', 'create']);
    });

    it('filters non-strings when capabilities is array', () => {
      const parsed = { capabilities: ['list', 1, null, 'get'] };
      expect(getCapabilitiesFromDatasource(parsed)).toEqual(['list', 'get']);
    });

    it('returns capability keys where value is true when capabilities is object', () => {
      const parsed = { capabilities: { list: true, get: true, create: false } };
      expect(getCapabilitiesFromDatasource(parsed)).toEqual(['list', 'get']);
    });

    it('returns default capabilities when capabilities missing', () => {
      const parsed = { resourceType: 'contact' };
      expect(getCapabilitiesFromDatasource(parsed)).toEqual([
        'list', 'get', 'create', 'update', 'delete'
      ]);
    });

    it('returns default when capabilities is empty array', () => {
      const parsed = { capabilities: [] };
      expect(getCapabilitiesFromDatasource(parsed)).toEqual([
        'list', 'get', 'create', 'update', 'delete'
      ]);
    });

    it('returns default when capabilities is empty object', () => {
      const parsed = { capabilities: {} };
      expect(getCapabilitiesFromDatasource(parsed)).toEqual([
        'list', 'get', 'create', 'update', 'delete'
      ]);
    });
  });

  describe('mergeRbacFromDatasources', () => {
    const appPath = path.join(process.cwd(), 'integration', 'hubspot');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns false when no permission names collected (no datasource files)', () => {
      const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const changes = [];
      const result = mergeRbacFromDatasources(appPath, {}, [], () => null, { format: 'yaml', dryRun: false, changes });
      expect(result).toBe(false);
      expect(changes).toHaveLength(0);
      existsSyncSpy.mockRestore();
    });

    it('does not change RBAC when datasource has autoRbac=false', () => {
      const rbacJsonPath = path.join(appPath, 'rbac.json');
      const dsPath = path.join(appPath, 'hubspot-datasource-contact.json');
      const existingRbac = {
        roles: [{ name: 'Admin', value: 'hubspot-admin', description: 'Admin', groups: [] }],
        permissions: [{ name: 'contact:list', roles: ['hubspot-admin'], description: 'List' }]
      };
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const s = String(p);
        return s === rbacJsonPath || s === dsPath;
      });
      loadConfigFile.mockImplementation((p) => {
        if (p === rbacJsonPath) return existingRbac;
        if (p === dsPath) return { resourceType: 'contact', openapi: { autoRbac: false, operations: { list: {} } } };
        return {};
      });

      const changes = [];
      const result = mergeRbacFromDatasources(
        appPath,
        { key: 'hubspot', displayName: 'HubSpot' },
        ['hubspot-datasource-contact.json'],
        () => null,
        { format: 'yaml', dryRun: false, changes }
      );
      expect(result).toBe(false);
      expect(changes).toEqual([]);
      expect(writeConfigFile).not.toHaveBeenCalled();
    });

    it('writes back to rbac.json when existing file is rbac.json (preserves format)', () => {
      const rbacJsonPath = path.join(appPath, 'rbac.json');
      const dsPath = path.join(appPath, 'hubspot-datasource-contact.json');
      const existingRbac = {
        roles: [{ name: 'Admin', value: 'hubspot-admin', description: 'Admin', groups: [] }],
        permissions: [{ name: 'contact:list', roles: ['hubspot-admin'], description: 'List' }]
      };
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const s = String(p);
        return s === rbacJsonPath || s === dsPath;
      });
      loadConfigFile.mockImplementation((p) => {
        if (p === rbacJsonPath) return existingRbac;
        if (p === dsPath) {
          return { resourceType: 'contact', openapi: { autoRbac: true, operations: { list: {}, get: {} } } };
        }
        return {};
      });
      writeConfigFile.mockImplementation(() => {});
      const changes = [];

      const result = mergeRbacFromDatasources(
        appPath,
        { key: 'hubspot', displayName: 'HubSpot' },
        ['hubspot-datasource-contact.json'],
        () => null,
        { format: 'yaml', dryRun: false, changes }
      );

      expect(result).toBe(true);
      expect(writeConfigFile).toHaveBeenCalledWith(rbacJsonPath, expect.any(Object));
      expect(writeConfigFile.mock.calls[0][0]).toBe(rbacJsonPath);
    });

    it('adds missing permissions to existing rbac and does not add roles when roles exist', () => {
      const rbacPath = path.join(appPath, 'rbac.yaml');
      const existingRbac = {
        roles: [{ name: 'Admin', value: 'hubspot-admin', description: 'Admin', groups: [] }],
        permissions: [{ name: 'contact:list', roles: ['hubspot-admin'], description: 'List' }]
      };
      const dsPath = path.join(appPath, 'hubspot-datasource-contact.json');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const s = String(p);
        return s === rbacPath || s === dsPath;
      });
      loadConfigFile.mockImplementation((p) => {
        if (p === rbacPath) return existingRbac;
        if (p === dsPath) {
          return { resourceType: 'contact', openapi: { autoRbac: true, operations: { list: {}, get: {} } } };
        }
        return {};
      });
      writeConfigFile.mockImplementation(() => {});
      const changes = [];

      const result = mergeRbacFromDatasources(
        appPath,
        { key: 'hubspot', displayName: 'HubSpot' },
        ['hubspot-datasource-contact.json'],
        () => null,
        { format: 'yaml', dryRun: false, changes }
      );

      expect(result).toBe(true);
      expect(existingRbac.permissions).toHaveLength(2);
      expect(existingRbac.permissions.map(pr => pr.name).sort()).toEqual(['contact:get', 'contact:list']);
      expect(changes.some(c => c.includes('Added RBAC permission: contact:get'))).toBe(true);
      expect(changes.some(c => c.includes('Admin and Reader'))).toBe(false);
      expect(writeConfigFile).toHaveBeenCalledWith(rbacPath, expect.objectContaining({ roles: expect.any(Array), permissions: expect.any(Array) }));
    });

    it('keeps manual RBAC role mappings when autoRbac is true (does not overwrite existing roles/desc)', () => {
      const rbacPath = path.join(appPath, 'rbac.json');
      const existingRbac = {
        roles: [
          { name: 'Admin', value: 'hubspot-admin', description: 'Admin', groups: [] },
          { name: 'Reader', value: 'hubspot-reader', description: 'Reader', groups: [] }
        ],
        permissions: [
          { name: 'companies:list', roles: ['hubspot-reader'], description: 'custom-desc' }
        ]
      };
      const dsPath = path.join(appPath, 'hubspot-datasource-companies.json');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const s = String(p);
        return s === rbacPath || s === dsPath;
      });
      loadConfigFile.mockImplementation((p) => {
        if (p === rbacPath) return existingRbac;
        if (p === dsPath) {
          return { resourceType: 'companies', openapi: { autoRbac: true, operations: { list: {}, get: {} } } };
        }
        return {};
      });
      writeConfigFile.mockImplementation(() => {});
      const changes = [];

      const result = mergeRbacFromDatasources(
        appPath,
        { key: 'hubspot', displayName: 'HubSpot' },
        ['hubspot-datasource-companies.json'],
        () => null,
        { format: 'json', dryRun: false, changes }
      );

      expect(result).toBe(true);
      const companiesList = existingRbac.permissions.find(p => p.name === 'companies:list');
      const companiesGet = existingRbac.permissions.find(p => p.name === 'companies:get');
      expect(companiesList.roles).toEqual(['hubspot-reader']);
      expect(companiesList.description).toBe('custom-desc');
      expect(companiesGet.roles).toEqual(expect.arrayContaining(['hubspot-reader', 'hubspot-admin']));
    });

    it('renames permissions when operation key is renamed (kebab alias -> canonical)', () => {
      const rbacJsonPath = path.join(appPath, 'rbac.json');
      const dsPath = path.join(appPath, 'hubspot-datasource-companies.json');
      const existingRbac = {
        roles: [{ name: 'Admin', value: 'hubspot-admin', description: 'Admin', groups: [] }],
        permissions: [{ name: 'companies:createbasic', roles: ['hubspot-admin'], description: 'keep-me' }]
      };
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const s = String(p);
        return s === rbacJsonPath || s === dsPath;
      });
      loadConfigFile.mockImplementation((p) => {
        if (p === rbacJsonPath) return existingRbac;
        if (p === dsPath) return { resourceType: 'companies', openapi: { autoRbac: true, operations: { createBasic: {} } } };
        return {};
      });
      writeConfigFile.mockImplementation(() => {});
      const changes = [];
      const result = mergeRbacFromDatasources(
        appPath,
        { key: 'hubspot', displayName: 'HubSpot' },
        ['hubspot-datasource-companies.json'],
        () => null,
        { format: 'json', dryRun: false, changes }
      );
      expect(result).toBe(true);
      expect(existingRbac.permissions.some(p => p.name === 'companies:create-basic')).toBe(true);
      expect(existingRbac.permissions.some(p => p.description === 'keep-me')).toBe(true);
      expect(changes.some(c => c.includes('Renamed RBAC permission'))).toBe(true);
    });

    it('adds new permissions for new operations and removes extras for deleted operations', () => {
      const rbacPath = path.join(appPath, 'rbac.yaml');
      const dsPath = path.join(appPath, 'hubspot-datasource-companies.json');
      const existingRbac = {
        roles: [{ name: 'Admin', value: 'hubspot-admin', description: 'Admin', groups: [] }],
        permissions: [
          { name: 'companies:list', roles: ['hubspot-admin'], description: 'List' },
          { name: 'companies:oldop', roles: ['hubspot-admin'], description: 'Old' }
        ]
      };
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const s = String(p);
        return s === rbacPath || s === dsPath;
      });
      loadConfigFile.mockImplementation((p) => {
        if (p === rbacPath) return existingRbac;
        if (p === dsPath) return { resourceType: 'companies', openapi: { autoRbac: true, operations: { list: {}, newOp: {} } } };
        return {};
      });
      writeConfigFile.mockImplementation(() => {});
      const changes = [];
      const result = mergeRbacFromDatasources(
        appPath,
        { key: 'hubspot', displayName: 'HubSpot' },
        ['hubspot-datasource-companies.json'],
        () => null,
        { format: 'yaml', dryRun: false, changes }
      );
      expect(result).toBe(true);
      expect(existingRbac.permissions.some(p => p.name === 'companies:new-op')).toBe(true);
      expect(existingRbac.permissions.some(p => p.name === 'companies:oldop')).toBe(false);
      expect(changes.some(c => c.includes('Removed'))).toBe(true);
    });

    it('creates rbac.json when no rbac file exists and format is json', () => {
      const rbacJsonPath = path.join(appPath, 'rbac.json');
      const dsPath = path.join(appPath, 'hubspot-datasource-contact.json');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const s = String(p);
        return s === dsPath;
      });
      loadConfigFile.mockImplementation((p) => {
        if (p === dsPath) {
          return { resourceType: 'contact', openapi: { autoRbac: true, operations: { list: {}, get: {} } } };
        }
        return {};
      });
      writeConfigFile.mockImplementation(() => {});

      const changes = [];
      const result = mergeRbacFromDatasources(
        appPath,
        { key: 'hubspot', displayName: 'HubSpot' },
        ['hubspot-datasource-contact.json'],
        () => null,
        { format: 'json', dryRun: false, changes }
      );

      expect(result).toBe(true);
      expect(writeConfigFile).toHaveBeenCalledWith(rbacJsonPath, expect.any(Object));
      expect(writeConfigFile.mock.calls[0][0]).toBe(rbacJsonPath);
      const writtenObj = writeConfigFile.mock.calls[0][1];
      expect(writtenObj.permissions.some(p => p.name === 'contact:list')).toBe(true);
      expect(writtenObj.permissions.some(p => p.name === 'contact:get')).toBe(true);
    });

    it('creates rbac with permissions and default Admin/Reader when no rbac file exists', () => {
      const defaultRbacPath = path.join(appPath, 'rbac.yaml');
      const dsPath = path.join(appPath, 'hubspot-datasource-contact.json');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const s = String(p);
        return s === dsPath;
      });
      loadConfigFile.mockImplementation((p) => {
        if (p === dsPath) {
          return { resourceType: 'contact', openapi: { autoRbac: true, operations: { list: {}, get: {} } } };
        }
        return {};
      });
      writeConfigFile.mockImplementation(() => {});

      const changes = [];
      const result = mergeRbacFromDatasources(
        appPath,
        { key: 'hubspot', displayName: 'HubSpot' },
        ['hubspot-datasource-contact.json'],
        () => null,
        { format: 'yaml', dryRun: false, changes }
      );

      expect(result).toBe(true);
      expect(changes.some(c => c.includes('contact:list'))).toBe(true);
      expect(changes.some(c => c.includes('contact:get'))).toBe(true);
      expect(changes.some(c => c.includes('Admin and Reader'))).toBe(true);
      expect(writeConfigFile).toHaveBeenCalledWith(defaultRbacPath, expect.any(Object));
      const writtenObj = writeConfigFile.mock.calls[0][1];
      expect(JSON.stringify(writtenObj)).toContain('hubspot-admin');
      expect(JSON.stringify(writtenObj)).toContain('hubspot-reader');
      expect(writtenObj.permissions.some(p => p.name === 'contact:list')).toBe(true);
    });

    it('dry-run reports changes but does not write', () => {
      const dsPath = path.join(appPath, 'hubspot-datasource-deals.json');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      loadConfigFile.mockImplementation((p) => {
        if (String(p) === dsPath) {
          return { resourceType: 'deal', openapi: { autoRbac: true, operations: { list: {} } } };
        }
        return {};
      });

      const changes = [];
      const result = mergeRbacFromDatasources(
        appPath,
        { key: 'hubspot', displayName: 'HubSpot' },
        ['hubspot-datasource-deals.json'],
        () => null,
        { format: 'yaml', dryRun: true, changes }
      );

      expect(result).toBe(true);
      expect(changes.length).toBeGreaterThan(0);
      expect(writeConfigFile).not.toHaveBeenCalled();
    });

    it('uses extractRbacFromSystem when no rbac file exists', () => {
      const defaultRbacPath = path.join(appPath, 'rbac.yaml');
      const dsPath = path.join(appPath, 'hubspot-datasource-contact.json');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => String(p) === dsPath);
      loadConfigFile.mockImplementation((p) => {
        if (p === dsPath) return { resourceType: 'contact', openapi: { autoRbac: true, operations: { list: {} } } };
        return {};
      });
      const extractRbacFromSystem = jest.fn().mockReturnValue({
        roles: [{ name: 'Legacy', value: 'legacy', description: 'Legacy', groups: [] }],
        permissions: []
      });
      writeConfigFile.mockImplementation(() => {});

      const changes = [];
      mergeRbacFromDatasources(
        appPath,
        { key: 'hubspot', displayName: 'HubSpot' },
        ['hubspot-datasource-contact.json'],
        extractRbacFromSystem,
        { format: 'yaml', dryRun: false, changes }
      );

      expect(extractRbacFromSystem).toHaveBeenCalledWith({ key: 'hubspot', displayName: 'HubSpot' });
      expect(writeConfigFile).toHaveBeenCalledWith(defaultRbacPath, expect.any(Object));
      const writtenObj = writeConfigFile.mock.calls[0][1];
      expect(writtenObj.roles.some(r => r.value === 'legacy')).toBe(true);
      expect(writtenObj.permissions.some(p => p.name === 'contact:list')).toBe(true);
    });
  });

  describe('migrateSystemRbacIntoRbacFile', () => {
    let resolveSpy;

    beforeEach(() => {
      jest.clearAllMocks();
      resolveSpy = jest.spyOn(appConfigResolver, 'resolveRbacPath');
    });

    afterEach(() => {
      resolveSpy.mockRestore();
    });

    it('returns false when system has no roles or permissions', () => {
      resolveSpy.mockReturnValue(path.join(process.cwd(), 'integration', 'x', 'rbac.json'));
      const changes = [];
      const systemParsed = { key: 'x' };
      const result = migrateSystemRbacIntoRbacFile(
        '/app',
        '/app/system.json',
        systemParsed,
        { dryRun: false, changes }
      );
      expect(result).toBe(false);
    });

    it('returns false when no rbac file exists on disk', () => {
      resolveSpy.mockReturnValue(null);
      const changes = [];
      const systemParsed = {
        roles: [{ name: 'A', value: 'a', description: 'd', groups: [] }]
      };
      const result = migrateSystemRbacIntoRbacFile(
        '/app',
        '/app/system.json',
        systemParsed,
        { dryRun: false, changes }
      );
      expect(result).toBe(false);
      expect(writeConfigFile).not.toHaveBeenCalled();
    });

    it('merges system RBAC into existing rbac file and removes from system', () => {
      const rbacJsonPath = path.join('/app', 'rbac.json');
      resolveSpy.mockReturnValue(rbacJsonPath);
      loadConfigFile.mockImplementation((p) => {
        if (String(p) === rbacJsonPath) {
          return {
            roles: [{ name: 'Admin', value: 'sys-admin', description: 'Admin', groups: [] }],
            permissions: [{ name: 'contact:list', roles: ['sys-admin'], description: 'List' }]
          };
        }
        return {};
      });

      const systemParsed = {
        key: 'hubspot',
        roles: [{ name: 'Extra', value: 'extra-role', description: 'Extra', groups: [] }],
        permissions: [{ name: 'contact:get', roles: ['extra-role'], description: 'Get one' }]
      };
      const changes = [];
      expect(extractRbacFromSystem(systemParsed).permissions).toHaveLength(1);

      const result = migrateSystemRbacIntoRbacFile(
        '/app',
        '/app/hubspot-system.json',
        systemParsed,
        { dryRun: false, changes }
      );

      expect(result).toBe(true);

      expect(systemParsed.roles).toBeUndefined();
      expect(systemParsed.permissions).toBeUndefined();

      const rbacWrite = writeConfigFile.mock.calls.find(c => String(c[0]) === rbacJsonPath);
      expect(rbacWrite).toBeDefined();
      expect(rbacWrite[1].roles.some(r => r.value === 'extra-role')).toBe(true);
      expect(rbacWrite[1].permissions.some(p => p.name === 'contact:get')).toBe(true);

      const systemWrite = writeConfigFile.mock.calls.find(c => String(c[0]).endsWith('hubspot-system.json'));
      expect(systemWrite).toBeDefined();
    });

    it('dry-run does not write but records intent', () => {
      const rbacJsonPath = path.join('/app', 'rbac.json');
      resolveSpy.mockReturnValue(rbacJsonPath);
      loadConfigFile.mockReturnValue({ roles: [], permissions: [] });
      const systemParsed = {
        roles: [{ name: 'A', value: 'a', description: 'd', groups: [] }]
      };
      const changes = [];
      migrateSystemRbacIntoRbacFile(
        '/app',
        '/app/system.json',
        systemParsed,
        { dryRun: true, changes }
      );
      expect(writeConfigFile).not.toHaveBeenCalled();
      expect(systemParsed.roles).toBeDefined();
      expect(changes.some(c => c.includes('Removed roles and permissions'))).toBe(true);
    });
  });
});
