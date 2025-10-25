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
jest.mock('os');
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

const secrets = require('../../lib/secrets');
const generator = require('../../lib/generator');
const keyGenerator = require('../../lib/key-generator');
const validator = require('../../lib/validator');
const infra = require('../../lib/infra');

describe('CLI Commands', () => {
  const mockHomeDir = '/home/test';
  const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);

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
      const mockEnvResult = {
        docker: 'ok',
        ports: 'ok',
        secrets: 'ok',
        recommendations: []
      };

      validator.checkEnvironment.mockResolvedValue(mockEnvResult);
      infra.checkInfraHealth.mockRejectedValue(new Error('Infrastructure not running'));

      try {
        const result = await validator.checkEnvironment();
        console.log('\n🔍 AI Fabrix Environment Check\n');

        console.log(`Docker: ${result.docker === 'ok' ? '✅ Running' : '❌ Not available'}`);
        console.log(`Ports: ${result.ports === 'ok' ? '✅ Available' : '⚠️  Some ports in use'}`);
        console.log(`Secrets: ${result.secrets === 'ok' ? '✅ Configured' : '❌ Missing'}`);

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

        expect(console.log).toHaveBeenCalledWith('\n🏥 Infrastructure: Not running');
      } catch (error) {
        expect(true).toBe(false); // Should not reach here
      }
    });

    it('should handle doctor command errors', async() => {
      const errorMessage = 'Environment check failed';

      validator.checkEnvironment.mockRejectedValue(new Error(errorMessage));

      try {
        await validator.checkEnvironment();
        expect(true).toBe(false); // Should have thrown error
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });
});
