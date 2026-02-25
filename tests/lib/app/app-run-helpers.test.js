/**
 * Tests for run .env generation environment (docker)
 */

jest.mock('../../../lib/core/secrets', () => {
  const actual = jest.requireActual('../../../lib/core/secrets');
  return {
    ...actual,
    generateEnvFile: jest.fn().mockResolvedValue('/tmp/.env'),
    generateEnvContent: jest.fn().mockResolvedValue('PORT=3000\n')
  };
});

jest.mock('../../../lib/core/secrets-env-write', () => ({
  resolveAndWriteEnvFile: jest.fn().mockResolvedValue('/tmp/myapp-env.env'),
  resolveAndGetEnvMap: jest.fn().mockResolvedValue({ PORT: '3000' })
}));

jest.mock('../../../lib/core/admin-secrets', () => ({
  readAndDecryptAdminSecrets: jest.fn().mockResolvedValue({ POSTGRES_PASSWORD: 'admin' }),
  envObjectToContent: jest.fn((obj) => Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n'))
}));

jest.mock('../../../lib/infrastructure', () => ({
  checkInfraHealth: jest.fn().mockResolvedValue({ postgres: 'healthy', redis: 'healthy' }),
  ensureAdminSecrets: jest.fn().mockResolvedValue('/tmp/admin-secrets.env')
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
  logContainerStatus: jest.fn().mockResolvedValue(),
  getContainerName: jest.fn()
}));

jest.mock('../../../lib/utils/docker', () => ({
  ensureDockerAndCompose: jest.fn().mockResolvedValue(),
  getComposeCommand: jest.fn().mockResolvedValue('docker compose')
}));

jest.mock('../../../lib/utils/health-check', () => ({
  waitForHealthCheck: jest.fn().mockResolvedValue()
}));

jest.mock('../../../lib/utils/remote-docker-env', () => ({
  getRemoteDockerEnv: jest.fn().mockResolvedValue({})
}));

jest.mock('../../../lib/utils/env-copy', () => ({
  resolveEnvOutputPath: jest.fn(() => '/tmp/env-output/.env'),
  writeEnvOutputForReload: jest.fn().mockResolvedValue(undefined),
  writeEnvOutputForLocal: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, opts, cb) => {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    setImmediate(() => cb(null, '', ''));
    return { kill: jest.fn() };
  })
}));

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const existsSync = jest.fn((p) => {
    const str = String(p || '');
    if (str.includes('/builder/myapp/.env') || str.endsWith('/tmp/dev/myapp') || str.includes('application.yaml') || str.includes('.env.run')) {
      return true;
    }
    return false;
  });
  const readFile = jest.fn((pathArg, encoding, cb) => {
    if (typeof encoding === 'function') {
      cb = encoding;
      encoding = 'utf8';
    }
    const str = String(pathArg || '');
    if (str.includes('.env.run')) {
      return (cb ? setImmediate(() => cb(null, 'POSTGRES_PASSWORD=admin\nPORT=3000\n')) : Promise.resolve('POSTGRES_PASSWORD=admin\nPORT=3000\n'));
    }
    return actualFs.promises.readFile(pathArg, encoding).then((r) => (cb ? setImmediate(() => cb(null, r)) : r)).catch((e) => (cb ? setImmediate(() => cb(e)) : Promise.reject(e)));
  });
  return {
    ...actualFs,
    existsSync,
    readFileSync: jest.fn(),
    statSync: jest.fn(),
    promises: {
      ...actualFs.promises,
      copyFile: jest.fn().mockResolvedValue(),
      writeFile: jest.fn().mockResolvedValue(),
      mkdir: jest.fn().mockResolvedValue(),
      unlink: jest.fn().mockResolvedValue(),
      readFile: jest.fn((pathArg, encoding) => {
        const str = String(pathArg || '');
        if (str.includes('.env.run')) return Promise.resolve('POSTGRES_PASSWORD=admin\nPORT=3000\n');
        return actualFs.promises.readFile(pathArg, encoding);
      })
    }
  };
});

const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
const composeGenerator = require('../../../lib/utils/compose-generator');
const { prepareEnvironment, checkPrerequisites, startContainer } = require('../../../lib/app/run-helpers');
const fs = require('fs');
const { resolveVersionForApp } = require('../../../lib/utils/image-version');
const { checkImageExists } = require('../../../lib/utils/app-run-containers');

describe('Run .env generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds merged env and returns composePath, runEnvPath and runEnvAdminPath', async() => {
    const appConfig = { port: 3000 };
    const result = await prepareEnvironment('myapp', appConfig, {});
    expect(result).toEqual(expect.objectContaining({
      composePath: expect.any(String),
      runEnvPath: expect.any(String),
      runEnvAdminPath: expect.any(String)
    }));
    expect(secretsEnvWrite.resolveAndGetEnvMap).toHaveBeenCalledWith('myapp', expect.objectContaining({
      environment: 'docker',
      secretsPath: null,
      force: false
    }));
  });

  it('uses docker environment for merged app env', async() => {
    const appConfig = { port: 3000 };
    await prepareEnvironment('myapp', appConfig, { reload: true });
    expect(secretsEnvWrite.resolveAndGetEnvMap).toHaveBeenCalledWith('myapp', expect.objectContaining({
      environment: 'docker',
      secretsPath: null,
      force: false
    }));
  });
});

