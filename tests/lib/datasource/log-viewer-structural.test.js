/**
 * @fileoverview Structural test log filename rules and latest-file resolution.
 */

const fs = require('node:fs');
const path = require('path');
const os = require('os');

const {
  isStructuralTestLogFileName,
  getLatestStructuralTestLogPath
} = require('../../../lib/datasource/log-viewer');

describe('log-viewer structural filenames', () => {
  it('isStructuralTestLogFileName excludes e2e and integration prefixes', () => {
    expect(isStructuralTestLogFileName('test-2026-04-16T00-00-00-000Z.json')).toBe(true);
    expect(isStructuralTestLogFileName('test-e2e-2026-04-16T00-00-00-000Z.json')).toBe(false);
    expect(isStructuralTestLogFileName('test-integration-2026-04-16T00-00-00-000Z.json')).toBe(false);
    expect(isStructuralTestLogFileName('other.json')).toBe(false);
  });

  it('getLatestStructuralTestLogPath returns newest matching file', async() => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logv-struct-'));
    try {
      const logsDir = path.join(root, 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      const older = path.join(logsDir, 'test-2020-01-01T00-00-00-000Z.json');
      const newer = path.join(logsDir, 'test-2030-01-01T00-00-00-000Z.json');
      fs.writeFileSync(older, '{}', 'utf8');
      fs.writeFileSync(newer, '{}', 'utf8');
      const got = await getLatestStructuralTestLogPath(logsDir);
      expect(got).toBe(newer);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
