/**
 * Tests for Environment Generation - Comprehensive Configuration Testing
 *
 * @fileoverview Unit tests for env generation with all configuration combinations
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const yaml = require('js-yaml');

jest.mock('fs');
jest.mock('os');

// Mock chalk before requiring modules that use it
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  return mockChalk;
});

// Mock config BEFORE requiring modules
const mockConfig = {
  getDeveloperId: jest.fn(),
  getSecretsPath: jest.fn().mockResolvedValue(null),
  getSecretsEncryptionKey: jest.fn().mockResolvedValue(null),
  getAifabrixEnvConfigPath: jest.fn().mockResolvedValue(null),
  CONFIG_FILE: '/mock/config/dir/config.yaml'
};

jest.mock('../../../lib/config', () => mockConfig);

// Mock dev-config
jest.mock('../../../lib/utils/dev-config', () => ({
  getDevPorts: jest.fn((devId) => {
    const offset = typeof devId === 'number' ? devId * 100 : 0;
    return {
      postgres: 5432 + offset,
      redis: 6379 + offset
    };
  }),
  getBasePorts: jest.fn(() => ({
    app: 3000,
    postgres: 5432,
    redis: 6379,
    pgadmin: 5050,
    redisCommander: 8081
  }))
}));

// Mock env-config-loader
const mockEnvConfig = {
  environments: {
    local: {
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      DATAPLANE_HOST: 'localhost',
      DATAPLANE_PORT: '3011',
      MISO_HOST: 'localhost',
      MISO_PORT: '3010'
    },
    docker: {
      DB_HOST: 'postgres',
      DB_PORT: '5432',
      REDIS_HOST: 'redis',
      REDIS_PORT: '6379',
      DATAPLANE_HOST: 'dataplane',
      DATAPLANE_PORT: '3001',
      MISO_HOST: 'miso-controller',
      MISO_PORT: '3000'
    }
  }
};

jest.mock('../../../lib/utils/env-config-loader', () => ({
  loadEnvConfig: jest.fn().mockResolvedValue(mockEnvConfig)
}));

// Mock env-endpoints
jest.mock('../../../lib/utils/env-endpoints', () => ({
  getEnvHosts: jest.fn().mockImplementation(async(context) => {
    // Return mock env config values directly
    const envs = mockEnvConfig.environments || {};
    return envs[context] || {};
  }),
  rewriteInfraEndpoints: jest.fn().mockImplementation(async(envContent, context, devPorts) => {
    // If devPorts is provided and context is 'local', update REDIS_PORT
    if (context === 'local' && devPorts && typeof devPorts.redis === 'number') {
      let updated = envContent;
      // Update REDIS_PORT if present
      if (/^REDIS_PORT\s*=.*$/m.test(updated)) {
        updated = updated.replace(
          /^REDIS_PORT\s*=\s*.*$/m,
          `REDIS_PORT=${devPorts.redis}`
        );
      }
      // Update REDIS_URL if present
      if (/^REDIS_URL\s*=.*$/m.test(updated)) {
        const m = updated.match(/^REDIS_URL\s*=\s*redis:\/\/([^:\s]+):\d+/m);
        const currentHost = m && m[1] ? m[1] : 'localhost';
        updated = updated.replace(
          /^REDIS_URL\s*=\s*.*$/m,
          `REDIS_URL=redis://${currentHost}:${devPorts.redis}`
        );
      }
      // Update REDIS_HOST if it has a port pattern
      if (/^REDIS_HOST\s*=.*:\d+$/m.test(updated)) {
        const hostPortMatch = updated.match(/^REDIS_HOST\s*=\s*([a-zA-Z0-9_.-]+):\d+$/m);
        const currentHost = hostPortMatch && hostPortMatch[1] ? hostPortMatch[1] : 'localhost';
        updated = updated.replace(
          /^REDIS_HOST\s*=\s*.*$/m,
          `REDIS_HOST=${currentHost}:${devPorts.redis}`
        );
      }
      return updated;
    }
    // Default: return content as-is
    return envContent;
  })
}));

// Mock secrets-url
jest.mock('../../../lib/utils/secrets-url', () => ({
  resolveServicePortsInEnvContent: jest.fn(async(envContent, environment) => {
    // For docker, just return the content as-is (port resolution is tested elsewhere)
    return envContent;
  })
}));

// Mock secrets utilities
jest.mock('../../../lib/utils/secrets-path', () => ({
  getActualSecretsPath: jest.fn().mockResolvedValue({
    userPath: '/mock/secrets/user.yaml',
    buildPath: null
  })
}));

jest.mock('../../../lib/utils/secrets-utils', () => ({
  loadUserSecrets: jest.fn(() => ({})),
  loadBuildSecrets: jest.fn().mockResolvedValue({}),
  loadDefaultSecrets: jest.fn(() => ({
    'redis-url': 'redis://localhost:6379',
    'redis-passwordKeyVault': 'redis-pass'
  }))
}));

jest.mock('../../../lib/utils/secrets-generator', () => ({
  generateMissingSecrets: jest.fn().mockResolvedValue(),
  createDefaultSecrets: jest.fn().mockResolvedValue()
}));

jest.mock('../../../lib/utils/secrets-encryption', () => ({
  decryptSecret: jest.fn((val) => val),
  isEncrypted: jest.fn(() => false)
}));

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

const { generateEnvContent } = require('../../../lib/secrets');
const { adjustLocalEnvPortsInContent } = require('../../../lib/utils/secrets-helpers');
const { buildEnvVarMap } = require('../../../lib/utils/env-map');
const { processEnvVariables } = require('../../../lib/utils/env-copy');

describe('Environment Generation - Comprehensive Tests', () => {
  const mockHomeDir = '/home/test';
  const mockAppName = 'test-app';
  const mockBuilderPath = path.join(process.cwd(), 'builder', mockAppName);
  const mockTemplatePath = path.join(mockBuilderPath, 'env.template');
  const mockVariablesPath = path.join(mockBuilderPath, 'variables.yaml');

  const baseEnvTemplate = `NODE_ENV=development
PORT=3077
APP_NAME=${mockAppName}
REDIS_URL=kv://redis-url
REDIS_HOST=\${REDIS_HOST}
REDIS_PORT=\${REDIS_PORT}
DATAPLANE_HOST=\${DATAPLANE_HOST}
DATAPLANE_PORT=\${DATAPLANE_PORT}
DB_HOST=\${DB_HOST}
DB_PORT=\${DB_PORT}`;

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
    mockConfig.getDeveloperId.mockResolvedValue('0');

    // Default fs mocks - use a function that can be overridden in tests
    fs.existsSync.mockImplementation((filePath) => {
      if (filePath === mockTemplatePath) return true;
      if (filePath === mockVariablesPath) return true;
      if (filePath && filePath.includes('env-config.yaml')) return true;
      if (filePath && filePath.includes('config.yaml')) return false; // Default: no config.yaml
      return false;
    });

    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === mockTemplatePath) {
        return baseEnvTemplate;
      }
      if (filePath && filePath.includes('env-config.yaml')) {
        return yaml.dump(mockEnvConfig);
      }
      if (filePath && filePath.includes('config.yaml')) {
        return yaml.dump({});
      }
      return '';
    });

    fs.writeFileSync.mockImplementation(() => {});
    fs.mkdirSync.mockImplementation(() => {});
    fs.statSync.mockReturnValue({ isDirectory: () => false });
  });

  describe('generateEnvContent - Local Environment', () => {
    describe('Local with build.localPort set', () => {
      it('should use build.localPort when developer-id is null', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: 3087
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue(null);
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'local', false);

        expect(result).toMatch(/^PORT=3087$/m);
        expect(result).toContain('REDIS_HOST=localhost');
      });

      it('should use build.localPort when developer-id is 0', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: 3087
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('0');
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'local', false);

        expect(result).toMatch(/^PORT=3087$/m);
      });

      it('should use build.localPort + 100 when developer-id is 1', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: 3087
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'local', false);

        expect(result).toMatch(/^PORT=3187$/m); // 3087 + 100
      });

      it('should use build.localPort + 200 when developer-id is 2', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: 3087
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('2');
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'local', false);

        expect(result).toMatch(/^PORT=3287$/m); // 3087 + 200
      });
    });

    describe('Local with build.localPort null/undefined', () => {
      it('should use port when build.localPort is null and developer-id is null', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: null
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue(null);
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'local', false);

        expect(result).toMatch(/^PORT=3077$/m);
      });

      it('should use port when build.localPort is null and developer-id is 0', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: null
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('0');
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'local', false);

        expect(result).toMatch(/^PORT=3077$/m);
      });

      it('should use port + 100 when build.localPort is null and developer-id is 1', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: null
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'local', false);

        expect(result).toMatch(/^PORT=3177$/m); // 3077 + 100
      });
    });

    describe('Local host interpolation', () => {
      it('should resolve all hosts to localhost for local environment', async() => {
        const variables = {
          port: 3077
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('0');

        const result = await generateEnvContent(mockAppName, null, 'local', false);

        expect(result).toContain('REDIS_HOST=localhost');
        expect(result).toContain('DATAPLANE_HOST=localhost');
        expect(result).toContain('DB_HOST=localhost');
      });

      it('should apply developer-id offset to infra ports', async() => {
        const templateWithPorts = `NODE_ENV=development
PORT=3077
APP_NAME=${mockAppName}
REDIS_URL=kv://redis-url
REDIS_HOST=\${REDIS_HOST}
REDIS_PORT=\${REDIS_PORT}
DATABASE_PORT=\${DB_PORT}
DATAPLANE_HOST=\${DATAPLANE_HOST}
DATAPLANE_PORT=\${DATAPLANE_PORT}
DB_HOST=\${DB_HOST}
DB_PORT=\${DB_PORT}`;

        const variables = {
          port: 3077
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return templateWithPorts;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        const result = await generateEnvContent(mockAppName, null, 'local', false);

        // Redis port should be 6379 + 100 = 6479
        expect(result).toMatch(/REDIS_PORT=6479/);
        // Database port should be 5432 + 100 = 5532
        expect(result).toMatch(/DATABASE_PORT=5532/);
      });
    });

    describe('Local config.yaml overrides', () => {
      it('should override env-config.yaml with environments.local values', async() => {
        const configYaml = {
          environments: {
            local: {
              REDIS_HOST: 'custom-redis-host'
            }
          }
        };

        const configYamlPath = path.join(mockHomeDir, '.aifabrix', 'config.yaml');

        os.homedir.mockReturnValue(mockHomeDir);

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === configYamlPath) return true;
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === configYamlPath) return yaml.dump(configYaml);
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return yaml.dump(configYaml);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        const result = await buildEnvVarMap('local', os);

        expect(result.REDIS_HOST).toBe('custom-redis-host');
      });

      it('should apply aifabrix-localhost override for local hosts', async() => {
        const configYaml = {
          'aifabrix-localhost': '192.168.1.100'
        };

        const configYamlPath = path.join(mockHomeDir, '.aifabrix', 'config.yaml');

        os.homedir.mockReturnValue(mockHomeDir);

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === configYamlPath) return true;
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === configYamlPath) return yaml.dump(configYaml);
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return yaml.dump(configYaml);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        const result = await buildEnvVarMap('local', os);

        expect(result.REDIS_HOST).toBe('192.168.1.100');
        expect(result.DB_HOST).toBe('192.168.1.100');
      });
    });
  });

  describe('generateEnvContent - Docker Environment', () => {
    describe('Docker with port set', () => {
      it('should use port when developer-id is null', async() => {
        const variables = {
          port: 3077
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue(null);
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        expect(result).toMatch(/^PORT=3077$/m);
      });

      it('should use port when developer-id is 0', async() => {
        const variables = {
          port: 3077
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('0');
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        expect(result).toMatch(/^PORT=3077$/m);
      });

      it('should use container port (no developer-id offset) when developer-id is 1', async() => {
        const variables = {
          port: 3077
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        // PORT in Docker container should be container port (3077), not host port (3177)
        // Docker maps host port to container port via port mapping
        expect(result).toMatch(/^PORT=3077$/m);
      });

      it('should use container port (no developer-id offset) when developer-id is 2', async() => {
        const variables = {
          port: 3077
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('2');
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        // PORT in Docker container should be container port (3077), not host port (3277)
        // Docker maps host port to container port via port mapping
        expect(result).toMatch(/^PORT=3077$/m);
      });
    });

    describe('Docker with port null/undefined', () => {
      it('should use default 3000 when port is null and developer-id is null', async() => {
        const variables = {
          port: null
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue(null);
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        expect(result).toMatch(/^PORT=3000$/m);
      });

      it('should use default container port (no developer-id offset) when port is null and developer-id is 1', async() => {
        const variables = {
          port: null
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        // PORT in Docker container should be container port (3000), not host port (3100)
        // Docker maps host port to container port via port mapping
        expect(result).toMatch(/^PORT=3000$/m);
      });
    });

    describe('Docker host interpolation', () => {
      it('should resolve all hosts to docker service names', async() => {
        const variables = {
          port: 3077
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('0');

        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        expect(result).toContain('REDIS_HOST=redis');
        expect(result).toContain('DATAPLANE_HOST=dataplane');
        expect(result).toContain('DB_HOST=postgres');
      });
    });

    describe('Docker config.yaml overrides', () => {
      it('should override env-config.yaml with environments.docker values', async() => {
        const configYaml = {
          environments: {
            docker: {
              REDIS_HOST: 'custom-redis-service'
            }
          }
        };

        const configYamlPath = path.join(mockHomeDir, '.aifabrix', 'config.yaml');

        os.homedir.mockReturnValue(mockHomeDir);

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === configYamlPath) return true;
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === configYamlPath) return yaml.dump(configYaml);
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return yaml.dump(configYaml);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        const result = await buildEnvVarMap('docker', os);

        expect(result.REDIS_HOST).toBe('custom-redis-service');
      });
    });
  });

  describe('adjustLocalEnvPortsInContent - Port Calculation', () => {
    describe('Base port selection', () => {
      it('should use build.localPort when set', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: 3087
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockVariablesPath;
        });

        mockConfig.getDeveloperId.mockResolvedValue('0');

        const envContent = 'PORT=3000\nREDIS_HOST=localhost';
        const result = await adjustLocalEnvPortsInContent(envContent, mockVariablesPath);

        expect(result).toMatch(/^PORT=3087$/m);
      });

      it('should use port when build.localPort is null', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: null
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockVariablesPath;
        });

        mockConfig.getDeveloperId.mockResolvedValue('0');

        const envContent = 'PORT=3000\nREDIS_HOST=localhost';
        const result = await adjustLocalEnvPortsInContent(envContent, mockVariablesPath);

        expect(result).toMatch(/^PORT=3077$/m);
      });

      it('should use default 3000 when both port and build.localPort are null', async() => {
        const variables = {
          port: null
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockVariablesPath;
        });

        mockConfig.getDeveloperId.mockResolvedValue('0');

        const envContent = 'PORT=3000\nREDIS_HOST=localhost';
        const result = await adjustLocalEnvPortsInContent(envContent, mockVariablesPath);

        expect(result).toMatch(/^PORT=3000$/m);
      });

      it('should use port when build.localPort is 0 (not > 0)', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: 0
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockVariablesPath;
        });

        mockConfig.getDeveloperId.mockResolvedValue('0');

        const envContent = 'PORT=3000\nREDIS_HOST=localhost';
        const result = await adjustLocalEnvPortsInContent(envContent, mockVariablesPath);

        expect(result).toMatch(/^PORT=3077$/m);
      });
    });

    describe('Developer-id offset application', () => {
      it('should apply offset to app port', async() => {
        const variables = {
          port: 3077,
          build: {
            localPort: 3087
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockVariablesPath;
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        const envContent = 'PORT=3000\nREDIS_HOST=localhost';
        const result = await adjustLocalEnvPortsInContent(envContent, mockVariablesPath);

        expect(result).toMatch(/^PORT=3187$/m); // 3087 + 100
      });

      it('should apply offset to infra ports', async() => {
        const variables = {
          port: 3077
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockVariablesPath;
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        const envContent = 'PORT=3077\nDATABASE_PORT=5432\nREDIS_PORT=6379';
        const result = await adjustLocalEnvPortsInContent(envContent, mockVariablesPath);

        expect(result).toMatch(/DATABASE_PORT=5532/); // 5432 + 100
        expect(result).toMatch(/REDIS_PORT=6479/); // 6379 + 100
      });
    });
  });

  describe('buildEnvVarMap - Host Interpolation', () => {
    describe('env-config.yaml loading', () => {
      it('should load correct hosts for local context', async() => {
        const result = await buildEnvVarMap('local', os);

        expect(result.DB_HOST).toBe('localhost');
        expect(result.REDIS_HOST).toBe('localhost');
        expect(result.DATAPLANE_HOST).toBe('localhost');
      });

      it('should load correct hosts for docker context', async() => {
        const result = await buildEnvVarMap('docker', os);

        expect(result.DB_HOST).toBe('postgres');
        expect(result.REDIS_HOST).toBe('redis');
        expect(result.DATAPLANE_HOST).toBe('dataplane');
      });

      it('should handle missing env-config.yaml gracefully', async() => {
        // Mock loadEnvConfig to throw error (simulating missing file)
        const { loadEnvConfig } = require('../../../lib/utils/env-config-loader');
        loadEnvConfig.mockRejectedValueOnce(new Error('File not found'));

        const result = await buildEnvVarMap('local', os);

        expect(result).toEqual({});
        // Reset mock for other tests
        loadEnvConfig.mockResolvedValue(mockEnvConfig);
      });
    });

    describe('config.yaml overrides', () => {
      it('should override env-config.yaml with environments.local values', async() => {
        const configYaml = {
          environments: {
            local: {
              REDIS_HOST: 'custom-redis'
            }
          }
        };

        const configYamlPath = path.join(mockHomeDir, '.aifabrix', 'config.yaml');

        // Ensure os.homedir returns the correct value
        os.homedir.mockReturnValue(mockHomeDir);

        fs.existsSync.mockImplementation((filePath) => {
          // Match exact path or any config.yaml in .aifabrix directory
          if (filePath === configYamlPath) return true;
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          // Match exact path or any config.yaml in .aifabrix directory
          if (filePath === configYamlPath) return yaml.dump(configYaml);
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return yaml.dump(configYaml);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        const result = await buildEnvVarMap('local', os);

        expect(result.REDIS_HOST).toBe('custom-redis');
      });

      it('should override env-config.yaml with environments.docker values', async() => {
        const configYaml = {
          environments: {
            docker: {
              REDIS_HOST: 'custom-docker-redis'
            }
          }
        };

        const configYamlPath = path.join(mockHomeDir, '.aifabrix', 'config.yaml');

        // Ensure os.homedir returns the correct value
        os.homedir.mockReturnValue(mockHomeDir);

        fs.existsSync.mockImplementation((filePath) => {
          // Match exact path or any config.yaml in .aifabrix directory
          if (filePath === configYamlPath) return true;
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          // Match exact path or any config.yaml in .aifabrix directory
          if (filePath === configYamlPath) return yaml.dump(configYaml);
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return yaml.dump(configYaml);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        const result = await buildEnvVarMap('docker', os);

        expect(result.REDIS_HOST).toBe('custom-docker-redis');
      });
    });

    describe('aifabrix-localhost override', () => {
      it('should apply to localhost values in local context', async() => {
        const configYaml = {
          'aifabrix-localhost': '192.168.1.100'
        };

        const configYamlPath = path.join(mockHomeDir, '.aifabrix', 'config.yaml');

        // Ensure os.homedir returns the correct value
        os.homedir.mockReturnValue(mockHomeDir);

        fs.existsSync.mockImplementation((filePath) => {
          // Match exact path or any config.yaml in .aifabrix directory
          if (filePath === configYamlPath) return true;
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          // Match exact path or any config.yaml in .aifabrix directory
          if (filePath === configYamlPath) return yaml.dump(configYaml);
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return yaml.dump(configYaml);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        const result = await buildEnvVarMap('local', os);

        expect(result.REDIS_HOST).toBe('192.168.1.100');
        expect(result.DB_HOST).toBe('192.168.1.100');
      });

      it('should not affect docker context', async() => {
        const configYaml = {
          'aifabrix-localhost': '192.168.1.100'
        };

        const configYamlPath = path.join(mockHomeDir, '.aifabrix', 'config.yaml');

        // Ensure os.homedir returns the correct value
        os.homedir.mockReturnValue(mockHomeDir);

        fs.existsSync.mockImplementation((filePath) => {
          // Match exact path or any config.yaml in .aifabrix directory
          if (filePath === configYamlPath) return true;
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          // Match exact path or any config.yaml in .aifabrix directory
          if (filePath === configYamlPath) return yaml.dump(configYaml);
          if (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix')) return yaml.dump(configYaml);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        const result = await buildEnvVarMap('docker', os);

        expect(result.REDIS_HOST).toBe('redis'); // Not overridden
      });
    });

    describe('Host:port splitting', () => {
      it('should split DB_HOST: "postgres:5432" into DB_HOST and DB_PORT', async() => {
        const envConfig = {
          environments: {
            local: {
              DB_HOST: 'postgres:5432'
            }
          }
        };

        const { loadEnvConfig } = require('../../../lib/utils/env-config-loader');
        loadEnvConfig.mockResolvedValueOnce(envConfig);

        const result = await buildEnvVarMap('local', os);

        expect(result.DB_HOST).toBe('postgres');
        expect(result.DB_PORT).toBe('5432');
        // Reset mock for other tests
        loadEnvConfig.mockResolvedValue(mockEnvConfig);
      });

      it('should split REDIS_HOST: "redis:6379" into REDIS_HOST and REDIS_PORT', async() => {
        const envConfig = {
          environments: {
            docker: {
              REDIS_HOST: 'redis:6379'
            }
          }
        };

        const { loadEnvConfig } = require('../../../lib/utils/env-config-loader');
        loadEnvConfig.mockResolvedValueOnce(envConfig);

        const result = await buildEnvVarMap('docker', os);

        expect(result.REDIS_HOST).toBe('redis');
        expect(result.REDIS_PORT).toBe('6379');
        // Reset mock for other tests
        loadEnvConfig.mockResolvedValue(mockEnvConfig);
      });
    });
  });

  describe('processEnvVariables - Local .env Copy', () => {
    describe('Regeneration with local environment', () => {
      it('should regenerate with env=local when appName provided', async() => {
        const envPath = path.join(mockBuilderPath, '.env');
        const variablesPath = mockVariablesPath;
        const outDir = '/tmp/aifabrix-out';
        const outEnvPath = path.join(outDir, '.env');

        const variables = {
          port: 3077,
          build: {
            localPort: 3087,
            envOutputPath: outDir
          }
        };

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return true;
          if (filePath === outDir) return true;
          if (filePath === mockTemplatePath) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === variablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        fs.writeFileSync.mockImplementation(() => {});
        fs.statSync.mockReturnValue({ isDirectory: () => false });

        mockConfig.getDeveloperId.mockResolvedValue('0');

        await processEnvVariables(envPath, variablesPath, mockAppName, null);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0];
        expect(writtenPath).toBe(outEnvPath);
        expect(writtenContent).toContain('REDIS_HOST=localhost'); // Should be localhost, not docker service
        expect(writtenContent).toMatch(/^PORT=3087$/m);
      });

      it('should use build.localPort and apply developer-id offset', async() => {
        const envPath = path.join(mockBuilderPath, '.env');
        const variablesPath = mockVariablesPath;
        const outDir = '/tmp/aifabrix-out';
        const outEnvPath = path.join(outDir, '.env');

        const variables = {
          port: 3077,
          build: {
            localPort: 3087,
            envOutputPath: outDir
          }
        };

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return true;
          if (filePath === outDir) return true;
          if (filePath === mockTemplatePath) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return baseEnvTemplate;
          if (filePath === variablesPath) return yaml.dump(variables);
          if (filePath && filePath.includes('env-config.yaml')) return yaml.dump(mockEnvConfig);
          return '';
        });

        fs.writeFileSync.mockImplementation(() => {});
        fs.statSync.mockReturnValue({ isDirectory: () => false });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        await processEnvVariables(envPath, variablesPath, mockAppName, null);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0];
        expect(writtenPath).toBe(outEnvPath);
        expect(writtenContent).toMatch(/^PORT=3187$/m); // 3087 + 100
      });
    });

    describe('Fallback behavior', () => {
      it('should use patching approach when appName not provided', async() => {
        const envPath = path.join(mockBuilderPath, '.env');
        const variablesPath = mockVariablesPath;
        const outDir = '/tmp/aifabrix-out';
        const outEnvPath = path.join(outDir, '.env');

        const variables = {
          port: 3077,
          build: {
            localPort: 3087,
            envOutputPath: outDir
          }
        };

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return true;
          if (filePath === outDir) return true;
          if (filePath === envPath) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return yaml.dump(variables);
          if (filePath === envPath) return 'PORT=3000\nREDIS_HOST=redis';
          return '';
        });

        fs.writeFileSync.mockImplementation(() => {});
        fs.statSync.mockReturnValue({ isDirectory: () => false });

        const prev = process.env.AIFABRIX_DEVELOPERID;
        process.env.AIFABRIX_DEVELOPERID = '1';

        await processEnvVariables(envPath, variablesPath, null, null);

        process.env.AIFABRIX_DEVELOPERID = prev;

        expect(fs.writeFileSync).toHaveBeenCalled();
        const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0];
        expect(writtenPath).toBe(outEnvPath);
        expect(writtenContent).toMatch(/^PORT=3187$/m); // 3087 + 100
      });

      it('should read developer-id from config file when env var not set', async() => {
        const envPath = path.join(mockBuilderPath, '.env');
        const variablesPath = mockVariablesPath;
        const outDir = '/tmp/aifabrix-out';
        const outEnvPath = path.join(outDir, '.env');
        const configPath = mockConfig.CONFIG_FILE;

        const variables = {
          port: 3000,
          build: {
            envOutputPath: outDir
          }
        };

        // Clear env var
        const prev = process.env.AIFABRIX_DEVELOPERID;
        delete process.env.AIFABRIX_DEVELOPERID;

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return true;
          if (filePath === outDir) return true;
          if (filePath === envPath) return true;
          if (filePath === configPath) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return yaml.dump(variables);
          if (filePath === envPath) return 'PORT=3000\nREDIS_HOST=redis';
          if (filePath === configPath) return 'developer-id: 2';
          return '';
        });

        fs.writeFileSync.mockImplementation(() => {});
        fs.statSync.mockReturnValue({ isDirectory: () => false });

        // Mock rewriteInfraEndpoints
        const { rewriteInfraEndpoints } = require('../../../lib/utils/env-endpoints');
        rewriteInfraEndpoints.mockResolvedValue('PORT=3200\nREDIS_HOST=redis');

        await processEnvVariables(envPath, variablesPath, null, null);

        process.env.AIFABRIX_DEVELOPERID = prev;

        expect(fs.writeFileSync).toHaveBeenCalled();
        const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0];
        expect(writtenPath).toBe(outEnvPath);
        // dev-id 2 => 3000 + 2*100 = 3200
        expect(writtenContent).toMatch(/^PORT=3200$/m);
      });

      it('should parse developer-id as number from config file', async() => {
        const envPath = path.join(mockBuilderPath, '.env');
        const variablesPath = mockVariablesPath;
        const outDir = '/tmp/aifabrix-out';
        const outEnvPath = path.join(outDir, '.env');
        const configPath = mockConfig.CONFIG_FILE;

        const variables = {
          port: 3000,
          build: {
            envOutputPath: outDir
          }
        };

        const prev = process.env.AIFABRIX_DEVELOPERID;
        delete process.env.AIFABRIX_DEVELOPERID;

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return true;
          if (filePath === outDir) return true;
          if (filePath === envPath) return true;
          if (filePath === configPath) return true;
          return false;
        });

        // Mock yaml.load to return number
        jest.spyOn(yaml, 'load').mockImplementation((content) => {
          if (content.includes('developer-id')) {
            return { 'developer-id': 3 };
          }
          if (content.includes('port:')) {
            return variables;
          }
          return {};
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return yaml.dump(variables);
          if (filePath === envPath) return 'PORT=3000\nREDIS_HOST=redis';
          if (filePath === configPath) return 'developer-id: 3';
          return '';
        });

        fs.writeFileSync.mockImplementation(() => {});
        fs.statSync.mockReturnValue({ isDirectory: () => false });

        const { rewriteInfraEndpoints } = require('../../../lib/utils/env-endpoints');
        rewriteInfraEndpoints.mockResolvedValue('PORT=3300\nREDIS_HOST=redis');

        await processEnvVariables(envPath, variablesPath, null, null);

        process.env.AIFABRIX_DEVELOPERID = prev;
        yaml.load.mockRestore();

        expect(fs.writeFileSync).toHaveBeenCalled();
        const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0];
        expect(writtenPath).toBe(outEnvPath);
        // dev-id 3 => 3000 + 3*100 = 3300
        expect(writtenContent).toMatch(/^PORT=3300$/m);
      });

      it('should append PORT when PORT does not exist in envContent', async() => {
        const envPath = path.join(mockBuilderPath, '.env');
        const variablesPath = mockVariablesPath;
        const outDir = '/tmp/aifabrix-out';
        const outEnvPath = path.join(outDir, '.env');

        const variables = {
          port: 3000,
          build: {
            envOutputPath: outDir
          }
        };

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return true;
          if (filePath === outDir) return true;
          if (filePath === envPath) return true;
          return false;
        });

        // envContent without PORT
        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return yaml.dump(variables);
          if (filePath === envPath) return 'REDIS_HOST=redis\nDATABASE_URL=postgres://localhost';
          return '';
        });

        fs.writeFileSync.mockImplementation(() => {});
        fs.statSync.mockReturnValue({ isDirectory: () => false });

        const prev = process.env.AIFABRIX_DEVELOPERID;
        process.env.AIFABRIX_DEVELOPERID = '0';

        const { rewriteInfraEndpoints } = require('../../../lib/utils/env-endpoints');
        rewriteInfraEndpoints.mockResolvedValue('REDIS_HOST=redis\nDATABASE_URL=postgres://localhost\nPORT=3000\n');

        await processEnvVariables(envPath, variablesPath, null, null);

        process.env.AIFABRIX_DEVELOPERID = prev;

        expect(fs.writeFileSync).toHaveBeenCalled();
        const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0];
        expect(writtenPath).toBe(outEnvPath);
        // PORT should be appended
        expect(writtenContent).toMatch(/PORT=3000/);
        expect(writtenContent).toContain('REDIS_HOST=redis');
      });

      it('should not replace localhost URL when port does not match baseAppPort', async() => {
        const envPath = path.join(mockBuilderPath, '.env');
        const variablesPath = mockVariablesPath;
        const outDir = '/tmp/aifabrix-out';
        const outEnvPath = path.join(outDir, '.env');

        const variables = {
          port: 3000,
          build: {
            envOutputPath: outDir
          }
        };

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return true;
          if (filePath === outDir) return true;
          if (filePath === envPath) return true;
          return false;
        });

        // envContent with localhost URL on different port (not baseAppPort)
        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return yaml.dump(variables);
          if (filePath === envPath) return 'PORT=3000\nALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080';
          return '';
        });

        fs.writeFileSync.mockImplementation(() => {});
        fs.statSync.mockReturnValue({ isDirectory: () => false });

        const prev = process.env.AIFABRIX_DEVELOPERID;
        process.env.AIFABRIX_DEVELOPERID = '1';

        const { rewriteInfraEndpoints } = require('../../../lib/utils/env-endpoints');
        rewriteInfraEndpoints.mockResolvedValue('PORT=3100\nALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080');

        await processEnvVariables(envPath, variablesPath, null, null);

        process.env.AIFABRIX_DEVELOPERID = prev;

        expect(fs.writeFileSync).toHaveBeenCalled();
        const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0];
        expect(writtenPath).toBe(outEnvPath);
        // Ports 5173 and 8080 should remain unchanged (not baseAppPort 3000)
        expect(writtenContent).toContain('http://localhost:5173');
        expect(writtenContent).toContain('http://localhost:8080');
        // PORT should be updated to 3100
        expect(writtenContent).toMatch(/^PORT=3100$/m);
      });

      it('should handle config file read error gracefully', async() => {
        const envPath = path.join(mockBuilderPath, '.env');
        const variablesPath = mockVariablesPath;
        const outDir = '/tmp/aifabrix-out';
        const outEnvPath = path.join(outDir, '.env');
        const configPath = mockConfig.CONFIG_FILE;

        const variables = {
          port: 3000,
          build: {
            envOutputPath: outDir
          }
        };

        const prev = process.env.AIFABRIX_DEVELOPERID;
        delete process.env.AIFABRIX_DEVELOPERID;

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return true;
          if (filePath === outDir) return true;
          if (filePath === envPath) return true;
          if (filePath === configPath) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === variablesPath) return yaml.dump(variables);
          if (filePath === envPath) return 'PORT=3000\nREDIS_HOST=redis';
          if (filePath === configPath) {
            throw new Error('Permission denied');
          }
          return '';
        });

        fs.writeFileSync.mockImplementation(() => {});
        fs.statSync.mockReturnValue({ isDirectory: () => false });

        const { rewriteInfraEndpoints } = require('../../../lib/utils/env-endpoints');
        rewriteInfraEndpoints.mockResolvedValue('PORT=3000\nREDIS_HOST=redis');

        // Should not throw, should fallback to dev-id 0
        await processEnvVariables(envPath, variablesPath, null, null);

        process.env.AIFABRIX_DEVELOPERID = prev;

        expect(fs.writeFileSync).toHaveBeenCalled();
        const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0];
        expect(writtenPath).toBe(outEnvPath);
        // Should use base port (3000) when error occurs
        expect(writtenContent).toMatch(/^PORT=3000$/m);
      });
    });
  });
});

