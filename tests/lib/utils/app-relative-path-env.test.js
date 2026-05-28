/**
 * @fileoverview Tests for app.key → NAME_RELATIVE_PATH env naming (Builder CLI)
 */

'use strict';

const {
  appKeyToRelativePathEnvKey,
  isAppRelativePathEnvKey,
  renameAppRelativePathEnvKeyInTemplate
} = require('../../../lib/utils/app-relative-path-env');

describe('app-relative-path-env', () => {
  describe('appKeyToRelativePathEnvKey', () => {
    it('maps app.key to UPPER_SNAKE_RELATIVE_PATH', () => {
      expect(appKeyToRelativePathEnvKey('dataplane')).toBe('DATAPLANE_RELATIVE_PATH');
      expect(appKeyToRelativePathEnvKey('myapp')).toBe('MYAPP_RELATIVE_PATH');
      expect(appKeyToRelativePathEnvKey('my-app')).toBe('MY_APP_RELATIVE_PATH');
    });

    it('uses static overrides for Keycloak and Miso', () => {
      expect(appKeyToRelativePathEnvKey('keycloak')).toBe('KC_HTTP_RELATIVE_PATH');
      expect(appKeyToRelativePathEnvKey('miso-controller')).toBe('MISO_RELATIVE_PATH');
    });
  });

  describe('isAppRelativePathEnvKey', () => {
    it('matches static and NAME_RELATIVE_PATH keys', () => {
      expect(isAppRelativePathEnvKey('KC_HTTP_RELATIVE_PATH')).toBe(true);
      expect(isAppRelativePathEnvKey('MISO_RELATIVE_PATH')).toBe(true);
      expect(isAppRelativePathEnvKey('DATAPLANE_RELATIVE_PATH')).toBe(true);
      expect(isAppRelativePathEnvKey('MYAPP_RELATIVE_PATH')).toBe(true);
      expect(isAppRelativePathEnvKey('FOO')).toBe(false);
    });
  });

  describe('renameAppRelativePathEnvKeyInTemplate', () => {
    it('renames template vdir line when app.key differs from product template', () => {
      const content = 'DATAPLANE_RELATIVE_PATH=url://vdir-public\n';
      const out = renameAppRelativePathEnvKeyInTemplate(content, 'myapp');
      expect(out).toBe('MYAPP_RELATIVE_PATH=url://vdir-public\n');
    });

    it('leaves line unchanged when key already matches app.key', () => {
      const content = 'DATAPLANE_RELATIVE_PATH=url://vdir-public\n';
      expect(renameAppRelativePathEnvKeyInTemplate(content, 'dataplane')).toBe(content);
    });
  });
});
