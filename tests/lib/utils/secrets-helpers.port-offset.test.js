/**
 * Tests for Secrets Helpers - developer-id port offset behavior
 *
 * @fileoverview Unit tests for adjusting local env ports and output copy
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');

jest.mock('fs');

// Mock config BEFORE requiring module
jest.mock('../../../lib/core/config', () => ({
  getSecretsPath: jest.fn().mockResolvedValue(null),
  getDeveloperId: jest.fn().mockResolvedValue('2') // dev-id 2 => +200
}));

const { adjustLocalEnvPortsInContent } = require('../../../lib/utils/secrets-helpers');
const { processEnvVariables } = require('../../../lib/utils/env-copy');

describe('adjustLocalEnvPortsInContent - developer-id app PORT and localhost URL offsets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates PORT and localhost URLs using +100*id offset while leaving other ports intact', async() => {
    const input = [
      'PORT=3000',
      'ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173',
      'DATABASE_PORT=5432',
      'REDIS_URL=redis://localhost:6379',
      'REDIS_HOST=localhost:6379'
    ].join('\n');

    const output = await adjustLocalEnvPortsInContent(input);

    // dev-id 2 => appPort 3200, postgres 5632, redis 6579
    expect(output).toMatch(/^PORT=3200$/m);
    expect(output).toMatch(/ALLOWED_ORIGINS=http:\/\/localhost:3200,http:\/\/localhost:5173/);
    expect(output).toMatch(/^DATABASE_PORT=5632$/m);
    expect(output).toMatch(/^REDIS_URL=redis:\/\/localhost:6579$/m);
    expect(output).toMatch(/^REDIS_HOST=localhost:6579$/m);
  });

  it('appends PORT if not present in env content', async() => {
    const input = 'SOME_VAR=value';
    const output = await adjustLocalEnvPortsInContent(input);
    expect(output).toMatch(/^PORT=3200$/m); // base 3000 + 200
  });
});
describe('processEnvVariables - copied .env PORT/localhost URL offsets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes copied .env with offset PORT and updated localhost URLs', async() => {
    const envPath = path.join(process.cwd(), 'builder', 'myapp', '.env');
    const variablesPath = path.join(process.cwd(), 'builder', 'myapp', 'variables.yaml');
    const outDir = '/tmp/aifabrix-out';
    const outEnvPath = path.join(outDir, '.env');

    // Mock existence checks
    fs.existsSync.mockImplementation((p) => {
      if (p === variablesPath) return true;
      if (p === outDir) return true;
      if (p === envPath) return true;
      return false;
    });
    fs.statSync.mockReturnValue({ isDirectory: () => true });

    // Mock reads
    fs.readFileSync.mockImplementation((p) => {
      if (p === variablesPath) {
        return [
          'port: 3000',
          'build:',
          `  envOutputPath: ${outDir}`
        ].join('\n');
      }
      if (p === envPath) {
        return [
          'PORT=3000',
          'ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173'
        ].join('\n');
      }
      return '';
    });

    // Capture write
    fs.writeFileSync.mockImplementation(() => {});

    // Use env var for developer id
    const prev = process.env.AIFABRIX_DEVELOPERID;
    process.env.AIFABRIX_DEVELOPERID = '2';
    await processEnvVariables(envPath, variablesPath);
    process.env.AIFABRIX_DEVELOPERID = prev;

    // Validate write call
    expect(fs.writeFileSync).toHaveBeenCalled();
    const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0];
    expect(writtenPath).toBe(outEnvPath);

    // dev-id 2 => appPort 3200
    expect(writtenContent).toMatch(/^PORT=3200$/m);
    expect(writtenContent).toMatch(/ALLOWED_ORIGINS=http:\/\/localhost:3200,http:\/\/localhost:5173/);
  });

  it('uses localPort + offset when developer id is set', async() => {
    const envPath = path.join(process.cwd(), 'builder', 'myapp', '.env');
    const variablesPath = path.join(process.cwd(), 'builder', 'myapp', 'variables.yaml');
    const outDir = '/tmp/aifabrix-out';
    const outEnvPath = path.join(outDir, '.env');

    fs.existsSync.mockImplementation((p) => {
      if (p === variablesPath) return true;
      if (p === outDir) return true;
      if (p === envPath) return true;
      return false;
    });
    fs.statSync.mockReturnValue({ isDirectory: () => true });
    fs.readFileSync.mockImplementation((p) => {
      if (p === variablesPath) {
        return [
          'build:',
          '  envOutputPath: ' + outDir,
          '  localPort: 4000',
          'port: 3000'
        ].join('\n');
      }
      if (p === envPath) {
        return 'PORT=3000';
      }
      return '';
    });
    fs.writeFileSync.mockImplementation(() => {});

    const prev = process.env.AIFABRIX_DEVELOPERID;
    process.env.AIFABRIX_DEVELOPERID = '1';
    await processEnvVariables(envPath, variablesPath);
    process.env.AIFABRIX_DEVELOPERID = prev;

    const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0];
    expect(writtenPath).toBe(outEnvPath);
    expect(writtenContent).toMatch(/^PORT=4100$/m); // 4000 + 100
  });
});
