/**
 * Tests for External System Delete Module
 *
 * @fileoverview Unit tests for external-system/delete.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn(() => Promise.resolve({})),
  resolveEnvironment: jest.fn().mockResolvedValue('dev')
}));

jest.mock('../../../lib/utils/token-manager', () => ({
  getDeploymentAuth: jest.fn(() => Promise.resolve({ token: 'test-token' }))
}));

jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn(() => Promise.resolve('http://controller'))
}));

jest.mock('../../../lib/utils/dataplane-resolver', () => ({
  resolveDataplaneUrl: jest.fn(() => Promise.resolve('http://dataplane'))
}));

jest.mock('../../../lib/api/external-systems.api', () => ({
  getExternalSystemConfig: jest.fn(() => Promise.resolve({
    success: true,
    data: { dataSources: [{ key: 'ds1' }, { key: 'ds2' }] }
  })),
  deleteExternalSystem: jest.fn(() => Promise.resolve({ success: true }))
}));

const inquirer = require('inquirer');
const { deleteExternalSystem } = require('../../../lib/api/external-systems.api');

describe('external-system delete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should prompt and delete when confirmed', async() => {
    inquirer.prompt.mockResolvedValue({ confirm: 'yes' });
    const { deleteExternalSystem: deleteExternalSystemCommand } = require('../../../lib/external-system/delete');

    await deleteExternalSystemCommand('hubspot', { environment: 'dev', controller: 'http://controller' });

    expect(inquirer.prompt).toHaveBeenCalled();
    expect(deleteExternalSystem).toHaveBeenCalledWith('http://dataplane', 'hubspot', expect.any(Object));
  });

  it('should cancel when user declines', async() => {
    inquirer.prompt.mockResolvedValue({ confirm: 'no' });
    const { deleteExternalSystem: deleteExternalSystemCommand } = require('../../../lib/external-system/delete');

    await deleteExternalSystemCommand('hubspot', { environment: 'dev', controller: 'http://controller' });

    expect(deleteExternalSystem).not.toHaveBeenCalled();
  });

  it('should skip confirmation with --yes', async() => {
    const { deleteExternalSystem: deleteExternalSystemCommand } = require('../../../lib/external-system/delete');

    await deleteExternalSystemCommand('hubspot', { environment: 'dev', controller: 'http://controller', yes: true });

    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(deleteExternalSystem).toHaveBeenCalledWith('http://dataplane', 'hubspot', expect.any(Object));
  });
});
