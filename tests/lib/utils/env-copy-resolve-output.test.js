/**
 * @fileoverview processEnvVariables: local flavor at envOutputPath for resolve
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { processEnvVariables } = require('../../../lib/utils/env-copy');
const secrets = require('../../../lib/core/secrets');

describe('processEnvVariables preferLocalEnvOutputPath', () => {
  let dir;
  let builderDir;
  let outDir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-env-copy-resolve-'));
    builderDir = path.join(dir, 'builder', 'svc');
    outDir = path.join(dir, 'out');
    fs.mkdirSync(builderDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('writes local flavor to envOutputPath when preferLocalEnvOutputPath', async() => {
    const variablesPath = path.join(builderDir, 'application.yaml');
    fs.writeFileSync(
      variablesPath,
      yaml.dump({
        build: { envOutputPath: path.join(outDir, '.env') },
        port: 3000,
        app: { key: 'svc' }
      }),
      'utf8'
    );
    fs.writeFileSync(path.join(builderDir, 'env.template'), 'FOO=1\n', 'utf8');
    const envPath = path.join(builderDir, '.env');
    fs.writeFileSync(envPath, '#docker-side\nDB_HOST=postgres\n', 'utf8');

    const spy = jest.spyOn(secrets, 'generateEnvContent').mockResolvedValue('#local-side\nFOO=localhost\n');

    const outPath = path.join(outDir, '.env');
    await processEnvVariables(envPath, variablesPath, 'svc', undefined, {
      preferLocalEnvOutputPath: true,
      appPath: builderDir
    });

    const written = fs.readFileSync(outPath, 'utf8');
    expect(written).toContain('#local-side');
    expect(written).toContain('FOO=localhost');
    expect(spy).toHaveBeenCalledWith('svc', undefined, 'local', false, { appPath: builderDir });
    spy.mockRestore();
  });

  it('syncs builder .env to envOutputPath when preferLocal not set', async() => {
    const variablesPath = path.join(builderDir, 'application.yaml');
    fs.writeFileSync(
      variablesPath,
      yaml.dump({
        build: { envOutputPath: path.join(outDir, '.env') },
        port: 3000,
        app: { key: 'svc' }
      }),
      'utf8'
    );
    const envPath = path.join(builderDir, '.env');
    fs.writeFileSync(envPath, 'SYNCED=1\n', 'utf8');

    const spy = jest.spyOn(secrets, 'generateEnvContent');

    const outPath = path.join(outDir, '.env');
    await processEnvVariables(envPath, variablesPath, 'svc', undefined);

    expect(fs.readFileSync(outPath, 'utf8')).toContain('SYNCED=1');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
