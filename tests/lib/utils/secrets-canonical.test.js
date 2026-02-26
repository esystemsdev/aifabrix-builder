/**
 * Tests for secrets-canonical module
 *
 * @fileoverview Unit tests for lib/utils/secrets-canonical.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

jest.mock('fs');
jest.mock('../../../lib/core/config', () => ({
  getSecretsPath: jest.fn().mockResolvedValue(null)
}));

const { readYamlAtPath, applyCanonicalSecretsOverride } = require('../../../lib/utils/secrets-canonical');
const config = require('../../../lib/core/config');

describe('secrets-canonical', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readYamlAtPath', () => {
    it('parses valid YAML and returns object', () => {
      const filePath = '/path/to/secrets.yaml';
      const content = 'key: value\nnested:\n  foo: bar';
      fs.readFileSync.mockReturnValue(content);

      const result = readYamlAtPath(filePath);
      expect(result).toEqual({ key: 'value', nested: { foo: 'bar' } });
      expect(fs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('throws when YAML is invalid', () => {
      fs.readFileSync.mockReturnValue('invalid: yaml: [unclosed');
      expect(() => readYamlAtPath('/path/to/bad.yaml')).toThrow();
    });

    it('throws when file does not exist', () => {
      fs.readFileSync.mockImplementation(() => {
        const err = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      });
      expect(() => readYamlAtPath('/nonexistent.yaml')).toThrow('ENOENT');
    });

    it('handles empty YAML as empty object', () => {
      fs.readFileSync.mockReturnValue('');
      const result = readYamlAtPath('/path/empty.yaml');
      expect(result).toBeUndefined();
    });
  });

  describe('applyCanonicalSecretsOverride', () => {
    it('returns current secrets when getSecretsPath returns null', async() => {
      config.getSecretsPath.mockResolvedValue(null);
      const current = { key: 'value' };
      const result = await applyCanonicalSecretsOverride(current);
      expect(result).toEqual(current);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('returns current secrets when canonical file does not exist', async() => {
      config.getSecretsPath.mockResolvedValue('/path/canonical.yaml');
      fs.existsSync.mockReturnValue(false);
      const current = { key: 'value' };
      const result = await applyCanonicalSecretsOverride(current);
      expect(result).toEqual(current);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('merges canonical secrets when file exists and is valid', async() => {
      const canonicalPath = path.join(process.cwd(), 'canonical.yaml');
      config.getSecretsPath.mockResolvedValue(canonicalPath);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ canonicalKey: 'canonical-value' }));

      const result = await applyCanonicalSecretsOverride({});
      expect(result).toEqual({ canonicalKey: 'canonical-value' });
    });

    it('handles relative canonical path by resolving against cwd', async() => {
      config.getSecretsPath.mockResolvedValue('canonical.yaml');
      const resolvedPath = path.resolve(process.cwd(), 'canonical.yaml');
      fs.existsSync.mockImplementation((p) => p === resolvedPath);
      fs.readFileSync.mockReturnValue(yaml.dump({ k: 'v' }));

      const result = await applyCanonicalSecretsOverride({});
      expect(result).toEqual({ k: 'v' });
      expect(fs.existsSync).toHaveBeenCalledWith(resolvedPath);
    });

    it('ignores invalid YAML in canonical file', async() => {
      config.getSecretsPath.mockResolvedValue('/path/canonical.yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      const current = { key: 'value' };
      const result = await applyCanonicalSecretsOverride(current);
      expect(result).toEqual(current);
    });
  });
});
