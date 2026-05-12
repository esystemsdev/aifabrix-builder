/**
 * @fileoverview Tests for ancestor secrets.local.yaml path collection
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const { collectAncestorAifabrixSecretsLocalYamlPaths } = require('../../../lib/utils/secrets-ancestor-paths');

describe('secrets-ancestor-paths', () => {
  it('returns nearest-first paths for nested .aifabrix dirs', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'af-anc-'));
    const training = path.join(tmp, 'training');
    const ws = tmp;
    fs.mkdirSync(path.join(training, '.aifabrix'), { recursive: true });
    fs.mkdirSync(path.join(ws, '.aifabrix'), { recursive: true });
    fs.writeFileSync(path.join(ws, '.aifabrix', 'secrets.local.yaml'), 'parent: 1\n', 'utf8');
    fs.writeFileSync(path.join(training, '.aifabrix', 'secrets.local.yaml'), 'child: 2\n', 'utf8');

    const list = collectAncestorAifabrixSecretsLocalYamlPaths(training, fs.existsSync.bind(fs));
    expect(list).toHaveLength(2);
    expect(list[0]).toBe(path.join(training, '.aifabrix', 'secrets.local.yaml'));
    expect(list[1]).toBe(path.join(ws, '.aifabrix', 'secrets.local.yaml'));
  });

  it('dedupes identical resolved paths', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'af-anc2-'));
    const p = path.join(tmp, '.aifabrix', 'secrets.local.yaml');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'x: 1\n', 'utf8');
    const list = collectAncestorAifabrixSecretsLocalYamlPaths(tmp, fs.existsSync.bind(fs));
    expect(list).toEqual([path.resolve(p)]);
  });
});
