/**
 * Tests for AI Fabrix Builder App Commands Module
 *
 * @fileoverview Unit tests for commands/app.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Mock chalk before requiring modules that use it
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.cyan = jest.fn((text) => text);
  mockChalk.bold = jest.fn((text) => text);
  return mockChalk;
});

// Note: We don't mock secrets/config/api modules here since updateEnvTemplate doesn't use them

// Mock logger - use same pattern as secrets.test.js
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock fs
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn()
    },
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn()
  };
});

const logger = require('../../../lib/utils/logger');
const { updateEnvTemplate } = require('../../../lib/utils/env-template');

// Mock app modules
jest.mock('../../../lib/app/list', () => ({
  listApplications: jest.fn()
}));

jest.mock('../../../lib/app/register', () => ({
  registerApplication: jest.fn()
}));

jest.mock('../../../lib/app/rotate-secret', () => ({
  rotateSecret: jest.fn()
}));

const { listApplications } = require('../../../lib/app/list');
const { registerApplication } = require('../../../lib/app/register');
const { rotateSecret } = require('../../../lib/app/rotate-secret');
const { setupAppCommands } = require('../../../lib/commands/app');

describe('App Commands Module', () => {
  let program;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock Commander program with proper chaining
    const createCommandGroup = () => {
      const group = {
        command: jest.fn(),
        description: jest.fn().mockReturnThis(),
        action: jest.fn().mockReturnThis(),
        requiredOption: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis()
      };
      // Make command return a new subcommand for chaining
      group.command.mockImplementation((name) => {
        const subCommand = createCommandGroup();
        group._subCommands = group._subCommands || [];
        group._subCommands.push({ name, command: subCommand });
        return subCommand;
      });
      return group;
    };

    const appGroup = createCommandGroup();
    program = {
      command: jest.fn((name) => {
        if (name === 'app') {
          program._appGroup = appGroup;
          return appGroup;
        }
        return createCommandGroup();
      }),
      description: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      requiredOption: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      _appGroup: appGroup
    };
  });

  describe('updateEnvTemplate', () => {
    const appKey = 'myapp';
    const clientIdKey = 'myapp-client-idKeyVault';
    const clientSecretKey = 'myapp-client-secretKeyVault';
    const controllerUrl = 'http://localhost:3010';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should add MISO_CLIENTID, MISO_CLIENTSECRET, and MISO_CONTROLLER_URL to env.template when not present', async() => {
      const existingContent = '# Application Environment\nPORT=3000\n';
      const envTemplatePath = path.join(process.cwd(), 'builder', appKey, 'env.template');
      fsSync.existsSync.mockReturnValue(true);
      fs.readFile.mockResolvedValue(existingContent);
      fs.writeFile.mockResolvedValue();

      await updateEnvTemplate(appKey, clientIdKey, clientSecretKey, controllerUrl);

      expect(fs.readFile).toHaveBeenCalledWith(envTemplatePath, 'utf8');
      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('MISO_CLIENTID=kv://myapp-client-idKeyVault');
      expect(writtenContent).toContain('MISO_CLIENTSECRET=kv://myapp-client-secretKeyVault');
      expect(writtenContent).toContain('MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');
    });

    it('should update existing MISO_CLIENTID, MISO_CLIENTSECRET, and MISO_CONTROLLER_URL', async() => {
      const existingContent = '# Application Environment\nPORT=3000\nMISO_CLIENTID=kv://old-key\nMISO_CLIENTSECRET=kv://old-secret\nMISO_CONTROLLER_URL=http://old-url\n';
      fsSync.existsSync.mockReturnValue(true);
      fs.readFile.mockResolvedValue(existingContent);
      fs.writeFile.mockResolvedValue();

      await updateEnvTemplate(appKey, clientIdKey, clientSecretKey, controllerUrl);

      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('MISO_CLIENTID=kv://myapp-client-idKeyVault');
      expect(writtenContent).toContain('MISO_CLIENTSECRET=kv://myapp-client-secretKeyVault');
      expect(writtenContent).toContain('MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');
      expect(writtenContent).not.toContain('kv://old-key');
      expect(writtenContent).not.toContain('kv://old-secret');
      expect(writtenContent).not.toContain('http://old-url');
    });

    it('should warn if env.template not found', async() => {
      fsSync.existsSync.mockReturnValue(false);

      await updateEnvTemplate(appKey, clientIdKey, clientSecretKey, controllerUrl);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('env.template not found'));
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async() => {
      fsSync.existsSync.mockReturnValue(true);
      fs.readFile.mockRejectedValue(new Error('Read error'));

      await updateEnvTemplate(appKey, clientIdKey, clientSecretKey, controllerUrl);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not update env.template'));
    });
  });

  describe('setupAppCommands', () => {
    it('should setup app command group', () => {
      setupAppCommands(program);

      expect(program.command).toHaveBeenCalledWith('app');
      expect(program._appGroup.description).toHaveBeenCalledWith('Manage applications');
    });

    it('should setup register command', () => {
      setupAppCommands(program);

      const appGroup = program._appGroup;
      const registerCommand = appGroup._subCommands?.find(c => c.name === 'register <appKey>');
      expect(registerCommand).toBeDefined();
      expect(registerCommand.command.description).toHaveBeenCalledWith('Register application and get pipeline credentials');
      expect(registerCommand.command.option).toHaveBeenCalledWith('-p, --port <port>', 'Application port (default: from variables.yaml)');
      expect(registerCommand.command.option).toHaveBeenCalledWith('-n, --name <name>', 'Override display name');
      expect(registerCommand.command.option).toHaveBeenCalledWith('-d, --description <desc>', 'Override description');
      expect(registerCommand.command.requiredOption).not.toHaveBeenCalled();
    });

    it('should setup list command', () => {
      setupAppCommands(program);

      const appGroup = program._appGroup;
      const listCommand = appGroup._subCommands?.find(c => c.name === 'list');
      expect(listCommand).toBeDefined();
      expect(listCommand.command.description).toHaveBeenCalledWith('List applications');
      expect(listCommand.command.requiredOption).not.toHaveBeenCalled();
      expect(listCommand.command.option).not.toHaveBeenCalled();
    });

    it('should setup rotate-secret command', () => {
      setupAppCommands(program);

      const appGroup = program._appGroup;
      const rotateCommand = appGroup._subCommands?.find(c => c.name === 'rotate-secret <appKey>');
      expect(rotateCommand).toBeDefined();
      expect(rotateCommand.command.description).toHaveBeenCalledWith('Rotate pipeline ClientSecret for an application');
      expect(rotateCommand.command.requiredOption).not.toHaveBeenCalled();
      expect(rotateCommand.command.option).not.toHaveBeenCalled();
    });

    describe('register command action', () => {
      it('should call registerApplication with correct parameters', async() => {
        jest.spyOn(process, 'exit').mockImplementation(() => {});

        registerApplication.mockResolvedValue();

        setupAppCommands(program);

        const appGroup = program._appGroup;
        const registerCommand = appGroup._subCommands?.find(c => c.name === 'register <appKey>');
        if (registerCommand) {
          const actionCall = registerCommand.command.action.mock.calls[0];
          if (actionCall && typeof actionCall[0] === 'function') {
            const options = {
              environment: 'dev',
              controller: 'http://localhost:3000',
              port: '3000',
              name: 'Test App',
              description: 'Test Description'
            };
            await actionCall[0]('test-app', options);

            expect(registerApplication).toHaveBeenCalledWith('test-app', options);
            expect(process.exit).not.toHaveBeenCalled();
          }
        }
      });

      it('should handle registration errors', async() => {
        jest.spyOn(process, 'exit').mockImplementation(() => {});

        const error = new Error('Registration failed');
        registerApplication.mockRejectedValue(error);

        setupAppCommands(program);

        const appGroup = program._appGroup;
        const registerCommand = appGroup._subCommands?.find(c => c.name === 'register <appKey>');
        if (registerCommand) {
          const actionCall = registerCommand.command.action.mock.calls[0];
          if (actionCall && typeof actionCall[0] === 'function') {
            const options = { environment: 'dev' };
            await actionCall[0]('test-app', options);

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('❌ Registration failed:'), 'Registration failed');
            expect(process.exit).toHaveBeenCalledWith(1);
          }
        }
      });
    });

    describe('list command action', () => {
      it('should call listApplications with correct parameters', async() => {
        jest.spyOn(process, 'exit').mockImplementation(() => {});

        listApplications.mockResolvedValue();

        setupAppCommands(program);

        const appGroup = program._appGroup;
        const listCommand = appGroup._subCommands?.find(c => c.name === 'list');
        if (listCommand) {
          const actionCall = listCommand.command.action.mock.calls[0];
          if (actionCall && typeof actionCall[0] === 'function') {
            const options = {
              environment: 'dev',
              controller: 'http://localhost:3000'
            };
            await actionCall[0](options);

            expect(listApplications).toHaveBeenCalledWith(options);
            expect(process.exit).not.toHaveBeenCalled();
          }
        }
      });

      it('should handle list errors', async() => {
        jest.spyOn(process, 'exit').mockImplementation(() => {});

        const error = new Error('List failed');
        listApplications.mockRejectedValue(error);

        setupAppCommands(program);

        const appGroup = program._appGroup;
        const listCommand = appGroup._subCommands?.find(c => c.name === 'list');
        if (listCommand) {
          const actionCall = listCommand.command.action.mock.calls[0];
          if (actionCall && typeof actionCall[0] === 'function') {
            const options = { environment: 'dev' };
            await actionCall[0](options);

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('❌ Failed to list applications:'), 'List failed');
            expect(process.exit).toHaveBeenCalledWith(1);
          }
        }
      });
    });

    describe('rotate-secret command action', () => {
      it('should call rotateSecret with correct parameters', async() => {
        jest.spyOn(process, 'exit').mockImplementation(() => {});

        rotateSecret.mockResolvedValue();

        setupAppCommands(program);

        const appGroup = program._appGroup;
        const rotateCommand = appGroup._subCommands?.find(c => c.name === 'rotate-secret <appKey>');
        if (rotateCommand) {
          const actionCall = rotateCommand.command.action.mock.calls[0];
          if (actionCall && typeof actionCall[0] === 'function') {
            const options = {
              environment: 'dev',
              controller: 'http://localhost:3000'
            };
            await actionCall[0]('test-app', options);

            expect(rotateSecret).toHaveBeenCalledWith('test-app', options);
            expect(process.exit).not.toHaveBeenCalled();
          }
        }
      });

      it('should handle rotation errors', async() => {
        jest.spyOn(process, 'exit').mockImplementation(() => {});

        const error = new Error('Rotation failed');
        rotateSecret.mockRejectedValue(error);

        setupAppCommands(program);

        const appGroup = program._appGroup;
        const rotateCommand = appGroup._subCommands?.find(c => c.name === 'rotate-secret <appKey>');
        if (rotateCommand) {
          const actionCall = rotateCommand.command.action.mock.calls[0];
          if (actionCall && typeof actionCall[0] === 'function') {
            const options = { environment: 'dev' };
            await actionCall[0]('test-app', options);

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('❌ Rotation failed:'), 'Rotation failed');
            expect(process.exit).toHaveBeenCalledWith(1);
          }
        }
      });
    });
  });

});