describe('prepareEnvironment - port for run vs run --reload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    composeGenerator.generateDockerCompose.mockResolvedValue('services: {}');
  });

  it('uses application.yaml port for compose host port (first in host:container)', async() => {
    const appConfig = { port: 4000, build: { localPort: 3010 } };
    await prepareEnvironment('myapp', appConfig, {});
    expect(composeGenerator.generateDockerCompose).toHaveBeenCalledWith(
      'myapp',
      appConfig,
      expect.objectContaining({ port: 4000 })
    );
  });

  it('uses application.yaml port for compose host port with --reload', async() => {
    const appConfig = { port: 4000, build: { localPort: 3010 } };
    await prepareEnvironment('myapp', appConfig, { reload: true });
    expect(composeGenerator.generateDockerCompose).toHaveBeenCalledWith(
      'myapp',
      appConfig,
      expect.objectContaining({ port: 4000 })
    );
  });

  it('uses application.yaml port for host and containerPort for container (e.g. 8082:8080)', async() => {
    const appConfig = { port: 8082, build: { containerPort: 8080, localPort: 9999 } };
    await prepareEnvironment('myapp', appConfig, {});
    expect(composeGenerator.generateDockerCompose).toHaveBeenCalledWith(
      'myapp',
      appConfig,
      expect.objectContaining({ port: 8082 })
    );
  });

  it('throws when generated compose contains password literals in environment', async() => {
    composeGenerator.generateDockerCompose.mockResolvedValue(
      'services:\n  db:\n    environment:\n      POSTGRES_PASSWORD: secret123\n'
    );
    const appConfig = { port: 3000 };
    await expect(prepareEnvironment('myapp', appConfig, {})).rejects.toThrow(
      /must not contain password literals/
    );
  });

  it('writes to envOutputPath with localPort when run without --reload', async() => {
    const envCopy = require('../../../lib/utils/env-copy');
    const appConfig = { port: 3000, build: { envOutputPath: '../../packages/miso-controller/.env' } };
    await prepareEnvironment('myapp', appConfig, {});
    expect(envCopy.writeEnvOutputForLocal).toHaveBeenCalledWith('myapp', '/tmp/env-output/.env');
    expect(envCopy.writeEnvOutputForReload).not.toHaveBeenCalled();
  });

  it('writes to envOutputPath same as container when run with --reload', async() => {
    const envCopy = require('../../../lib/utils/env-copy');
    const appConfig = { port: 3000, build: { envOutputPath: '../../packages/miso-controller/.env' } };
    await prepareEnvironment('myapp', appConfig, { reload: true });
    expect(envCopy.writeEnvOutputForReload).toHaveBeenCalledWith(
      '/tmp/env-output/.env',
      expect.stringContaining('.env.run')
    );
    expect(envCopy.writeEnvOutputForLocal).not.toHaveBeenCalled();
  });

  it('does not write to envOutputPath when skipEnvOutputPath is true (up-* flow)', async() => {
    const envCopy = require('../../../lib/utils/env-copy');
    const appConfig = { port: 3000, build: { envOutputPath: '../../.env' } };
    await prepareEnvironment('myapp', appConfig, { skipEnvOutputPath: true });
    expect(envCopy.writeEnvOutputForLocal).not.toHaveBeenCalled();
    expect(envCopy.writeEnvOutputForReload).not.toHaveBeenCalled();
  });
});

describe('startContainer', () => {
  it('deletes runEnvPath (.env.run) after successful start (ISO 27K)', async() => {
    const runEnvPath = '/home/.aifabrix/applications/.env.run';
    const appConfig = { developerId: 0, healthCheck: { path: '/health' } };

    await startContainer('myapp', '/path/compose.yaml', 3000, appConfig, { runEnvPath });

    expect(fs.promises.unlink).toHaveBeenCalledWith(runEnvPath);
  });

  it('does not call unlink when runEnvPath is null', async() => {
    await startContainer('myapp', '/path/compose.yaml', 3000, { developerId: 0 }, {});
    expect(fs.promises.unlink).not.toHaveBeenCalled();
  });

  it('deletes both .env.run and .env.run.admin after successful start', async() => {
    const runEnvPath = '/home/.aifabrix/applications/.env.run';
    const runEnvAdminPath = '/home/.aifabrix/applications/.env.run.admin';
    const appConfig = { developerId: 0, healthCheck: { path: '/health' } };

    await startContainer('myapp', '/path/compose.yaml', 3000, appConfig, { runEnvPath, runEnvAdminPath });

    expect(fs.promises.unlink).toHaveBeenCalledWith(runEnvPath);
    expect(fs.promises.unlink).toHaveBeenCalledWith(runEnvAdminPath);
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

  it('should use runOptions.image for image check when provided', async() => {
    const templateAppConfig = { port: 8082, image: { name: 'aifabrix/keycloak', tag: 'latest' } };
    await checkPrerequisites('keycloak', templateAppConfig, false, true, { image: 'myreg/keycloak:v1' });

    expect(checkImageExists).toHaveBeenCalledWith('myreg/keycloak', 'v1', false);
  });

  it('should throw template-app hint when image not found for keycloak', async() => {
    checkImageExists.mockResolvedValue(false);
    const templateAppConfig = { port: 8082, image: { name: 'aifabrix/keycloak', tag: 'latest' } };

    await expect(checkPrerequisites('keycloak', templateAppConfig, false, true))
      .rejects.toThrow(/Docker image aifabrix\/keycloak:latest not found/);
    await expect(checkPrerequisites('keycloak', templateAppConfig, false, true))
      .rejects.toThrow(/Pull the image|use --image/);
  });

  it('should throw build hint when image not found for non-template app', async() => {
    checkImageExists.mockResolvedValue(false);
    const appConfig = { port: 3000, image: { name: 'aifabrix/myapp', tag: 'latest' } };

    await expect(checkPrerequisites('myapp', appConfig, false, true))
      .rejects.toThrow(/Run 'aifabrix build myapp' first/);
  });
});

