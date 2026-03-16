/**
 * Tests for setup-secrets CLI: ensure ensureSecretsEncryptionKey is invoked for secret and secure commands.
 *
 * @fileoverview Unit tests for lib/cli/setup-secrets.js (ISO 27001 plan)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/cli-utils', () => ({
  handleCommandError: jest.fn()
}));

jest.mock('../../../lib/core/config', () => ({
  ensureSecretsEncryptionKey: jest.fn().mockResolvedValue(undefined),
  setSecretsPath: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../../lib/commands/secrets-list', () => ({
  handleSecretsList: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../../lib/commands/secrets-set', () => ({
  handleSecretsSet: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../../lib/commands/secrets-remove', () => ({
  handleSecretsRemove: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../../lib/commands/secrets-validate', () => ({
  handleSecretsValidate: jest.fn().mockResolvedValue({ valid: true })
}));

jest.mock('../../../lib/commands/secure', () => ({
  handleSecure: jest.fn().mockResolvedValue(undefined)
}));

const config = require('../../../lib/core/config');
const { setupSecretsCommands } = require('../../../lib/cli/setup-secrets');

describe('setup-secrets', () => {
  let commandActions;
  let mockProgram;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'exit').mockImplementation(() => {});
    config.ensureSecretsEncryptionKey.mockResolvedValue(undefined);
    require('../../../lib/commands/secrets-list').handleSecretsList.mockResolvedValue(undefined);
    require('../../../lib/commands/secrets-set').handleSecretsSet.mockResolvedValue(undefined);
    require('../../../lib/commands/secrets-remove').handleSecretsRemove.mockResolvedValue(undefined);
    require('../../../lib/commands/secrets-validate').handleSecretsValidate.mockResolvedValue({ valid: true });
    require('../../../lib/commands/secure').handleSecure.mockResolvedValue(undefined);

    commandActions = {};
    mockProgram = {
      command: jest.fn((name) => {
        const chain = {
          description: jest.fn().mockReturnThis(),
          option: jest.fn().mockReturnThis(),
          action: jest.fn((action) => {
            commandActions[name] = action;
            return chain;
          }),
          command: jest.fn((subName) => {
            const subBase = (typeof subName === 'string' ? subName.split(' ')[0] : subName) || subName;
            const fullKey = `${name} ${subBase}`;
            const subChain = {
              description: jest.fn().mockReturnThis(),
              option: jest.fn().mockReturnThis(),
              action: jest.fn((action) => {
                commandActions[fullKey] = action;
                return subChain;
              })
            };
            return subChain;
          })
        };
        return chain;
      })
    };
    setupSecretsCommands(mockProgram);
  });

  afterEach(() => {
    if (process.exit.mockRestore) process.exit.mockRestore();
  });

  it('calls ensureSecretsEncryptionKey when secret list action runs', async() => {
    const action = commandActions['secret list'];
    expect(action).toBeDefined();
    await action({});
    expect(config.ensureSecretsEncryptionKey).toHaveBeenCalled();
  });

  it('calls ensureSecretsEncryptionKey when secret set action runs', async() => {
    const action = commandActions['secret set'];
    expect(action).toBeDefined();
    await action('key', 'value', {});
    expect(config.ensureSecretsEncryptionKey).toHaveBeenCalled();
  });

  it('calls ensureSecretsEncryptionKey when secret remove action runs', async() => {
    const action = commandActions['secret remove'];
    expect(action).toBeDefined();
    await action('key', {});
    expect(config.ensureSecretsEncryptionKey).toHaveBeenCalled();
  });

  it('calls ensureSecretsEncryptionKey when secret validate action runs', async() => {
    const action = commandActions['secret validate'];
    expect(action).toBeDefined();
    await action(undefined, {});
    expect(config.ensureSecretsEncryptionKey).toHaveBeenCalled();
  });

  it('calls ensureSecretsEncryptionKey when secure action runs', async() => {
    const action = commandActions['secure'];
    expect(action).toBeDefined();
    await action({});
    expect(config.ensureSecretsEncryptionKey).toHaveBeenCalled();
  });

  it('set-secrets-file action calls config.setSecretsPath and does not require ensureSecretsEncryptionKey', async() => {
    const action = commandActions['secret set-secrets-file'];
    expect(action).toBeDefined();
    config.setSecretsPath.mockResolvedValue(undefined);
    await action('/path/to/secrets.yaml');
    expect(config.setSecretsPath).toHaveBeenCalledWith('/path/to/secrets.yaml');
    expect(config.ensureSecretsEncryptionKey).not.toHaveBeenCalled();
  });

  it('set-secrets-file with empty string calls config.setSecretsPath to clear', async() => {
    const action = commandActions['secret set-secrets-file'];
    expect(action).toBeDefined();
    config.setSecretsPath.mockResolvedValue(undefined);
    await action('');
    expect(config.setSecretsPath).toHaveBeenCalledWith('');
  });
});
