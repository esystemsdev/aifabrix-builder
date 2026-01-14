/**
 * Tests for External System RBAC Support in Generator
 *
 * @fileoverview Unit tests for external system RBAC merging in generator.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const generator = require('../../../lib/generator');

// Mock fs module
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const mockFs = {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn()
    }
  };
  return mockFs;
});

// Mock paths module
jest.mock('../../../lib/utils/paths', () => {
  const actualPaths = jest.requireActual('../../../lib/utils/paths');
  const path = require('path');
  return {
    ...actualPaths,
    detectAppType: jest.fn().mockResolvedValue({
      isExternal: true,
      appPath: path.join(process.cwd(), 'integration', 'testexternal'),
      appType: 'external',
      baseDir: 'integration'
    }),
    getDeployJsonPath: jest.fn((appName, appType, preferNew) => {
      const appPath = path.join(process.cwd(), 'integration', appName);
      return path.join(appPath, `${appName}-deploy.json`);
    })
  };
});

describe('External System RBAC Support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateDeployJson for external systems with rbac.yaml', () => {
    it('should merge rbac.yaml roles and permissions into system JSON', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);
      const systemJson = {
        key: 'testexternal',
        displayName: 'Test External',
        description: 'Test external system',
        type: 'openapi',
        authentication: { type: 'apikey' }
      };

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

      const variablesPath = path.join(appPath, 'variables.yaml');
      const systemFilePath = path.join(appPath, 'testexternal-deploy.json');
      const rbacPath = path.join(appPath, 'rbac.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === systemFilePath) return true;
        if (filePath === rbacPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return yaml.dump({
            app: { type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['testexternal-deploy.json']
            }
          });
        }
        if (filePath === rbacPath) {
          return yaml.dump(rbacYaml);
        }
        return '';
      });

      fs.promises.readFile.mockImplementation((filePath) => {
        if (filePath === systemFilePath) {
          return Promise.resolve(JSON.stringify(systemJson));
        }
        return Promise.reject(new Error(`File not found: ${filePath}`));
      });
      fs.promises.writeFile.mockResolvedValue();

      await generator.generateDeployJson(appName);

      expect(fs.promises.writeFile).toHaveBeenCalled();
      const writtenContent = JSON.parse(fs.promises.writeFile.mock.calls[0][1]);
      expect(writtenContent.roles).toEqual(rbacYaml.roles);
      expect(writtenContent.permissions).toEqual(rbacYaml.permissions);
    });

    it('should prefer system JSON roles/permissions over rbac.yaml', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);
      const systemJson = {
        key: 'testexternal',
        displayName: 'Test External',
        description: 'Test external system',
        type: 'openapi',
        authentication: { type: 'apikey' },
        roles: [
          {
            name: 'System Admin',
            value: 'system-admin',
            description: 'System admin role'
          }
        ],
        permissions: [
          {
            name: 'system:read',
            roles: ['system-admin'],
            description: 'System read access'
          }
        ]
      };

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

      const variablesPath = path.join(appPath, 'variables.yaml');
      const systemFilePath = path.join(appPath, 'testexternal-deploy.json');
      const rbacPath = path.join(appPath, 'rbac.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === systemFilePath) return true;
        if (filePath === rbacPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return yaml.dump({
            app: { type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['testexternal-deploy.json']
            }
          });
        }
        if (filePath === rbacPath) {
          return yaml.dump(rbacYaml);
        }
        return '';
      });

      fs.promises.readFile.mockImplementation((filePath) => {
        if (filePath === systemFilePath) {
          return Promise.resolve(JSON.stringify(systemJson));
        }
        return Promise.reject(new Error(`File not found: ${filePath}`));
      });
      fs.promises.writeFile.mockResolvedValue();

      await generator.generateDeployJson(appName);

      expect(fs.promises.writeFile).toHaveBeenCalled();
      const writtenContent = JSON.parse(fs.promises.writeFile.mock.calls[0][1]);
      // Should keep system JSON roles/permissions (priority)
      expect(writtenContent.roles).toEqual(systemJson.roles);
      expect(writtenContent.permissions).toEqual(systemJson.permissions);
    });

    it('should handle missing rbac.yaml gracefully', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);
      const systemJson = {
        key: 'testexternal',
        displayName: 'Test External',
        description: 'Test external system',
        type: 'openapi',
        authentication: { type: 'apikey' }
      };

      const variablesPath = path.join(appPath, 'variables.yaml');
      const systemFilePath = path.join(appPath, 'testexternal-deploy.json');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === systemFilePath) return true;
        if (filePath.includes('rbac.yaml')) return false;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return yaml.dump({
            app: { type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['testexternal-deploy.json']
            }
          });
        }
        return '';
      });

      fs.promises.readFile.mockImplementation((filePath) => {
        if (filePath === systemFilePath) {
          return Promise.resolve(JSON.stringify(systemJson));
        }
        return Promise.reject(new Error(`File not found: ${filePath}`));
      });
      fs.promises.writeFile.mockResolvedValue();

      await generator.generateDeployJson(appName);

      expect(fs.promises.writeFile).toHaveBeenCalled();
      const writtenContent = JSON.parse(fs.promises.writeFile.mock.calls[0][1]);
      expect(writtenContent.roles).toBeUndefined();
      expect(writtenContent.permissions).toBeUndefined();
    });

    it('should merge rbac.yaml when system JSON has empty roles/permissions arrays', async() => {
      const appName = 'testexternal';
      const appPath = path.join(process.cwd(), 'integration', appName);
      const systemJson = {
        key: 'testexternal',
        displayName: 'Test External',
        description: 'Test external system',
        type: 'openapi',
        authentication: { type: 'apikey' },
        roles: [],
        permissions: []
      };

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

      const variablesPath = path.join(appPath, 'variables.yaml');
      const systemFilePath = path.join(appPath, 'testexternal-deploy.json');
      const rbacPath = path.join(appPath, 'rbac.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === systemFilePath) return true;
        if (filePath === rbacPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return yaml.dump({
            app: { type: 'external' },
            externalIntegration: {
              schemaBasePath: './',
              systems: ['testexternal-deploy.json']
            }
          });
        }
        if (filePath === rbacPath) {
          return yaml.dump(rbacYaml);
        }
        return '';
      });

      fs.promises.readFile.mockImplementation((filePath) => {
        if (filePath === systemFilePath) {
          return Promise.resolve(JSON.stringify(systemJson));
        }
        return Promise.reject(new Error(`File not found: ${filePath}`));
      });
      fs.promises.writeFile.mockResolvedValue();

      await generator.generateDeployJson(appName);

      expect(fs.promises.writeFile).toHaveBeenCalled();
      const writtenContent = JSON.parse(fs.promises.writeFile.mock.calls[0][1]);
      // Should merge from rbac.yaml when arrays are empty
      expect(writtenContent.roles).toEqual(rbacYaml.roles);
      expect(writtenContent.permissions).toEqual(rbacYaml.permissions);
    });
  });
});

