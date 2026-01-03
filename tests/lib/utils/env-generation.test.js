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
      MISO_PORT: '3010',
      KEYCLOAK_HOST: 'localhost',
      KEYCLOAK_PORT: '8082'
    },
    docker: {
      DB_HOST: 'postgres',
      DB_PORT: '5432',
      REDIS_HOST: 'redis',
      REDIS_PORT: '6379',
      DATAPLANE_HOST: 'dataplane',
      DATAPLANE_PORT: '3001',
      MISO_HOST: 'miso-controller',
      MISO_PORT: '3000',
      KEYCLOAK_HOST: 'keycloak',
      KEYCLOAK_PORT: '8082'
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
  }),
  getServicePort: jest.fn().mockImplementation(async(portKey, serviceName, hosts, context, devPorts) => {
    // If devPorts provided, use it (already has developer-id adjustment)
    if (devPorts && typeof devPorts[serviceName] === 'number') {
      return devPorts[serviceName];
    }
    // Get base port from hosts config
    let basePort = null;
    if (hosts && hosts[portKey] !== undefined && hosts[portKey] !== null) {
      const portVal = typeof hosts[portKey] === 'number' ? hosts[portKey] : parseInt(hosts[portKey], 10);
      if (!Number.isNaN(portVal)) {
        basePort = portVal;
      }
    }
    // Fallback to devConfig base ports
    if (basePort === null || basePort === undefined) {
      const basePorts = {
        redis: 6379,
        postgres: 5432
      };
      basePort = basePorts[serviceName];
    }
    // Apply developer-id adjustment only for local context
    if (context === 'local') {
      const config = require('../../../lib/config');
      const devId = await config.getDeveloperId();
      let devIdNum = 0;
      if (devId !== null && devId !== undefined) {
        const parsed = parseInt(devId, 10);
        if (!Number.isNaN(parsed)) {
          devIdNum = parsed;
        }
      }
      return devIdNum === 0 ? basePort : (basePort + (devIdNum * 100));
    }
    // For docker context, return base port without adjustment
    return basePort;
  }),
  getServiceHost: jest.fn().mockImplementation((host, context, defaultHost, localhostOverride) => {
    const finalHost = host || defaultHost;
    if (context === 'local' && localhostOverride && finalHost === 'localhost') {
      return localhostOverride;
    }
    return finalHost;
  }),
  getLocalhostOverride: jest.fn().mockImplementation((context) => {
    if (context !== 'local') return null;
    return null; // No override in tests by default
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

    });
  });

  describe('PORT Override Chain Scenarios', () => {
    describe('Scenario 1: All sources present', () => {
      it('should use variables.yaml build.localPort as strongest override (dev-id 1)', async() => {
        // env-config.yaml → PORT: 3000
        // config.yaml → PORT: 3010
        // variables.yaml → build.localPort: 3015 (strongest)
        // Expected: 3015 + 100 = 3115

        const variables = {
          port: 3000,
          build: {
            localPort: 3015
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath.includes('config.yaml')) {
            return yaml.dump({ environments: { local: { PORT: 3010 } } });
          }
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockVariablesPath || filePath.includes('config.yaml') || filePath.includes('env-config.yaml');
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        const envContent = 'PORT=3000';
        const result = await adjustLocalEnvPortsInContent(envContent, mockVariablesPath);

        expect(result).toMatch(/^PORT=3115$/m); // 3015 + 100
      });
    });

    describe('Scenario 2: Only variables.yaml present', () => {
      it('should use variables.yaml build.localPort when other sources missing (dev-id 1)', async() => {
        const variables = {
          port: 3000,
          build: {
            localPort: 3010
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

        const envContent = 'PORT=3000';
        const result = await adjustLocalEnvPortsInContent(envContent, mockVariablesPath);

        expect(result).toMatch(/^PORT=3110$/m); // 3010 + 100
      });
    });

    describe('Scenario 3: Only variables.yaml port (no build.localPort)', () => {
      it('should use variables.yaml port as fallback (dev-id 1)', async() => {
        const variables = {
          port: 3000
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockVariablesPath;
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        const envContent = 'PORT=3000';
        const result = await adjustLocalEnvPortsInContent(envContent, mockVariablesPath);

        expect(result).toMatch(/^PORT=3100$/m); // 3000 + 100
      });
    });

    describe('Scenario 4: Only env-config.yaml present', () => {
      it('should use env-config.yaml PORT when variables.yaml missing (dev-id 1)', async() => {
        fs.readFileSync.mockImplementation((filePath) => {
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath.includes('env-config.yaml');
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        const envContent = 'PORT=3000';
        const result = await adjustLocalEnvPortsInContent(envContent, null);

        // Should use env content PORT as fallback: 3000 + 100 = 3100
        expect(result).toMatch(/^PORT=3100$/m);
      });
    });
  });

  describe('Infrastructure Port Override Scenarios', () => {
    describe('DB_PORT override chain', () => {
      it('should use config.yaml DB_PORT override with developer-id adjustment (dev-id 1)', async() => {
        // env-config.yaml → DB_PORT: 5432
        // config.yaml → DB_PORT: 5433 (overrides)
        // Expected in buildEnvVarMap: 5433 + 100 = 5533

        const configYaml = {
          environments: {
            local: {
              DB_PORT: 5433
            }
          }
        };

        const configYamlPath = path.join(mockHomeDir, '.aifabrix', 'config.yaml');
        os.homedir.mockReturnValue(mockHomeDir);

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === configYamlPath || (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix'))) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === configYamlPath || (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix'))) {
            return yaml.dump(configYaml);
          }
          if (filePath && filePath.includes('env-config.yaml')) {
            return yaml.dump(mockEnvConfig);
          }
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        const result = await buildEnvVarMap('local', os);

        expect(result.DB_PORT).toBe('5533'); // 5433 + 100
      });
    });

    describe('REDIS_PORT override chain', () => {
      it('should use config.yaml REDIS_PORT override with developer-id adjustment (dev-id 1)', async() => {
        // env-config.yaml → REDIS_PORT: 6379
        // config.yaml → REDIS_PORT: 6380 (overrides)
        // Expected in buildEnvVarMap: 6380 + 100 = 6480

        const configYaml = {
          environments: {
            local: {
              REDIS_PORT: 6380
            }
          }
        };

        const configYamlPath = path.join(mockHomeDir, '.aifabrix', 'config.yaml');
        os.homedir.mockReturnValue(mockHomeDir);

        fs.existsSync.mockImplementation((filePath) => {
          if (filePath === configYamlPath || (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix'))) return true;
          if (filePath && filePath.includes('env-config.yaml')) return true;
          return false;
        });

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === configYamlPath || (filePath && filePath.includes('config.yaml') && filePath.includes('.aifabrix'))) {
            return yaml.dump(configYaml);
          }
          if (filePath && filePath.includes('env-config.yaml')) {
            return yaml.dump(mockEnvConfig);
          }
          return '';
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        const result = await buildEnvVarMap('local', os);

        expect(result.REDIS_PORT).toBe('6480'); // 6380 + 100
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

    describe('Developer-id adjustment for port variables', () => {
      it('should apply developer-id adjustment to DB_PORT for local context (dev-id 1)', async() => {
        mockConfig.getDeveloperId.mockResolvedValue('1');

        const result = await buildEnvVarMap('local', os);

        expect(result.DB_PORT).toBe('5532'); // 5432 + 100
      });

      it('should apply developer-id adjustment to REDIS_PORT for local context (dev-id 1)', async() => {
        mockConfig.getDeveloperId.mockResolvedValue('1');

        const result = await buildEnvVarMap('local', os);

        expect(result.REDIS_PORT).toBe('6479'); // 6379 + 100
      });

      it('should apply developer-id adjustment to KEYCLOAK_PORT for local context (dev-id 1)', async() => {
        mockConfig.getDeveloperId.mockResolvedValue('1');

        const result = await buildEnvVarMap('local', os);

        expect(result.KEYCLOAK_PORT).toBe('8182'); // 8082 + 100
      });

      it('should not apply developer-id adjustment for docker context', async() => {
        mockConfig.getDeveloperId.mockResolvedValue('1');

        const result = await buildEnvVarMap('docker', os);

        expect(result.DB_PORT).toBe('5432'); // No adjustment for docker
        expect(result.REDIS_PORT).toBe('6379'); // No adjustment for docker
      });

      it('should not apply adjustment when developer-id is 0', async() => {
        mockConfig.getDeveloperId.mockResolvedValue('0');

        const result = await buildEnvVarMap('local', os);

        expect(result.DB_PORT).toBe('5432'); // No adjustment
        expect(result.REDIS_PORT).toBe('6379'); // No adjustment
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

  describe('Complete End-to-End Scenarios', () => {
    describe('Developer ID 1, Local Context', () => {
      it('should generate all variables with developer-id adjustment', async() => {
        const variables = {
          port: 3000,
          build: {
            localPort: 3010
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath === mockTemplatePath) {
            return `PORT=3000
DB_HOST=\${DB_HOST}
DB_PORT=\${DB_PORT}
REDIS_HOST=\${REDIS_HOST}
REDIS_PORT=\${REDIS_PORT}
REDIS_URL=redis://\${REDIS_HOST}:\${REDIS_PORT}
KEYCLOAK_HOST=\${KEYCLOAK_HOST}
KEYCLOAK_PORT=\${KEYCLOAK_PORT}
MISO_HOST=\${MISO_HOST}
MISO_PORT=\${MISO_PORT}`;
          }
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockVariablesPath || filePath === mockTemplatePath || filePath.includes('env-config.yaml');
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        const { generateEnvContent } = require('../../../lib/secrets');
        const result = await generateEnvContent(mockAppName, null, 'local', false);

        // Verify PORT uses build.localPort + adjustment: 3010 + 100 = 3110
        expect(result).toMatch(/^PORT=3110$/m);
        // Verify DB_PORT uses env-config + adjustment: 5432 + 100 = 5532
        expect(result).toMatch(/^DB_PORT=5532$/m);
        // Verify REDIS_PORT uses env-config + adjustment: 6379 + 100 = 6479
        expect(result).toMatch(/^REDIS_PORT=6479$/m);
        // Verify REDIS_URL uses adjusted ports
        expect(result).toMatch(/^REDIS_URL=redis:\/\/localhost:6479$/m);
        // Verify KEYCLOAK_PORT uses env-config + adjustment: 8082 + 100 = 8182
        expect(result).toMatch(/^KEYCLOAK_PORT=8182$/m);
        // Verify MISO_PORT uses env-config + adjustment: 3010 + 100 = 3110
        expect(result).toMatch(/^MISO_PORT=3110$/m);
      });
    });

    describe('Developer ID 2, Local Context', () => {
      it('should generate all variables with developer-id adjustment', async() => {
        const variables = {
          port: 3000,
          build: {
            localPort: 3010
          }
        };

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockVariablesPath) return yaml.dump(variables);
          if (filePath === mockTemplatePath) {
            return `PORT=3000
DB_PORT=\${DB_PORT}
REDIS_PORT=\${REDIS_PORT}`;
          }
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockVariablesPath || filePath === mockTemplatePath || filePath.includes('env-config.yaml');
        });

        mockConfig.getDeveloperId.mockResolvedValue('2');

        const { generateEnvContent } = require('../../../lib/secrets');
        const result = await generateEnvContent(mockAppName, null, 'local', false);

        // Verify PORT: 3010 + 200 = 3210
        expect(result).toMatch(/^PORT=3210$/m);
        // Verify DB_PORT: 5432 + 200 = 5632
        expect(result).toMatch(/^DB_PORT=5632$/m);
        // Verify REDIS_PORT: 6379 + 200 = 6579
        expect(result).toMatch(/^REDIS_PORT=6579$/m);
      });
    });

    describe('Docker Context (no developer-id adjustment for infra ports)', () => {
      it('should use base ports without adjustment', async() => {
        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) {
            return `PORT=3000
DB_PORT=\${DB_PORT}
REDIS_PORT=\${REDIS_PORT}`;
          }
          return '';
        });

        fs.existsSync.mockImplementation((filePath) => {
          return filePath === mockTemplatePath || filePath.includes('env-config.yaml');
        });

        mockConfig.getDeveloperId.mockResolvedValue('1');

        const { generateEnvContent } = require('../../../lib/secrets');
        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        // Verify DB_PORT: 5432 (no adjustment for docker)
        expect(result).toMatch(/^DB_PORT=5432$/m);
        // Verify REDIS_PORT: 6379 (no adjustment for docker)
        expect(result).toMatch(/^REDIS_PORT=6379$/m);
      });
    });

    describe('Docker Context (Public Port Adjustment)', () => {
      it('should generate public ports for developer ID 1', async() => {
        const mockTemplateContent = `MISO_PORT=\${MISO_PORT}
MISO_PUBLIC_PORT=\${MISO_PUBLIC_PORT}
KEYCLOAK_PORT=\${KEYCLOAK_PORT}
KEYCLOAK_PUBLIC_PORT=\${KEYCLOAK_PUBLIC_PORT}
DB_PORT=\${DB_PORT}
DB_PUBLIC_PORT=\${DB_PUBLIC_PORT}
REDIS_PORT=\${REDIS_PORT}
REDIS_PUBLIC_PORT=\${REDIS_PUBLIC_PORT}`;

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return mockTemplateContent;
          return '';
        });
        fs.existsSync.mockReturnValue(true);
        mockConfig.getDeveloperId.mockResolvedValue('1');

        const { generateEnvContent } = require('../../../lib/secrets');
        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        expect(result).toMatch(/^MISO_PORT=3000$/m);
        expect(result).toMatch(/^MISO_PUBLIC_PORT=3100$/m);
        expect(result).toMatch(/^KEYCLOAK_PORT=8082$/m);
        expect(result).toMatch(/^KEYCLOAK_PUBLIC_PORT=8182$/m);
        expect(result).toMatch(/^DB_PORT=5432$/m);
        expect(result).toMatch(/^DB_PUBLIC_PORT=5532$/m);
        expect(result).toMatch(/^REDIS_PORT=6379$/m);
        expect(result).toMatch(/^REDIS_PUBLIC_PORT=6479$/m);
      });

      it('should generate public ports for developer ID 2', async() => {
        const mockTemplateContent = `MISO_PORT=\${MISO_PORT}
MISO_PUBLIC_PORT=\${MISO_PUBLIC_PORT}
KEYCLOAK_PORT=\${KEYCLOAK_PORT}
KEYCLOAK_PUBLIC_PORT=\${KEYCLOAK_PUBLIC_PORT}`;

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return mockTemplateContent;
          return '';
        });
        fs.existsSync.mockReturnValue(true);
        mockConfig.getDeveloperId.mockResolvedValue('2');

        const { generateEnvContent } = require('../../../lib/secrets');
        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        expect(result).toMatch(/^MISO_PORT=3000$/m);
        expect(result).toMatch(/^MISO_PUBLIC_PORT=3200$/m);
        expect(result).toMatch(/^KEYCLOAK_PORT=8082$/m);
        expect(result).toMatch(/^KEYCLOAK_PUBLIC_PORT=8282$/m);
      });

      it('should not generate public ports for developer ID 0', async() => {
        const mockTemplateContent = `MISO_PORT=\${MISO_PORT}
MISO_PUBLIC_PORT=\${MISO_PUBLIC_PORT}`;

        fs.readFileSync.mockImplementation((filePath) => {
          if (filePath === mockTemplatePath) return mockTemplateContent;
          return '';
        });
        fs.existsSync.mockReturnValue(true);
        mockConfig.getDeveloperId.mockResolvedValue('0');

        const { generateEnvContent } = require('../../../lib/secrets');
        const result = await generateEnvContent(mockAppName, null, 'docker', false);

        expect(result).toMatch(/^MISO_PORT=3000$/m);
        // When MISO_PUBLIC_PORT is undefined (dev-id 0), Handlebars outputs the literal variable name
        // So we check that it's not a valid port number (3100, 3200, etc.)
        expect(result).not.toMatch(/^MISO_PUBLIC_PORT=(3100|3200|3300|5532|6479|8182|8282)/m);
        // The variable should either be undefined (literal ${MISO_PUBLIC_PORT}) or empty
        expect(result).toMatch(/MISO_PUBLIC_PORT=\$\{MISO_PUBLIC_PORT\}/);
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

