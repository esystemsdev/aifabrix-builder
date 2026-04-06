/**
 * @fileoverview Unit tests for declarative-url-ports (plan 122 host port math)
 */

'use strict';

const {
  parseDeveloperIdNum,
  publishedHostPort,
  localHostPort
} = require('../../../lib/utils/declarative-url-ports');

describe('declarative-url-ports', () => {
  describe('parseDeveloperIdNum', () => {
    it('returns 0 for null, undefined, empty string', () => {
      expect(parseDeveloperIdNum(null)).toBe(0);
      expect(parseDeveloperIdNum(undefined)).toBe(0);
      expect(parseDeveloperIdNum('')).toBe(0);
    });

    it('parses integer strings', () => {
      expect(parseDeveloperIdNum('2')).toBe(2);
      expect(parseDeveloperIdNum(2)).toBe(2);
      expect(parseDeveloperIdNum('  12  ')).toBe(12);
    });

    it('returns 0 for non-numeric', () => {
      expect(parseDeveloperIdNum('abc')).toBe(0);
      expect(parseDeveloperIdNum(NaN)).toBe(0);
    });
  });

  describe('publishedHostPort', () => {
    it('adds devId*100 to listen port', () => {
      expect(publishedHostPort(3001, 0)).toBe(3001);
      expect(publishedHostPort(3001, 1)).toBe(3101);
      expect(publishedHostPort(3001, 2)).toBe(3201);
    });
  });

  describe('localHostPort', () => {
    it('adds 10 + devId*100 to listen port', () => {
      expect(localHostPort(3000, 0)).toBe(3010);
      expect(localHostPort(3000, 1)).toBe(3110);
      expect(localHostPort(4000, 1)).toBe(4110);
    });
  });
});
