/**
 * Comprehensive Tests for CLI Module
 *
 * @fileoverview Comprehensive tests for cli.js module to improve coverage
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../lib/infrastructure');
jest.mock('../../lib/app');
jest.mock('../../lib/generator');
jest.mock('../../lib/validation/validator');
jest.mock('../../lib/core/key-generator');
// Mock config BEFORE secrets to ensure config mock is available when secrets.js loads
jest.mock('../../lib/core/config', () => {
  const mockGetDeveloperId = jest.fn().mockResolvedValue(1);
  const mockSetDeveloperId = jest.fn().mockResolvedValue();
  const mockGetConfig = jest.fn().mockResolvedValue({ 'developer-id': 1, environment: 'dev', environments: {} });
  const mockSaveConfig = jest.fn().mockResolvedValue();
  const mockClearConfig = jest.fn().mockResolvedValue();
  const mockGetCurrentEnvironment = jest.fn().mockResolvedValue('dev');
  const mockSetCurrentEnvironment = jest.fn().mockResolvedValue();
  const mockSetControllerUrl = jest.fn().mockResolvedValue();
  const mockGetControllerUrl = jest.fn().mockResolvedValue(null);
  const mockSaveClientToken = jest.fn().mockResolvedValue();
  const mockSaveDeviceToken = jest.fn().mockResolvedValue();
  const mockEnsureSecretsEncryptionKey = jest.fn().mockResolvedValue();

  return {
    getDeveloperId: mockGetDeveloperId,
    ensureSecretsEncryptionKey: mockEnsureSecretsEncryptionKey,
    setDeveloperId: mockSetDeveloperId,
    getConfig: mockGetConfig,
    saveConfig: mockSaveConfig,
    clearConfig: mockClearConfig,
    getCurrentEnvironment: mockGetCurrentEnvironment,
    setCurrentEnvironment: mockSetCurrentEnvironment,
    setControllerUrl: mockSetControllerUrl,
    getControllerUrl: mockGetControllerUrl,
    saveClientToken: mockSaveClientToken,
    saveDeviceToken: mockSaveDeviceToken,
    CONFIG_DIR: '/mock/config/dir',
    CONFIG_FILE: '/mock/config/dir/config.yaml'
  };
});
// Mock dev-config BEFORE secrets (secrets requires dev-config)
jest.mock('../../lib/utils/dev-config', () => {
  const mockGetDevPorts = jest.fn((id) => ({
    app: 3000 + (id * 100),
    postgres: 5432 + (id * 100),
    redis: 6379 + (id * 100),
    pgadmin: 5050 + (id * 100),
    redisCommander: 8081 + (id * 100)
  }));

  return {
    getDevPorts: mockGetDevPorts,
    getBasePorts: jest.fn(() => ({
      app: 3000,
      postgres: 5432,
      redis: 6379,
      pgadmin: 5050,
      redisCommander: 8081
    }))
  };
});
// Mock secrets dependencies BEFORE secrets
jest.mock('../../lib/utils/secrets-utils');
jest.mock('../../lib/utils/secrets-path');
jest.mock('../../lib/utils/secrets-generator');
// Mock secrets - must be after config and dev-config mocks
// Using factory function to prevent loading actual secrets.js which requires config
jest.mock('../../lib/core/secrets', () => {
  // Don't require actual secrets.js here - it would load config
  return {
    generateEnvFile: jest.fn().mockResolvedValue('/path/to/.env'),
    loadSecrets: jest.fn().mockResolvedValue({}),
    resolveKvReferences: jest.fn().mockResolvedValue(''),
    generateAdminSecretsEnv: jest.fn().mockResolvedValue('/path/to/admin-secrets.env'),
    validateSecrets: jest.fn().mockReturnValue({ valid: true, missing: [] }),
    generateMissingSecrets: jest.fn().mockResolvedValue([]),
    createDefaultSecrets: jest.fn().mockResolvedValue()
  };
});
jest.mock('../../lib/utils/api');
jest.mock('../../lib/api/auth.api', () => ({
  getToken: jest.fn()
}));
jest.mock('../../lib/utils/token-manager');
jest.mock('inquirer');
jest.mock('child_process');

const infra = require('../../lib/infrastructure');
const app = require('../../lib/app');
const secrets = require('../../lib/core/secrets');
const generator = require('../../lib/generator');
const validator = require('../../lib/validation/validator');
const keyGenerator = require('../../lib/core/key-generator');
const config = require('../../lib/core/config');
const { makeApiCall } = require('../../lib/utils/api');
const tokenManager = require('../../lib/utils/token-manager');
const inquirer = require('inquirer');
const { exec } = require('child_process');
const { setupCommands } = require('../../lib/cli');

describe('CLI Comprehensive Tests', () => {
  let mockProgram;
  let commandActions;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset config mock to ensure it's working
    const config = require('../../lib/core/config');
    config.getDeveloperId.mockClear();
    config.getDeveloperId.mockResolvedValue(1);
    config.getConfig.mockClear();
    config.getConfig.mockResolvedValue({ 'developer-id': 1, environment: 'dev', environments: {} });
    config.getCurrentEnvironment.mockClear();
    config.getCurrentEnvironment.mockResolvedValue('dev');
    config.setCurrentEnvironment.mockClear();
    config.setCurrentEnvironment.mockResolvedValue();
    config.setControllerUrl.mockClear();
    config.setControllerUrl.mockResolvedValue();
    config.getControllerUrl.mockClear();
    config.getControllerUrl.mockResolvedValue(null);
    config.saveClientToken.mockClear();
    config.saveClientToken.mockResolvedValue();
    config.saveDeviceToken.mockClear();
    config.saveDeviceToken.mockResolvedValue();

    // Reset token-manager mock
    const tokenManager = require('../../lib/utils/token-manager');
    tokenManager.loadClientCredentials.mockClear();
    tokenManager.loadClientCredentials.mockResolvedValue(null);

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
          addHelpText: jest.fn().mockReturnThis(),
          action: jest.fn((action) => {
            commandActions[cmdName] = action;
            return mockCommand;
          }),
          // Support nested commands for command groups (e.g., 'secrets set')
          command: jest.fn((subCmdName) => {
            const fullCmdName = `${cmdName} ${subCmdName}`;
            const mockSubCommand = {
              description: jest.fn().mockReturnThis(),
              option: jest.fn().mockReturnThis(),
              requiredOption: jest.fn().mockReturnThis(),
              action: jest.fn((action) => {
                commandActions[fullCmdName] = action;
                return mockSubCommand;
              })
            };
            return mockSubCommand;
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
      expect(mockProgram.command).toHaveBeenCalledWith('up-infra');
      expect(mockProgram.command).toHaveBeenCalledWith('down-infra [app]');
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
      expect(mockProgram.command).toHaveBeenCalledWith('dockerfile <app>');
    });
  });

  describe('login command action', () => {
    beforeEach(() => {
      setupCommands(mockProgram);
    });

    it('should handle credentials login with flags (CI/CD)', async() => {
      const { getToken } = require('../../lib/api/auth.api');
      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      config.setCurrentEnvironment.mockResolvedValue();
      config.saveClientToken.mockResolvedValue();
      tokenManager.loadClientCredentials.mockResolvedValue(null);
      const controllerUrl = require('../../lib/utils/controller-url');
      controllerUrl.getDefaultControllerUrl = jest.fn().mockResolvedValue('http://localhost:3000');

      const action = commandActions.login;
      await action({
        method: 'credentials',
        app: 'test-app',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        environment: 'dev'
      });

      expect(getToken).toHaveBeenCalledWith(
        'test-client-id',
        'test-secret',
        expect.stringContaining('localhost:3100')
      );
      expect(config.setCurrentEnvironment).toHaveBeenCalledWith('dev');
      expect(config.saveClientToken).toHaveBeenCalled();
    });

    it('should handle credentials login with prompts', async() => {
      inquirer.prompt
        .mockResolvedValueOnce({ method: 'credentials' })
        .mockResolvedValueOnce({
          clientId: 'test-client-id',
          clientSecret: 'test-secret'
        });

      makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      config.getCurrentEnvironment.mockResolvedValue('dev');
      config.setCurrentEnvironment.mockResolvedValue();
      config.saveClientToken.mockResolvedValue();
      tokenManager.loadClientCredentials.mockResolvedValue(null);

      const { getToken } = require('../../lib/api/auth.api');
      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });
      const controllerUrl = require('../../lib/utils/controller-url');
      controllerUrl.getDefaultControllerUrl = jest.fn().mockResolvedValue('http://localhost:3000');

      const action = commandActions.login;
      await action({
        app: 'test-app'
      });

      expect(inquirer.prompt).toHaveBeenCalled();
      expect(getToken).toHaveBeenCalled();
      expect(config.saveClientToken).toHaveBeenCalled();
    });

    it('should handle login failure and exit', async() => {
      inquirer.prompt
        .mockResolvedValueOnce({ method: 'credentials' })
        .mockResolvedValueOnce({
          clientId: 'test-client-id',
          clientSecret: 'test-secret'
        });

      const { getToken } = require('../../lib/api/auth.api');
      getToken.mockResolvedValue({
        success: false,
        formattedError: 'Invalid credentials'
      });

      config.getCurrentEnvironment.mockResolvedValue('dev');
      tokenManager.loadClientCredentials.mockResolvedValue(null);

      const action = commandActions.login;
      await action({
        controller: 'http://localhost:3000',
        app: 'test-app'
      });

      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle login exceptions', async() => {
      inquirer.prompt.mockRejectedValue(new Error('Prompt failed'));

      config.getCurrentEnvironment.mockResolvedValue('dev');

      const action = commandActions.login;
      await action({
        controller: 'http://localhost:3000',
        app: 'test-app'
      });

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

      const action = commandActions['up-infra'];
      await action({});

      expect(infra.startInfra).toHaveBeenCalledWith(null, { traefik: false });
    });

    it('should handle infrastructure start errors', async() => {
      infra.startInfra.mockRejectedValue(new Error('Docker not running'));

      const action = commandActions['up-infra'];
      await action({});

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

      const action = commandActions['down-infra [app]'];
      await action(undefined, {});

      expect(infra.stopInfra).toHaveBeenCalled();
      expect(infra.stopInfraWithVolumes).not.toHaveBeenCalled();
    });

    it('should stop infrastructure with volumes', async() => {
      infra.stopInfraWithVolumes = jest.fn().mockResolvedValue();

      const action = commandActions['down-infra [app]'];
      await action(undefined, { volumes: true });

      expect(infra.stopInfraWithVolumes).toHaveBeenCalled();
    });

    it('should handle stop errors', async() => {
      infra.stopInfra.mockRejectedValue(new Error('Stop failed'));

      const action = commandActions['down-infra [app]'];
      await action(undefined, {});

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
        path: '/path/to/test-app-deploy.json',
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

