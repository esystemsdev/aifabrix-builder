/**
 * Tests for run .env generation environment (docker)
 */

jest.mock('../../lib/secrets', () => ({
  generateEnvFile: jest.fn().mockResolvedValue('/tmp/.env')
}));

jest.mock('../../lib/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(0)
}));

jest.mock('../../lib/utils/build-copy', () => ({
  getDevDirectory: jest.fn().mockReturnValue('/tmp/dev/myapp'),
  copyBuilderToDevDirectory: jest.fn().mockResolvedValue('/tmp/dev/myapp')
}));

jest.mock('../../lib/utils/compose-generator', () => ({
  generateDockerCompose: jest.fn().mockResolvedValue('services: {}')
}));

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const existsSync = jest.fn((p) => {
    const str = String(p || '');
    if (str.includes('/builder/myapp/.env') || str.endsWith('/tmp/dev/myapp')) {
      return true;
    }
    return false;
  });
  return {
    ...actualFs,
    existsSync,
    readFileSync: jest.fn(),
    statSync: jest.fn(),
    promises: {
      ...actualFs.promises,
      copyFile: jest.fn().mockResolvedValue(),
      writeFile: jest.fn().mockResolvedValue()
    }
  };
});

const secrets = require('../../lib/secrets');
const { prepareEnvironment } = require('../../lib/app-run-helpers');

describe('Run .env generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses docker environment when generating .env during run prepare', async() => {
    const appConfig = { port: 3000 };
    await prepareEnvironment('myapp', appConfig, {});
    expect(secrets.generateEnvFile).toHaveBeenCalledWith('myapp', null, 'docker');
  });
});

