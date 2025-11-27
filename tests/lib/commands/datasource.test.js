/**
 * Tests for AI Fabrix Builder Datasource Commands Module
 *
 * @fileoverview Unit tests for commands/datasource.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

// Mock modules
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  return mockChalk;
});
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../../lib/datasource-validate', () => ({
  validateDatasourceFile: jest.fn()
}));
jest.mock('../../../lib/datasource-list', () => ({
  listDatasources: jest.fn()
}));
jest.mock('../../../lib/datasource-diff', () => ({
  compareDatasources: jest.fn()
}));
jest.mock('../../../lib/datasource-deploy', () => ({
  deployDatasource: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { validateDatasourceFile } = require('../../../lib/datasource-validate');
const { listDatasources } = require('../../../lib/datasource-list');
const { compareDatasources } = require('../../../lib/datasource-diff');
const { deployDatasource } = require('../../../lib/datasource-deploy');

describe('Datasource Commands Module', () => {
  let program;
  let setupDatasourceCommands;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock Commander program with proper chaining
    const createCommandGroup = () => {
      const group = {
        command: jest.fn(),
        description: jest.fn().mockReturnThis(),
        action: jest.fn().mockReturnThis(),
        requiredOption: jest.fn().mockReturnThis()
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

    const datasourceGroup = createCommandGroup();
    program = {
      command: jest.fn((name) => {
        if (name === 'datasource') {
          program._datasourceGroup = datasourceGroup;
          return datasourceGroup;
        }
        return createCommandGroup();
      }),
      description: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      requiredOption: jest.fn().mockReturnThis(),
      _datasourceGroup: datasourceGroup
    };

    setupDatasourceCommands = require('../../../lib/commands/datasource').setupDatasourceCommands;
  });

  describe('setupDatasourceCommands', () => {
    it('should create datasource command group', () => {
      setupDatasourceCommands(program);

      expect(program.command).toHaveBeenCalledWith('datasource');
    });

    it('should register validate command', () => {
      setupDatasourceCommands(program);

      expect(program.command).toHaveBeenCalledWith('datasource');
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('validate <file>');
      // Check that the subcommand's description was called
      const validateCommand = datasourceGroup._subCommands?.find(c => c.name === 'validate <file>');
      expect(validateCommand).toBeDefined();
      expect(validateCommand.command.description).toHaveBeenCalledWith('Validate external datasource JSON file');
    });

    it('should register list command', () => {
      setupDatasourceCommands(program);

      expect(program.command).toHaveBeenCalledWith('datasource');
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('list');
      // Check that the subcommand's description and requiredOption were called
      const listCommand = datasourceGroup._subCommands?.find(c => c.name === 'list');
      expect(listCommand).toBeDefined();
      expect(listCommand.command.description).toHaveBeenCalledWith('List datasources from environment');
      expect(listCommand.command.requiredOption).toHaveBeenCalledWith('-e, --environment <env>', 'Environment ID or key');
    });

    it('should register diff command', () => {
      setupDatasourceCommands(program);

      expect(program.command).toHaveBeenCalledWith('datasource');
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('diff <file1> <file2>');
      // Check that the subcommand's description was called
      const diffCommand = datasourceGroup._subCommands?.find(c => c.name === 'diff <file1> <file2>');
      expect(diffCommand).toBeDefined();
      expect(diffCommand.command.description).toHaveBeenCalledWith('Compare two datasource configuration files (for dataplane)');
    });

    it('should register deploy command', () => {
      setupDatasourceCommands(program);

      expect(program.command).toHaveBeenCalledWith('datasource');
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('deploy <myapp> <file>');
      // Check that the subcommand's description and requiredOptions were called
      const deployCommand = datasourceGroup._subCommands?.find(c => c.name === 'deploy <myapp> <file>');
      expect(deployCommand).toBeDefined();
      expect(deployCommand.command.description).toHaveBeenCalledWith('Deploy datasource to dataplane');
      expect(deployCommand.command.requiredOption).toHaveBeenCalledWith('--controller <url>', 'Controller URL');
      expect(deployCommand.command.requiredOption).toHaveBeenCalledWith('-e, --environment <env>', 'Environment (miso, dev, tst, pro)');
    });
  });

  describe('validate command action', () => {
    it('should handle successful validation', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      setupDatasourceCommands(program);

      // Get the validate command's action handler
      const datasourceGroup = program._datasourceGroup;
      const validateCommand = datasourceGroup._subCommands?.find(c => c.name === 'validate <file>');
      if (validateCommand) {
        const actionCall = validateCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]('/path/to/file.json', {});

          expect(validateDatasourceFile).toHaveBeenCalledWith('/path/to/file.json');
          expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Datasource file is valid'));
          expect(process.exit).not.toHaveBeenCalled();
        }
      }
    });

    it('should handle validation errors', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      validateDatasourceFile.mockResolvedValue({
        valid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: []
      });

      setupDatasourceCommands(program);

      // Get the validate command's action handler
      const datasourceGroup = program._datasourceGroup;
      const validateCommand = datasourceGroup._subCommands?.find(c => c.name === 'validate <file>');
      if (validateCommand) {
        const actionCall = validateCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]('/path/to/file.json', {});

          expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Datasource file has errors'));
          expect(process.exit).toHaveBeenCalledWith(1);
        }
      }
    });

    it('should handle validation exceptions', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      validateDatasourceFile.mockRejectedValue(new Error('Validation failed'));

      setupDatasourceCommands(program);

      // Get the validate command's action handler
      const datasourceGroup = program._datasourceGroup;
      const validateCommand = datasourceGroup._subCommands?.find(c => c.name === 'validate <file>');
      if (validateCommand) {
        const actionCall = validateCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]('/path/to/file.json', {});

          expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Validation failed'), expect.anything());
          expect(process.exit).toHaveBeenCalledWith(1);
        }
      }
    });
  });

  describe('list command action', () => {
    it('should handle successful listing', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      listDatasources.mockResolvedValue();

      setupDatasourceCommands(program);

      // Get the list command's action handler
      const datasourceGroup = program._datasourceGroup;
      const listCommand = datasourceGroup._subCommands?.find(c => c.name === 'list');
      if (listCommand) {
        const actionCall = listCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]({ environment: 'dev' });

          expect(listDatasources).toHaveBeenCalledWith({ environment: 'dev' });
        }
      }
    });

    it('should handle listing errors', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      listDatasources.mockRejectedValue(new Error('Listing failed'));

      setupDatasourceCommands(program);

      // Get the list command's action handler
      const datasourceGroup = program._datasourceGroup;
      const listCommand = datasourceGroup._subCommands?.find(c => c.name === 'list');
      if (listCommand) {
        const actionCall = listCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]({ environment: 'dev' });

          expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to list datasources'), expect.anything());
          expect(process.exit).toHaveBeenCalledWith(1);
        }
      }
    });
  });

  describe('diff command action', () => {
    it('should handle successful diff', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      compareDatasources.mockResolvedValue();

      setupDatasourceCommands(program);

      // Get the diff command's action handler
      const datasourceGroup = program._datasourceGroup;
      const diffCommand = datasourceGroup._subCommands?.find(c => c.name === 'diff <file1> <file2>');
      if (diffCommand) {
        const actionCall = diffCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]('/path/to/file1.json', '/path/to/file2.json', {});

          expect(compareDatasources).toHaveBeenCalledWith('/path/to/file1.json', '/path/to/file2.json');
        }
      }
    });

    it('should handle diff errors', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      compareDatasources.mockRejectedValue(new Error('Diff failed'));

      setupDatasourceCommands(program);

      // Get the diff command's action handler
      const datasourceGroup = program._datasourceGroup;
      const diffCommand = datasourceGroup._subCommands?.find(c => c.name === 'diff <file1> <file2>');
      if (diffCommand) {
        const actionCall = diffCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]('/path/to/file1.json', '/path/to/file2.json', {});

          expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Diff failed'), expect.anything());
          expect(process.exit).toHaveBeenCalledWith(1);
        }
      }
    });
  });

  describe('deploy command action', () => {
    it('should handle successful deployment', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      deployDatasource.mockResolvedValue({ success: true });

      setupDatasourceCommands(program);

      // Get the deploy command's action handler
      const datasourceGroup = program._datasourceGroup;
      const deployCommand = datasourceGroup._subCommands?.find(c => c.name === 'deploy <myapp> <file>');
      if (deployCommand) {
        const actionCall = deployCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]('myapp', '/path/to/file.json', {
            controller: 'http://localhost:3010',
            environment: 'dev'
          });

          expect(deployDatasource).toHaveBeenCalledWith('myapp', '/path/to/file.json', {
            controller: 'http://localhost:3010',
            environment: 'dev'
          });
        }
      }
    });

    it('should handle deployment errors', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      deployDatasource.mockRejectedValue(new Error('Deployment failed'));

      setupDatasourceCommands(program);

      // Get the deploy command's action handler
      const datasourceGroup = program._datasourceGroup;
      const deployCommand = datasourceGroup._subCommands?.find(c => c.name === 'deploy <myapp> <file>');
      if (deployCommand) {
        const actionCall = deployCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]('myapp', '/path/to/file.json', {
            controller: 'http://localhost:3010',
            environment: 'dev'
          });

          expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Deployment failed'), expect.anything());
          expect(process.exit).toHaveBeenCalledWith(1);
        }
      }
    });
  });
});

