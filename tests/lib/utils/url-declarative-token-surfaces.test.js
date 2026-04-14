/**
 * Exhaustive parseUrlToken coverage: six surfaces × current-app + cross-app (plan 126).
 */

'use strict';

const {
  parseUrlToken,
  DECLARATIVE_URL_EXACT_TOKENS,
  DECLARATIVE_URL_CROSS_APP_SUFFIXES
} = require('../../../lib/utils/url-declarative-token-parse');

describe('url-declarative-token-parse', () => {
  describe('DECLARATIVE_URL_EXACT_TOKENS', () => {
    it('each exact id parses to current app (empty targetKey)', () => {
      for (const { id, kind, surface } of DECLARATIVE_URL_EXACT_TOKENS) {
        expect(parseUrlToken(id)).toEqual({ targetKey: '', kind, surface });
      }
    });
  });

  describe('cross-app long suffixes', () => {
    const app = 'dataplane';
    for (const { suffix, kind, surface } of DECLARATIVE_URL_CROSS_APP_SUFFIXES) {
      it(`parses ${app}${suffix}`, () => {
        expect(parseUrlToken(`${app}${suffix}`)).toEqual({ targetKey: app, kind, surface });
      });
    }
  });

  describe('cross-app short full-url suffixes', () => {
    it('parses dataplane-public', () => {
      expect(parseUrlToken('dataplane-public')).toEqual({
        targetKey: 'dataplane',
        kind: 'public',
        surface: 'full'
      });
    });
    it('parses keycloak-internal and keycloak-private as internal full', () => {
      expect(parseUrlToken('keycloak-internal')).toEqual({
        targetKey: 'keycloak',
        kind: 'internal',
        surface: 'full'
      });
      expect(parseUrlToken('keycloak-private')).toEqual({
        targetKey: 'keycloak',
        kind: 'internal',
        surface: 'full'
      });
    });
  });

  it('longest suffix wins: myapp-host-public not treated as -public only', () => {
    expect(parseUrlToken('myapp-host-public')).toEqual({
      targetKey: 'myapp',
      kind: 'public',
      surface: 'host'
    });
  });

  it('unknown token defaults to current-app public full', () => {
    expect(parseUrlToken('')).toEqual({ targetKey: '', kind: 'public', surface: 'full' });
    expect(parseUrlToken('   ')).toEqual({ targetKey: '', kind: 'public', surface: 'full' });
    expect(parseUrlToken('not-a-known-pattern')).toEqual({
      targetKey: '',
      kind: 'public',
      surface: 'full'
    });
  });

  it('empty targetKey after strip is valid (edge)', () => {
    expect(parseUrlToken('-public')).toEqual({ targetKey: '', kind: 'public', surface: 'full' });
  });
});
