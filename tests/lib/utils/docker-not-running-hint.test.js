/**
 * @fileoverview Tests for docker-not-running-hint.js
 */

describe('docker-not-running-hint', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    jest.resetModules();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('linux hint mentions systemctl and docker socket access', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    const { getDockerDaemonStartHintSentence, getDockerNotRunningErrorMessage } = require('../../../lib/utils/docker-not-running-hint');
    const s = getDockerDaemonStartHintSentence();
    expect(s).toMatch(/systemctl/);
    expect(s).toMatch(/docker/i);
    expect(getDockerNotRunningErrorMessage()).toContain('Docker is not running or not installed');
  });

  it('darwin hint mentions Docker Desktop', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const { getDockerDaemonStartHintSentence } = require('../../../lib/utils/docker-not-running-hint');
    expect(getDockerDaemonStartHintSentence()).toMatch(/Docker Desktop/);
  });

  it('win32 hint mentions Docker Desktop', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    const { getDockerDaemonStartHintSentence } = require('../../../lib/utils/docker-not-running-hint');
    expect(getDockerDaemonStartHintSentence()).toMatch(/Docker Desktop/);
  });

  it('getDockerApiOverTcpHintLines mentions docker-endpoint and dev show', () => {
    const { getDockerApiOverTcpHintLines } = require('../../../lib/utils/docker-not-running-hint');
    const lines = getDockerApiOverTcpHintLines();
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.join('\n')).toMatch(/docker-endpoint/);
    expect(lines.join('\n')).toMatch(/dev show/);
  });
});
