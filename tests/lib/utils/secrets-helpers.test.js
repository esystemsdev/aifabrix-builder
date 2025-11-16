/**
 * Tests for Secrets Helpers
 *
 * @fileoverview Unit tests for secrets-helpers.js edge cases
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

jest.mock('fs');

// Mock config BEFORE requiring module
jest.mock('../../../lib/config', () => ({
  getSecretsPath: jest.fn().mockResolvedValue(null)
}));

const {
  formatMissingSecretsFileInfo,
  applyCanonicalSecretsOverride
} = require('../../../lib/utils/secrets-helpers');

describe('formatMissingSecretsFileInfo', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatMissingSecretsFileInfo(null)).toBe('');
    expect(formatMissingSecretsFileInfo(undefined)).toBe('');
  });

  it('handles string path input', () => {
    const info = formatMissingSecretsFileInfo('/path/to/secrets.yaml');
    expect(info).toContain('Secrets file location: /path/to/secrets.yaml');
  });

  it('ignores object without userPath', () => {
    const info = formatMissingSecretsFileInfo({ buildPath: '/path' });
    expect(info).toBe('');
  });

  it('includes only userPath when buildPath is null', () => {
    const userPath = '/home/user/.aifabrix/secrets.local.yaml';
    const info = formatMissingSecretsFileInfo({ userPath, buildPath: null });
    expect(info).toContain(userPath);
    expect(info).not.toContain(' and ');
  });

  it('includes both userPath and buildPath when present', () => {
    const userPath = '/home/user/.aifabrix/secrets.local.yaml';
    const buildPath = '/project/builder/secrets.yaml';
    const info = formatMissingSecretsFileInfo({ userPath, buildPath });
    expect(info).toContain(userPath);
    expect(info).toContain(' and ');
    expect(info).toContain(buildPath);
  });
});

describe('applyCanonicalSecretsOverride', () => {
  const config = require('../../../lib/config');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns canonical secrets when current is empty and canonical file exists', async() => {
    const canonicalPath = path.join(process.cwd(), 'canonical.yaml');
    const canonical = { 'key': 'value' };
    config.getSecretsPath.mockResolvedValue(canonicalPath);
    fs.existsSync.mockImplementation((filePath) => filePath === canonicalPath);
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === canonicalPath) return yaml.dump(canonical);
      return '';
    });

    const result = await applyCanonicalSecretsOverride({});
    expect(result).toEqual(canonical);
  });

  it('ignores canonical when file missing', async() => {
    config.getSecretsPath.mockResolvedValue('/missing.yaml');
    fs.existsSync.mockReturnValue(false);
    const result = await applyCanonicalSecretsOverride({});
    expect(result).toEqual({});
  });

  it('ignores canonical when YAML invalid or non-object', async() => {
    const canonicalPath = path.join(process.cwd(), 'canonical.yaml');
    config.getSecretsPath.mockResolvedValue(canonicalPath);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('invalid: yaml: content: [');

    const resultInvalid = await applyCanonicalSecretsOverride({});
    expect(resultInvalid).toEqual({});

    fs.readFileSync.mockReturnValue('123'); // non-object
    const resultNonObject = await applyCanonicalSecretsOverride({});
    expect(resultNonObject).toEqual({});
  });

  it('merges canonical secrets without overriding existing keys (fallback behavior)', async() => {
    const canonicalPath = path.join(process.cwd(), 'canonical.yaml');
    const canonical = { 'key': 'canonical', 'new': 'from-canonical' };
    const current = { 'key': 'current', 'other': 'v' };

    config.getSecretsPath.mockResolvedValue(canonicalPath);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(yaml.dump(canonical));

    const result = await applyCanonicalSecretsOverride(current);
    expect(result.key).toBe('current'); // existing wins
    expect(result.other).toBe('v');
    expect(result.new).toBe('from-canonical'); // new key added
  });
});

