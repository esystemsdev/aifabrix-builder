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
const {
  getCapabilitiesFromDatasource,
  mergeRbacFromDatasources
} = require('../../../lib/commands/repair-rbac');

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
        if (p === dsPath) return { resourceType: 'contact', capabilities: ['list', 'get'] };
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
          return { resourceType: 'contact', capabilities: ['list', 'get'] };
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

    it('creates rbac.json when no rbac file exists and format is json', () => {
      const rbacJsonPath = path.join(appPath, 'rbac.json');
      const dsPath = path.join(appPath, 'hubspot-datasource-contact.json');
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const s = String(p);
        return s === dsPath;
      });
      loadConfigFile.mockImplementation((p) => {
        if (p === dsPath) {
          return { resourceType: 'contact', capabilities: ['list', 'get'] };
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
          return { resourceType: 'contact', capabilities: ['list', 'get'] };
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
          return { resourceType: 'deal', capabilities: ['list'] };
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
        if (p === dsPath) return { resourceType: 'contact', capabilities: ['list'] };
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
});
