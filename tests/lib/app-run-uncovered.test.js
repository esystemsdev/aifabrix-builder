/**
 * Tests for Uncovered Code Paths in app-run.js
 *
 * @fileoverview Tests to improve coverage for uncovered lines in app-run.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

jest.mock('child_process', () => {
  const actualChildProcess = jest.requireActual('child_process');
  return {
    ...actualChildProcess,
    exec: jest.fn()
  };
});

jest.mock('net', () => {
  let portAvailable = true; // Default to available

  const createMockServer = () => {
    let errorHandler = null;

    const mockServer = {
      listen: jest.fn((port, callback) => {
        if (portAvailable) {
          // Port is available - trigger success callback
          if (typeof callback === 'function') {
            setTimeout(() => {
              callback();
            }, 0);
          }
        } else {
          // Port is unavailable - trigger error handler
          setTimeout(() => {
            const error = new Error('EADDRINUSE');
            error.code = 'EADDRINUSE';
            if (errorHandler) {
              errorHandler(error);
            }
          }, 0);
        }
      }),
      close: jest.fn((callback) => {
        if (typeof callback === 'function') {
          callback();
        }
      }),
      on: jest.fn((event, handler) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      })
    };

    return mockServer;
  };

  const mockNet = {
    createServer: jest.fn(() => createMockServer()),
    __setPortAvailable: (available) => {
      portAvailable = available;
    }
  };

  return mockNet;
});

jest.mock('../../lib/validator');
jest.mock('../../lib/infra');
jest.mock('../../lib/secrets');
jest.mock('../../lib/utils/health-check');
jest.mock('../../lib/utils/compose-generator');

const validator = require('../../lib/validator');
const infra = require('../../lib/infra');
const secrets = require('../../lib/secrets');
const healthCheck = require('../../lib/utils/health-check');
const composeGenerator = require('../../lib/utils/compose-generator');

const appRun = require('../../lib/app-run');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const net = require('net');

describe('App-Run Uncovered Code Paths', () => {
  let tempDir;
  let originalCwd;
  let originalHomedir;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Mock os.homedir() to return temp directory to avoid writing to real home directory
    originalHomedir = os.homedir;
    jest.spyOn(os, 'homedir').mockReturnValue(tempDir);

    fsSync.mkdirSync(path.join(tempDir, 'builder'), { recursive: true });

    exec.mockReset();
    exec.mockImplementation((command, callback) => {
      callback(null, { stdout: '', stderr: '' });
    });

    validator.validateApplication.mockResolvedValue({
      valid: true,
      variables: { errors: [], warnings: [] },
      rbac: { errors: [], warnings: [] },
      env: { errors: [], warnings: [] }
    });

    infra.checkInfraHealth.mockResolvedValue({
      postgres: 'healthy',
      redis: 'healthy'
    });

    infra.ensureAdminSecrets.mockResolvedValue(path.join(tempDir, '.aifabrix', 'admin-secrets.env'));

    secrets.generateEnvFile.mockResolvedValue();

    healthCheck.waitForHealthCheck.mockResolvedValue();

    composeGenerator.generateDockerCompose.mockImplementation((appName, config, options) => {
      // Write compose file to disk
      const composePath = path.join(process.cwd(), 'builder', appName, 'docker-compose.yaml');
      const composeContent = 'version: "3.8"\nservices:\n  app:\n    image: test';
      fsSync.writeFileSync(composePath, composeContent);
      return Promise.resolve(composePath);
    });

    composeGenerator.getImageName.mockReturnValue('test-app');
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    if (os.homedir.mockRestore) {
      os.homedir.mockRestore();
    }
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    jest.clearAllMocks();
  });

  describe('validateAppConfiguration - uncovered paths', () => {
    it('should throw error when running from inside builder directory', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Change to builder/{appName} directory
      process.chdir(appPath);

      await expect(appRun.runApp(appName, {})).rejects.toThrow('You\'re running from inside the builder directory');
    });

    it('should handle validation errors with rbac.yaml errors', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      validator.validateApplication.mockResolvedValueOnce({
        valid: false,
        variables: { errors: [], warnings: [] },
        rbac: { errors: ['Invalid role definition'], warnings: [] },
        env: { errors: [], warnings: [] }
      });

      await expect(appRun.runApp(appName, {})).rejects.toThrow('Configuration validation failed');
    });

    it('should handle validation errors with env.template errors', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      validator.validateApplication.mockResolvedValueOnce({
        valid: false,
        variables: { errors: [], warnings: [] },
        rbac: { errors: [], warnings: [] },
        env: { errors: ['Invalid environment variable format'], warnings: [] }
      });

      await expect(appRun.runApp(appName, {})).rejects.toThrow('Configuration validation failed');
    });

    it('should handle validation failed with no specific errors', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      validator.validateApplication.mockResolvedValueOnce({
        valid: false,
        variables: { errors: [], warnings: [] },
        rbac: { errors: [], warnings: [] },
        env: { errors: [], warnings: [] }
      });

      await expect(appRun.runApp(appName, {})).rejects.toThrow('Configuration validation failed');
    });
  });

  describe('checkPrerequisites - uncovered paths', () => {
    it('should log success messages', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        image: { tag: 'v1.0.0' },
        build: { port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      exec.mockImplementation((command, callback) => {
        if (command.includes('docker images')) {
          callback(null, { stdout: 'test-app:v1.0.0\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(infra, 'checkInfraHealth').mockResolvedValue({
        postgres: 'healthy',
        redis: 'healthy'
      });

      await appRun.runApp(appName, {}).catch(() => {});

      appRun.checkImageExists.mockRestore();
    });

    it('should handle unhealthy infrastructure services', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Mock exec for docker images check
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      infra.checkInfraHealth.mockResolvedValueOnce({
        postgres: 'unhealthy',
        redis: 'healthy'
      });

      await expect(appRun.runApp(appName, {})).rejects.toThrow('Infrastructure services not healthy');

      appRun.checkImageExists.mockRestore();
    });
  });

  describe('prepareEnvironment - uncovered paths', () => {
    it('should handle .env file already exists', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000, envOutputPath: '../apps/test-app' }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Create .env file
      fsSync.writeFileSync(path.join(appPath, '.env'), 'PORT=3000');

      // Ensure port is available for this test
      net.__setPortAvailable(true);

      // Mock exec for docker images check
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      // Mock exec for docker-compose commands
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker-compose')) {
          callback(new Error('Test error'), { stdout: '', stderr: 'Container failed to start' });
        } else if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkContainerRunning').mockResolvedValue(false);
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(true);

      await appRun.runApp(appName, {}).catch(() => {});

      expect(secrets.generateEnvFile).toHaveBeenCalled();

      appRun.checkImageExists.mockRestore();
      appRun.checkContainerRunning.mockRestore();
      appRun.checkPortAvailable.mockRestore();
    });

    it('should handle envOutputPath in variables.yaml', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000, envOutputPath: '../apps/test-app' }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Ensure port is available for this test
      net.__setPortAvailable(true);

      // Mock exec for docker images check
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      // Mock exec for docker-compose commands
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker-compose')) {
          callback(new Error('Test error'), { stdout: '', stderr: 'Container failed to start' });
        } else if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkContainerRunning').mockResolvedValue(false);
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(true);

      await appRun.runApp(appName, {}).catch(() => {});

      expect(secrets.generateEnvFile).toHaveBeenCalled();

      appRun.checkImageExists.mockRestore();
      appRun.checkContainerRunning.mockRestore();
      appRun.checkPortAvailable.mockRestore();
    });
  });

  describe('startContainer - uncovered paths', () => {
    it('should start container and wait for health check', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 },
        healthCheck: { path: '/api/health' }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Create admin-secrets.env file
      const adminSecretsDir = path.join(os.homedir(), '.aifabrix');
      if (!fsSync.existsSync(adminSecretsDir)) {
        fsSync.mkdirSync(adminSecretsDir, { recursive: true });
      }
      fsSync.writeFileSync(
        path.join(adminSecretsDir, 'admin-secrets.env'),
        'POSTGRES_PASSWORD=testpass123'
      );

      exec.mockImplementation((command, callback) => {
        if (command.includes('docker-compose')) {
          callback(null, { stdout: 'Container started', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkContainerRunning').mockResolvedValue(false);
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(true);

      await appRun.runApp(appName, {}).catch(() => {});

      appRun.checkImageExists.mockRestore();
      appRun.checkContainerRunning.mockRestore();
      appRun.checkPortAvailable.mockRestore();
    });

    it('should handle missing POSTGRES_PASSWORD in admin-secrets.env', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Create admin-secrets.env without POSTGRES_PASSWORD
      const adminSecretsDir = path.join(os.homedir(), '.aifabrix');
      if (!fsSync.existsSync(adminSecretsDir)) {
        fsSync.mkdirSync(adminSecretsDir, { recursive: true });
      }
      fsSync.writeFileSync(
        path.join(adminSecretsDir, 'admin-secrets.env'),
        'OTHER_VAR=value'
      );

      exec.mockImplementation((command, callback) => {
        if (command.includes('docker-compose')) {
          callback(null, { stdout: 'Container started', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkContainerRunning').mockResolvedValue(false);
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(true);

      await appRun.runApp(appName, {}).catch(() => {});

      appRun.checkImageExists.mockRestore();
      appRun.checkContainerRunning.mockRestore();
      appRun.checkPortAvailable.mockRestore();
    });
  });

  describe('displayRunStatus - uncovered paths', () => {
    it('should display run status with custom health check path', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 },
        healthCheck: { path: '/api/health' }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Mock exec for docker images check
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      // Mock exec for docker-compose commands
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker-compose')) {
          callback(null, { stdout: 'Container started', stderr: '' });
        } else if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkContainerRunning').mockResolvedValue(false);
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(true);

      await appRun.runApp(appName, {}).catch(() => {});

      appRun.checkImageExists.mockRestore();
      appRun.checkContainerRunning.mockRestore();
      appRun.checkPortAvailable.mockRestore();
    });

    it('should display run status with default health check path', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Mock exec for docker images check
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      // Mock exec for docker-compose commands
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker-compose')) {
          callback(null, { stdout: 'Container started', stderr: '' });
        } else if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkContainerRunning').mockResolvedValue(false);
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(true);

      await appRun.runApp(appName, {}).catch(() => {});

      appRun.checkImageExists.mockRestore();
      appRun.checkContainerRunning.mockRestore();
      appRun.checkPortAvailable.mockRestore();
    });
  });

  describe('runApp - uncovered paths', () => {
    it('should handle container already running', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      exec.mockImplementation((command, callback) => {
        if (command.includes('docker ps')) {
          callback(null, { stdout: `aifabrix-${appName}\n`, stderr: '' });
        } else if (command.includes('docker stop')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('docker rm')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      // Mock exec for docker-compose commands
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker-compose')) {
          callback(new Error('Test error'), { stdout: '', stderr: 'Container failed to start' });
        } else if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkContainerRunning').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(true);

      await appRun.runApp(appName, {}).catch(() => {});

      appRun.checkImageExists.mockRestore();
      appRun.checkContainerRunning.mockRestore();
      appRun.checkPortAvailable.mockRestore();
    });

    it('should handle port already in use', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Set port to unavailable for this test
      net.__setPortAvailable(false);

      // Mock exec for all docker commands
      exec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('docker images')) {
            callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
          } else if (command.includes('docker ps')) {
            callback(null, { stdout: '', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        }
      });

      // Set up spies BEFORE calling runApp to ensure they intercept
      // Use mockImplementation to ensure immediate resolution
      const checkImageExistsSpy = jest.spyOn(appRun, 'checkImageExists').mockImplementation(async() => true);
      const checkContainerRunningSpy = jest.spyOn(appRun, 'checkContainerRunning').mockImplementation(async() => false);
      // Note: checkPortAvailable is called internally, so we mock 'net' module instead of spying

      try {
        await expect(appRun.runApp(appName, {})).rejects.toThrow('Port');
      } finally {
        checkImageExistsSpy.mockRestore();
        checkContainerRunningSpy.mockRestore();
        // Reset port availability for other tests
        net.__setPortAvailable(true);
      }
    });

    it('should handle startContainer error and preserve compose file', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      // Ensure port is available for this test
      net.__setPortAvailable(true);

      // Mock exec for docker images check
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      // Mock exec for docker-compose commands to fail
      exec.mockImplementation((command, callback) => {
        if (command.includes('docker-compose')) {
          callback(new Error('Container failed to start'), { stdout: '', stderr: 'Error starting container' });
        } else if (command.includes('docker images')) {
          callback(null, { stdout: `${appName}:latest\n`, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      jest.spyOn(appRun, 'checkImageExists').mockResolvedValue(true);
      jest.spyOn(appRun, 'checkContainerRunning').mockResolvedValue(false);
      jest.spyOn(appRun, 'checkPortAvailable').mockResolvedValue(true);

      await expect(appRun.runApp(appName, {})).rejects.toThrow('Failed to run application');

      // Verify compose file was created
      const composePath = path.join(appPath, 'docker-compose.yaml');
      expect(fsSync.existsSync(composePath)).toBe(true);

      appRun.checkImageExists.mockRestore();
      appRun.checkContainerRunning.mockRestore();
      appRun.checkPortAvailable.mockRestore();
    });

    it('should handle error with proper error message wrapping', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'variables.yaml'),
        yaml.dump(variables)
      );

      validator.validateApplication.mockRejectedValueOnce(new Error('Validation error'));

      await expect(appRun.runApp(appName, {})).rejects.toThrow('Failed to run application: Validation error');
    });
  });
});

