/**
 * Tests for config-format-preference module
 *
 * @fileoverview Unit tests for lib/utils/config-format-preference.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  validateAndNormalizeFormat,
  createFormatFunctions
} = require('../../../lib/utils/config-format-preference');

describe('config-format-preference', () => {
  describe('validateAndNormalizeFormat', () => {
    it('returns "json" for valid json input', () => {
      expect(validateAndNormalizeFormat('json')).toBe('json');
      expect(validateAndNormalizeFormat('JSON')).toBe('json');
      expect(validateAndNormalizeFormat('  json  ')).toBe('json');
    });

    it('returns "yaml" for valid yaml input', () => {
      expect(validateAndNormalizeFormat('yaml')).toBe('yaml');
      expect(validateAndNormalizeFormat('YAML')).toBe('yaml');
      expect(validateAndNormalizeFormat('  yaml  ')).toBe('yaml');
    });

    it('throws for null or undefined', () => {
      expect(() => validateAndNormalizeFormat(null)).toThrow('Option --format must be \'json\' or \'yaml\'');
      expect(() => validateAndNormalizeFormat(undefined)).toThrow('Option --format must be \'json\' or \'yaml\'');
    });

    it('throws for non-string', () => {
      expect(() => validateAndNormalizeFormat(123)).toThrow('Option --format must be \'json\' or \'yaml\'');
      expect(() => validateAndNormalizeFormat({})).toThrow('Option --format must be \'json\' or \'yaml\'');
    });

    it('throws for empty string', () => {
      expect(() => validateAndNormalizeFormat('')).toThrow('Option --format must be \'json\' or \'yaml\'');
      expect(() => validateAndNormalizeFormat('   ')).toThrow('Option --format must be \'json\' or \'yaml\'');
    });

    it('throws for invalid format values', () => {
      expect(() => validateAndNormalizeFormat('xml')).toThrow('Option --format must be \'json\' or \'yaml\'');
      expect(() => validateAndNormalizeFormat('yml')).toThrow('Option --format must be \'json\' or \'yaml\'');
      expect(() => validateAndNormalizeFormat('unknown')).toThrow('Option --format must be \'json\' or \'yaml\'');
    });
  });

  describe('createFormatFunctions', () => {
    describe('getFormat', () => {
      it('returns format when config has valid json format', async() => {
        const getConfigFn = jest.fn().mockResolvedValue({ format: 'json' });
        const saveConfigFn = jest.fn();
        const { getFormat } = createFormatFunctions(getConfigFn, saveConfigFn);
        const result = await getFormat();
        expect(result).toBe('json');
        expect(getConfigFn).toHaveBeenCalled();
      });

      it('returns format when config has valid yaml format', async() => {
        const getConfigFn = jest.fn().mockResolvedValue({ format: 'yaml' });
        const { getFormat } = createFormatFunctions(getConfigFn, jest.fn());
        const result = await getFormat();
        expect(result).toBe('yaml');
      });

      it('returns null when format is not set', async() => {
        const getConfigFn = jest.fn().mockResolvedValue({});
        const { getFormat } = createFormatFunctions(getConfigFn, jest.fn());
        const result = await getFormat();
        expect(result).toBeNull();
      });

      it('returns null when format is invalid', async() => {
        const getConfigFn = jest.fn().mockResolvedValue({ format: 'xml' });
        const { getFormat } = createFormatFunctions(getConfigFn, jest.fn());
        const result = await getFormat();
        expect(result).toBeNull();
      });

      it('returns null when format is empty string', async() => {
        const getConfigFn = jest.fn().mockResolvedValue({ format: '' });
        const { getFormat } = createFormatFunctions(getConfigFn, jest.fn());
        const result = await getFormat();
        expect(result).toBeNull();
      });
    });

    describe('setFormat', () => {
      it('normalizes and saves format', async() => {
        const getConfigFn = jest.fn().mockResolvedValue({ environment: 'dev' });
        const saveConfigFn = jest.fn().mockResolvedValue();
        const { setFormat } = createFormatFunctions(getConfigFn, saveConfigFn);
        await setFormat('JSON');
        expect(getConfigFn).toHaveBeenCalled();
        expect(saveConfigFn).toHaveBeenCalledWith(
          expect.objectContaining({ format: 'json', environment: 'dev' })
        );
      });

      it('throws for invalid format', async() => {
        const getConfigFn = jest.fn();
        const saveConfigFn = jest.fn();
        const { setFormat } = createFormatFunctions(getConfigFn, saveConfigFn);
        await expect(setFormat('invalid')).rejects.toThrow('Option --format must be');
        expect(saveConfigFn).not.toHaveBeenCalled();
      });
    });

    it('exposes validateAndNormalizeFormat', () => {
      const { validateAndNormalizeFormat } = createFormatFunctions(jest.fn(), jest.fn());
      expect(validateAndNormalizeFormat('json')).toBe('json');
      expect(() => validateAndNormalizeFormat('bad')).toThrow();
    });
  });
});
