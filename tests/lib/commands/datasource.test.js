/**
 * Tests for AI Fabrix Builder Datasource Commands Module
 *
 * @fileoverview Unit tests for commands/datasource.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock modules
jest.mock('chalk', () => {
  const id = (text) => text;
  const mockChalk = (text) => text;
  mockChalk.green = Object.assign(jest.fn(id), { bold: jest.fn(id) });
  mockChalk.red = Object.assign(jest.fn(id), { bold: jest.fn(id) });
  mockChalk.blue = jest.fn(id);
  mockChalk.yellow = jest.fn(id);
  mockChalk.gray = jest.fn(id);
  mockChalk.cyan = jest.fn(id);
  mockChalk.white = Object.assign(jest.fn(id), { bold: jest.fn(id) });
  return mockChalk;
});
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../../lib/datasource/validate', () => ({
  validateDatasourceFile: jest.fn()
}));
jest.mock('../../../lib/datasource/list', () => ({
  listDatasources: jest.fn()
}));
jest.mock('../../../lib/datasource/diff', () => ({
  compareDatasources: jest.fn()
}));
jest.mock('../../../lib/datasource/deploy', () => ({
  deployDatasource: jest.fn()
}));
jest.mock('../../../lib/datasource/log-viewer', () => ({
  runLogViewer: jest.fn().mockResolvedValue(undefined)
}));

const logger = require('../../../lib/utils/logger');
const { validateDatasourceFile } = require('../../../lib/datasource/validate');
const { listDatasources } = require('../../../lib/datasource/list');
const { compareDatasources } = require('../../../lib/datasource/diff');
const { deployDatasource } = require('../../../lib/datasource/deploy');
const { runLogViewer } = require('../../../lib/datasource/log-viewer');

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
        addHelpText: jest.fn().mockReturnThis(),
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
      addHelpText: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      requiredOption: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
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
      expect(datasourceGroup.command).toHaveBeenCalledWith('validate <file-or-key>');
      // Check that the subcommand's description was called
      const validateCommand = datasourceGroup._subCommands?.find(c => c.name === 'validate <file-or-key>');
      expect(validateCommand).toBeDefined();
      expect(validateCommand.command.description).toHaveBeenCalledWith(
        'Validate datasource JSON (file path or datasource key under integration/<app>/)'
      );
      expect(validateCommand.command.addHelpText).toHaveBeenCalledWith(
        'after',
        expect.stringMatching(/Examples:\s*\n/)
      );
    });

    it('should register list command', () => {
      setupDatasourceCommands(program);

      expect(program.command).toHaveBeenCalledWith('datasource');
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('list [prefix]');
      // Check that the subcommand's description was called (no flags)
      const listCommand = datasourceGroup._subCommands?.find(c => c.name === 'list [prefix]');
      expect(listCommand).toBeDefined();
      expect(listCommand.command.description).toHaveBeenCalledWith(
        'List datasources for environment in config (optional prefix filters datasource keys)'
      );
      expect(listCommand.command.addHelpText).toHaveBeenCalledWith(
        'after',
        expect.stringMatching(/Examples:\s*\n/)
      );
    });

    it('should register diff command', () => {
      setupDatasourceCommands(program);

      expect(program.command).toHaveBeenCalledWith('datasource');
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('diff <file1> <file2>');
      // Check that the subcommand's description was called
      const diffCommand = datasourceGroup._subCommands?.find(c => c.name === 'diff <file1> <file2>');
      expect(diffCommand).toBeDefined();
      expect(diffCommand.command.description).toHaveBeenCalledWith(
        'Diff two datasource JSON files (two file paths; not datasource keys)'
      );
    });

    it('should register upload command', () => {
      setupDatasourceCommands(program);

      expect(program.command).toHaveBeenCalledWith('datasource');
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('upload <file-or-key>');
      // Check that the subcommand's description was called (no flags)
      const uploadCommand = datasourceGroup._subCommands?.find(c => c.name === 'upload <file-or-key>');
      expect(uploadCommand).toBeDefined();
      expect(uploadCommand.command.description).toHaveBeenCalledWith(
        'Deploy datasource JSON to dataplane (file path or datasource key under integration/<app>/)'
      );
      expect(uploadCommand.command.addHelpText).toHaveBeenCalledWith(
        'after',
        expect.stringMatching(/Examples:\s*\n/)
      );
    });

    it('should register test command (unified validation, runType=test)', () => {
      setupDatasourceCommands(program);
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('test <datasourceKey>');
      const testCmd = datasourceGroup._subCommands?.find(c => c.name === 'test <datasourceKey>');
      expect(testCmd).toBeDefined();
      expect(testCmd.command.description).toHaveBeenCalledWith(
        'Structural/policy validation for one datasource (unified dataplane API, runType=test)'
      );
      expect(testCmd.command.addHelpText).toHaveBeenCalledWith(
        'after',
        expect.stringMatching(/Examples:\s*\n/)
      );
    });

    it('should register test-integration command', () => {
      setupDatasourceCommands(program);
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('test-integration <datasourceKey>');
      const cmd = datasourceGroup._subCommands?.find(c => c.name === 'test-integration <datasourceKey>');
      expect(cmd).toBeDefined();
      expect(cmd.command.description).toHaveBeenCalledWith(
        'Integration test one datasource (unified validation API, runType=integration)'
      );
      expect(cmd.command.addHelpText).toHaveBeenCalledWith(
        'after',
        expect.stringMatching(/Examples:\s*\n/)
      );
    });

    it('should register test-e2e command', () => {
      setupDatasourceCommands(program);
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('test-e2e <datasourceKey> [capabilityKey]');
      const cmd = datasourceGroup._subCommands?.find(c => c.name === 'test-e2e <datasourceKey> [capabilityKey]');
      expect(cmd).toBeDefined();
      expect(cmd.command.description).toHaveBeenCalledWith(
        'E2E test one datasource (unified validation API, runType=e2e)'
      );
      expect(cmd.command.addHelpText).toHaveBeenCalledWith(
        'after',
        expect.stringMatching(/Examples:\s*\n/)
      );
    });

    it('should register watch flags on test, test-integration, and test-e2e', () => {
      setupDatasourceCommands(program);
      const datasourceGroup = program._datasourceGroup;
      for (const name of [
        'test <datasourceKey>',
        'test-integration <datasourceKey>',
        'test-e2e <datasourceKey> [capabilityKey]'
      ]) {
        const cmd = datasourceGroup._subCommands?.find(c => c.name === name);
        expect(cmd).toBeDefined();
        expect(cmd.command.option).toHaveBeenCalledWith('--watch', expect.any(String));
        expect(cmd.command.option).toHaveBeenCalledWith(
          '--watch-path <path>',
          expect.any(String),
          expect.any(Function),
          []
        );
        expect(cmd.command.option).toHaveBeenCalledWith('--watch-application-yaml', expect.any(String));
        expect(cmd.command.option).toHaveBeenCalledWith('--watch-ci', expect.any(String));
        expect(cmd.command.option).toHaveBeenCalledWith('--watch-full-diff', expect.any(String));
      }
    });

    it('should register log-e2e command', () => {
      setupDatasourceCommands(program);
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('log-e2e <datasourceKey>');
      const logE2e = datasourceGroup._subCommands?.find(c => c.name === 'log-e2e <datasourceKey>');
      expect(logE2e).toBeDefined();
      expect(logE2e.command.option).toHaveBeenCalledWith('-a, --app <app>', expect.any(String));
      expect(logE2e.command.option).toHaveBeenCalledWith('-f, --file <path>', expect.any(String));
    });

    it('should register log-integration command', () => {
      setupDatasourceCommands(program);
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('log-integration <datasourceKey>');
      const logInt = datasourceGroup._subCommands?.find(c => c.name === 'log-integration <datasourceKey>');
      expect(logInt).toBeDefined();
      expect(logInt.command.option).toHaveBeenCalledWith('-a, --app <app>', expect.any(String));
      expect(logInt.command.option).toHaveBeenCalledWith('-f, --file <path>', expect.any(String));
    });

    it('should register log-test command', () => {
      setupDatasourceCommands(program);
      const datasourceGroup = program._datasourceGroup;
      expect(datasourceGroup.command).toHaveBeenCalledWith('log-test <datasourceKey>');
      const logTest = datasourceGroup._subCommands?.find(c => c.name === 'log-test <datasourceKey>');
      expect(logTest).toBeDefined();
      expect(logTest.command.option).toHaveBeenCalledWith('-a, --app <app>', expect.any(String));
      expect(logTest.command.option).toHaveBeenCalledWith('-f, --file <path>', expect.any(String));
    });

    it('log-test action calls runLogViewer with logType test', async() => {
      setupDatasourceCommands(program);
      const datasourceGroup = program._datasourceGroup;
      const logTest = datasourceGroup._subCommands?.find(c => c.name === 'log-test <datasourceKey>');
      const actionFn = logTest.command.action.mock.calls[0][0];
      await actionFn('hubspot-users', { app: 'hubspot', file: '/tmp/log.json' });
      expect(runLogViewer).toHaveBeenCalledWith(
        'hubspot-users',
        expect.objectContaining({
          app: 'hubspot',
          file: '/tmp/log.json',
          logType: 'test'
        })
      );
    });
  });

  describe('validate command action', () => {
    it('should handle successful validation', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      setupDatasourceCommands(program);

      // Get the validate command's action handler
      const datasourceGroup = program._datasourceGroup;
      const validateCommand = datasourceGroup._subCommands?.find(c => c.name === 'validate <file-or-key>');
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
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      setupDatasourceCommands(program);

      // Get the validate command's action handler
      const datasourceGroup = program._datasourceGroup;
      const validateCommand = datasourceGroup._subCommands?.find(c => c.name === 'validate <file-or-key>');
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
      const validateCommand = datasourceGroup._subCommands?.find(c => c.name === 'validate <file-or-key>');
      if (validateCommand) {
        const actionCall = validateCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]('/path/to/file.json', {});

          expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
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
      const listCommand = datasourceGroup._subCommands?.find(c => c.name === 'list [prefix]');
      if (listCommand) {
        const actionCall = listCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]();

          expect(listDatasources).toHaveBeenCalledWith({});
        }
      }
    });

    it('should pass key prefix to list when provided', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      listDatasources.mockResolvedValue();

      setupDatasourceCommands(program);

      const datasourceGroup = program._datasourceGroup;
      const listCommand = datasourceGroup._subCommands?.find(c => c.name === 'list [prefix]');
      expect(listCommand).toBeDefined();
      const actionCall = listCommand.command.action.mock.calls[0];
      await actionCall[0]('test');

      expect(listDatasources).toHaveBeenCalledWith({ keyPrefix: 'test' });
    });

    it('should handle listing errors', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      listDatasources.mockRejectedValue(new Error('Listing failed'));

      setupDatasourceCommands(program);

      // Get the list command's action handler
      const datasourceGroup = program._datasourceGroup;
      const listCommand = datasourceGroup._subCommands?.find(c => c.name === 'list [prefix]');
      if (listCommand) {
        const actionCall = listCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]();

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

  describe('upload command action', () => {
    it('should handle successful upload', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      deployDatasource.mockResolvedValue({ success: true });

      setupDatasourceCommands(program);

      // Get the upload command's action handler
      const datasourceGroup = program._datasourceGroup;
      const uploadCommand = datasourceGroup._subCommands?.find(c => c.name === 'upload <file-or-key>');
      if (uploadCommand) {
        const actionCall = uploadCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]('/path/to/file.json', {
            controller: 'http://localhost:3010',
            environment: 'dev'
          });

          expect(deployDatasource).toHaveBeenCalledWith('/path/to/file.json', {
            controller: 'http://localhost:3010',
            environment: 'dev'
          });
        }
      }
    });

    it('should handle upload errors', async() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});

      deployDatasource.mockRejectedValue(new Error('Deployment failed'));

      setupDatasourceCommands(program);

      // Get the upload command's action handler
      const datasourceGroup = program._datasourceGroup;
      const uploadCommand = datasourceGroup._subCommands?.find(c => c.name === 'upload <file-or-key>');
      if (uploadCommand) {
        const actionCall = uploadCommand.command.action.mock.calls[0];
        if (actionCall && typeof actionCall[0] === 'function') {
          await actionCall[0]('/path/to/file.json', {
            controller: 'http://localhost:3010',
            environment: 'dev'
          });

          expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Upload failed'), expect.anything());
          expect(process.exit).toHaveBeenCalledWith(1);
        }
      }
    });
  });
});

