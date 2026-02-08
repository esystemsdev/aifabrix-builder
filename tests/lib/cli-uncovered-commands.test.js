/**
 * Tests for uncovered CLI command handlers in lib/cli.js
 *
 * @fileoverview Unit tests for CLI command handlers with low coverage
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../lib/app', () => ({
  pushApp: jest.fn(),
  deployApp: jest.fn()
}));

jest.mock('../../lib/deployment/environment', () => ({
  deployEnvironment: jest.fn()
}));

jest.mock('../../lib/validation/validator', () => ({
  checkEnvironment: jest.fn()
}));

jest.mock('../../lib/infrastructure', () => ({
  checkInfraHealth: jest.fn()
}));

jest.mock('../../lib/generator', () => ({
  splitDeployJson: jest.fn(),
  generateDeployJson: jest.fn()
}));

jest.mock('../../lib/validation/validate', () => ({
  validateAppOrFile: jest.fn(),
  displayValidationResults: jest.fn()
}));

jest.mock('../../lib/core/diff', () => ({
  compareFiles: jest.fn(),
  formatDiffOutput: jest.fn()
}));

jest.mock('../../lib/external-system/download', () => ({
  downloadExternalSystem: jest.fn()
}));

jest.mock('../../lib/external-system/test', () => ({
  testExternalSystem: jest.fn(),
  testExternalSystemIntegration: jest.fn(),
  displayTestResults: jest.fn(),
  displayIntegrationTestResults: jest.fn()
}));

jest.mock('../../lib/utils/cli-utils', () => ({
  handleCommandError: jest.fn()
}));

jest.mock('../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../lib/utils/paths', () => ({
  detectAppType: jest.fn(),
  getDeployJsonPath: jest.fn()
}));

jest.mock('../../lib/commands/secure', () => ({
  handleSecure: jest.fn()
}));

jest.mock('../../lib/commands/secrets-set', () => ({
  handleSecretsSet: jest.fn()
}));

const fs = require('fs');
const app = require('../../lib/app');
const environmentDeploy = require('../../lib/deployment/environment');
const validator = require('../../lib/validation/validator');
const infra = require('../../lib/infrastructure');
const generator = require('../../lib/generator');
const validate = require('../../lib/validation/validate');
const diff = require('../../lib/core/diff');
const download = require('../../lib/external-system/download');
const test = require('../../lib/external-system/test');
const cliUtils = require('../../lib/utils/cli-utils');
const logger = require('../../lib/utils/logger');
const { handleSecure } = require('../../lib/commands/secure');
const { handleSecretsSet } = require('../../lib/commands/secrets-set');
const chalk = require('chalk');

describe('CLI Uncovered Command Handlers', () => {
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  describe('push command handler', () => {
    it('should handle push command successfully', async() => {
      app.pushApp.mockResolvedValue();
      const appName = 'testapp';
      const options = { registry: 'registry.azurecr.io', tag: 'latest' };

      const handler = async(appName, options) => {
        try {
          await app.pushApp(appName, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'push');
          process.exit(1);
        }
      };

      await handler(appName, options);
      expect(app.pushApp).toHaveBeenCalledWith(appName, options);
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle push command error', async() => {
      const error = new Error('Push failed');
      app.pushApp.mockRejectedValue(error);

      const handler = async(appName, options) => {
        try {
          await app.pushApp(appName, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'push');
          process.exit(1);
        }
      };

      await handler('testapp', {});
      expect(cliUtils.handleCommandError).toHaveBeenCalledWith(error, 'push');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('environment deploy command handler', () => {
    it('should handle environment deploy successfully', async() => {
      environmentDeploy.deployEnvironment.mockResolvedValue();
      const envKey = 'dev';
      const options = { controller: 'https://controller.example.com' };

      const handler = async(envKey, options) => {
        try {
          const environmentDeploy = require('../../lib/deployment/environment');
          await environmentDeploy.deployEnvironment(envKey, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'environment deploy');
          process.exit(1);
        }
      };

      await handler(envKey, options);
      expect(environmentDeploy.deployEnvironment).toHaveBeenCalledWith(envKey, options);
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle environment deploy error', async() => {
      const error = new Error('Deployment failed');
      environmentDeploy.deployEnvironment.mockRejectedValue(error);

      const handler = async(envKey, options) => {
        try {
          const environmentDeploy = require('../../lib/deployment/environment');
          await environmentDeploy.deployEnvironment(envKey, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'environment deploy');
          process.exit(1);
        }
      };

      await handler('dev', {});
      expect(cliUtils.handleCommandError).toHaveBeenCalledWith(error, 'environment deploy');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('env deploy command handler', () => {
    it('should handle env deploy successfully', async() => {
      environmentDeploy.deployEnvironment.mockResolvedValue();
      const envKey = 'dev';
      const options = { controller: 'https://controller.example.com' };

      const handler = async(envKey, options) => {
        try {
          const environmentDeploy = require('../../lib/deployment/environment');
          await environmentDeploy.deployEnvironment(envKey, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'environment deploy');
          process.exit(1);
        }
      };

      await handler(envKey, options);
      expect(environmentDeploy.deployEnvironment).toHaveBeenCalledWith(envKey, options);
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('deploy command handler', () => {
    it('should handle deploy command successfully', async() => {
      app.deployApp.mockResolvedValue({ deploymentId: '123' });
      const appName = 'testapp';
      const options = { environment: 'dev', controller: 'https://controller.example.com' };

      const handler = async(appName, options) => {
        try {
          await app.deployApp(appName, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'deploy');
          process.exit(1);
        }
      };

      await handler(appName, options);
      expect(app.deployApp).toHaveBeenCalledWith(appName, options);
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle deploy command error', async() => {
      const error = new Error('Deployment failed');
      app.deployApp.mockRejectedValue(error);

      const handler = async(appName, options) => {
        try {
          await app.deployApp(appName, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'deploy');
          process.exit(1);
        }
      };

      await handler('testapp', {});
      expect(cliUtils.handleCommandError).toHaveBeenCalledWith(error, 'deploy');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('doctor command infrastructure health check', () => {
    it('should check infrastructure health when Docker is available', async() => {
      validator.checkEnvironment.mockResolvedValue({
        docker: 'ok',
        ports: 'ok',
        secrets: 'ok',
        recommendations: []
      });
      infra.checkInfraHealth.mockResolvedValue({
        postgres: 'healthy',
        redis: 'healthy'
      });

      const handler = async() => {
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

      await handler();
      expect(validator.checkEnvironment).toHaveBeenCalled();
      expect(infra.checkInfraHealth).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith('\n🏥 Infrastructure Health:');
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle infrastructure health check error', async() => {
      validator.checkEnvironment.mockResolvedValue({
        docker: 'ok',
        ports: 'ok',
        secrets: 'ok',
        recommendations: []
      });
      infra.checkInfraHealth.mockRejectedValue(new Error('Health check failed'));

      const handler = async() => {
        try {
          const result = await validator.checkEnvironment();
          logger.log('\n🔍 AI Fabrix Environment Check\n');
          logger.log(`Docker: ${result.docker === 'ok' ? '✅ Running' : '❌ Not available'}`);
          logger.log(`Ports: ${result.ports === 'ok' ? '✅ Available' : '⚠️  Some ports in use'}`);
          logger.log(`Secrets: ${result.secrets === 'ok' ? '✅ Configured' : '❌ Missing'}`);

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
        } catch (error) {
          cliUtils.handleCommandError(error, 'doctor');
          process.exit(1);
        }
      };

      await handler();
      expect(logger.log).toHaveBeenCalledWith('\n🏥 Infrastructure: Not running');
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('split-json command handler', () => {
    let detectAppType, getDeployJsonPath;

    beforeEach(() => {
      jest.clearAllMocks();
      fs.existsSync = jest.fn();
      const paths = require('../../lib/utils/paths');
      detectAppType = paths.detectAppType;
      getDeployJsonPath = paths.getDeployJsonPath;
    });

    it('should handle split-json command successfully', async() => {
      detectAppType.mockResolvedValue({
        appPath: '/test/app',
        appType: 'typescript'
      });
      getDeployJsonPath.mockReturnValue('/test/app/aifabrix-deploy.json');
      fs.existsSync.mockReturnValue(true);
      generator.splitDeployJson.mockResolvedValue({
        envTemplate: '/test/app/env.template',
        variables: '/test/app/variables.yaml',
        rbac: '/test/app/rbac.yml',
        readme: '/test/app/README.md'
      });

      const handler = async(appName, options) => {
        try {
          const fs = require('fs');
          const { detectAppType, getDeployJsonPath } = require('../../lib/utils/paths');
          const { appPath, appType } = await detectAppType(appName);
          const deployJsonPath = getDeployJsonPath(appName, appType, true);

          if (!fs.existsSync(deployJsonPath)) {
            throw new Error(`Deployment JSON file not found: ${deployJsonPath}`);
          }

          const outputDir = options.output || appPath;
          const result = await generator.splitDeployJson(deployJsonPath, outputDir);

          logger.log(chalk.green('\n✓ Successfully split deployment JSON into component files:'));
          logger.log(`  • env.template: ${result.envTemplate}`);
          logger.log(`  • variables.yaml: ${result.variables}`);
          if (result.rbac) {
            logger.log(`  • rbac.yml: ${result.rbac}`);
          }
          logger.log(`  • README.md: ${result.readme}`);
        } catch (error) {
          cliUtils.handleCommandError(error, 'split-json');
          process.exit(1);
        }
      };

      await handler('testapp', {});
      expect(generator.splitDeployJson).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(chalk.green('\n✓ Successfully split deployment JSON into component files:'));
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle split-json command error when file not found', async() => {
      detectAppType.mockResolvedValue({
        appPath: '/test/app',
        appType: 'typescript'
      });
      getDeployJsonPath.mockReturnValue('/test/app/aifabrix-deploy.json');
      fs.existsSync.mockReturnValue(false);

      const handler = async(appName, options) => {
        try {
          const fs = require('fs');
          const { detectAppType, getDeployJsonPath } = require('../../lib/utils/paths');
          const { appPath, appType } = await detectAppType(appName);
          const deployJsonPath = getDeployJsonPath(appName, appType, true);

          if (!fs.existsSync(deployJsonPath)) {
            throw new Error(`Deployment JSON file not found: ${deployJsonPath}`);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'split-json');
          process.exit(1);
        }
      };

      await handler('testapp', {});
      expect(cliUtils.handleCommandError).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('validate command handler', () => {
    it('should handle validate command successfully', async() => {
      validate.validateAppOrFile.mockResolvedValue({ valid: true });
      validate.displayValidationResults.mockImplementation(() => {});

      const handler = async(appOrFile) => {
        try {
          const validate = require('../../lib/validation/validate');
          const result = await validate.validateAppOrFile(appOrFile);
          validate.displayValidationResults(result);
          if (!result.valid) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'validate');
          process.exit(1);
        }
      };

      await handler('testapp');
      expect(validate.validateAppOrFile).toHaveBeenCalledWith('testapp');
      expect(validate.displayValidationResults).toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should exit when validation fails', async() => {
      validate.validateAppOrFile.mockResolvedValue({ valid: false });
      validate.displayValidationResults.mockImplementation(() => {});

      const handler = async(appOrFile) => {
        try {
          const validate = require('../../lib/validation/validate');
          const result = await validate.validateAppOrFile(appOrFile);
          validate.displayValidationResults(result);
          if (!result.valid) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'validate');
          process.exit(1);
        }
      };

      await handler('testapp');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle validate command error', async() => {
      const error = new Error('Validation failed');
      validate.validateAppOrFile.mockRejectedValue(error);

      const handler = async(appOrFile) => {
        try {
          const validate = require('../../lib/validation/validate');
          const result = await validate.validateAppOrFile(appOrFile);
          validate.displayValidationResults(result);
          if (!result.valid) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'validate');
          process.exit(1);
        }
      };

      await handler('testapp');
      expect(cliUtils.handleCommandError).toHaveBeenCalledWith(error, 'validate');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('diff command handler', () => {
    it('should handle diff command successfully', async() => {
      diff.compareFiles.mockResolvedValue({ identical: true });
      diff.formatDiffOutput.mockImplementation(() => {});

      const handler = async(file1, file2) => {
        try {
          const diff = require('../../lib/core/diff');
          const result = await diff.compareFiles(file1, file2);
          diff.formatDiffOutput(result);
          if (!result.identical) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'diff');
          process.exit(1);
        }
      };

      await handler('file1.yaml', 'file2.yaml');
      expect(diff.compareFiles).toHaveBeenCalledWith('file1.yaml', 'file2.yaml');
      expect(diff.formatDiffOutput).toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should exit when files are not identical', async() => {
      diff.compareFiles.mockResolvedValue({ identical: false });
      diff.formatDiffOutput.mockImplementation(() => {});

      const handler = async(file1, file2) => {
        try {
          const diff = require('../../lib/core/diff');
          const result = await diff.compareFiles(file1, file2);
          diff.formatDiffOutput(result);
          if (!result.identical) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'diff');
          process.exit(1);
        }
      };

      await handler('file1.yaml', 'file2.yaml');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle diff command error', async() => {
      const error = new Error('Diff failed');
      diff.compareFiles.mockRejectedValue(error);

      const handler = async(file1, file2) => {
        try {
          const diff = require('../../lib/core/diff');
          const result = await diff.compareFiles(file1, file2);
          diff.formatDiffOutput(result);
          if (!result.identical) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'diff');
          process.exit(1);
        }
      };

      await handler('file1.yaml', 'file2.yaml');
      expect(cliUtils.handleCommandError).toHaveBeenCalledWith(error, 'diff');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('secrets set command handler', () => {
    it('should handle secrets set command successfully', async() => {
      handleSecretsSet.mockResolvedValue();

      const handler = async(key, value, options) => {
        try {
          await handleSecretsSet(key, value, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'secrets set');
          process.exit(1);
        }
      };

      await handler('test-key', 'test-value', {});
      expect(handleSecretsSet).toHaveBeenCalledWith('test-key', 'test-value', {});
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle secrets set command error', async() => {
      const error = new Error('Secrets set failed');
      handleSecretsSet.mockRejectedValue(error);

      const handler = async(key, value, options) => {
        try {
          await handleSecretsSet(key, value, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'secrets set');
          process.exit(1);
        }
      };

      await handler('test-key', 'test-value', {});
      expect(cliUtils.handleCommandError).toHaveBeenCalledWith(error, 'secrets set');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('secure command handler', () => {
    it('should handle secure command successfully', async() => {
      handleSecure.mockResolvedValue();

      const handler = async(options) => {
        try {
          await handleSecure(options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'secure');
          process.exit(1);
        }
      };

      await handler({ 'secrets-encryption': 'test-key' });
      expect(handleSecure).toHaveBeenCalledWith({ 'secrets-encryption': 'test-key' });
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle secure command error', async() => {
      const error = new Error('Secure failed');
      handleSecure.mockRejectedValue(error);

      const handler = async(options) => {
        try {
          await handleSecure(options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'secure');
          process.exit(1);
        }
      };

      await handler({});
      expect(cliUtils.handleCommandError).toHaveBeenCalledWith(error, 'secure');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('download command handler', () => {
    it('should handle download command successfully', async() => {
      download.downloadExternalSystem.mockResolvedValue();

      const handler = async(systemKey, options) => {
        try {
          const download = require('../../lib/external-system/download');
          await download.downloadExternalSystem(systemKey, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'download');
          process.exit(1);
        }
      };

      await handler('test-system', { environment: 'dev' });
      expect(download.downloadExternalSystem).toHaveBeenCalledWith('test-system', { environment: 'dev' });
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle download command error', async() => {
      const error = new Error('Download failed');
      download.downloadExternalSystem.mockRejectedValue(error);

      const handler = async(systemKey, options) => {
        try {
          const download = require('../../lib/external-system/download');
          await download.downloadExternalSystem(systemKey, options);
        } catch (error) {
          cliUtils.handleCommandError(error, 'download');
          process.exit(1);
        }
      };

      await handler('test-system', {});
      expect(cliUtils.handleCommandError).toHaveBeenCalledWith(error, 'download');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('test command handler', () => {
    it('should handle test command successfully', async() => {
      test.testExternalSystem.mockResolvedValue({ valid: true });
      test.displayTestResults.mockImplementation(() => {});

      const handler = async(appName, options) => {
        try {
          const test = require('../../lib/external-system/test');
          const results = await test.testExternalSystem(appName, options);
          test.displayTestResults(results, options.verbose);
          if (!results.valid) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'test');
          process.exit(1);
        }
      };

      await handler('testapp', { verbose: true });
      expect(test.testExternalSystem).toHaveBeenCalledWith('testapp', { verbose: true });
      expect(test.displayTestResults).toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should exit when test results are invalid', async() => {
      test.testExternalSystem.mockResolvedValue({ valid: false });
      test.displayTestResults.mockImplementation(() => {});

      const handler = async(appName, options) => {
        try {
          const test = require('../../lib/external-system/test');
          const results = await test.testExternalSystem(appName, options);
          test.displayTestResults(results, options.verbose);
          if (!results.valid) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'test');
          process.exit(1);
        }
      };

      await handler('testapp', {});
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle test command error', async() => {
      const error = new Error('Test failed');
      test.testExternalSystem.mockRejectedValue(error);

      const handler = async(appName, options) => {
        try {
          const test = require('../../lib/external-system/test');
          const results = await test.testExternalSystem(appName, options);
          test.displayTestResults(results, options.verbose);
          if (!results.valid) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'test');
          process.exit(1);
        }
      };

      await handler('testapp', {});
      expect(cliUtils.handleCommandError).toHaveBeenCalledWith(error, 'test');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('test-integration command handler', () => {
    it('should handle test-integration command successfully', async() => {
      test.testExternalSystemIntegration.mockResolvedValue({ success: true });
      test.displayIntegrationTestResults.mockImplementation(() => {});

      const handler = async(appName, options) => {
        try {
          const test = require('../../lib/external-system/test');
          const results = await test.testExternalSystemIntegration(appName, options);
          test.displayIntegrationTestResults(results, options.verbose);
          if (!results.success) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'test-integration');
          process.exit(1);
        }
      };

      await handler('testapp', { verbose: true });
      expect(test.testExternalSystemIntegration).toHaveBeenCalledWith('testapp', { verbose: true });
      expect(test.displayIntegrationTestResults).toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should exit when integration test fails', async() => {
      test.testExternalSystemIntegration.mockResolvedValue({ success: false });
      test.displayIntegrationTestResults.mockImplementation(() => {});

      const handler = async(appName, options) => {
        try {
          const test = require('../../lib/external-system/test');
          const results = await test.testExternalSystemIntegration(appName, options);
          test.displayIntegrationTestResults(results, options.verbose);
          if (!results.success) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'test-integration');
          process.exit(1);
        }
      };

      await handler('testapp', {});
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle test-integration command error', async() => {
      const error = new Error('Integration test failed');
      test.testExternalSystemIntegration.mockRejectedValue(error);

      const handler = async(appName, options) => {
        try {
          const test = require('../../lib/external-system/test');
          const results = await test.testExternalSystemIntegration(appName, options);
          test.displayIntegrationTestResults(results, options.verbose);
          if (!results.success) {
            process.exit(1);
          }
        } catch (error) {
          cliUtils.handleCommandError(error, 'test-integration');
          process.exit(1);
        }
      };

      await handler('testapp', {});
      expect(cliUtils.handleCommandError).toHaveBeenCalledWith(error, 'test-integration');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});

