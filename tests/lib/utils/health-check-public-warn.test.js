/**
 * @fileoverview Unit tests for health-check-public-warn.js
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

jest.mock('chalk', () => {
  const id = (t) => t;
  id.yellow = (t) => t;
  id.gray = (t) => t;
  return id;
});

const logger = require('../../../lib/utils/logger');
const {
  filterTraefikUrlByDns,
  logPublicHealthUrlWarningIfNeeded
} = require('../../../lib/utils/health-check-public-warn');

describe('health-check-public-warn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('filterTraefikUrlByDns', () => {
    it('returns empty when traefikUrl is empty', async() => {
      const fn = jest.fn();
      await expect(filterTraefikUrlByDns('', false, fn)).resolves.toEqual({
        traefikUrl: '',
        skippedPublicHealthUrl: ''
      });
      expect(fn).not.toHaveBeenCalled();
    });

    it('clears traefikUrl and sets skippedPublicHealthUrl when DNS fails', async() => {
      const url = 'https://dev.example.com/auth/health/ready';
      const isHostnameResolvableFn = jest.fn().mockResolvedValue(false);
      await expect(filterTraefikUrlByDns(url, false, isHostnameResolvableFn)).resolves.toEqual({
        traefikUrl: '',
        skippedPublicHealthUrl: url
      });
      expect(isHostnameResolvableFn).toHaveBeenCalledWith('dev.example.com', false);
    });

    it('keeps traefikUrl when DNS succeeds', async() => {
      const url = 'https://dev.example.com/health';
      const isHostnameResolvableFn = jest.fn().mockResolvedValue(true);
      await expect(filterTraefikUrlByDns(url, false, isHostnameResolvableFn)).resolves.toEqual({
        traefikUrl: url,
        skippedPublicHealthUrl: ''
      });
    });

    it('returns empty on invalid URL parse', async() => {
      const isHostnameResolvableFn = jest.fn();
      await expect(filterTraefikUrlByDns('not-a-url', false, isHostnameResolvableFn)).resolves.toEqual({
        traefikUrl: '',
        skippedPublicHealthUrl: ''
      });
      expect(isHostnameResolvableFn).not.toHaveBeenCalled();
    });
  });

  describe('logPublicHealthUrlWarningIfNeeded', () => {
    it('logs DNS skip message when skippedPublicHealthUrl is set', () => {
      logPublicHealthUrlWarningIfNeeded({
        skippedPublicHealthUrl: 'https://host/app/health',
        urlsToTry: ['http://localhost:8080/health'],
        resolvedIndex: 0
      });
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Public URL was not verified (DNS): https://host/app/health')
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Validate DNS names'));
    });

    it('logs Traefik-unverified message when health succeeded on localhost only', () => {
      logPublicHealthUrlWarningIfNeeded({
        skippedPublicHealthUrl: '',
        urlsToTry: ['https://edge.example/health', 'http://localhost:8282/health'],
        resolvedIndex: 1
      });
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Public URL was not verified: https://edge.example/health')
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('localhost only'));
    });

    it('does not log when resolvedIndex is first URL', () => {
      logPublicHealthUrlWarningIfNeeded({
        skippedPublicHealthUrl: '',
        urlsToTry: ['https://edge.example/h', 'http://localhost/h'],
        resolvedIndex: 0
      });
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('does nothing when resolvedIndex is invalid', () => {
      logPublicHealthUrlWarningIfNeeded({
        skippedPublicHealthUrl: '',
        urlsToTry: ['http://localhost/h'],
        resolvedIndex: -1
      });
      expect(logger.log).not.toHaveBeenCalled();
    });
  });
});
