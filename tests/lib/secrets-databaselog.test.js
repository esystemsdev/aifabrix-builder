/**
 * Tests for DATABASELOG_URL handling in resolve command
 *
 * @fileoverview Tests to verify DATABASELOG_URL is correctly replaced with ${VAR} references
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Mock modules
jest.mock('fs');
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/test')
}));

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  return mockChalk;
});

jest.mock('../../lib/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(1),
  setDeveloperId: jest.fn().mockResolvedValue(),
  getConfig: jest.fn().mockResolvedValue({ 'developer-id': 1 }),
  saveConfig: jest.fn().mockResolvedValue(),
  clearConfig: jest.fn().mockResolvedValue(),
  getSecretsEncryptionKey: jest.fn().mockResolvedValue(null),
  setSecretsEncryptionKey: jest.fn().mockResolvedValue(),
  getSecretsPath: jest.fn().mockResolvedValue(null),
  setSecretsPath: jest.fn().mockResolvedValue(),
  CONFIG_DIR: '/mock/config/dir',
  CONFIG_FILE: '/mock/config/dir/config.yaml'
}));

jest.mock('../../lib/utils/dev-config', () => ({
  getDevPorts: jest.fn((devId) => {
    const offset = devId * 100;
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

const config = require('../../lib/config');
const secrets = require('../../lib/secrets');

describe('DATABASELOG_URL handling in resolve command', () => {
  const appName = 'miso-controller';
  const mockHomeDir = '/home/test';
  const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
  const builderPath = path.join(process.cwd(), 'builder', appName);
  const envTemplatePath = path.join(builderPath, 'env.template');
  const variablesPath = path.join(builderPath, 'variables.yaml');
  const envPath = path.join(builderPath, '.env');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
    config.getDeveloperId.mockResolvedValue(1);

    fs.existsSync.mockImplementation((filePath) => {
      if (filePath === userSecretsPath) {
        return true;
      }
      return filePath === builderPath ||
             filePath === envTemplatePath ||
             filePath === variablesPath ||
             filePath.includes('env-config.yaml');
    });

    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === userSecretsPath) {
        return yaml.dump({
          'databases-miso-controller-0-urlKeyVault': 'postgresql://miso_user:miso_pass123@localhost:5532/miso',
          'databases-miso-controller-1-urlKeyVault': 'postgresql://miso_logs_user:miso_logs_pass123@localhost:5532/miso-logs'
        });
      }
      if (filePath === variablesPath) {
        return yaml.dump({
          port: 3000,
          build: {
            containerPort: 3000,
            localPort: 3010
          }
        });
      }
      if (filePath === envTemplatePath) {
        return `DATABASE_URL=kv://databases-miso-controller-0-urlKeyVault
DATABASELOG_URL=kv://databases-miso-controller-1-urlKeyVault
DB_HOST=localhost
DB_PORT=5432`;
      }
      if (filePath.includes('secrets.yaml')) {
        return yaml.dump({
          'databases-miso-controller-0-urlKeyVault': 'postgresql://miso_user:miso_pass123@localhost:5532/miso',
          'databases-miso-controller-1-urlKeyVault': 'postgresql://miso_logs_user:miso_logs_pass123@localhost:5532/miso-logs'
        });
      }
      if (filePath.includes('env-config.yaml')) {
        return yaml.dump({
          environments: {
            local: {
              REDIS_HOST: 'localhost',
              REDIS_PORT: 6379,
              DB_HOST: 'localhost',
              DB_PORT: 5432
            },
            docker: {
              REDIS_HOST: 'redis',
              REDIS_PORT: 6379,
              DB_HOST: 'postgres',
              DB_PORT: 5432
            }
          }
        });
      }
      return '';
    });
  });

  it('should replace DATABASELOG_URL with ${DB_HOST}:${DB_PORT} references for local environment', async() => {
    await secrets.generateEnvFile(appName, undefined, 'local');

    const writeCalls = fs.writeFileSync.mock.calls;
    const envCall = writeCalls.find(call => call[0] === envPath);
    expect(envCall).toBeDefined();
    const envContent = envCall[1];

    // DATABASELOG_URL should use ${VAR} references that get interpolated
    // After interpolation, it should have localhost:5532 (dev-id 1 adjusted port)
    expect(envContent).toContain('DATABASELOG_URL=postgresql://miso_logs_user:miso_logs_pass123@localhost:5532/miso-logs');
    // Should NOT contain hardcoded localhost:5432 in DATABASELOG_URL
    expect(envContent).not.toMatch(/DATABASELOG_URL=.*localhost:5432/);
  });

  it('should replace both DATABASE_URL and DATABASELOG_URL correctly for local environment', async() => {
    await secrets.generateEnvFile(appName, undefined, 'local');

    const writeCalls = fs.writeFileSync.mock.calls;
    const envCall = writeCalls.find(call => call[0] === envPath);
    expect(envCall).toBeDefined();
    const envContent = envCall[1];

    // Both should have localhost:5532 (dev-id 1 adjusted)
    expect(envContent).toContain('DATABASE_URL=postgresql://miso_user:miso_pass123@localhost:5532/miso');
    expect(envContent).toContain('DATABASELOG_URL=postgresql://miso_logs_user:miso_logs_pass123@localhost:5532/miso-logs');
  });

  it('should replace DATABASELOG_URL with postgres:5432 for docker environment', async() => {
    await secrets.generateEnvFile(appName, undefined, 'docker');

    const writeCalls = fs.writeFileSync.mock.calls;
    const envCall = writeCalls.find(call => call[0] === envPath);
    expect(envCall).toBeDefined();
    const envContent = envCall[1];

    // DATABASELOG_URL should use postgres (docker service name) not localhost
    expect(envContent).toContain('DATABASELOG_URL=postgresql://miso_logs_user:miso_logs_pass123@postgres:5432/miso-logs');
    // Should NOT contain localhost in DATABASELOG_URL
    expect(envContent).not.toMatch(/DATABASELOG_URL=.*localhost/);
  });
});

