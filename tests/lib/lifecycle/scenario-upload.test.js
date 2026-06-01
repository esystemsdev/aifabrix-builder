/**
 * @fileoverview Tests for governance scenario pack upload helpers.
 */

'use strict';

const fs = require('node:fs');
const os = require('os');
const path = require('path');

const {
  datasourceKeysFromPack,
  loadPackFromFile
} = require('../../../lib/lifecycle/scenario-upload');

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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scenarios-'));
    const filePath = path.join(dir, 'pack.yaml');
    fs.writeFileSync(
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
    const doc = loadPackFromFile(filePath);
    expect(doc.metadata.key).toBe('test-pack');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
