/**
 * Tests for Wizard Prompts
 *
 * @fileoverview Tests for lib/wizard-prompts.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      access: jest.fn(),
      stat: jest.fn()
    }
  };
});

const inquirer = require('inquirer');
const fsPromises = require('fs').promises;
const path = require('path');
const wizardPrompts = require('../../../lib/generator/wizard-prompts');

describe('Wizard Prompts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('promptForMode', () => {
    it('should prompt for wizard mode', async() => {
      inquirer.prompt.mockResolvedValue({ mode: 'create-system' });
      const result = await wizardPrompts.promptForMode();
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(result).toBe('create-system');
    });

    it('should return add-datasource mode', async() => {
      inquirer.prompt.mockResolvedValue({ mode: 'add-datasource' });
      const result = await wizardPrompts.promptForMode();
      expect(result).toBe('add-datasource');
    });
  });

  describe('promptForSourceType', () => {
    it('should prompt for source type', async() => {
      inquirer.prompt.mockResolvedValue({ sourceType: 'openapi-file' });
      const result = await wizardPrompts.promptForSourceType();
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(result).toBe('openapi-file');
    });
  });

  describe('promptForOpenApiFile', () => {
    it('should prompt for OpenAPI file path', async() => {
      const filePath = '/path/to/openapi.yaml';
      fsPromises.stat.mockResolvedValue({ isFile: () => true });
      inquirer.prompt.mockResolvedValue({ filePath });
      const result = await wizardPrompts.promptForOpenApiFile();
      expect(result).toBe(path.resolve(filePath));
    });
  });

  describe('promptForOpenApiUrl', () => {
    it('should prompt for OpenAPI URL', async() => {
      const url = 'https://api.example.com/openapi.yaml';
      inquirer.prompt.mockResolvedValue({ url });
      const result = await wizardPrompts.promptForOpenApiUrl();
      expect(result).toBe(url);
    });
  });

  describe('promptForMcpServer', () => {
    it('should prompt for MCP server details', async() => {
      const serverUrl = 'https://mcp.example.com';
      const token = 'mcp-token-123';
      inquirer.prompt.mockResolvedValue({ serverUrl, token });
      const result = await wizardPrompts.promptForMcpServer();
      expect(result).toEqual({ serverUrl, token });
    });
  });

  describe('promptForKnownPlatform', () => {
    it('should prompt for known platform', async() => {
      inquirer.prompt.mockResolvedValue({ platform: 'hubspot' });
      const result = await wizardPrompts.promptForKnownPlatform();
      expect(result).toBe('hubspot');
    });

    it('should prompt with custom platforms', async() => {
      const platforms = [
        { key: 'custom1', displayName: 'Custom Platform 1' },
        { key: 'custom2', displayName: 'Custom Platform 2' }
      ];
      inquirer.prompt.mockResolvedValue({ platform: 'custom1' });
      const result = await wizardPrompts.promptForKnownPlatform(platforms);
      expect(result).toBe('custom1');
    });
  });

  describe('promptForUserIntent', () => {
    it('should prompt for user intent', async() => {
      inquirer.prompt.mockResolvedValue({ intent: 'sales-focused' });
      const result = await wizardPrompts.promptForUserIntent();
      expect(result).toBe('sales-focused');
    });
  });

  describe('promptForUserPreferences', () => {
    it('should prompt for user preferences', async() => {
      const preferences = { mcp: true, abac: false, rbac: true };
      inquirer.prompt.mockResolvedValue(preferences);
      const result = await wizardPrompts.promptForUserPreferences();
      expect(result).toEqual(preferences);
    });
  });

  describe('promptForCredentialAction', () => {
    it('should return only action (no credentialIdOrKey when select)', async() => {
      inquirer.prompt.mockResolvedValue({ action: 'select' });
      const result = await wizardPrompts.promptForCredentialAction();
      expect(result).toEqual({ action: 'select' });
      expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    });

    it('should return skip action', async() => {
      inquirer.prompt.mockResolvedValue({ action: 'skip' });
      const result = await wizardPrompts.promptForCredentialAction();
      expect(result).toEqual({ action: 'skip' });
    });
  });

  describe('promptForExistingCredential', () => {
    it('should show list when credentials are provided', async() => {
      const credentialsList = [
        { key: 'cred-1', displayName: 'Credential One' },
        { key: 'cred-2', displayName: 'Credential Two' }
      ];
      inquirer.prompt.mockResolvedValue({ credentialIdOrKey: 'cred-2' });
      const result = await wizardPrompts.promptForExistingCredential(credentialsList);
      expect(inquirer.prompt).toHaveBeenCalledWith([expect.objectContaining({
        type: 'list',
        name: 'credentialIdOrKey',
        message: 'Select a credential:',
        choices: [
          { name: 'Credential One', value: 'cred-1' },
          { name: 'Credential Two', value: 'cred-2' }
        ]
      })]);
      expect(result).toEqual({ credentialIdOrKey: 'cred-2' });
    });

    it('should show input when credentials list is empty', async() => {
      inquirer.prompt.mockResolvedValue({ credentialIdOrKey: 'my-credential' });
      const result = await wizardPrompts.promptForExistingCredential([]);
      expect(inquirer.prompt).toHaveBeenCalledWith([expect.objectContaining({
        type: 'input',
        name: 'credentialIdOrKey',
        message: 'Enter credential ID or key (must exist on the dataplane):'
      })]);
      expect(result).toEqual({ credentialIdOrKey: 'my-credential' });
    });
  });

  describe('promptForExistingSystem', () => {
    it('should show list when systems are provided', async() => {
      const systemsList = [
        { key: 'sys-1', displayName: 'System One' },
        { key: 'sys-2', displayName: 'System Two' }
      ];
      inquirer.prompt.mockResolvedValue({ systemIdOrKey: 'sys-2' });
      const result = await wizardPrompts.promptForExistingSystem(systemsList);
      expect(inquirer.prompt).toHaveBeenCalledWith([expect.objectContaining({
        type: 'list',
        name: 'systemIdOrKey',
        message: 'Select an existing external system (not a webapp):',
        choices: [
          { name: 'System One', value: 'sys-1' },
          { name: 'System Two', value: 'sys-2' }
        ]
      })]);
      expect(result).toBe('sys-2');
    });

    it('should show input when list is empty', async() => {
      inquirer.prompt.mockResolvedValue({ systemIdOrKey: 'my-system' });
      const result = await wizardPrompts.promptForExistingSystem([]);
      expect(inquirer.prompt).toHaveBeenCalledWith([expect.objectContaining({
        type: 'input',
        name: 'systemIdOrKey',
        message: 'Enter the existing external system ID or key (not a webapp):'
      })]);
      expect(result).toBe('my-system');
    });
  });

  describe('promptForConfigReview', () => {
    it('should prompt for config review with accept', async() => {
      const systemConfig = { key: 'test-system' };
      const datasourceConfigs = [{ key: 'ds1' }];
      inquirer.prompt.mockResolvedValue({ action: 'accept' });
      const result = await wizardPrompts.promptForConfigReview({ preview: null, systemConfig, datasourceConfigs });
      expect(result.action).toBe('accept');
    });

    it('should prompt for config review with cancel', async() => {
      const systemConfig = { key: 'test-system' };
      const datasourceConfigs = [{ key: 'ds1' }];
      inquirer.prompt.mockResolvedValue({ action: 'cancel' });
      const result = await wizardPrompts.promptForConfigReview({ preview: null, systemConfig, datasourceConfigs });
      expect(result.action).toBe('cancel');
    });
  });

  describe('promptForAppName', () => {
    it('should prompt for application name', async() => {
      inquirer.prompt.mockResolvedValue({ appName: 'test-app' });
      const result = await wizardPrompts.promptForAppName();
      expect(result).toBe('test-app');
    });

    it('should use default name if provided', async() => {
      inquirer.prompt.mockResolvedValue({ appName: 'default-app' });
      const result = await wizardPrompts.promptForAppName('default-app');
      expect(result).toBe('default-app');
    });
  });
});
