/**
 * @fileoverview manifest-source-emit (plan 141 P2)
 */

'use strict';

describe('manifest-source-emit', () => {
  const originalTty = process.stdout.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalTty, configurable: true });
    jest.resetModules();
  });

  it('does not log when stdout is not a TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const { emitManifestMetadataLineIfTTY } = require('../../../lib/utils/manifest-source-emit');
    const logs = [];
    emitManifestMetadataLineIfTTY(
      { log: (s) => logs.push(s) },
      { appKey: 'x', appPath: '/tmp/nope', envOnly: false, json: false }
    );
    expect(logs).toEqual([]);
  });

  it('does not log when json output', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    const { emitManifestMetadataLineIfTTY } = require('../../../lib/utils/manifest-source-emit');
    const logs = [];
    emitManifestMetadataLineIfTTY(
      { log: (s) => logs.push(s) },
      { appKey: 'x', appPath: '/tmp/nope', envOnly: false, json: true }
    );
    expect(logs).toEqual([]);
  });

  it('does not log when envOnly', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    const { emitManifestMetadataLineIfTTY } = require('../../../lib/utils/manifest-source-emit');
    const logs = [];
    emitManifestMetadataLineIfTTY(
      { log: (s) => logs.push(s) },
      { appKey: 'x', appPath: '/tmp/nope', envOnly: true, json: false }
    );
    expect(logs).toEqual([]);
  });

  it('formatManifestSourceMetadataLine includes tier and path', () => {
    const { formatManifestSourceMetadataLine } = require('../../../lib/utils/manifest-source-emit');
    const line = formatManifestSourceMetadataLine({ tier: 'cwd-builder', configPath: '/abs/app/application.yaml' });
    expect(String(line)).toContain('Manifest:');
    expect(String(line)).toContain('cwd/builder');
    expect(String(line)).toContain('/abs/app/application.yaml');
  });

  it('logs one line when TTY and config exists', () => {
    const fs = jest.requireActual('node:fs');
    const os = require('os');
    const path = require('path');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'afb-emit-'));
    const appDir = path.join(tmp, 'builder', 'emit-app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'application.yaml'), 'app:\n  type: node\n');
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    const { emitManifestMetadataLineIfTTY } = require('../../../lib/utils/manifest-source-emit');
    const logs = [];
    emitManifestMetadataLineIfTTY(
      { log: (s) => logs.push(String(s)) },
      { appKey: 'emit-app', appPath: appDir, envOnly: false, json: false, cwd: tmp }
    );
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain('Manifest:');
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('emitAllPlatformSystemManifestLinesIfTTY is a no-op when not TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const { emitAllPlatformSystemManifestLinesIfTTY } = require('../../../lib/utils/manifest-source-emit');
    const logs = [];
    emitAllPlatformSystemManifestLinesIfTTY({ log: (s) => logs.push(String(s)) });
    expect(logs).toEqual([]);
  });
});
