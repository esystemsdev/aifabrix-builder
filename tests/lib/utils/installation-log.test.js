/**
 * @fileoverview Tests for installation.log helpers
 */

'use strict';

const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const pathsMod = require('../../../lib/utils/paths');
const installationLog = require('../../../lib/utils/installation-log');
const { buildInstallationRecordLines } = require('../../../lib/utils/installation-log-record');

jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(2),
  getAdminEmail: jest.fn().mockResolvedValue(''),
  getConfig: jest.fn().mockResolvedValue({})
}));

jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('http://localhost:3100')
}));

describe('installation-log', () => {
  let tmpDir;

  beforeEach(async() => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'instlog-'));
    jest.spyOn(pathsMod, 'getAifabrixSystemDir').mockReturnValue(tmpDir);
  });

  afterEach(async() => {
    jest.restoreAllMocks();
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('appendInstallationRecord writes one atomic block', async() => {
    await installationLog.appendInstallationRecord({
      command: 'up-infra',
      outcome: 'success',
      startedAt: new Date('2026-05-13T10:00:00.000Z'),
      completedAt: new Date('2026-05-13T10:01:30.000Z'),
      options: {},
      infra: {
        cfg: { traefik: false, tlsEnabled: false, pgadmin: true, redisCommander: true },
        options: {}
      },
      configExtra: { controllerUrl: 'http://localhost:3100', adminEmail: 'unset' }
    });
    const content = await fs.readFile(path.join(tmpDir, installationLog.INSTALLATION_LOG), 'utf8');
    expect(content).toContain('command: up-infra');
    expect(content).toContain('outcome: success');
    expect(content).toContain('recordVersion: 1');
    expect(content).toContain('Infra');
    expect(content).toContain('durationSec: 90');
    expect(content.split('command: up-infra').length - 1).toBe(1);
  });

  it('failure record masks sensitive error message', async() => {
    const err = new Error('failed password=secret123');
    await installationLog.appendInstallationRecord({
      command: 'up-miso',
      outcome: 'failure',
      startedAt: new Date(),
      completedAt: new Date(),
      options: {},
      error: err,
      errorCode: 'ERR_TEST'
    });
    const content = await fs.readFile(path.join(tmpDir, installationLog.INSTALLATION_LOG), 'utf8');
    expect(content).toContain('password=***');
    expect(content).not.toContain('secret123');
  });

  it('rotateInstallationLogIfNeeded renames when over maxBytes', async() => {
    const logPath = path.join(tmpDir, installationLog.INSTALLATION_LOG);
    const big = Buffer.alloc(30, 0x61);
    await fs.writeFile(logPath, big);
    await installationLog.rotateInstallationLogIfNeeded(logPath, 20);
    const existsOld = await fs
      .access(path.join(tmpDir, `${installationLog.INSTALLATION_LOG}.1`))
      .then(() => true)
      .catch(() => false);
    expect(existsOld).toBe(true);
  });

  it('buildInstallationRecordLines keeps deterministic section order', async() => {
    const lines = await buildInstallationRecordLines({
      command: 'teardown',
      outcome: 'success',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      completedAt: new Date('2026-01-01T00:00:01.000Z'),
      options: {},
      cleanup: { volumesRemoved: true, configPreserved: true },
      configExtra: { adminEmail: 'unset' }
    });
    const text = lines.join('\n');
    const cfgIdx = text.indexOf('Config');
    const cleanIdx = text.indexOf('Cleanup');
    expect(cfgIdx).toBeGreaterThan(-1);
    expect(cleanIdx).toBeGreaterThan(cfgIdx);
  });
});
