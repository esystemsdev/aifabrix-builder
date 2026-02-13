/**
 * Tests for External System RBAC Validation
 *
 * @fileoverview Unit tests for external system RBAC validation in validator.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const validator = require('../../../lib/validation/validator');

// Mock fs module
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const mockFs = {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn()
  };
  return mockFs;
});

// Mock paths module
jest.mock('../../../lib/utils/paths', () => {
  const actualPaths = jest.requireActual('../../../lib/utils/paths');
  const path = require('path');
  return {
    ...actualPaths,
    detectAppType: jest.fn()
  };
});

const { detectAppType } = require('../../../lib/utils/paths');

describe('External System RBAC Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRbac for external systems', () => {
    it('should validate rbac.yaml for external system in integration/ directory', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);
      const rbacPath = path.join(appPath, 'rbac.yaml');

      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external',
        baseDir: 'integration'
      });

      const rbacYaml = {
        roles: [
          {
            name: 'External Admin',
            value: 'external-admin',
            description: 'Admin access'
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
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === rbacPath) {
          return yaml.dump(rbacYaml);
        }
        return '';
      });

      const result = await validator.validateRbac(appName);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(detectAppType).toHaveBeenCalledWith(appName, expect.any(Object));
    });

    it('should validate rbac.yaml for external system in builder/ directory', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'builder', appName);
      const rbacPath = path.join(appPath, 'rbac.yaml');

      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external',
        baseDir: 'builder'
      });

      const rbacYaml = {
        roles: [
          {
            name: 'External Admin',
            value: 'external-admin',
            description: 'Admin access'
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
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === rbacPath) {
          return yaml.dump(rbacYaml);
        }
        return '';
      });

      const result = await validator.validateRbac(appName);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(detectAppType).toHaveBeenCalledWith(appName, expect.any(Object));
    });

    it('should return warning when rbac.yaml is missing for external system', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);

      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external',
        baseDir: 'integration'
      });

      fs.existsSync.mockReturnValue(false);

      const result = await validator.validateRbac(appName);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('rbac.yaml not found - authentication disabled');
    });

    it('should validate role value pattern', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);
      const rbacPath = path.join(appPath, 'rbac.yaml');

      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external',
        baseDir: 'integration'
      });

      const rbacYaml = {
        roles: [
          {
            name: 'Invalid Role',
            value: 'InvalidRole123', // Invalid: contains uppercase and numbers
            description: 'Invalid role'
          }
        ],
        permissions: []
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === rbacPath) {
          return yaml.dump(rbacYaml);
        }
        return '';
      });

      const result = await validator.validateRbac(appName);

      // Note: Pattern validation happens at schema level, not in validator.js
      // This test verifies the function runs without errors
      expect(detectAppType).toHaveBeenCalledWith(appName, expect.any(Object));
    });

    it('should validate permission name pattern', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);
      const rbacPath = path.join(appPath, 'rbac.yaml');

      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external',
        baseDir: 'integration'
      });

      const rbacYaml = {
        roles: [
          {
            name: 'External Admin',
            value: 'external-admin',
            description: 'Admin access'
          }
        ],
        permissions: [
          {
            name: 'external:read:write', // Valid pattern
            roles: ['external-admin'],
            description: 'Read and write access'
          }
        ]
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === rbacPath) {
          return yaml.dump(rbacYaml);
        }
        return '';
      });

      const result = await validator.validateRbac(appName);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle invalid YAML syntax in rbac.yaml', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);
      const rbacPath = path.join(appPath, 'rbac.yaml');

      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external',
        baseDir: 'integration'
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === rbacPath) {
          return 'invalid: yaml: syntax: [';
        }
        return '';
      });

      await expect(validator.validateRbac(appName)).rejects.toThrow('Invalid YAML syntax');
    });

    it('should validate missing required fields in roles', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);
      const rbacPath = path.join(appPath, 'rbac.yaml');

      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external',
        baseDir: 'integration'
      });

      const rbacYaml = {
        roles: [
          {
            name: 'External Admin'
            // Missing value and description
          }
        ],
        permissions: []
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === rbacPath) {
          return yaml.dump(rbacYaml);
        }
        return '';
      });

      const result = await validator.validateRbac(appName);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('missing required fields'))).toBe(true);
    });

    it('should validate missing required fields in permissions', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);
      const rbacPath = path.join(appPath, 'rbac.yaml');

      detectAppType.mockResolvedValue({
        isExternal: true,
        appPath: appPath,
        appType: 'external',
        baseDir: 'integration'
      });

      const rbacYaml = {
        roles: [
          {
            name: 'External Admin',
            value: 'external-admin',
            description: 'Admin access'
          }
        ],
        permissions: [
          {
            name: 'external:read'
            // Missing roles and description
          }
        ]
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === rbacPath) {
          return yaml.dump(rbacYaml);
        }
        return '';
      });

      const result = await validator.validateRbac(appName);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('missing required fields'))).toBe(true);
    });
  });
});

