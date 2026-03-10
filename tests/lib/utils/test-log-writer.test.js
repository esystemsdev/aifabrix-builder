/**
 * Tests for Test Log Writer
 * @fileoverview Tests for lib/utils/test-log-writer.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(),
    writeFile: jest.fn().mockResolvedValue()
  }
}));

const { sanitizeForLog, writeTestLog } = require('../../../lib/utils/test-log-writer');

describe('Test Log Writer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitizeForLog', () => {
    it('should return primitives unchanged', () => {
      expect(sanitizeForLog(null)).toBe(null);
      expect(sanitizeForLog(42)).toBe(42);
      expect(sanitizeForLog('hello')).toBe('hello');
    });

    it('should pass through objects unchanged (dataplane handles sanitization)', () => {
      const data = { token: 'x', name: 'test', nested: { value: 1 } };
      const out = sanitizeForLog(data);
      expect(out).toEqual(data);
    });

    it('should handle arrays', () => {
      const arr = [1, { a: 2 }, 'x'];
      expect(sanitizeForLog(arr)).toEqual(arr);
    });

    it('should replace circular refs with [Circular]', () => {
      const obj = { a: 1 };
      obj.self = obj;
      const out = sanitizeForLog(obj);
      expect(out.a).toBe(1);
      expect(out.self).toBe('[Circular]');
    });

    it('should handle nested circular refs', () => {
      const outer = { b: {} };
      outer.b.back = outer;
      const out = sanitizeForLog(outer);
      expect(out.b.back).toBe('[Circular]');
    });
  });

  describe('writeTestLog', () => {
    it('should create logs dir and write file', async() => {
      const filePath = await writeTestLog('myapp', { request: {}, response: {} });

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(filePath).toContain('logs');
      expect(filePath).toContain('myapp');
    });

    it('should write data as JSON to correct path', async() => {
      const data = { request: { systemKey: 'sys1' }, response: { success: true } };
      await writeTestLog('myapp', data, 'test-integration');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-integration-'),
        JSON.stringify(data, null, 2),
        'utf8'
      );
    });

    it('should use custom integrationBaseDir when provided', async() => {
      await writeTestLog('myapp', {}, 'test-e2e', '/custom/integration');

      expect(fs.mkdir).toHaveBeenCalledWith('/custom/integration/myapp/logs', { recursive: true });
    });
  });
});
