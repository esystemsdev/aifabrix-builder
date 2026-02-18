/**
 * Tests for run .env generation environment (docker)
 */

jest.mock('../../../lib/core/secrets', () => ({
  generateEnvFile: jest.fn().mockResolvedValue('/tmp/.env'),
  generateEnvContent: jest.fn().mockResolvedValue('PORT=3000\n')
}));

jest.mock('../../../lib/core/secrets-env-write', () => ({
  resolveAndWriteEnvFile: jest.fn().mockResolvedValue('/tmp/myapp-env.env')
}));

jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(0)
}));

jest.mock('../../../lib/utils/build-copy', () => ({
  getDevDirectory: jest.fn().mockReturnValue('/tmp/dev/myapp'),
  copyBuilderToDevDirectory: jest.fn().mockResolvedValue('/tmp/dev/myapp')
}));

jest.mock('../../../lib/utils/compose-generator', () => ({
  generateDockerCompose: jest.fn().mockResolvedValue('services: {}'),
  getImageName: jest.fn((config, appName) => config?.image?.name || appName)
}));

jest.mock('../../../lib/utils/image-version', () => ({
  resolveVersionForApp: jest.fn().mockResolvedValue({
    version: '1.0.0',
    fromImage: false,
    updated: false
  })
}));

jest.mock('../../../lib/utils/app-run-containers', () => ({
  checkImageExists: jest.fn().mockResolvedValue(true),
  checkContainerRunning: jest.fn(),
  stopAndRemoveContainer: jest.fn(),
  logContainerStatus: jest.fn(),
  getContainerName: jest.fn()
}));

jest.mock('../../../lib/infrastructure', () => ({
  checkInfraHealth: jest.fn().mockResolvedValue({ postgres: 'healthy', redis: 'healthy' })
}));

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const existsSync = jest.fn((p) => {
    const str = String(p || '');
    if (str.includes('/builder/myapp/.env') || str.endsWith('/tmp/dev/myapp') || str.includes('application.yaml')) {
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

const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
const { prepareEnvironment, checkPrerequisites } = require('../../../lib/app/run-helpers');
const { resolveVersionForApp } = require('../../../lib/utils/image-version');
const { checkImageExists } = require('../../../lib/utils/app-run-containers');

describe('Run .env generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses docker environment when resolving and writing .env during run prepare', async() => {
    const appConfig = { port: 3000 };
    await prepareEnvironment('myapp', appConfig, {});
    expect(secretsEnvWrite.resolveAndWriteEnvFile).toHaveBeenCalledWith('myapp', expect.objectContaining({
      environment: 'docker',
      secretsPath: null,
      force: false
    }));
  });
});

describe('checkPrerequisites - version resolution', () => {
  const appConfig = {
    port: 3000,
    image: { name: 'aifabrix/myapp', tag: 'latest' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    checkImageExists.mockResolvedValue(true);
    resolveVersionForApp.mockResolvedValue({ version: '1.0.0', fromImage: false, updated: false });
  });

  it('should call resolveVersionForApp when image exists', async() => {
    await checkPrerequisites('myapp', appConfig, false, true);

    expect(resolveVersionForApp).toHaveBeenCalledWith(
      'myapp',
      appConfig,
      expect.objectContaining({
        updateBuilder: true,
        builderPath: expect.any(String)
      })
    );
  });

  it('should pass updateBuilder true for run flow', async() => {
    await checkPrerequisites('myapp', appConfig, false, true);

    expect(resolveVersionForApp).toHaveBeenCalledWith(
      'myapp',
      appConfig,
      expect.objectContaining({ updateBuilder: true })
    );
  });

  it('should pass updateBuilder false for template apps (keycloak, miso-controller, dataplane)', async() => {
    const templateAppConfig = { port: 8082, image: { name: 'aifabrix/keycloak', tag: 'latest' } };
    await checkPrerequisites('keycloak', templateAppConfig, false, true);

    expect(resolveVersionForApp).toHaveBeenCalledWith(
      'keycloak',
      templateAppConfig,
      expect.objectContaining({ updateBuilder: false })
    );
  });
});

