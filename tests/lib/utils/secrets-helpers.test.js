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

  it('fills empty string values from canonical secrets', async() => {
    const canonicalPath = path.join(process.cwd(), 'canonical.yaml');
    const canonical = { 'miso-controller-url': 'http://${MISO_HOST}:${MISO_PORT}', 'other-key': 'canonical-value' };
    const current = { 'miso-controller-url': '', 'existing-key': 'existing-value' };

    config.getSecretsPath.mockResolvedValue(canonicalPath);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(yaml.dump(canonical));

    const result = await applyCanonicalSecretsOverride(current);
    expect(result['miso-controller-url']).toBe('http://${MISO_HOST}:${MISO_PORT}'); // empty value filled from canonical
    expect(result['existing-key']).toBe('existing-value'); // existing non-empty value preserved
    expect(result['other-key']).toBe('canonical-value'); // new key added
  });

  it('fills undefined values from canonical secrets', async() => {
    const canonicalPath = path.join(process.cwd(), 'canonical.yaml');
    const canonical = { 'miso-controller-url': 'http://localhost:3000', 'new-key': 'canonical' };
    const current = { 'miso-controller-url': undefined, 'existing-key': 'existing' };

    config.getSecretsPath.mockResolvedValue(canonicalPath);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(yaml.dump(canonical));

    const result = await applyCanonicalSecretsOverride(current);
    expect(result['miso-controller-url']).toBe('http://localhost:3000'); // undefined value filled from canonical
    expect(result['existing-key']).toBe('existing'); // existing value preserved
    expect(result['new-key']).toBe('canonical'); // new key added
  });

  it('fills null values from canonical secrets', async() => {
    const canonicalPath = path.join(process.cwd(), 'canonical.yaml');
    const canonical = { 'miso-controller-url': 'http://localhost:3000' };
    const current = { 'miso-controller-url': null };

    config.getSecretsPath.mockResolvedValue(canonicalPath);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(yaml.dump(canonical));

    const result = await applyCanonicalSecretsOverride(current);
    expect(result['miso-controller-url']).toBe('http://localhost:3000'); // null value filled from canonical
  });

  it('replaces encrypted values (secure://) with plaintext from canonical secrets', async() => {
    const canonicalPath = path.join(process.cwd(), 'canonical.yaml');
    // Canonical has plaintext UUID values
    const canonical = {
      'azure-subscription-idKeyVault': '67576622-504a-4532-9903-dbae7df491f5',
      'azure-tenant-idKeyVault': '09aff594-ba37-4af2-bf40-b773b654c563',
      'azure-service-nameKeyVault': 'aifabrix001'
    };
    // User secrets have encrypted values (secure:// prefix)
    const current = {
      'azure-subscription-idKeyVault': 'secure://xK9mP2qR5tW8vY1z:AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef:ZxYwVuTsRqPoNmLkJiHgFeDcBa9876543210',
      'azure-tenant-idKeyVault': 'secure://yL0nQ3rS6uX9wZ2a:BcDeFgHiJkLmNoPqRsTuVwXyZa2345678901bcdefg:YwXvUtSrQpOnMlKjIhGfEdCbA8765432109',
      'azure-service-nameKeyVault': 'secure://zM1pO4sT7vY0xZ3b:CdEfGhIjKlMnOpQrStUvWxYzAb3456789012cdefgh:XvWuVtUsTrQpPnOmLkKjJiIhHgGfFeEdDcCbBaA9876543210'
    };

    config.getSecretsPath.mockResolvedValue(canonicalPath);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(yaml.dump(canonical));

    const result = await applyCanonicalSecretsOverride(current);
    // Encrypted values (secure://) should be replaced with plaintext from canonical
    expect(result['azure-subscription-idKeyVault']).toBe('67576622-504a-4532-9903-dbae7df491f5');
    expect(result['azure-tenant-idKeyVault']).toBe('09aff594-ba37-4af2-bf40-b773b654c563');
    expect(result['azure-service-nameKeyVault']).toBe('aifabrix001');
  });

  it('does not replace plaintext values with canonical', async() => {
    const canonicalPath = path.join(process.cwd(), 'canonical.yaml');
    const canonical = { 'some-key': 'canonical-value' };
    const current = { 'some-key': 'user-value' }; // Plaintext value, should keep user value

    config.getSecretsPath.mockResolvedValue(canonicalPath);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(yaml.dump(canonical));

    const result = await applyCanonicalSecretsOverride(current);
    expect(result['some-key']).toBe('user-value'); // User value preserved (plaintext, not encrypted)
  });

});

