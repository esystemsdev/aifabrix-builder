/**
 * Tests for wizard debug artifact file paths.
 *
 * Verifies that wizard debug artifacts are written under:
 * integration/<app>/logs/
 */

jest.mock('../../../lib/utils/logger');
jest.mock('chalk', () => {
  const createMockFn = (text) => text;
  const mockChalk = createMockFn;
  ['blue', 'green', 'red', 'yellow', 'gray'].forEach(prop => {
    mockChalk[prop] = createMockFn;
  });
  return mockChalk;
});

const path = require('path');

const fs = require('fs').promises;
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn()
  }
}));

jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn(() => '/workspace/integration/test-app')
}));

const logger = require('../../../lib/utils/logger');
const { getIntegrationPath } = require('../../../lib/utils/paths');
const helpers = require('../../../lib/commands/wizard-core-helpers');

describe('wizard-core-helpers debug artifacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes debug.log under integration/<app>/logs/', async() => {
    await helpers.writeDebugLog('test-app', 'hello');

    expect(getIntegrationPath).toHaveBeenCalledWith('test-app');
    expect(fs.mkdir).toHaveBeenCalledWith(
      '/workspace/integration/test-app/logs',
      { recursive: true }
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join('/workspace/integration/test-app/logs', 'debug.log'),
      'hello',
      'utf8'
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('integration/test-app/logs/debug.log')
    );
  });

  it('writes debug manifests under integration/<app>/logs/', async() => {
    const saved = await helpers.writeDebugManifest(
      'test-app',
      { key: 'sys' },
      { key: 'ds' }
    );

    expect(saved).toEqual(['debug-system.yaml', 'debug-datasource.yaml']);
    expect(fs.mkdir).toHaveBeenCalledWith(
      '/workspace/integration/test-app/logs',
      { recursive: true }
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join('/workspace/integration/test-app/logs', 'debug-system.yaml'),
      expect.any(String),
      'utf8'
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join('/workspace/integration/test-app/logs', 'debug-datasource.yaml'),
      expect.any(String),
      'utf8'
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('integration/test-app/logs/debug-system.yaml')
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('integration/test-app/logs/debug-datasource.yaml')
    );
  });
});

