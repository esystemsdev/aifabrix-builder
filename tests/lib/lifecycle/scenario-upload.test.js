/**
 * @fileoverview Tests for governance scenario pack upload helpers.
 */

'use strict';

const path = require('path');

/** Real disk I/O; other suites in the worker may jest.mock('fs') and break rmSync recursive cleanup. */
jest.unmock('../../../lib/internal/fs-real-sync');

const {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync
} = require('../../../lib/internal/fs-real-sync');

const {
  datasourceKeysFromPack,
  loadPackFromFile
} = require('../../../lib/lifecycle/scenario-upload');

/**
 * Project-local temp root (avoids /tmp + mocked fs.rmSync ENOTEMPTY on CI workers).
 * @returns {string}
 */
function scenarioUploadFixtureRoot() {
  return path.join(__dirname, '../../../.temp/jest-scenario-upload');
}

describe('scenario-upload', () => {
  it('extracts datasource keys from pack scenarios', () => {
    const keys = datasourceKeysFromPack({
      spec: {
        scenarios: [
          { search: { datasourceKeys: ['ds-a', 'ds-b'] } },
          { search: { datasourceKeys: ['ds-b'] } }
        ]
      }
    });
    expect(keys.sort()).toEqual(['ds-a', 'ds-b']);
  });

  it('loads pack YAML from disk', () => {
    const root = scenarioUploadFixtureRoot();
    mkdirSync(root, { recursive: true });
    const dir = mkdtempSync(path.join(root, 'pack-'));
    const filePath = path.join(dir, 'pack.yaml');
    writeFileSync(
      filePath,
      [
        'apiVersion: dataplane.aifabrix.ai/v1',
        'kind: GovernanceScenarioPack',
        'metadata:',
        '  key: test-pack',
        '  displayName: Test',
        'spec:',
        '  systemKey: acme',
        '  scenarios:',
        '    - id: s1',
        '      subjectUserId: u1',
        '      search:',
        '        datasourceKeys:',
        '          - ds-a',
        '      expect:',
        '        mustIncludeKeys: []'
      ].join('\n'),
      'utf8'
    );
    try {
      const doc = loadPackFromFile(filePath);
      expect(doc.metadata.key).toBe('test-pack');
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors on shared CI workers
      }
    }
  });
});
