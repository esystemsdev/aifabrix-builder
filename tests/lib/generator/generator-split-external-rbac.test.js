/**
 * Tests for External System RBAC Support in Split-JSON
 *
 * @fileoverview Unit tests for split-json with external system RBAC
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const generator = require('../../../lib/generator');

// Mock fs module so project root resolution still works (paths.js uses existsSync for package.json).
// Jest mock factory may not reference out-of-scope variables; use require('path') inside.
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const pathMod = require('path');
  const mockExistsSync = (filePath) => {
    const p = String(filePath);
    const isDeployJson = p.includes('testexternal-deploy.json');
    const isOutputDir = p.includes('integration') && (p.endsWith('testexternal') || p.endsWith('testexternal' + pathMod.sep) || p.includes('testexternal' + pathMod.sep));
    if (isDeployJson || isOutputDir) {
      return true;
    }
    return actualFs.existsSync(filePath);
  };
  return {
    ...actualFs,
    existsSync: jest.fn(mockExistsSync),
    statSync: jest.fn((filePath) => actualFs.statSync(filePath)),
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn()
    }
  };
});

describe('External System RBAC Split-JSON', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('splitDeployJson with external system JSON containing roles/permissions', () => {
    it('should extract roles and permissions from external system JSON to rbac.yml', async() => {
      const deployJsonPath = path.join(process.cwd(), 'integration', 'testexternal', 'testexternal-deploy.json');
      const outputDir = path.join(process.cwd(), 'integration', 'testexternal');

      const externalSystemJson = {
        key: 'testexternal',
        displayName: 'Test External',
        description: 'Test external system',
        type: 'openapi',
        authentication: { type: 'apikey' },
        roles: [
          {
            name: 'External Admin',
            value: 'external-admin',
            description: 'Admin access',
            groups: ['admins@company.com']
          },
          {
            name: 'External User',
            value: 'external-user',
            description: 'User access'
          }
        ],
        permissions: [
          {
            name: 'external:read',
            roles: ['external-user', 'external-admin'],
            description: 'Read access'
          },
          {
            name: 'external:write',
            roles: ['external-admin'],
            description: 'Write access'
          }
        ]
      };

      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true });
      fs.promises.readFile.mockResolvedValue(JSON.stringify(externalSystemJson));
      fs.promises.writeFile.mockResolvedValue();
      fs.promises.mkdir.mockResolvedValue();

      const result = await generator.splitDeployJson(deployJsonPath, outputDir);

      expect(result.rbac).toBeDefined();
      expect(result.rbac).toContain('rbac.yml');

      // Verify rbac.yml was written
      const writeCalls = fs.promises.writeFile.mock.calls;
      const rbacWriteCall = writeCalls.find(call => call[0].includes('rbac.yml'));
      expect(rbacWriteCall).toBeDefined();

      // Parse written rbac.yml content
      const writtenRbac = yaml.load(rbacWriteCall[1]);
      expect(writtenRbac.roles).toEqual(externalSystemJson.roles);
      expect(writtenRbac.permissions).toEqual(externalSystemJson.permissions);
    });

    it('should handle external system JSON without roles/permissions', async() => {
      const deployJsonPath = path.join(process.cwd(), 'integration', 'testexternal', 'testexternal-deploy.json');
      const outputDir = path.join(process.cwd(), 'integration', 'testexternal');

      const externalSystemJson = {
        key: 'testexternal',
        displayName: 'Test External',
        description: 'Test external system',
        type: 'openapi',
        authentication: { type: 'apikey' }
      };

      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true });
      fs.promises.readFile.mockResolvedValue(JSON.stringify(externalSystemJson));
      fs.promises.writeFile.mockResolvedValue();
      fs.promises.mkdir.mockResolvedValue();

      const result = await generator.splitDeployJson(deployJsonPath, outputDir);

      // Should not create rbac.yml if no roles/permissions
      expect(result.rbac).toBeUndefined();

      // Verify rbac.yml was not written
      const writeCalls = fs.promises.writeFile.mock.calls;
      const rbacWriteCall = writeCalls.find(call => call[0].includes('rbac.yml'));
      expect(rbacWriteCall).toBeUndefined();
    });

    it('should extract only roles when permissions are missing', async() => {
      const deployJsonPath = path.join(process.cwd(), 'integration', 'testexternal', 'testexternal-deploy.json');
      const outputDir = path.join(process.cwd(), 'integration', 'testexternal');

      const externalSystemJson = {
        key: 'testexternal',
        displayName: 'Test External',
        description: 'Test external system',
        type: 'openapi',
        authentication: { type: 'apikey' },
        roles: [
          {
            name: 'External Admin',
            value: 'external-admin',
            description: 'Admin access'
          }
        ]
      };

      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true });
      fs.promises.readFile.mockResolvedValue(JSON.stringify(externalSystemJson));
      fs.promises.writeFile.mockResolvedValue();
      fs.promises.mkdir.mockResolvedValue();

      const result = await generator.splitDeployJson(deployJsonPath, outputDir);

      expect(result.rbac).toBeDefined();

      // Verify rbac.yml was written with only roles
      const writeCalls = fs.promises.writeFile.mock.calls;
      const rbacWriteCall = writeCalls.find(call => call[0].includes('rbac.yml'));
      expect(rbacWriteCall).toBeDefined();

      const writtenRbac = yaml.load(rbacWriteCall[1]);
      expect(writtenRbac.roles).toEqual(externalSystemJson.roles);
      expect(writtenRbac.permissions).toBeUndefined();
    });

    it('should extract only permissions when roles are missing', async() => {
      const deployJsonPath = path.join(process.cwd(), 'integration', 'testexternal', 'testexternal-deploy.json');
      const outputDir = path.join(process.cwd(), 'integration', 'testexternal');

      const externalSystemJson = {
        key: 'testexternal',
        displayName: 'Test External',
        description: 'Test external system',
        type: 'openapi',
        authentication: { type: 'apikey' },
        permissions: [
          {
            name: 'external:read',
            roles: ['external-admin'],
            description: 'Read access'
          }
        ]
      };

      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true });
      fs.promises.readFile.mockResolvedValue(JSON.stringify(externalSystemJson));
      fs.promises.writeFile.mockResolvedValue();
      fs.promises.mkdir.mockResolvedValue();

      const result = await generator.splitDeployJson(deployJsonPath, outputDir);

      expect(result.rbac).toBeDefined();

      // Verify rbac.yml was written with only permissions
      const writeCalls = fs.promises.writeFile.mock.calls;
      const rbacWriteCall = writeCalls.find(call => call[0].includes('rbac.yml'));
      expect(rbacWriteCall).toBeDefined();

      const writtenRbac = yaml.load(rbacWriteCall[1]);
      expect(writtenRbac.permissions).toEqual(externalSystemJson.permissions);
      expect(writtenRbac.roles).toBeUndefined();
    });

    it('should preserve Azure AD groups in extracted roles', async() => {
      const deployJsonPath = path.join(process.cwd(), 'integration', 'testexternal', 'testexternal-deploy.json');
      const outputDir = path.join(process.cwd(), 'integration', 'testexternal');

      const externalSystemJson = {
        key: 'testexternal',
        displayName: 'Test External',
        description: 'Test external system',
        type: 'openapi',
        authentication: { type: 'apikey' },
        roles: [
          {
            name: 'External Admin',
            value: 'external-admin',
            description: 'Admin access',
            groups: ['admins@company.com', 'super-admins@company.com']
          }
        ],
        permissions: [
          {
            name: 'external:read',
            roles: ['external-admin'],
            description: 'Read access'
          }
        ]
      };

      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true });
      fs.promises.readFile.mockResolvedValue(JSON.stringify(externalSystemJson));
      fs.promises.writeFile.mockResolvedValue();
      fs.promises.mkdir.mockResolvedValue();

      const result = await generator.splitDeployJson(deployJsonPath, outputDir);

      expect(result.rbac).toBeDefined();

      // Verify groups are preserved
      const writeCalls = fs.promises.writeFile.mock.calls;
      const rbacWriteCall = writeCalls.find(call => call[0].includes('rbac.yml'));
      const writtenRbac = yaml.load(rbacWriteCall[1]);
      expect(writtenRbac.roles[0].groups).toEqual(['admins@company.com', 'super-admins@company.com']);
    });
  });
});

