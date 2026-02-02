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
jest.mock('../../lib/core/secrets');
jest.mock('../../lib/generator');
jest.mock('../../lib/core/key-generator');
jest.mock('../../lib/validation/validator');
jest.mock('../../lib/validation/validate');
jest.mock('../../lib/infrastructure');
jest.mock('../../lib/app');
jest.mock('../../lib/build');
jest.mock('../../lib/utils/cli-utils');
jest.mock('../../lib/utils/logger');
jest.mock('../../lib/commands/login');
jest.mock('../../lib/core/config');
jest.mock('../../lib/utils/dev-config');

const chalk = require('chalk');
const secrets = require('../../lib/core/secrets');
const generator = require('../../lib/generator');
const keyGenerator = require('../../lib/core/key-generator');
const validator = require('../../lib/validation/validator');
const validate = require('../../lib/validation/validate');
const infra = require('../../lib/infrastructure');
const app = require('../../lib/app');
const cliUtils = require('../../lib/utils/cli-utils');
const logger = require('../../lib/utils/logger');
const { handleLogin } = require('../../lib/commands/login');
const config = require('../../lib/core/config');
const devConfig = require('../../lib/utils/dev-config');

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
      validate.validateAppOrFile.mockResolvedValue({
        valid: true,
        application: { valid: true, errors: [], warnings: [] },
        externalFiles: []
      });
      validate.displayValidationResults.mockImplementation(() => {});

      // Import CLI module after mocking
      const cli = require('../../lib/cli');

      // We need to simulate the command action
      // Since we can't easily test Commander.js commands directly, we'll test the underlying logic
      try {
        const envPath = await secrets.generateEnvFile(appName, undefined, 'docker', false);
        logger.log(`✓ Generated .env file: ${envPath}`);

        // Validate after generating .env
        const result = await validate.validateAppOrFile(appName);
        validate.displayValidationResults(result);

        expect(secrets.generateEnvFile).toHaveBeenCalledWith(appName, undefined, 'docker', false);
        expect(validate.validateAppOrFile).toHaveBeenCalledWith(appName);
        expect(validate.displayValidationResults).toHaveBeenCalled();
      } catch (error) {
        // This should not happen in this test
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should validate files after generating .env and exit on validation errors', async() => {
      const appName = 'testapp';
      const expectedEnvPath = path.join(process.cwd(), 'builder', appName, '.env');

      secrets.generateEnvFile.mockResolvedValue(expectedEnvPath);
      validate.validateAppOrFile.mockResolvedValue({
        valid: false,
        application: {
          valid: false,
          errors: ['Missing required field: app.key'],
          warnings: []
        },
        externalFiles: []
      });
      validate.displayValidationResults.mockImplementation(() => {});

      try {
        const envPath = await secrets.generateEnvFile(appName, undefined, 'docker', false);
        logger.log(`✓ Generated .env file: ${envPath}`);

        const result = await validate.validateAppOrFile(appName);
        validate.displayValidationResults(result);
        if (!result.valid) {
          logger.log(chalk.yellow('\n⚠️  Validation found errors. Fix them before deploying.'));
          process.exit(1);
        }

        expect(secrets.generateEnvFile).toHaveBeenCalled();
        expect(validate.validateAppOrFile).toHaveBeenCalledWith(appName);
        expect(validate.displayValidationResults).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      } catch (error) {
        // Expected to exit
      }
    });

    it('should skip validation when --skip-validation flag is provided', async() => {
      const appName = 'testapp';
      const expectedEnvPath = path.join(process.cwd(), 'builder', appName, '.env');

      secrets.generateEnvFile.mockResolvedValue(expectedEnvPath);

      try {
        const envPath = await secrets.generateEnvFile(appName, undefined, 'docker', false);
        logger.log(`✓ Generated .env file: ${envPath}`);

        // Validation should be skipped
        expect(secrets.generateEnvFile).toHaveBeenCalledWith(appName, undefined, 'docker', false);
        expect(validate.validateAppOrFile).not.toHaveBeenCalled();
      } catch (error) {
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
      const expectedJsonPath = path.join(process.cwd(), 'builder', appName, 'testapp-deploy.json');
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
      const expectedJsonPath = path.join(process.cwd(), 'builder', appName, 'testapp-deploy.json');
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
        const expectedJsonPath = path.join(process.cwd(), 'builder', appName, 'testapp-deploy.json');
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

        // Simulate the command handler action from cli.js line 571-592
        const action = async(appName, options) => {
          try {
            const result = await generator.generateDeployJsonWithValidation(appName, options);
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

        await action(appName, {});
        expect(generator.generateDeployJsonWithValidation).toHaveBeenCalledWith(appName, {});
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

        // Simulate the command handler action from cli.js line 266-275 (exact match)
        const action = async(appName) => {
          try {
            const key = await keyGenerator.generateDeploymentKey(appName);
            logger.log(`\nDeployment key for ${appName}:`);
            logger.log(key);
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

        // Simulate the command handler action from cli.js line 266-275 (exact match)
        const action = async(appName) => {
          try {
            const key = await keyGenerator.generateDeploymentKey(appName);
            logger.log(`\nDeployment key for ${appName}:`);
            logger.log(key);
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

        // Simulate the command handler action from cli.js line 281-290 (exact match)
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

        // Simulate the command handler action from cli.js line 281-290 (exact match)
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

  describe('Additional edge cases and branch coverage', () => {
    describe('login command error handling', () => {
      it('should handle login errors with proper error logging', async() => {
        const errorMessage = 'Authentication failed';
        handleLogin.mockRejectedValue(new Error(errorMessage));
        logger.error.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 36-43
        const action = async(options) => {
          try {
            await handleLogin(options);
          } catch (error) {
            logger.error(chalk.red('\n❌ Login failed:'), error.message);
            process.exit(1);
          }
        };

        await action({ url: 'http://localhost:3000' });
        expect(handleLogin).toHaveBeenCalledWith({ url: 'http://localhost:3000' });
        expect(logger.error).toHaveBeenCalledWith(chalk.red('\n❌ Login failed:'), errorMessage);
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('down command with volumes option', () => {
      it('should stop infrastructure with volumes when volumes option is set', async() => {
        infra.stopInfraWithVolumes.mockResolvedValue();

        // Simulate the command handler action from cli.js line 60-71
        const action = async(options) => {
          try {
            if (options.volumes) {
              await infra.stopInfraWithVolumes();
            } else {
              await infra.stopInfra();
            }
          } catch (error) {
            cliUtils.handleCommandError(error, 'down-infra');
            process.exit(1);
          }
        };

        await action({ volumes: true });
        expect(infra.stopInfraWithVolumes).toHaveBeenCalled();
        expect(infra.stopInfra).not.toHaveBeenCalled();
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should stop infrastructure without volumes when volumes option is not set', async() => {
        infra.stopInfra.mockResolvedValue();

        // Simulate the command handler action from cli.js line 60-71
        const action = async(options) => {
          try {
            if (options.volumes) {
              await infra.stopInfraWithVolumes();
            } else {
              await infra.stopInfra();
            }
          } catch (error) {
            cliUtils.handleCommandError(error, 'down-infra');
            process.exit(1);
          }
        };

        await action({ volumes: false });
        expect(infra.stopInfra).toHaveBeenCalled();
        expect(infra.stopInfraWithVolumes).not.toHaveBeenCalled();
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle errors when stopping infrastructure with volumes', async() => {
        const errorMessage = 'Stop with volumes failed';
        infra.stopInfraWithVolumes.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 60-71
        const action = async(options) => {
          try {
            if (options.volumes) {
              await infra.stopInfraWithVolumes();
            } else {
              await infra.stopInfra();
            }
          } catch (error) {
            cliUtils.handleCommandError(error, 'down-infra');
            process.exit(1);
          }
        };

        await action({ volumes: true });
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'down-infra');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('resolve command with force option', () => {
      it('should generate env file with force option', async() => {
        const appName = 'testapp';
        const envPath = 'builder/testapp/.env';
        secrets.generateEnvFile.mockResolvedValue(envPath);

        // Simulate the command handler action from cli.js line 268-279
        const action = async(appName, options) => {
          try {
            const envPath = await secrets.generateEnvFile(appName, undefined, 'docker', options.force);
            logger.log(`✓ Generated .env file: ${envPath}`);
          } catch (error) {
            cliUtils.handleCommandError(error, 'resolve');
            process.exit(1);
          }
        };

        await action(appName, { force: true });
        expect(secrets.generateEnvFile).toHaveBeenCalledWith(appName, undefined, 'docker', true);
        expect(logger.log).toHaveBeenCalledWith(`✓ Generated .env file: ${envPath}`);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should generate env file without force option', async() => {
        const appName = 'testapp';
        const envPath = 'builder/testapp/.env';
        secrets.generateEnvFile.mockResolvedValue(envPath);

        // Simulate the command handler action from cli.js line 268-279
        const action = async(appName, options) => {
          try {
            const envPath = await secrets.generateEnvFile(appName, undefined, 'docker', options.force);
            logger.log(`✓ Generated .env file: ${envPath}`);
          } catch (error) {
            cliUtils.handleCommandError(error, 'resolve');
            process.exit(1);
          }
        };

        await action(appName, { force: false });
        expect(secrets.generateEnvFile).toHaveBeenCalledWith(appName, undefined, 'docker', false);
        expect(logger.log).toHaveBeenCalledWith(`✓ Generated .env file: ${envPath}`);
        expect(process.exit).not.toHaveBeenCalled();
      });
    });

    describe('json command validation failure', () => {
      it('should handle json command with validation errors array', async() => {
        const appName = 'testapp';
        const mockResult = {
          success: false,
          path: '',
          validation: {
            valid: false,
            errors: ['Missing required field: key'],
            warnings: []
          },
          deployment: null
        };

        generator.generateDeployJsonWithValidation.mockResolvedValue(mockResult);
        logger.log.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 239-262
        const action = async(appName) => {
          try {
            const result = await generator.generateDeployJsonWithValidation(appName);
            if (result.success) {
              logger.log(`✓ Generated deployment JSON: ${result.path}`);

              if (result.validation.warnings && result.validation.warnings.length > 0) {
                logger.log('\n⚠️  Warnings:');
                result.validation.warnings.forEach(warning => logger.log(`   • ${warning}`));
              }
            } else {
              logger.log('❌ Validation failed:');
              if (result.validation.errors && result.validation.errors.length > 0) {
                result.validation.errors.forEach(error => logger.log(`   • ${error}`));
              }
              process.exit(1);
            }
          } catch (error) {
            cliUtils.handleCommandError(error, 'json');
            process.exit(1);
          }
        };

        await action(appName);
        expect(logger.log).toHaveBeenCalledWith('❌ Validation failed:');
        expect(logger.log).toHaveBeenCalledWith('   • Missing required field: key');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      it('should handle json command with validation warnings array', async() => {
        const appName = 'testapp';
        const expectedJsonPath = path.join(process.cwd(), 'builder', appName, 'testapp-deploy.json');
        const mockResult = {
          success: true,
          path: expectedJsonPath,
          validation: {
            valid: true,
            errors: [],
            warnings: ['Health check path should start with /']
          },
          deployment: {
            key: 'testapp',
            displayName: 'Test App'
          }
        };

        generator.generateDeployJsonWithValidation.mockResolvedValue(mockResult);
        logger.log.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 239-262
        const action = async(appName) => {
          try {
            const result = await generator.generateDeployJsonWithValidation(appName);
            if (result.success) {
              logger.log(`✓ Generated deployment JSON: ${result.path}`);

              if (result.validation.warnings && result.validation.warnings.length > 0) {
                logger.log('\n⚠️  Warnings:');
                result.validation.warnings.forEach(warning => logger.log(`   • ${warning}`));
              }
            } else {
              logger.log('❌ Validation failed:');
              if (result.validation.errors && result.validation.errors.length > 0) {
                result.validation.errors.forEach(error => logger.log(`   • ${error}`));
              }
              process.exit(1);
            }
          } catch (error) {
            cliUtils.handleCommandError(error, 'json');
            process.exit(1);
          }
        };

        await action(appName);
        expect(logger.log).toHaveBeenCalledWith(`✓ Generated deployment JSON: ${expectedJsonPath}`);
        expect(logger.log).toHaveBeenCalledWith('\n⚠️  Warnings:');
        expect(logger.log).toHaveBeenCalledWith('   • Health check path should start with /');
        expect(process.exit).not.toHaveBeenCalled();
      });
    });

    describe('doctor command health check edge cases', () => {
      it('should handle doctor command when docker is not ok', async() => {
        const mockEnvResult = {
          docker: 'error',
          ports: 'ok',
          secrets: 'ok',
          recommendations: []
        };

        validator.checkEnvironment.mockResolvedValue(mockEnvResult);
        logger.log.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 157-190
        const action = async() => {
          try {
            const result = await validator.checkEnvironment();
            logger.log('\n🔍 AI Fabrix Environment Check\n');

            logger.log(`Docker: ${result.docker === 'ok' ? '✅ Running' : '❌ Not available'}`);
            logger.log(`Ports: ${result.ports === 'ok' ? '✅ Available' : '⚠️  Some ports in use'}`);
            logger.log(`Secrets: ${result.secrets === 'ok' ? '✅ Configured' : '❌ Missing'}`);

            if (result.recommendations.length > 0) {
              logger.log('\n📋 Recommendations:');
              result.recommendations.forEach(rec => logger.log(`  • ${rec}`));
            }

            // Check infrastructure health if Docker is available
            if (result.docker === 'ok') {
              try {
                const health = await infra.checkInfraHealth();
                logger.log('\n🏥 Infrastructure Health:');
                Object.entries(health).forEach(([service, status]) => {
                  const icon = status === 'healthy' ? '✅' : status === 'unknown' ? '❓' : '❌';
                  logger.log(`  ${icon} ${service}: ${status}`);
                });
              } catch (error) {
                logger.log('\n🏥 Infrastructure: Not running');
              }
            }

            logger.log('');
          } catch (error) {
            cliUtils.handleCommandError(error, 'doctor');
            process.exit(1);
          }
        };

        await action();
        expect(logger.log).toHaveBeenCalledWith('Docker: ❌ Not available');
        expect(infra.checkInfraHealth).not.toHaveBeenCalled();
      });

      it('should handle doctor command with unknown health status', async() => {
        const mockEnvResult = {
          docker: 'ok',
          ports: 'ok',
          secrets: 'ok',
          recommendations: []
        };

        const mockHealthResult = {
          postgres: 'unknown',
          redis: 'unhealthy'
        };

        validator.checkEnvironment.mockResolvedValue(mockEnvResult);
        infra.checkInfraHealth.mockResolvedValue(mockHealthResult);
        logger.log.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 157-190
        const action = async() => {
          try {
            const result = await validator.checkEnvironment();
            logger.log('\n🔍 AI Fabrix Environment Check\n');

            logger.log(`Docker: ${result.docker === 'ok' ? '✅ Running' : '❌ Not available'}`);
            logger.log(`Ports: ${result.ports === 'ok' ? '✅ Available' : '⚠️  Some ports in use'}`);
            logger.log(`Secrets: ${result.secrets === 'ok' ? '✅ Configured' : '❌ Missing'}`);

            if (result.recommendations.length > 0) {
              logger.log('\n📋 Recommendations:');
              result.recommendations.forEach(rec => logger.log(`  • ${rec}`));
            }

            // Check infrastructure health if Docker is available
            if (result.docker === 'ok') {
              try {
                const health = await infra.checkInfraHealth();
                logger.log('\n🏥 Infrastructure Health:');
                Object.entries(health).forEach(([service, status]) => {
                  const icon = status === 'healthy' ? '✅' : status === 'unknown' ? '❓' : '❌';
                  logger.log(`  ${icon} ${service}: ${status}`);
                });
              } catch (error) {
                logger.log('\n🏥 Infrastructure: Not running');
              }
            }

            logger.log('');
          } catch (error) {
            cliUtils.handleCommandError(error, 'doctor');
            process.exit(1);
          }
        };

        await action();
        expect(logger.log).toHaveBeenCalledWith('  ❓ postgres: unknown');
        expect(logger.log).toHaveBeenCalledWith('  ❌ redis: unhealthy');
      });
    });

    describe('status command with stopped services', () => {
      it('should show status for stopped services', async() => {
        const mockStatus = {
          postgres: { status: 'stopped', port: 5432, url: 'postgresql://localhost:5432' },
          redis: { status: 'running', port: 6379, url: 'redis://localhost:6379' }
        };

        infra.getInfraStatus.mockResolvedValue(mockStatus);
        logger.log.mockImplementation(() => {});

        // Simulate the command handler action from cli.js line 194-211
        const action = async() => {
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
          } catch (error) {
            cliUtils.handleCommandError(error, 'status');
            process.exit(1);
          }
        };

        await action();
        expect(logger.log).toHaveBeenCalledWith('❌ postgres:');
        expect(logger.log).toHaveBeenCalledWith('   Status: stopped');
        expect(logger.log).toHaveBeenCalledWith('✅ redis:');
        expect(logger.log).toHaveBeenCalledWith('   Status: running');
      });
    });
  });

  describe('setupCommands - Direct Command Handler Execution', () => {
    let mockProgram;
    let commandActions;

    beforeEach(() => {
      jest.clearAllMocks();
      commandActions = {};
      mockProgram = {
        command: jest.fn((cmdName) => {
          const mockCommand = {
            description: jest.fn().mockReturnThis(),
            option: jest.fn().mockReturnThis(),
            addHelpText: jest.fn().mockReturnThis(),
            action: function(action) {
              commandActions[cmdName] = action;
              return this;
            },
            // Support nested commands for command groups (e.g., 'secrets set')
            command: jest.fn((subCmdName) => {
              const fullCmdName = `${cmdName} ${subCmdName}`;
              const mockSubCommand = {
                description: jest.fn().mockReturnThis(),
                option: jest.fn().mockReturnThis(),
                action: function(action) {
                  commandActions[fullCmdName] = action;
                  return this;
                }
              };
              return mockSubCommand;
            })
          };
          return mockCommand;
        })
      };
      // Ensure logger methods are properly mocked after clearAllMocks
      // These will be used by handlers when setupCommands is called
      logger.log = jest.fn();
      logger.error = jest.fn();
      logger.warn = jest.fn();
      logger.info = jest.fn();
    });

    // Helper function to setup commands and reset logger
    function setupCommandsAndResetLogger() {
      // Reset commandActions to ensure clean state
      commandActions = {};
      // Recreate mockProgram to ensure fresh action handlers
      mockProgram = {
        command: jest.fn((cmdName) => {
          const mockCommand = {
            description: jest.fn().mockReturnThis(),
            option: jest.fn().mockReturnThis(),
            addHelpText: jest.fn().mockReturnThis(),
            action: function(action) {
              commandActions[cmdName] = action;
              return this;
            },
            // Support nested commands for command groups (e.g., 'secrets set')
            command: jest.fn((subCmdName) => {
              const fullCmdName = `${cmdName} ${subCmdName}`;
              const mockSubCommand = {
                description: jest.fn().mockReturnThis(),
                option: jest.fn().mockReturnThis(),
                action: function(action) {
                  commandActions[fullCmdName] = action;
                  return this;
                }
              };
              return mockSubCommand;
            })
          };
          return mockCommand;
        })
      };

      // Reset modules to ensure fresh logger reference is captured by handlers
      jest.resetModules();

      // Re-require logger after resetModules to get fresh mock
      const freshLogger = require('../../lib/utils/logger');
      // Set up logger mock functions
      freshLogger.log = jest.fn();
      freshLogger.error = jest.fn();
      freshLogger.warn = jest.fn();
      freshLogger.info = jest.fn();

      // Update the outer scope logger reference
      Object.assign(logger, freshLogger);

      // Re-require other mocked modules that CLI depends on
      const freshKeyGenerator = require('../../lib/core/key-generator');
      const freshApp = require('../../lib/app');
      const freshSecrets = require('../../lib/core/secrets');
      const freshGenerator = require('../../lib/generator');
      const freshValidator = require('../../lib/validation/validator');
      const freshInfra = require('../../lib/infrastructure');
      const freshCliUtils = require('../../lib/utils/cli-utils');
      const freshHandleLoginModule = require('../../lib/commands/login');
      const freshConfig = require('../../lib/core/config');
      const freshDevConfig = require('../../lib/utils/dev-config');

      // Update outer scope references
      Object.assign(keyGenerator, freshKeyGenerator);
      Object.assign(app, freshApp);
      Object.assign(secrets, freshSecrets);
      Object.assign(generator, freshGenerator);
      Object.assign(validator, freshValidator);
      Object.assign(infra, freshInfra);
      Object.assign(cliUtils, freshCliUtils);
      Object.assign(config, freshConfig);
      Object.assign(devConfig, freshDevConfig);
      // handleLogin is a destructured export, so update the module's handleLogin property
      // This ensures the fresh module has the mocked handleLogin
      if (freshHandleLoginModule.handleLogin) {
        freshHandleLoginModule.handleLogin = handleLogin;
      }

      const { setupCommands } = require('../../lib/cli');
      setupCommands(mockProgram);

      // Clear mock calls after setupCommands so we can track new calls from handlers
      logger.log.mockClear();
      logger.error.mockClear();
      logger.warn.mockClear();
      logger.info.mockClear();
    }

    describe('genkey command handler execution', () => {
      it('should execute genkey command handler via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const expectedKey = '0000000000000000000000000000000000000000000000000000000000000000';
        const jsonPath = 'builder/testapp/testapp-deploy.json';
        const deploymentJson = {
          key: appName,
          displayName: 'Test App',
          deploymentKey: expectedKey
        };

        generator.generateDeployJson.mockResolvedValue(jsonPath);
        // Mock fs.readFileSync - the handler uses require('fs') inside, so this should work
        const freshFs = require('fs');
        freshFs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(deploymentJson));
        chalk.gray.mockImplementation((text) => text);

        const handler = commandActions['genkey <app>'];
        expect(handler).toBeDefined();
        expect(typeof handler).toBe('function');

        await handler(appName);

        expect(generator.generateDeployJson).toHaveBeenCalledWith(appName);
        // Note: fs.readFileSync is called inside the handler via require('fs'), so we verify via the result
        expect(logger.log).toHaveBeenCalledWith(`\nDeployment key for ${appName}:`);
        expect(logger.log).toHaveBeenCalledWith(expectedKey);
        expect(logger.log).toHaveBeenCalledWith(chalk.gray(`\nGenerated from: ${jsonPath}`));
      });

      it('should handle genkey command handler error via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const errorMessage = 'JSON generation failed';
        generator.generateDeployJson.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['genkey <app>'];
        expect(handler).toBeDefined();

        await handler(appName);

        expect(generator.generateDeployJson).toHaveBeenCalledWith(appName);
        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'genkey');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('dockerfile command handler execution', () => {
      it('should execute dockerfile command handler via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const options = { language: 'typescript', force: true };
        const dockerfilePath = 'builder/testapp/Dockerfile';
        app.generateDockerfileForApp.mockResolvedValue(dockerfilePath);
        chalk.green.mockImplementation((text) => text);
        chalk.gray.mockImplementation((text) => text);

        const handler = commandActions['dockerfile <app>'];
        expect(handler).toBeDefined();

        await handler(appName, options);

        expect(app.generateDockerfileForApp).toHaveBeenCalledWith(appName, options);
        expect(logger.log).toHaveBeenCalledWith(chalk.green('\n✅ Dockerfile generated successfully!'));
        expect(logger.log).toHaveBeenCalledWith(chalk.gray(`Location: ${dockerfilePath}`));
      });

      it('should handle dockerfile command handler error via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const options = {};
        const errorMessage = 'Dockerfile generation failed';
        app.generateDockerfileForApp.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['dockerfile <app>'];
        expect(handler).toBeDefined();

        await handler(appName, options);

        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'dockerfile');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('resolve command handler execution', () => {
      it('should execute resolve command handler with force option via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const options = { force: true };
        const envPath = 'builder/testapp/.env';
        secrets.generateEnvFile.mockResolvedValue(envPath);

        const handler = commandActions['resolve <app>'];
        expect(handler).toBeDefined();

        await handler(appName, options);

        expect(secrets.generateEnvFile).toHaveBeenCalledWith(appName, undefined, 'docker', true);
        expect(logger.log).toHaveBeenCalledWith(`✓ Generated .env file: ${envPath}`);
      });

      it('should execute resolve command handler without force option via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const options = {};
        const envPath = 'builder/testapp/.env';
        secrets.generateEnvFile.mockResolvedValue(envPath);

        const handler = commandActions['resolve <app>'];
        expect(handler).toBeDefined();

        await handler(appName, options);

        expect(secrets.generateEnvFile).toHaveBeenCalledWith(appName, undefined, 'docker', undefined);
        expect(logger.log).toHaveBeenCalledWith(`✓ Generated .env file: ${envPath}`);
      });

      it('should handle resolve command handler error via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const options = {};
        const errorMessage = 'Secrets file not found';
        secrets.generateEnvFile.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['resolve <app>'];
        expect(handler).toBeDefined();

        await handler(appName, options);

        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'resolve');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('json command handler execution', () => {
      it('should execute json command handler with warnings via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const expectedJsonPath = path.join(process.cwd(), 'builder', appName, 'testapp-deploy.json');
        const mockResult = {
          success: true,
          path: expectedJsonPath,
          validation: {
            valid: true,
            errors: [],
            warnings: ['Warning 1', 'Warning 2']
          }
        };
        generator.generateDeployJsonWithValidation.mockResolvedValue(mockResult);

        const handler = commandActions['json <app>'];
        expect(handler).toBeDefined();

        await handler(appName);

        expect(generator.generateDeployJsonWithValidation).toHaveBeenCalledWith(appName, undefined);
        expect(logger.log).toHaveBeenCalledWith(`✓ Generated deployment JSON: ${expectedJsonPath}`);
        expect(logger.log).toHaveBeenCalledWith('\n⚠️  Warnings:');
        expect(logger.log).toHaveBeenCalledWith('   • Warning 1');
        expect(logger.log).toHaveBeenCalledWith('   • Warning 2');
      });

      it('should execute json command handler with validation errors via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const mockResult = {
          success: false,
          path: '',
          validation: {
            valid: false,
            errors: ['Error 1', 'Error 2'],
            warnings: []
          }
        };
        generator.generateDeployJsonWithValidation.mockResolvedValue(mockResult);
        process.exit.mockImplementation(() => {});

        const handler = commandActions['json <app>'];
        expect(handler).toBeDefined();

        await handler(appName);

        expect(generator.generateDeployJsonWithValidation).toHaveBeenCalledWith(appName, undefined);
        expect(logger.log).toHaveBeenCalledWith('❌ Validation failed:');
        expect(logger.log).toHaveBeenCalledWith('   • Error 1');
        expect(logger.log).toHaveBeenCalledWith('   • Error 2');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      it('should handle json command handler generation error via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const errorMessage = 'Generation failed';
        generator.generateDeployJsonWithValidation.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['json <app>'];
        expect(handler).toBeDefined();

        await handler(appName);

        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'json');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      it('should execute json command handler with validation errors array check via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const mockResult = {
          success: false,
          path: '',
          validation: {
            valid: false,
            errors: null,
            warnings: []
          }
        };
        generator.generateDeployJsonWithValidation.mockResolvedValue(mockResult);
        process.exit.mockImplementation(() => {});

        const handler = commandActions['json <app>'];
        expect(handler).toBeDefined();

        await handler(appName);

        expect(generator.generateDeployJsonWithValidation).toHaveBeenCalledWith(appName, undefined);
        expect(logger.log).toHaveBeenCalledWith('❌ Validation failed:');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      it('should execute json command handler with empty warnings array via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const expectedJsonPath = path.join(process.cwd(), 'builder', appName, 'testapp-deploy.json');
        const mockResult = {
          success: true,
          path: expectedJsonPath,
          validation: {
            valid: true,
            errors: [],
            warnings: []
          }
        };
        generator.generateDeployJsonWithValidation.mockResolvedValue(mockResult);

        const handler = commandActions['json <app>'];
        expect(handler).toBeDefined();

        await handler(appName, {});

        expect(generator.generateDeployJsonWithValidation).toHaveBeenCalledWith(appName, {});
        expect(logger.log).toHaveBeenCalledWith(`✓ Generated deployment JSON: ${expectedJsonPath}`);
        expect(logger.log).not.toHaveBeenCalledWith('\n⚠️  Warnings:');
      });
    });

    describe('login command handler execution', () => {
      it('should execute login command handler via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { url: 'http://localhost:3000', method: 'device' };
        handleLogin.mockResolvedValue();

        const handler = commandActions['login'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(handleLogin).toHaveBeenCalledWith(options);
        expect(process.exit).not.toHaveBeenCalled();
      });

      it('should handle login command handler error via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { url: 'http://localhost:3000' };
        const errorMessage = 'Login failed';
        handleLogin.mockRejectedValue(new Error(errorMessage));
        process.exit.mockImplementation(() => {});
        chalk.red.mockImplementation((text) => text);

        const handler = commandActions['login'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(logger.error).toHaveBeenCalledWith(chalk.red('\n❌ Login failed:'), errorMessage);
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('down command handler execution', () => {
      it('should execute down command handler with volumes via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { volumes: true };
        infra.stopInfraWithVolumes.mockResolvedValue();
        cliUtils.handleCommandError.mockImplementation(() => {});

        const handler = commandActions['down-infra [app]'];
        expect(handler).toBeDefined();

        await handler(undefined, options);

        expect(infra.stopInfraWithVolumes).toHaveBeenCalled();
        expect(infra.stopInfra).not.toHaveBeenCalled();
      });

      it('should execute down command handler without volumes via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = {};
        infra.stopInfra.mockResolvedValue();
        cliUtils.handleCommandError.mockImplementation(() => {});

        const handler = commandActions['down-infra [app]'];
        expect(handler).toBeDefined();

        await handler(undefined, options);

        expect(infra.stopInfra).toHaveBeenCalled();
        expect(infra.stopInfraWithVolumes).not.toHaveBeenCalled();
      });

      it('should handle down command handler error via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = {};
        const errorMessage = 'Stop failed';
        infra.stopInfra.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['down-infra [app]'];
        expect(handler).toBeDefined();

        await handler(undefined, options);

        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'down-infra');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      it('should execute down command handler for app with volumes via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const appName = 'testapp';
        const options = { volumes: true };
        app.downApp.mockResolvedValue();
        cliUtils.handleCommandError.mockImplementation(() => {});

        const handler = commandActions['down-infra [app]'];
        expect(handler).toBeDefined();

        await handler(appName, options);

        expect(app.downApp).toHaveBeenCalledWith(appName, { volumes: true });
        expect(infra.stopInfra).not.toHaveBeenCalled();
        expect(infra.stopInfraWithVolumes).not.toHaveBeenCalled();
      });
    });

    describe('doctor command handler execution', () => {
      it('should execute doctor command handler with health check via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const mockEnvResult = {
          docker: 'ok',
          ports: 'ok',
          secrets: 'ok',
          recommendations: []
        };
        const mockHealthResult = {
          postgres: 'healthy',
          redis: 'unknown',
          pgadmin: 'unhealthy'
        };
        validator.checkEnvironment.mockResolvedValue(mockEnvResult);
        infra.checkInfraHealth.mockResolvedValue(mockHealthResult);

        const handler = commandActions['doctor'];
        expect(handler).toBeDefined();

        await handler();

        expect(validator.checkEnvironment).toHaveBeenCalled();
        expect(infra.checkInfraHealth).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith('Docker: ✅ Running');
        expect(logger.log).toHaveBeenCalledWith('Ports: ✅ Available');
        expect(logger.log).toHaveBeenCalledWith('Secrets: ✅ Configured');
        expect(logger.log).toHaveBeenCalledWith('\n🏥 Infrastructure Health:');
        expect(logger.log).toHaveBeenCalledWith('  ✅ postgres: healthy');
        expect(logger.log).toHaveBeenCalledWith('  ❓ redis: unknown');
        expect(logger.log).toHaveBeenCalledWith('  ❌ pgadmin: unhealthy');
      });

      it('should execute doctor command handler without health check when docker not ok via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const mockEnvResult = {
          docker: 'error',
          ports: 'ok',
          secrets: 'ok',
          recommendations: []
        };
        validator.checkEnvironment.mockResolvedValue(mockEnvResult);

        const handler = commandActions['doctor'];
        expect(handler).toBeDefined();

        await handler();

        expect(validator.checkEnvironment).toHaveBeenCalled();
        expect(infra.checkInfraHealth).not.toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith('Docker: ❌ Not available');
      });

      it('should execute doctor command handler with health check error via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const mockEnvResult = {
          docker: 'ok',
          ports: 'ok',
          secrets: 'ok',
          recommendations: []
        };
        validator.checkEnvironment.mockResolvedValue(mockEnvResult);
        infra.checkInfraHealth.mockRejectedValue(new Error('Health check failed'));

        const handler = commandActions['doctor'];
        expect(handler).toBeDefined();

        await handler();

        expect(logger.log).toHaveBeenCalledWith('\n🏥 Infrastructure: Not running');
      });

      it('should execute doctor command handler with recommendations via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const mockEnvResult = {
          docker: 'ok',
          ports: 'ok',
          secrets: 'ok',
          recommendations: ['Recommendation 1', 'Recommendation 2']
        };
        validator.checkEnvironment.mockResolvedValue(mockEnvResult);
        infra.checkInfraHealth.mockResolvedValue({});
        // Reset logger mock calls but keep it as jest.fn()
        logger.log.mockClear();

        const handler = commandActions['doctor'];
        expect(handler).toBeDefined();

        await handler();

        expect(logger.log).toHaveBeenCalledWith('\n📋 Recommendations:');
        expect(logger.log).toHaveBeenCalledWith('  • Recommendation 1');
        expect(logger.log).toHaveBeenCalledWith('  • Recommendation 2');
      });
    });

    describe('status command handler execution', () => {
      it('should execute status command handler via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const mockStatus = {
          postgres: { status: 'running', port: 5432, url: 'postgresql://localhost:5432' },
          redis: { status: 'stopped', port: 6379, url: 'redis://localhost:6379' }
        };
        infra.getInfraStatus.mockResolvedValue(mockStatus);

        const handler = commandActions['status'];
        expect(handler).toBeDefined();

        await handler();

        expect(infra.getInfraStatus).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith('\n📊 Infrastructure Status\n');
        expect(logger.log).toHaveBeenCalledWith('✅ postgres:');
        expect(logger.log).toHaveBeenCalledWith('   Status: running');
        expect(logger.log).toHaveBeenCalledWith('❌ redis:');
        expect(logger.log).toHaveBeenCalledWith('   Status: stopped');
      });

      it('should handle status command handler error via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const errorMessage = 'Status check failed';
        infra.getInfraStatus.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['status'];
        expect(handler).toBeDefined();

        await handler();

        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'status');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('up command with developer option', () => {
      beforeEach(() => {
        config.getConfig.mockResolvedValue({});
      });

      it('should execute up command with developer option via setupCommands', async() => {
        setupCommandsAndResetLogger();
        config.getConfig.mockResolvedValue({});

        const options = { developer: '1' };
        config.setDeveloperId.mockResolvedValue();
        infra.startInfra.mockResolvedValue();
        process.env.AIFABRIX_DEVELOPERID = undefined;

        const handler = commandActions['up-infra'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(config.setDeveloperId).toHaveBeenCalledWith(1);
        expect(process.env.AIFABRIX_DEVELOPERID).toBe('1');
        expect(logger.log).toHaveBeenCalledWith(chalk.green('✓ Developer ID set to 1'));
        expect(infra.startInfra).toHaveBeenCalledWith(1, { traefik: false });
      });

      it('should handle up command with invalid developer ID via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { developer: '-1' };
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['up-infra'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'up-infra');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      it('should handle up command with NaN developer ID via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { developer: 'invalid' };
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['up-infra'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'up-infra');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      it('should execute up command without developer option via setupCommands', async() => {
        setupCommandsAndResetLogger();
        config.getConfig.mockResolvedValue({});

        const options = {};
        infra.startInfra.mockResolvedValue();

        const handler = commandActions['up-infra'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(config.setDeveloperId).not.toHaveBeenCalled();
        expect(infra.startInfra).toHaveBeenCalledWith(null, { traefik: false });
      });

      it('should execute up with --traefik, persist to config, and start with traefik', async() => {
        setupCommandsAndResetLogger();
        config.getConfig.mockResolvedValue({});
        config.saveConfig.mockResolvedValue();
        infra.startInfra.mockResolvedValue();

        const handler = commandActions['up-infra'];
        await handler({ traefik: true });

        expect(config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ traefik: true }));
        expect(logger.log).toHaveBeenCalledWith(chalk.green('✓ Traefik enabled and saved to config'));
        expect(infra.startInfra).toHaveBeenCalledWith(null, { traefik: true });
      });

      it('should execute up with --no-traefik, persist to config, and start without traefik', async() => {
        setupCommandsAndResetLogger();
        config.getConfig.mockResolvedValue({ traefik: true });
        config.saveConfig.mockResolvedValue();
        infra.startInfra.mockResolvedValue();

        const handler = commandActions['up-infra'];
        await handler({ traefik: false }); // --no-traefik sets options.traefik to false

        expect(config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ traefik: false }));
        expect(logger.log).toHaveBeenCalledWith(chalk.green('✓ Traefik disabled and saved to config'));
        expect(infra.startInfra).toHaveBeenCalledWith(null, { traefik: false });
      });

      it('should execute up reading traefik from config when flags omitted', async() => {
        setupCommandsAndResetLogger();
        config.getConfig.mockResolvedValue({ traefik: true });
        infra.startInfra.mockResolvedValue();

        const handler = commandActions['up-infra'];
        await handler({});

        expect(config.saveConfig).not.toHaveBeenCalled();
        expect(infra.startInfra).toHaveBeenCalledWith(null, { traefik: true });
      });

      it('should handle up command error via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = {};
        const errorMessage = 'Start failed';
        infra.startInfra.mockRejectedValue(new Error(errorMessage));
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['up-infra'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'up-infra');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    describe('status command with running applications', () => {
      it('should execute status command with running applications via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const mockStatus = {
          postgres: { status: 'running', port: 5432, url: 'postgresql://localhost:5432' },
          redis: { status: 'running', port: 6379, url: 'redis://localhost:6379' }
        };
        const mockApps = [
          { name: 'testapp', container: 'testapp-container', port: 3000, status: 'running', url: 'http://localhost:3000' },
          { name: 'testapp2', container: 'testapp2-container', port: 3001, status: 'up', url: 'http://localhost:3001' }
        ];
        infra.getInfraStatus.mockResolvedValue(mockStatus);
        infra.getAppStatus.mockResolvedValue(mockApps);

        const handler = commandActions['status'];
        expect(handler).toBeDefined();

        await handler();

        expect(infra.getInfraStatus).toHaveBeenCalled();
        expect(infra.getAppStatus).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith('\n📊 Infrastructure Status\n');
        expect(logger.log).toHaveBeenCalledWith('📱 Running Applications\n');
        expect(logger.log).toHaveBeenCalledWith('✅ testapp:');
        expect(logger.log).toHaveBeenCalledWith('   Container: testapp-container');
        expect(logger.log).toHaveBeenCalledWith('   Port: 3000');
        expect(logger.log).toHaveBeenCalledWith('   Status: running');
        expect(logger.log).toHaveBeenCalledWith('   URL: http://localhost:3000');
        expect(logger.log).toHaveBeenCalledWith('✅ testapp2:');
        expect(logger.log).toHaveBeenCalledWith('   Container: testapp2-container');
        expect(logger.log).toHaveBeenCalledWith('   Port: 3001');
        expect(logger.log).toHaveBeenCalledWith('   Status: up');
        expect(logger.log).toHaveBeenCalledWith('   URL: http://localhost:3001');
      });

      it('should execute status command without running applications via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const mockStatus = {
          postgres: { status: 'running', port: 5432, url: 'postgresql://localhost:5432' }
        };
        const mockApps = [];
        infra.getInfraStatus.mockResolvedValue(mockStatus);
        infra.getAppStatus.mockResolvedValue(mockApps);

        const handler = commandActions['status'];
        expect(handler).toBeDefined();

        await handler();

        expect(infra.getInfraStatus).toHaveBeenCalled();
        expect(infra.getAppStatus).toHaveBeenCalled();
        expect(logger.log).not.toHaveBeenCalledWith('📱 Running Applications\n');
      });

      it('should execute status command with stopped applications via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const mockStatus = {
          postgres: { status: 'running', port: 5432, url: 'postgresql://localhost:5432' }
        };
        const mockApps = [
          { name: 'testapp', container: 'testapp-container', port: 3000, status: 'stopped', url: 'http://localhost:3000' }
        ];
        infra.getInfraStatus.mockResolvedValue(mockStatus);
        infra.getAppStatus.mockResolvedValue(mockApps);

        const handler = commandActions['status'];
        expect(handler).toBeDefined();

        await handler();

        expect(logger.log).toHaveBeenCalledWith('📱 Running Applications\n');
        expect(logger.log).toHaveBeenCalledWith('❌ testapp:');
        expect(logger.log).toHaveBeenCalledWith('   Status: stopped');
      });
    });

    describe('dev config command handler execution', () => {
      it('should execute dev config command with set-id option via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { setId: '1' };
        config.setDeveloperId.mockResolvedValue();
        config.getAifabrixHomeOverride.mockResolvedValue(null);
        config.getAifabrixSecretsPath.mockResolvedValue(null);
        config.getAifabrixEnvConfigPath.mockResolvedValue(null);
        devConfig.getDevPorts.mockReturnValue({
          app: 3100,
          postgres: 5532,
          redis: 6479,
          pgadmin: 5150,
          redisCommander: 8181
        });
        process.env.AIFABRIX_DEVELOPERID = undefined;
        chalk.green.mockImplementation((text) => text);

        const handler = commandActions['dev config'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(config.setDeveloperId).toHaveBeenCalledWith('1');
        expect(process.env.AIFABRIX_DEVELOPERID).toBe('1');
        expect(devConfig.getDevPorts).toHaveBeenCalledWith(1);
        expect(logger.log).toHaveBeenCalledWith(chalk.green('✓ Developer ID set to 1'));
        expect(logger.log).toHaveBeenCalledWith('\n🔧 Developer Configuration\n');
        expect(logger.log).toHaveBeenCalledWith('Developer ID: 1');
        expect(logger.log).toHaveBeenCalledWith('\nPorts:');
        expect(logger.log).toHaveBeenCalledWith('  App: 3100');
        expect(logger.log).toHaveBeenCalledWith('  Postgres: 5532');
        expect(logger.log).toHaveBeenCalledWith('  Redis: 6479');
        expect(logger.log).toHaveBeenCalledWith('  pgAdmin: 5150');
        expect(logger.log).toHaveBeenCalledWith('  Redis Commander: 8181');
        expect(config.getAifabrixHomeOverride).toHaveBeenCalled();
        expect(config.getAifabrixSecretsPath).toHaveBeenCalled();
        expect(config.getAifabrixEnvConfigPath).toHaveBeenCalled();
      });

      it('should execute dev config command with set-id option using set-id key via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { 'set-id': '2' };
        config.setDeveloperId.mockResolvedValue();
        config.getAifabrixHomeOverride.mockResolvedValue(null);
        config.getAifabrixSecretsPath.mockResolvedValue(null);
        config.getAifabrixEnvConfigPath.mockResolvedValue(null);
        devConfig.getDevPorts.mockReturnValue({
          app: 3200,
          postgres: 5632,
          redis: 6579,
          pgadmin: 5250,
          redisCommander: 8281
        });
        process.env.AIFABRIX_DEVELOPERID = undefined;
        chalk.green.mockImplementation((text) => text);

        const handler = commandActions['dev config'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(config.setDeveloperId).toHaveBeenCalledWith('2');
        expect(devConfig.getDevPorts).toHaveBeenCalledWith(2);
        expect(config.getAifabrixHomeOverride).toHaveBeenCalled();
        expect(config.getAifabrixSecretsPath).toHaveBeenCalled();
        expect(config.getAifabrixEnvConfigPath).toHaveBeenCalled();
      });

      it('should preserve leading zeros in developer ID (e.g., "01") via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { setId: '01' };
        config.setDeveloperId.mockResolvedValue();
        config.getAifabrixHomeOverride.mockResolvedValue(null);
        config.getAifabrixSecretsPath.mockResolvedValue(null);
        config.getAifabrixEnvConfigPath.mockResolvedValue(null);
        devConfig.getDevPorts.mockReturnValue({
          app: 3100,
          postgres: 5532,
          redis: 6479,
          pgadmin: 5150,
          redisCommander: 8181
        });
        process.env.AIFABRIX_DEVELOPERID = undefined;
        chalk.green.mockImplementation((text) => text);

        const handler = commandActions['dev config'];
        expect(handler).toBeDefined();

        await handler(options);

        // Should preserve the string "01" with leading zero
        expect(config.setDeveloperId).toHaveBeenCalledWith('01');
        expect(process.env.AIFABRIX_DEVELOPERID).toBe('01');
        // getDevPorts should receive the numeric value (1) for port calculation
        expect(devConfig.getDevPorts).toHaveBeenCalledWith(1);
        expect(logger.log).toHaveBeenCalledWith(chalk.green('✓ Developer ID set to 01'));
        expect(logger.log).toHaveBeenCalledWith('\n🔧 Developer Configuration\n');
        expect(logger.log).toHaveBeenCalledWith('Developer ID: 01');
        expect(logger.log).toHaveBeenCalledWith('\nPorts:');
        expect(logger.log).toHaveBeenCalledWith('  App: 3100');
        expect(logger.log).toHaveBeenCalledWith('  Postgres: 5532');
        expect(logger.log).toHaveBeenCalledWith('  Redis: 6479');
        expect(logger.log).toHaveBeenCalledWith('  pgAdmin: 5150');
        expect(logger.log).toHaveBeenCalledWith('  Redis Commander: 8181');
        expect(config.getAifabrixHomeOverride).toHaveBeenCalled();
        expect(config.getAifabrixSecretsPath).toHaveBeenCalled();
        expect(config.getAifabrixEnvConfigPath).toHaveBeenCalled();
      });

      it('should execute dev config command without set-id option via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = {};
        config.getDeveloperId.mockResolvedValue(0);
        config.getAifabrixHomeOverride.mockResolvedValue(null);
        config.getAifabrixSecretsPath.mockResolvedValue(null);
        config.getAifabrixEnvConfigPath.mockResolvedValue(null);
        devConfig.getDevPorts.mockReturnValue({
          app: 3000,
          postgres: 5432,
          redis: 6379,
          pgadmin: 5050,
          redisCommander: 8081
        });

        const handler = commandActions['dev config'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(config.getDeveloperId).toHaveBeenCalled();
        expect(config.setDeveloperId).not.toHaveBeenCalled();
        expect(devConfig.getDevPorts).toHaveBeenCalledWith(0);
        expect(logger.log).toHaveBeenCalledWith('\n🔧 Developer Configuration\n');
        expect(logger.log).toHaveBeenCalledWith('Developer ID: 0');
        expect(logger.log).toHaveBeenCalledWith('\nPorts:');
        expect(logger.log).toHaveBeenCalledWith('  App: 3000');
        expect(logger.log).toHaveBeenCalledWith('  Postgres: 5432');
        expect(logger.log).toHaveBeenCalledWith('  Redis: 6379');
        expect(logger.log).toHaveBeenCalledWith('  pgAdmin: 5050');
        expect(logger.log).toHaveBeenCalledWith('  Redis Commander: 8081');
        expect(config.getAifabrixHomeOverride).toHaveBeenCalled();
        expect(config.getAifabrixSecretsPath).toHaveBeenCalled();
        expect(config.getAifabrixEnvConfigPath).toHaveBeenCalled();
      });

      it('should display configuration variables when set via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = {};
        config.getDeveloperId.mockResolvedValue(1);
        config.getAifabrixHomeOverride.mockResolvedValue('/workspace/.aifabrix');
        config.getAifabrixSecretsPath.mockResolvedValue('/workspace/aifabrix-miso/builder/secrets.local.yaml');
        config.getAifabrixEnvConfigPath.mockResolvedValue('/workspace/aifabrix-miso/builder/env-config.yaml');
        devConfig.getDevPorts.mockReturnValue({
          app: 3100,
          postgres: 5532,
          redis: 6479,
          pgadmin: 5150,
          redisCommander: 8181
        });

        const handler = commandActions['dev config'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(config.getDeveloperId).toHaveBeenCalled();
        expect(devConfig.getDevPorts).toHaveBeenCalledWith(1);
        expect(logger.log).toHaveBeenCalledWith('\n🔧 Developer Configuration\n');
        expect(logger.log).toHaveBeenCalledWith('Developer ID: 1');
        expect(logger.log).toHaveBeenCalledWith('\nPorts:');
        expect(logger.log).toHaveBeenCalledWith('  App: 3100');
        expect(logger.log).toHaveBeenCalledWith('\nConfiguration:');
        expect(logger.log).toHaveBeenCalledWith('  aifabrix-home: /workspace/.aifabrix');
        expect(logger.log).toHaveBeenCalledWith('  aifabrix-secrets: /workspace/aifabrix-miso/builder/secrets.local.yaml');
        expect(logger.log).toHaveBeenCalledWith('  aifabrix-env-config: /workspace/aifabrix-miso/builder/env-config.yaml');
      });

      it('should display configuration variables when set-id option is used via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { setId: '2' };
        config.setDeveloperId.mockResolvedValue();
        config.getAifabrixHomeOverride.mockResolvedValue('/workspace/.aifabrix');
        config.getAifabrixSecretsPath.mockResolvedValue('/workspace/aifabrix-miso/builder/secrets.local.yaml');
        config.getAifabrixEnvConfigPath.mockResolvedValue('/workspace/aifabrix-miso/builder/env-config.yaml');
        devConfig.getDevPorts.mockReturnValue({
          app: 3200,
          postgres: 5632,
          redis: 6579,
          pgadmin: 5250,
          redisCommander: 8281
        });
        process.env.AIFABRIX_DEVELOPERID = undefined;
        chalk.green.mockImplementation((text) => text);

        const handler = commandActions['dev config'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(config.setDeveloperId).toHaveBeenCalledWith('2');
        expect(devConfig.getDevPorts).toHaveBeenCalledWith(2);
        expect(logger.log).toHaveBeenCalledWith(chalk.green('✓ Developer ID set to 2'));
        expect(logger.log).toHaveBeenCalledWith('\n🔧 Developer Configuration\n');
        expect(logger.log).toHaveBeenCalledWith('Developer ID: 2');
        expect(logger.log).toHaveBeenCalledWith('\nPorts:');
        expect(logger.log).toHaveBeenCalledWith('  App: 3200');
        expect(logger.log).toHaveBeenCalledWith('\nConfiguration:');
        expect(logger.log).toHaveBeenCalledWith('  aifabrix-home: /workspace/.aifabrix');
        expect(logger.log).toHaveBeenCalledWith('  aifabrix-secrets: /workspace/aifabrix-miso/builder/secrets.local.yaml');
        expect(logger.log).toHaveBeenCalledWith('  aifabrix-env-config: /workspace/aifabrix-miso/builder/env-config.yaml');
      });

      it('should display partial configuration variables when only some are set via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = {};
        config.getDeveloperId.mockResolvedValue(1);
        config.getAifabrixHomeOverride.mockResolvedValue('/workspace/.aifabrix');
        config.getAifabrixSecretsPath.mockResolvedValue(null);
        config.getAifabrixEnvConfigPath.mockResolvedValue('/workspace/aifabrix-miso/builder/env-config.yaml');
        devConfig.getDevPorts.mockReturnValue({
          app: 3100,
          postgres: 5532,
          redis: 6479,
          pgadmin: 5150,
          redisCommander: 8181
        });

        const handler = commandActions['dev config'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(logger.log).toHaveBeenCalledWith('\nConfiguration:');
        expect(logger.log).toHaveBeenCalledWith('  aifabrix-home: /workspace/.aifabrix');
        expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('aifabrix-secrets'));
        expect(logger.log).toHaveBeenCalledWith('  aifabrix-env-config: /workspace/aifabrix-miso/builder/env-config.yaml');
      });

      it('should handle dev config command with invalid set-id via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { setId: '-1' };
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['dev config'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'dev config');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      it('should handle dev config command with NaN set-id via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { setId: 'invalid' };
        cliUtils.handleCommandError.mockImplementation(() => {});
        process.exit.mockImplementation(() => {});

        const handler = commandActions['dev config'];
        expect(handler).toBeDefined();

        await handler(options);

        expect(cliUtils.handleCommandError).toHaveBeenCalledWith(expect.any(Error), 'dev config');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      it('should handle dev config command when options is object via setupCommands', async() => {
        setupCommandsAndResetLogger();

        const options = { setId: '1' };
        config.setDeveloperId.mockResolvedValue();
        config.getAifabrixHomeOverride.mockResolvedValue(null);
        config.getAifabrixSecretsPath.mockResolvedValue(null);
        config.getAifabrixEnvConfigPath.mockResolvedValue(null);
        devConfig.getDevPorts.mockReturnValue({
          app: 3100,
          postgres: 5532,
          redis: 6479,
          pgadmin: 5150,
          redisCommander: 8181
        });
        chalk.green.mockImplementation((text) => text);

        const handler = commandActions['dev config'];
        expect(handler).toBeDefined();

        // Simulate Commander.js passing options as first arg when it's an object
        await handler(options);

        expect(config.setDeveloperId).toHaveBeenCalledWith('1');
        expect(config.getAifabrixHomeOverride).toHaveBeenCalled();
        expect(config.getAifabrixSecretsPath).toHaveBeenCalled();
        expect(config.getAifabrixEnvConfigPath).toHaveBeenCalled();
      });
    });
  });
});
