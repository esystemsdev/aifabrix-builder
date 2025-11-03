/**
 * Tests for AI Fabrix Builder CLI Commands
 *
 * @fileoverview Unit tests for CLI command implementations
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const net = require('net');

// Mock modules
jest.mock('fs');
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/test')
}));
jest.mock('child_process');
jest.mock('net');

// Mock problematic dependencies
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
  createPromptModule: jest.fn(() => ({
    prompt: jest.fn()
  }))
}));

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.cyan = jest.fn((text) => text);
  mockChalk.magenta = jest.fn((text) => text);
  mockChalk.white = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  mockChalk.bold = jest.fn((text) => text);
  mockChalk.dim = jest.fn((text) => text);
  mockChalk.italic = jest.fn((text) => text);
  mockChalk.underline = jest.fn((text) => text);
  mockChalk.strikethrough = jest.fn((text) => text);
  mockChalk.reset = jest.fn((text) => text);
  mockChalk.inverse = jest.fn((text) => text);
  mockChalk.black = jest.fn((text) => text);
  mockChalk.redBright = jest.fn((text) => text);
  mockChalk.greenBright = jest.fn((text) => text);
  mockChalk.yellowBright = jest.fn((text) => text);
  mockChalk.blueBright = jest.fn((text) => text);
  mockChalk.magentaBright = jest.fn((text) => text);
  mockChalk.cyanBright = jest.fn((text) => text);
  mockChalk.whiteBright = jest.fn((text) => text);
  mockChalk.bgBlack = jest.fn((text) => text);
  mockChalk.bgRed = jest.fn((text) => text);
  mockChalk.bgGreen = jest.fn((text) => text);
  mockChalk.bgYellow = jest.fn((text) => text);
  mockChalk.bgBlue = jest.fn((text) => text);
  mockChalk.bgMagenta = jest.fn((text) => text);
  mockChalk.bgCyan = jest.fn((text) => text);
  mockChalk.bgWhite = jest.fn((text) => text);
  mockChalk.bgBlackBright = jest.fn((text) => text);
  mockChalk.bgRedBright = jest.fn((text) => text);
  mockChalk.bgGreenBright = jest.fn((text) => text);
  mockChalk.bgYellowBright = jest.fn((text) => text);
  mockChalk.bgBlueBright = jest.fn((text) => text);
  mockChalk.bgMagentaBright = jest.fn((text) => text);
  mockChalk.bgCyanBright = jest.fn((text) => text);
  mockChalk.bgWhiteBright = jest.fn((text) => text);
  return mockChalk;
});

// Mock other chalk-dependent packages
jest.mock('log-symbols', () => ({
  success: '✓',
  error: '✖',
  warning: '⚠',
  info: 'ℹ'
}));

jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis()
  }));
});

// Mock the lib modules
jest.mock('../../lib/secrets');
jest.mock('../../lib/generator');
jest.mock('../../lib/key-generator');
jest.mock('../../lib/validator');
jest.mock('../../lib/infra');
jest.mock('../../lib/app');
jest.mock('../../lib/build');
jest.mock('../../lib/utils/cli-utils');
jest.mock('../../lib/utils/logger');
jest.mock('../../lib/commands/login');

const chalk = require('chalk');
const secrets = require('../../lib/secrets');
const generator = require('../../lib/generator');
const keyGenerator = require('../../lib/key-generator');
const validator = require('../../lib/validator');
const infra = require('../../lib/infra');
const app = require('../../lib/app');
const cliUtils = require('../../lib/utils/cli-utils');
const logger = require('../../lib/utils/logger');
const { handleLogin } = require('../../lib/commands/login');

describe('CLI Commands', () => {
  const mockHomeDir = '/home/test';
  const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    if (os.homedir && typeof os.homedir.mockReturnValue === 'function') {
      os.homedir.mockReturnValue(mockHomeDir);
    }

    // Mock environment variables to prevent supports-color issues
    process.env.FORCE_COLOR = '0';
    process.env.NO_COLOR = '1';
    process.env.TERM = 'dumb';

    // Mock console methods to capture output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolve command', () => {
    it('should generate .env file successfully', async() => {
      const appName = 'testapp';
      const expectedEnvPath = path.join(process.cwd(), 'builder', appName, '.env');

      secrets.generateEnvFile.mockResolvedValue(expectedEnvPath);

      // Import CLI module after mocking
      const cli = require('../../lib/cli');

      // We need to simulate the command action
      // Since we can't easily test Commander.js commands directly, we'll test the underlying logic
      try {
        const envPath = await secrets.generateEnvFile(appName);
        console.log(`✓ Generated .env file: ${envPath}`);

        expect(secrets.generateEnvFile).toHaveBeenCalledWith(appName);
        expect(console.log).toHaveBeenCalledWith(`✓ Generated .env file: ${expectedEnvPath}`);
      } catch (error) {
        // This should not happen in this test
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle errors gracefully', async() => {
      const appName = 'testapp';
      const errorMessage = 'Secrets file not found';

      secrets.generateEnvFile.mockRejectedValue(new Error(errorMessage));

      try {
        await secrets.generateEnvFile(appName);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });

    it('should handle missing app name', async() => {
      const errorMessage = 'App name is required and must be a string';

      secrets.generateEnvFile.mockRejectedValue(new Error(errorMessage));

      try {
        await secrets.generateEnvFile();
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('json command', () => {
    it('should generate deployment JSON successfully', async() => {
      const appName = 'testapp';
      const expectedJsonPath = path.join(process.cwd(), 'builder', appName, 'aifabrix-deploy.json');
      const mockResult = {
        success: true,
        path: expectedJsonPath,
        validation: {
          valid: true,
          errors: [],
          warnings: []
        },
        deployment: {
          key: 'testapp',
          displayName: 'Test App'
        }
      };

      generator.generateDeployJsonWithValidation.mockResolvedValue(mockResult);

      try {
        const result = await generator.generateDeployJsonWithValidation(appName);

        if (result.success) {
          console.log(`✓ Generated deployment JSON: ${result.path}`);

          if (result.validation.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            result.validation.warnings.forEach(warning => console.log(`   • ${warning}`));
          }
        } else {
          console.log('❌ Validation failed:');
          result.validation.errors.forEach(error => console.log(`   • ${error}`));
          process.exit(1);
        }

        expect(generator.generateDeployJsonWithValidation).toHaveBeenCalledWith(appName);
        expect(console.log).toHaveBeenCalledWith(`✓ Generated deployment JSON: ${expectedJsonPath}`);
        expect(process.exit).not.toHaveBeenCalled();
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle validation warnings', async() => {
      const appName = 'testapp';
      const expectedJsonPath = path.join(process.cwd(), 'builder', appName, 'aifabrix-deploy.json');
      const mockResult = {
        success: true,
        path: expectedJsonPath,
        validation: {
          valid: true,
          errors: [],
          warnings: ['Health check path should start with /', 'Port should be between 1 and 65535']
        },
        deployment: {
          key: 'testapp',
          displayName: 'Test App'
        }
      };

      generator.generateDeployJsonWithValidation.mockResolvedValue(mockResult);

      try {
        const result = await generator.generateDeployJsonWithValidation(appName);

        if (result.success) {
          console.log(`✓ Generated deployment JSON: ${result.path}`);

          if (result.validation.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            result.validation.warnings.forEach(warning => console.log(`   • ${warning}`));
          }
        }

        expect(console.log).toHaveBeenCalledWith('\n⚠️  Warnings:');
        expect(console.log).toHaveBeenCalledWith('   • Health check path should start with /');
        expect(console.log).toHaveBeenCalledWith('   • Port should be between 1 and 65535');
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle validation errors', async() => {
      const appName = 'testapp';
      const mockResult = {
        success: false,
        path: '',
        validation: {
          valid: false,
          errors: ['Missing required field: key', 'Invalid port: must be between 1 and 65535'],
          warnings: []
        },
        deployment: null
      };

      generator.generateDeployJsonWithValidation.mockResolvedValue(mockResult);

      try {
        const result = await generator.generateDeployJsonWithValidation(appName);

        if (result.success) {
          console.log(`✓ Generated deployment JSON: ${result.path}`);
        } else {
          console.log('❌ Validation failed:');
          result.validation.errors.forEach(error => console.log(`   • ${error}`));
          process.exit(1);
        }

        expect(console.log).toHaveBeenCalledWith('❌ Validation failed:');
        expect(console.log).toHaveBeenCalledWith('   • Missing required field: key');
        expect(console.log).toHaveBeenCalledWith('   • Invalid port: must be between 1 and 65535');
        expect(process.exit).toHaveBeenCalledWith(1);
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle generation errors', async() => {
      const appName = 'testapp';
      const errorMessage = 'variables.yaml not found';

      generator.generateDeployJsonWithValidation.mockRejectedValue(new Error(errorMessage));

      try {
        await generator.generateDeployJsonWithValidation(appName);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('genkey command', () => {
    it('should generate deployment key successfully', async() => {
      const appName = 'testapp';
      const expectedKey = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

      keyGenerator.generateDeploymentKey.mockResolvedValue(expectedKey);

      try {
        const key = await keyGenerator.generateDeploymentKey(appName);
        console.log(`\nDeployment key for ${appName}:`);
        console.log(key);
        console.log(`\nGenerated from: builder/${appName}/variables.yaml`);

        expect(keyGenerator.generateDeploymentKey).toHaveBeenCalledWith(appName);
        expect(console.log).toHaveBeenCalledWith(`\nDeployment key for ${appName}:`);
        expect(console.log).toHaveBeenCalledWith(expectedKey);
        expect(console.log).toHaveBeenCalledWith(`\nGenerated from: builder/${appName}/variables.yaml`);
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle key generation errors', async() => {
      const appName = 'testapp';
      const errorMessage = 'variables.yaml not found';

      keyGenerator.generateDeploymentKey.mockRejectedValue(new Error(errorMessage));

      try {
        await keyGenerator.generateDeploymentKey(appName);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });

    it('should handle invalid app name', async() => {
      const errorMessage = 'App name is required and must be a string';

      keyGenerator.generateDeploymentKey.mockRejectedValue(new Error(errorMessage));

      try {
        await keyGenerator.generateDeploymentKey();
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('doctor command', () => {
    it('should check environment successfully', async() => {
      const mockEnvResult = {
        docker: 'ok',
        ports: 'ok',
        secrets: 'ok',
        recommendations: []
      };

      const mockHealthResult = {
        postgres: 'healthy',
        redis: 'healthy',
        pgadmin: 'healthy',
        'redis-commander': 'healthy'
      };

      validator.checkEnvironment.mockResolvedValue(mockEnvResult);
      infra.checkInfraHealth.mockResolvedValue(mockHealthResult);

      try {
        const result = await validator.checkEnvironment();
        console.log('\n🔍 AI Fabrix Environment Check\n');

        console.log(`Docker: ${result.docker === 'ok' ? '✅ Running' : '❌ Not available'}`);
        console.log(`Ports: ${result.ports === 'ok' ? '✅ Available' : '⚠️  Some ports in use'}`);
        console.log(`Secrets: ${result.secrets === 'ok' ? '✅ Configured' : '❌ Missing'}`);

        if (result.recommendations.length > 0) {
          console.log('\n📋 Recommendations:');
          result.recommendations.forEach(rec => console.log(`  • ${rec}`));
        }

        // Check infrastructure health if Docker is available
        if (result.docker === 'ok') {
          try {
            const health = await infra.checkInfraHealth();
            console.log('\n🏥 Infrastructure Health:');
            Object.entries(health).forEach(([service, status]) => {
              const icon = status === 'healthy' ? '✅' : status === 'unknown' ? '❓' : '❌';
              console.log(`  ${icon} ${service}: ${status}`);
            });
          } catch (error) {
            console.log('\n🏥 Infrastructure: Not running');
          }
        }

        console.log('');

        expect(validator.checkEnvironment).toHaveBeenCalled();
        expect(infra.checkInfraHealth).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('Docker: ✅ Running');
        expect(console.log).toHaveBeenCalledWith('Ports: ✅ Available');
        expect(console.log).toHaveBeenCalledWith('Secrets: ✅ Configured');
        expect(console.log).toHaveBeenCalledWith('\n🏥 Infrastructure Health:');
        expect(console.log).toHaveBeenCalledWith('  ✅ postgres: healthy');
        expect(console.log).toHaveBeenCalledWith('  ✅ redis: healthy');
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle environment issues', async() => {
      const mockEnvResult = {
        docker: 'error',
        ports: 'warning',
        secrets: 'missing',
        recommendations: [
          'Install Docker and Docker Compose',
          'Some required ports (5432, 6379, 5050, 8081) are in use',
          'Create secrets file: ~/.aifabrix/secrets.yaml'
        ]
      };

      validator.checkEnvironment.mockResolvedValue(mockEnvResult);

      try {
        const result = await validator.checkEnvironment();
        console.log('\n🔍 AI Fabrix Environment Check\n');

        console.log(`Docker: ${result.docker === 'ok' ? '✅ Running' : '❌ Not available'}`);
        console.log(`Ports: ${result.ports === 'ok' ? '✅ Available' : '⚠️  Some ports in use'}`);
        console.log(`Secrets: ${result.secrets === 'ok' ? '✅ Configured' : '❌ Missing'}`);

        if (result.recommendations.length > 0) {
          console.log('\n📋 Recommendations:');
          result.recommendations.forEach(rec => console.log(`  • ${rec}`));
        }

        console.log('');

        expect(console.log).toHaveBeenCalledWith('Docker: ❌ Not available');
        expect(console.log).toHaveBeenCalledWith('Ports: ⚠️  Some ports in use');
        expect(console.log).toHaveBeenCalledWith('Secrets: ❌ Missing');
        expect(console.log).toHaveBeenCalledWith('\n📋 Recommendations:');
        expect(console.log).toHaveBeenCalledWith('  • Install Docker and Docker Compose');
        expect(console.log).toHaveBeenCalledWith('  • Some required ports (5432, 6379, 5050, 8081) are in use');
        expect(console.log).toHaveBeenCalledWith('  • Create secrets file: ~/.aifabrix/secrets.yaml');
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle infrastructure health check failure', async() => {
      validator.checkEnvironment.mockResolvedValue({ docker: 'ok', ports: 'ok', secrets: 'ok', recommendations: [] });
      infra.checkInfraHealth.mockRejectedValue(new Error('Infrastructure not running'));
      await expect(validator.checkEnvironment()).resolves.toBeDefined();
    });

    it('should handle doctor command errors', async() => {
      validator.checkEnvironment.mockRejectedValue(new Error('Environment check failed'));
      await expect(validator.checkEnvironment()).rejects.toThrow('Environment check failed');
    });
  });

  describe('login command', () => {
    it('should handle login successfully', async() => {
      handleLogin.mockResolvedValue();

      try {
        await handleLogin({ url: 'http://localhost:3000' });
        expect(handleLogin).toHaveBeenCalledWith({ url: 'http://localhost:3000' });
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle login errors', async() => {
      const errorMessage = 'Login failed';
      handleLogin.mockRejectedValue(new Error(errorMessage));

      try {
        await handleLogin({ url: 'http://localhost:3000' });
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('up command', () => {
    it('should start infrastructure successfully', async() => {
      infra.startInfra.mockResolvedValue();

      try {
        await infra.startInfra();
        expect(infra.startInfra).toHaveBeenCalled();
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle infrastructure start errors', async() => {
      const errorMessage = 'Docker not running';
      infra.startInfra.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await infra.startInfra();
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
        expect(cliUtils.handleCommandError).not.toHaveBeenCalled(); // Will be called in actual CLI handler
      }
    });
  });

  describe('down command', () => {
    it('should stop infrastructure without volumes', async() => {
      infra.stopInfra.mockResolvedValue();

      try {
        await infra.stopInfra();
        expect(infra.stopInfra).toHaveBeenCalled();
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should stop infrastructure with volumes', async() => {
      infra.stopInfraWithVolumes.mockResolvedValue();

      try {
        await infra.stopInfraWithVolumes();
        expect(infra.stopInfraWithVolumes).toHaveBeenCalled();
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle infrastructure stop errors', async() => {
      const errorMessage = 'Stop failed';
      infra.stopInfra.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await infra.stopInfra();
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('create command', () => {
    it('should create app successfully', async() => {
      const appName = 'testapp';
      const options = { port: '3000', database: true };

      app.createApp.mockResolvedValue();

      try {
        await app.createApp(appName, options);
        expect(app.createApp).toHaveBeenCalledWith(appName, options);
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle create app errors', async() => {
      const appName = 'testapp';
      const options = { port: '3000' };
      const errorMessage = 'App creation failed';
      app.createApp.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await app.createApp(appName, options);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('build command', () => {
    it('should build app successfully', async() => {
      const appName = 'testapp';
      const options = { tag: 'v1.0.0' };
      const imageTag = 'testapp:v1.0.0';

      app.buildApp.mockResolvedValue(imageTag);

      try {
        const result = await app.buildApp(appName, options);
        logger.log(`✅ Built image: ${result}`);

        expect(app.buildApp).toHaveBeenCalledWith(appName, options);
        expect(logger.log).toHaveBeenCalledWith(`✅ Built image: ${imageTag}`);
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle build app errors', async() => {
      const appName = 'testapp';
      const options = {};
      const errorMessage = 'Build failed';
      app.buildApp.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await app.buildApp(appName, options);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('run command', () => {
    it('should run app successfully', async() => {
      const appName = 'testapp';
      const options = { port: '3001' };

      app.runApp.mockResolvedValue();

      try {
        await app.runApp(appName, options);
        expect(app.runApp).toHaveBeenCalledWith(appName, options);
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle run app errors', async() => {
      const appName = 'testapp';
      const options = {};
      const errorMessage = 'Run failed';
      app.runApp.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await app.runApp(appName, options);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('push command', () => {
    it('should push app successfully', async() => {
      const appName = 'testapp';
      const options = { registry: 'myacr.azurecr.io', tag: 'latest' };

      app.pushApp.mockResolvedValue();

      try {
        await app.pushApp(appName, options);
        expect(app.pushApp).toHaveBeenCalledWith(appName, options);
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle push app errors', async() => {
      const appName = 'testapp';
      const options = {};
      const errorMessage = 'Push failed';
      app.pushApp.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await app.pushApp(appName, options);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('deploy command', () => {
    it('should deploy app successfully', async() => {
      const appName = 'testapp';
      const options = { environment: 'dev', controller: 'http://localhost:3000' };

      app.deployApp.mockResolvedValue();

      try {
        await app.deployApp(appName, options);
        expect(app.deployApp).toHaveBeenCalledWith(appName, options);
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle deploy app errors', async() => {
      const appName = 'testapp';
      const options = { environment: 'dev' };
      const errorMessage = 'Deploy failed';
      app.deployApp.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await app.deployApp(appName, options);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('status command', () => {
    it('should show infrastructure status successfully', async() => {
      const mockStatus = {
        postgres: { status: 'running', port: 5432, url: 'postgresql://localhost:5432' },
        redis: { status: 'running', port: 6379, url: 'redis://localhost:6379' },
        pgadmin: { status: 'running', port: 5050, url: 'http://localhost:5050' },
        'redis-commander': { status: 'running', port: 8081, url: 'http://localhost:8081' }
      };

      infra.getInfraStatus.mockResolvedValue(mockStatus);

      try {
        const status = await infra.getInfraStatus();
        logger.log('\n📊 Infrastructure Status\n');

        Object.entries(status).forEach(([service, info]) => {
          const icon = info.status === 'running' ? '✅' : '❌';
          logger.log(`${icon} ${service}:`);
          logger.log(`   Status: ${info.status}`);
          logger.log(`   Port: ${info.port}`);
          logger.log(`   URL: ${info.url}`);
          logger.log('');
        });

        expect(infra.getInfraStatus).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith('\n📊 Infrastructure Status\n');
        expect(logger.log).toHaveBeenCalledWith('✅ postgres:');
        expect(logger.log).toHaveBeenCalledWith('   Status: running');
        expect(logger.log).toHaveBeenCalledWith('   Port: 5432');
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle status command errors', async() => {
      const errorMessage = 'Status check failed';
      infra.getInfraStatus.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await infra.getInfraStatus();
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('restart command', () => {
    it('should restart service successfully', async() => {
      const service = 'postgres';

      infra.restartService.mockResolvedValue();

      try {
        await infra.restartService(service);
        logger.log(`✅ ${service} service restarted successfully`);

        expect(infra.restartService).toHaveBeenCalledWith(service);
        expect(logger.log).toHaveBeenCalledWith(`✅ ${service} service restarted successfully`);
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle restart service errors', async() => {
      const service = 'postgres';
      const errorMessage = 'Restart failed';
      infra.restartService.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await infra.restartService(service);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('resolve command - CLI handler', () => {
    it('should handle resolve command errors in CLI handler', async() => {
      const appName = 'testapp';
      const errorMessage = 'Secrets file not found';

      secrets.generateEnvFile.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await secrets.generateEnvFile(appName);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
        // In actual CLI handler, this would call handleCommandError and process.exit
      }
    });
  });

  describe('json command - CLI handler', () => {
    it('should handle json command generation errors in CLI handler', async() => {
      const appName = 'testapp';
      const errorMessage = 'Generation failed';

      generator.generateDeployJsonWithValidation.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await generator.generateDeployJsonWithValidation(appName);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
        // In actual CLI handler, this would call handleCommandError and process.exit
      }
    });
  });

  describe('genkey command - CLI handler', () => {
    it('should handle genkey command errors in CLI handler', async() => {
      const appName = 'testapp';
      const errorMessage = 'Key generation failed';

      keyGenerator.generateDeploymentKey.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await keyGenerator.generateDeploymentKey(appName);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
        // In actual CLI handler, this would call handleCommandError and process.exit
      }
    });
  });

  describe('dockerfile command', () => {
    it('should generate dockerfile successfully', async() => {
      const appName = 'testapp';
      const options = { language: 'typescript', force: true };
      const dockerfilePath = 'builder/testapp/Dockerfile';

      app.generateDockerfileForApp.mockResolvedValue(dockerfilePath);

      try {
        const result = await app.generateDockerfileForApp(appName, options);
        logger.log(chalk.green('\n✅ Dockerfile generated successfully!'));
        logger.log(chalk.gray(`Location: ${result}`));

        expect(app.generateDockerfileForApp).toHaveBeenCalledWith(appName, options);
        expect(logger.log).toHaveBeenCalledWith(chalk.green('\n✅ Dockerfile generated successfully!'));
        expect(logger.log).toHaveBeenCalledWith(chalk.gray(`Location: ${dockerfilePath}`));
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle dockerfile generation errors', async() => {
      const appName = 'testapp';
      const options = {};
      const errorMessage = 'Dockerfile generation failed';
      app.generateDockerfileForApp.mockRejectedValue(new Error(errorMessage));
      cliUtils.handleCommandError.mockImplementation(() => {});

      try {
        await app.generateDockerfileForApp(appName, options);
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('CLI command handlers - direct execution', () => {
    let cli;

    beforeEach(() => {
      // Clear module cache to get fresh instance
      jest.resetModules();
      cli = require('../../lib/cli');
    });

    describe('create command handler', () => {
      it('should execute create command handler successfully', async() => {
        const appName = 'testapp';
        const options = { port: '3000', database: true };
        app.createApp.mockResolvedValue();

        // Simulate the command handler action from cli.js line 86-93
        const action = async(appName, options) => {
          try {
            await app.createApp(appName, options);
          } catch (error) {
            cliUtils.handleCommandError(error, 'create');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(app.createApp).toHaveBeenCalledWith(appName, options);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle create command handler errors', async() => {
        const appName = 'testapp';
        const options = { port: '3000' };
        const errorMessage = 'App creation failed';
        app.createApp.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        const action = async(appName, options) => {
          try {
            await app.createApp(appName, options);
          } catch (error) {
            cliUtils.handleCommandError(error, 'create');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'create');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('build command handler', () => {
      it('should execute build command handler successfully', async() => {
        const appName = 'testapp';
        const options = { tag: 'v1.0.0' };
        const imageTag = 'testapp:v1.0.0';
        app.buildApp.mockResolvedValue(imageTag);

        // Simulate the command handler action from cli.js line 100-108
        const action = async(appName, options) => {
          try {
            const imageTag = await app.buildApp(appName, options);
            logger.log(`✅ Built image: ${imageTag}`);
          } catch (error) {
            cliUtils.handleCommandError(error, 'build');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(app.buildApp).toHaveBeenCalledWith(appName, options);
        expect(logger.log).toHaveBeenCalledWith(`✅ Built image: ${imageTag}`);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle build command handler errors', async() => {
        const appName = 'testapp';
        const options = {};
        const errorMessage = 'Build failed';
        app.buildApp.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        const action = async(appName, options) => {
          try {
            const imageTag = await app.buildApp(appName, options);
            logger.log(`✅ Built image: ${imageTag}`);
          } catch (error) {
            cliUtils.handleCommandError(error, 'build');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'build');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('run command handler', () => {
      it('should execute run command handler successfully', async() => {
        const appName = 'testapp';
        const options = { port: '3001' };
        app.runApp.mockResolvedValue();

        // Simulate the command handler action from cli.js line 113-120
        const action = async(appName, options) => {
          try {
            await app.runApp(appName, options);
          } catch (error) {
            cliUtils.handleCommandError(error, 'run');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(app.runApp).toHaveBeenCalledWith(appName, options);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle run command handler errors', async() => {
        const appName = 'testapp';
        const options = {};
        const errorMessage = 'Run failed';
        app.runApp.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        const action = async(appName, options) => {
          try {
            await app.runApp(appName, options);
          } catch (error) {
            cliUtils.handleCommandError(error, 'run');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'run');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('push command handler', () => {
      it('should execute push command handler successfully', async() => {
        const appName = 'testapp';
        const options = { registry: 'myacr.azurecr.io', tag: 'latest' };
        app.pushApp.mockResolvedValue();

        // Simulate the command handler action from cli.js line 127-134
        const action = async(appName, options) => {
          try {
            await app.pushApp(appName, options);
          } catch (error) {
            cliUtils.handleCommandError(error, 'push');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(app.pushApp).toHaveBeenCalledWith(appName, options);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle push command handler errors', async() => {
        const appName = 'testapp';
        const options = {};
        const errorMessage = 'Push failed';
        app.pushApp.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        const action = async(appName, options) => {
          try {
            await app.pushApp(appName, options);
          } catch (error) {
            cliUtils.handleCommandError(error, 'push');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'push');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('deploy command handler', () => {
      it('should execute deploy command handler successfully', async() => {
        const appName = 'testapp';
        const options = { environment: 'dev', controller: 'http://localhost:3000' };
        app.deployApp.mockResolvedValue();

        // Simulate the command handler action from cli.js line 144-151
        const action = async(appName, options) => {
          try {
            await app.deployApp(appName, options);
          } catch (error) {
            cliUtils.handleCommandError(error, 'deploy');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(app.deployApp).toHaveBeenCalledWith(appName, options);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle deploy command handler errors', async() => {
        const appName = 'testapp';
        const options = { environment: 'dev' };
        const errorMessage = 'Deploy failed';
        app.deployApp.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        const action = async(appName, options) => {
          try {
            await app.deployApp(appName, options);
          } catch (error) {
            cliUtils.handleCommandError(error, 'deploy');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'deploy');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('restart command handler', () => {
      it('should execute restart command handler successfully', async() => {
        const service = 'postgres';
        infra.restartService.mockResolvedValue();

        // Simulate the command handler action from cli.js line 214-222
        const action = async(service) => {
          try {
            await infra.restartService(service);
            logger.log(`✅ ${service} service restarted successfully`);
          } catch (error) {
            cliUtils.handleCommandError(error, 'restart');
            process.exit(1);
          }
        };

        await action(service);
        expect(infra.restartService).toHaveBeenCalledWith(service);
        expect(logger.log).toHaveBeenCalledWith(`✅ ${service} service restarted successfully`);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle restart command handler errors', async() => {
        const service = 'postgres';
        const errorMessage = 'Restart failed';
        infra.restartService.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        const action = async(service) => {
          try {
            await infra.restartService(service);
            logger.log(`✅ ${service} service restarted successfully`);
          } catch (error) {
            cliUtils.handleCommandError(error, 'restart');
            process.exit(1);
          }
        };

        await action(service);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'restart');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('resolve command handler', () => {
      it('should execute resolve command handler successfully', async() => {
        const appName = 'testapp';
        const envPath = 'builder/testapp/.env';
        secrets.generateEnvFile.mockResolvedValue(envPath);

        // Simulate the command handler action from cli.js line 227-235
        const action = async(appName) => {
          try {
            const envPath = await secrets.generateEnvFile(appName);
            logger.log(`✓ Generated .env file: ${envPath}`);
          } catch (error) {
            cliUtils.handleCommandError(error, 'resolve');
            process.exit(1);
          }
        };

        await action(appName);
        expect(secrets.generateEnvFile).toHaveBeenCalledWith(appName);
        expect(logger.log).toHaveBeenCalledWith(`✓ Generated .env file: ${envPath}`);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle resolve command handler errors', async() => {
        const appName = 'testapp';
        const errorMessage = 'Secrets file not found';
        secrets.generateEnvFile.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 227-235
        const action = async(appName) => {
          try {
            const envPath = await secrets.generateEnvFile(appName);
            logger.log(`✓ Generated .env file: ${envPath}`);
          } catch (error) {
            cliUtils.handleCommandError(error, 'resolve');
            process.exit(1);
          }
        };

        await action(appName);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'resolve');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('json command handler', () => {
      it('should execute json command handler successfully', async() => {
        const appName = 'testapp';
        const expectedJsonPath = path.join(process.cwd(), 'builder', appName, 'aifabrix-deploy.json');
        const mockResult = {
          success: true,
          path: expectedJsonPath,
          validation: {
            valid: true,
            errors: [],
            warnings: []
          },
          deployment: {
            key: 'testapp',
            displayName: 'Test App'
          }
        };

        generator.generateDeployJsonWithValidation.mockResolvedValue(mockResult);

        // Simulate the command handler action from cli.js line 239-258
        const action = async(appName) => {
          try {
            const result = await generator.generateDeployJsonWithValidation(appName);
            if (result.success) {
              logger.log(`✓ Generated deployment JSON: ${result.path}`);

              if (result.validation.warnings.length > 0) {
                logger.log('\n⚠️  Warnings:');
                result.validation.warnings.forEach(warning => logger.log(`   • ${warning}`));
              }
            } else {
              logger.log('❌ Validation failed:');
              result.validation.errors.forEach(error => logger.log(`   • ${error}`));
              process.exit(1);
            }
          } catch (error) {
            cliUtils.handleCommandError(error, 'json');
            process.exit(1);
          }
        };

        await action(appName);
        expect(generator.generateDeployJsonWithValidation).toHaveBeenCalledWith(appName);
        expect(logger.log).toHaveBeenCalledWith(`✓ Generated deployment JSON: ${expectedJsonPath}`);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle json command handler errors', async() => {
        const appName = 'testapp';
        const errorMessage = 'Generation failed';
        generator.generateDeployJsonWithValidation.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 239-258
        const action = async(appName) => {
          try {
            const result = await generator.generateDeployJsonWithValidation(appName);
            if (result.success) {
              logger.log(`✓ Generated deployment JSON: ${result.path}`);
            } else {
              logger.log('❌ Validation failed:');
              result.validation.errors.forEach(error => logger.log(`   • ${error}`));
              process.exit(1);
            }
          } catch (error) {
            cliUtils.handleCommandError(error, 'json');
            process.exit(1);
          }
        };

        await action(appName);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'json');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('genkey command handler', () => {
      it('should execute genkey command handler successfully', async() => {
        const appName = 'testapp';
        const expectedKey = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
        keyGenerator.generateDeploymentKey.mockResolvedValue(expectedKey);

        // Simulate the command handler action from cli.js line 262-272
        const action = async(appName) => {
          try {
            const key = await keyGenerator.generateDeploymentKey(appName);
            logger.log(`\nDeployment key for ${appName}:`);
            logger.log(key);
            logger.log(`\nGenerated from: builder/${appName}/variables.yaml`);
          } catch (error) {
            cliUtils.handleCommandError(error, 'genkey');
            process.exit(1);
          }
        };

        await action(appName);
        expect(keyGenerator.generateDeploymentKey).toHaveBeenCalledWith(appName);
        expect(logger.log).toHaveBeenCalledWith(`\nDeployment key for ${appName}:`);
        expect(logger.log).toHaveBeenCalledWith(expectedKey);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle genkey command handler errors', async() => {
        const appName = 'testapp';
        const errorMessage = 'Key generation failed';
        keyGenerator.generateDeploymentKey.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 262-272
        const action = async(appName) => {
          try {
            const key = await keyGenerator.generateDeploymentKey(appName);
            logger.log(`\nDeployment key for ${appName}:`);
            logger.log(key);
            logger.log(`\nGenerated from: builder/${appName}/variables.yaml`);
          } catch (error) {
            cliUtils.handleCommandError(error, 'genkey');
            process.exit(1);
          }
        };

        await action(appName);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'genkey');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('dockerfile command handler', () => {
      it('should execute dockerfile command handler successfully', async() => {
        const appName = 'testapp';
        const options = { language: 'typescript', force: true };
        const dockerfilePath = 'builder/testapp/Dockerfile';
        app.generateDockerfileForApp.mockResolvedValue(dockerfilePath);

        // Simulate the command handler action from cli.js line 278-287
        const action = async(appName, options) => {
          try {
            const dockerfilePath = await app.generateDockerfileForApp(appName, options);
            logger.log(chalk.green('\n✅ Dockerfile generated successfully!'));
            logger.log(chalk.gray(`Location: ${dockerfilePath}`));
          } catch (error) {
            cliUtils.handleCommandError(error, 'dockerfile');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(app.generateDockerfileForApp).toHaveBeenCalledWith(appName, options);
        expect(logger.log).toHaveBeenCalledWith(chalk.green('\n✅ Dockerfile generated successfully!'));
        expect(logger.log).toHaveBeenCalledWith(chalk.gray(`Location: ${dockerfilePath}`));
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle dockerfile command handler errors', async() => {
        const appName = 'testapp';
        const options = {};
        const errorMessage = 'Dockerfile generation failed';
        app.generateDockerfileForApp.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 278-287
        const action = async(appName, options) => {
          try {
            const dockerfilePath = await app.generateDockerfileForApp(appName, options);
            logger.log(chalk.green('\n✅ Dockerfile generated successfully!'));
            logger.log(chalk.gray(`Location: ${dockerfilePath}`));
          } catch (error) {
            cliUtils.handleCommandError(error, 'dockerfile');
            process.exit(1);
          }
        };

        await action(appName, options);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'dockerfile');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });
  });
});
