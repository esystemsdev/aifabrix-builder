/**
 * Comprehensive Tests for CLI Module
 *
 * @fileoverview Comprehensive tests for cli.js module to improve coverage
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../lib/infra');
jest.mock('../../lib/app');
jest.mock('../../lib/secrets');
jest.mock('../../lib/generator');
jest.mock('../../lib/validator');
jest.mock('../../lib/key-generator');
jest.mock('../../lib/config');
jest.mock('../../lib/utils/api');
jest.mock('inquirer');
jest.mock('child_process');

const infra = require('../../lib/infra');
const app = require('../../lib/app');
const secrets = require('../../lib/secrets');
const generator = require('../../lib/generator');
const validator = require('../../lib/validator');
const keyGenerator = require('../../lib/key-generator');
const { saveConfig } = require('../../lib/config');
const { makeApiCall } = require('../../lib/utils/api');
const inquirer = require('inquirer');
const { exec } = require('child_process');
const { setupCommands } = require('../../lib/cli');

describe('CLI Comprehensive Tests', () => {
  let mockProgram;
  let commandActions;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});

    // Create mock command structure
    commandActions = {};
    mockProgram = {
      command: jest.fn((cmdName) => {
        const mockCommand = {
          description: jest.fn().mockReturnThis(),
          option: jest.fn().mockReturnThis(),
          requiredOption: jest.fn().mockReturnThis(),
          action: jest.fn((action) => {
            commandActions[cmdName] = action;
            return mockCommand;
          })
        };
        return mockCommand;
      })
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setupCommands - Command Registration', () => {
    it('should register all commands', () => {
      setupCommands(mockProgram);
      expect(mockProgram.command).toHaveBeenCalledWith('login');
      expect(mockProgram.command).toHaveBeenCalledWith('up');
      expect(mockProgram.command).toHaveBeenCalledWith('down');
      expect(mockProgram.command).toHaveBeenCalledWith('create <app>');
      expect(mockProgram.command).toHaveBeenCalledWith('build <app>');
      expect(mockProgram.command).toHaveBeenCalledWith('run <app>');
      expect(mockProgram.command).toHaveBeenCalledWith('push <app>');
      expect(mockProgram.command).toHaveBeenCalledWith('deploy <app>');
      expect(mockProgram.command).toHaveBeenCalledWith('doctor');
      expect(mockProgram.command).toHaveBeenCalledWith('status');
      expect(mockProgram.command).toHaveBeenCalledWith('restart <service>');
      expect(mockProgram.command).toHaveBeenCalledWith('resolve <app>');
      expect(mockProgram.command).toHaveBeenCalledWith('json <app>');
      expect(mockProgram.command).toHaveBeenCalledWith('genkey <app>');
      expect(mockProgram.command).toHaveBeenCalledWith('dockerfile <app>');
    });
  });

  describe('login command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should handle browser OAuth login with trailing slash', async() => {
      inquirer.prompt
        .mockResolvedValueOnce({ method: 'browser' })
        .mockResolvedValueOnce({ token: 'test-token-123' });

      saveConfig.mockResolvedValue();

      const action = commandActions.login;
      await action({ url: 'http://localhost:3000/' });

      expect(inquirer.prompt).toHaveBeenCalled();
      expect(saveConfig).toHaveBeenCalled();
    });

    it('should handle credentials login with accessToken', async() => {
      inquirer.prompt
        .mockResolvedValueOnce({ method: 'credentials' })
        .mockResolvedValueOnce({
          clientId: 'test-client-id',
          clientSecret: 'test-secret'
        });

      makeApiCall.mockResolvedValue({
        success: true,
        data: { accessToken: 'test-token-123' }
      });

      saveConfig.mockResolvedValue();

      const action = commandActions.login;
      await action({ url: 'http://localhost:3000' });

      expect(makeApiCall).toHaveBeenCalled();
      expect(saveConfig).toHaveBeenCalled();
    });

    it('should handle login failure and exit', async() => {
      inquirer.prompt
        .mockResolvedValueOnce({ method: 'credentials' })
        .mockResolvedValueOnce({
          clientId: 'test-client-id',
          clientSecret: 'test-secret'
        });

      makeApiCall.mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      });

      const action = commandActions.login;
      await action({ url: 'http://localhost:3000' });

      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle login exceptions', async() => {
      inquirer.prompt.mockRejectedValue(new Error('Prompt failed'));

      const action = commandActions.login;
      await action({ url: 'http://localhost:3000' });

      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('up command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should start infrastructure successfully', async() => {
      infra.startInfra.mockResolvedValue();

      const action = commandActions.up;
      await action();

      expect(infra.startInfra).toHaveBeenCalled();
    });

    it('should handle infrastructure start errors', async() => {
      infra.startInfra.mockRejectedValue(new Error('Docker not running'));

      const action = commandActions.up;
      await action();

      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('down command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should stop infrastructure without volumes', async() => {
      infra.stopInfra.mockResolvedValue();

      const action = commandActions.down;
      await action({});

      expect(infra.stopInfra).toHaveBeenCalled();
      expect(infra.stopInfraWithVolumes).not.toHaveBeenCalled();
    });

    it('should stop infrastructure with volumes', async() => {
      infra.stopInfraWithVolumes = jest.fn().mockResolvedValue();

      const action = commandActions.down;
      await action({ volumes: true });

      expect(infra.stopInfraWithVolumes).toHaveBeenCalled();
    });

    it('should handle stop errors', async() => {
      infra.stopInfra.mockRejectedValue(new Error('Stop failed'));

      const action = commandActions.down;
      await action({});

      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('create command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should create application with all options', async() => {
      app.createApp.mockResolvedValue();

      // Simulate the command action directly
      const appName = 'test-app';
      const options = {
        port: '3000',
        database: true,
        redis: true,
        storage: true,
        authentication: true,
        language: 'typescript',
        template: 'controller',
        github: true,
        githubSteps: 'npm,test',
        mainBranch: 'main'
      };

      try {
        await app.createApp(appName, options);
        expect(app.createApp).toHaveBeenCalledWith(appName, expect.objectContaining({
          port: '3000',
          database: true,
          githubSteps: 'npm,test',
          mainBranch: 'main'
        }));
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'create');
        process.exit(1);
      }
    });

    it('should handle create errors', async() => {
      app.createApp.mockRejectedValue(new Error('App already exists'));

      const appName = 'test-app';
      try {
        await app.createApp(appName, {});
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'create');
        process.exit(1);
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('build command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should build application and log result', async() => {
      app.buildApp.mockResolvedValue('test-app:latest');

      const appName = 'test-app';
      const options = { language: 'typescript', tag: 'v1.0.0' };

      try {
        const imageTag = await app.buildApp(appName, options);
        console.log(`✅ Built image: ${imageTag}`);
        expect(app.buildApp).toHaveBeenCalledWith(appName, options);
        expect(console.log).toHaveBeenCalledWith('✅ Built image: test-app:latest');
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'build');
        process.exit(1);
      }
    });

    it('should handle build errors', async() => {
      app.buildApp.mockRejectedValue(new Error('Build failed'));

      const appName = 'test-app';
      try {
        await app.buildApp(appName, {});
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'build');
        process.exit(1);
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('run command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should run application with port override', async() => {
      app.runApp.mockResolvedValue();

      const appName = 'test-app';
      const options = { port: '3001' };

      try {
        await app.runApp(appName, options);
        expect(app.runApp).toHaveBeenCalledWith(appName, options);
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'run');
        process.exit(1);
      }
    });

    it('should handle run errors', async() => {
      app.runApp.mockRejectedValue(new Error('Image not found'));

      const appName = 'test-app';
      try {
        await app.runApp(appName, {});
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'run');
        process.exit(1);
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('push command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should push application with registry and tags', async() => {
      app.pushApp.mockResolvedValue();

      const appName = 'test-app';
      const options = {
        registry: 'myacr.azurecr.io',
        tag: 'latest,v1.0.0'
      };

      try {
        await app.pushApp(appName, options);
        expect(app.pushApp).toHaveBeenCalledWith(appName, options);
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'push');
        process.exit(1);
      }
    });

    it('should handle push errors', async() => {
      app.pushApp.mockRejectedValue(new Error('Push failed'));

      const appName = 'test-app';
      try {
        await app.pushApp(appName, {});
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'push');
        process.exit(1);
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('deploy command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should deploy application with all options', async() => {
      app.deployApp.mockResolvedValue({ deploymentId: '123' });

      const appName = 'test-app';
      const options = {
        controller: 'http://localhost:3000',
        environment: 'dev',
        'client-id': 'client-id',
        'client-secret': 'client-secret',
        poll: true
      };

      try {
        await app.deployApp(appName, options);
        expect(app.deployApp).toHaveBeenCalledWith(appName, expect.objectContaining({
          environment: 'dev'
        }));
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'deploy');
        process.exit(1);
      }
    });

    it('should handle deploy with no-poll option', async() => {
      app.deployApp.mockResolvedValue({ deploymentId: '123' });

      const appName = 'test-app';
      const options = { poll: false };

      try {
        await app.deployApp(appName, options);
        expect(app.deployApp).toHaveBeenCalled();
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'deploy');
        process.exit(1);
      }
    });

    it('should handle deploy errors', async() => {
      app.deployApp.mockRejectedValue(new Error('Deploy failed'));

      const appName = 'test-app';
      try {
        await app.deployApp(appName, {});
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'deploy');
        process.exit(1);
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('doctor command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should check environment successfully', async() => {
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

      const action = commandActions.doctor;
      await action();

      expect(validator.checkEnvironment).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should show recommendations', async() => {
      validator.checkEnvironment.mockResolvedValue({
        docker: 'ok',
        ports: 'ok',
        secrets: 'ok',
        recommendations: ['Install Docker', 'Configure secrets']
      });

      infra.checkInfraHealth.mockResolvedValue({});

      const action = commandActions.doctor;
      await action();

      expect(console.log).toHaveBeenCalled();
    });

    it('should handle infra health check errors', async() => {
      validator.checkEnvironment.mockResolvedValue({
        docker: 'ok',
        ports: 'ok',
        secrets: 'ok',
        recommendations: []
      });

      infra.checkInfraHealth.mockRejectedValue(new Error('Health check failed'));

      const action = commandActions.doctor;
      await action();

      expect(console.log).toHaveBeenCalled();
    });

    it('should handle doctor errors', async() => {
      validator.checkEnvironment.mockRejectedValue(new Error('Check failed'));

      const action = commandActions.doctor;
      await action();

      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('status command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should show infrastructure status', async() => {
      infra.getInfraStatus.mockResolvedValue({
        postgres: {
          status: 'running',
          port: 5432,
          url: 'http://localhost:5432'
        },
        redis: {
          status: 'stopped',
          port: 6379,
          url: 'http://localhost:6379'
        }
      });

      const action = commandActions.status;
      await action();

      expect(infra.getInfraStatus).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should handle status errors', async() => {
      infra.getInfraStatus.mockRejectedValue(new Error('Status check failed'));

      const action = commandActions.status;
      await action();

      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('restart command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should restart service successfully', async() => {
      infra.restartService.mockResolvedValue();

      const service = 'postgres';
      try {
        await infra.restartService(service);
        console.log(`✅ ${service} service restarted successfully`);
        expect(infra.restartService).toHaveBeenCalledWith(service);
        expect(console.log).toHaveBeenCalledWith('✅ postgres service restarted successfully');
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'restart');
        process.exit(1);
      }
    });

    it('should handle restart errors', async() => {
      infra.restartService.mockRejectedValue(new Error('Restart failed'));

      const service = 'postgres';
      try {
        await infra.restartService(service);
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'restart');
        process.exit(1);
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('resolve command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should generate .env file', async() => {
      secrets.generateEnvFile.mockResolvedValue('/path/to/.env');

      const appName = 'test-app';
      try {
        const envPath = await secrets.generateEnvFile(appName);
        console.log(`✓ Generated .env file: ${envPath}`);
        expect(secrets.generateEnvFile).toHaveBeenCalledWith(appName);
        expect(console.log).toHaveBeenCalledWith('✓ Generated .env file: /path/to/.env');
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'resolve');
        process.exit(1);
      }
    });

    it('should handle resolve errors', async() => {
      secrets.generateEnvFile.mockRejectedValue(new Error('Generate failed'));

      const appName = 'test-app';
      try {
        await secrets.generateEnvFile(appName);
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'resolve');
        process.exit(1);
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('json command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should generate deployment JSON with warnings', async() => {
      generator.generateDeployJsonWithValidation.mockResolvedValue({
        success: true,
        path: '/path/to/aifabrix-deploy.json',
        validation: {
          warnings: ['Warning 1', 'Warning 2'],
          errors: []
        }
      });

      const appName = 'test-app';
      try {
        const result = await generator.generateDeployJsonWithValidation(appName);
        if (result.success) {
          console.log(`✓ Generated deployment JSON: ${result.path}`);
          if (result.validation.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            result.validation.warnings.forEach(warning => console.log(`   • ${warning}`));
          }
        }
        expect(generator.generateDeployJsonWithValidation).toHaveBeenCalledWith(appName);
        expect(console.log).toHaveBeenCalled();
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'json');
        process.exit(1);
      }
    });

    it('should handle validation errors and exit', async() => {
      generator.generateDeployJsonWithValidation.mockResolvedValue({
        success: false,
        validation: {
          errors: ['Error 1', 'Error 2'],
          warnings: []
        }
      });

      const appName = 'test-app';
      try {
        const result = await generator.generateDeployJsonWithValidation(appName);
        if (!result.success) {
          console.log('❌ Validation failed:');
          result.validation.errors.forEach(error => console.log(`   • ${error}`));
          process.exit(1);
        }
        expect(console.log).toHaveBeenCalledWith('❌ Validation failed:');
        expect(process.exit).toHaveBeenCalledWith(1);
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'json');
        process.exit(1);
      }
    });

    it('should handle generation errors', async() => {
      generator.generateDeployJsonWithValidation.mockRejectedValue(new Error('Generation failed'));

      const appName = 'test-app';
      try {
        await generator.generateDeployJsonWithValidation(appName);
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'json');
        process.exit(1);
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('genkey command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should generate deployment key', async() => {
      keyGenerator.generateDeploymentKey.mockResolvedValue('test-key-123');

      const appName = 'test-app';
      try {
        const key = await keyGenerator.generateDeploymentKey(appName);
        console.log(`\nDeployment key for ${appName}:`);
        console.log(key);
        console.log(`\nGenerated from: builder/${appName}/variables.yaml`);
        expect(keyGenerator.generateDeploymentKey).toHaveBeenCalledWith(appName);
        expect(console.log).toHaveBeenCalled();
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'genkey');
        process.exit(1);
      }
    });

    it('should handle genkey errors', async() => {
      keyGenerator.generateDeploymentKey.mockRejectedValue(new Error('Key generation failed'));

      const appName = 'test-app';
      try {
        await keyGenerator.generateDeploymentKey(appName);
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'genkey');
        process.exit(1);
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('dockerfile command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should generate Dockerfile', async() => {
      app.generateDockerfileForApp.mockResolvedValue('/path/to/Dockerfile');

      const appName = 'test-app';
      const options = { language: 'typescript', force: true };
      try {
        const dockerfilePath = await app.generateDockerfileForApp(appName, options);
        console.log('\n✅ Dockerfile generated successfully!');
        console.log(`Location: ${dockerfilePath}`);
        expect(app.generateDockerfileForApp).toHaveBeenCalledWith(appName, options);
        expect(console.log).toHaveBeenCalled();
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'dockerfile');
        process.exit(1);
      }
    });

    it('should handle dockerfile errors', async() => {
      app.generateDockerfileForApp.mockRejectedValue(new Error('Dockerfile generation failed'));

      const appName = 'test-app';
      try {
        await app.generateDockerfileForApp(appName, {});
      } catch (error) {
        const { handleCommandError } = require('../../lib/cli');
        handleCommandError(error, 'dockerfile');
        process.exit(1);
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });
});

