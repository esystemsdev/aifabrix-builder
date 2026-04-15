/**
 * @fileoverview Deploy manifest url:// → Key Vault secret names (Azure)
 */

'use strict';

const {
  urlTokenToKeyVaultSecretName,
  rewriteFrontDoorHostForAzureDeploy
} = require('../../../lib/generator/deploy-manifest-azure-kv');
const { parseEnvironmentVariables } = require('../../../lib/generator/helpers');

describe('deploy-manifest-azure-kv', () => {
  describe('urlTokenToKeyVaultSecretName', () => {
    it('maps self public/internal to web-server-url / internal-server-url', () => {
      expect(urlTokenToKeyVaultSecretName('miso-controller', 'public')).toBe(
        'miso-controller-web-server-url'
      );
      expect(urlTokenToKeyVaultSecretName('miso-controller', 'internal')).toBe(
        'miso-controller-internal-server-url'
      );
      expect(urlTokenToKeyVaultSecretName('dataplane', 'public')).toBe('dataplane-web-server-url');
    });

    it('maps keycloak cross-app tokens to Bicep secret names', () => {
      expect(urlTokenToKeyVaultSecretName('miso-controller', 'keycloak-public')).toBe(
        'keycloak-web-server-url'
      );
      expect(urlTokenToKeyVaultSecretName('miso-controller', 'keycloak-internal')).toBe(
        'keycloak-internal-server-url'
      );
    });

    it('maps keycloak self public/internal to keycloak-web-server-url (not keycloak-web-server-url)', () => {
      expect(urlTokenToKeyVaultSecretName('keycloak', 'public')).toBe('keycloak-web-server-url');
      expect(urlTokenToKeyVaultSecretName('keycloak', 'internal')).toBe('keycloak-internal-server-url');
    });

    it('maps other-app public to {app}-web-server-url', () => {
      expect(urlTokenToKeyVaultSecretName('miso-controller', 'dataplane-public')).toBe(
        'dataplane-web-server-url'
      );
    });

    it('maps vdir and host surfaces', () => {
      expect(urlTokenToKeyVaultSecretName('keycloak', 'vdir-public')).toBe('keycloak-vdir-public');
      expect(urlTokenToKeyVaultSecretName('keycloak', 'keycloak-vdir-public')).toBe(
        'keycloak-vdir-public'
      );
      expect(urlTokenToKeyVaultSecretName('miso-controller', 'host-public')).toBe(
        'miso-controller-host-public'
      );
    });

    it('throws on empty token', () => {
      expect(() => urlTokenToKeyVaultSecretName('x', '  ')).toThrow(/Empty url/);
    });
  });

  describe('rewriteFrontDoorHostForAzureDeploy', () => {
    it('replaces DEV_USERNAME/REMOTE_HOST template with Key Vault secret name', () => {
      const d = {
        key: 'miso-controller',
        frontDoorRouting: {
          enabled: true,
          host: '${DEV_USERNAME}.${REMOTE_HOST}',
          pattern: '/miso/*'
        }
      };
      rewriteFrontDoorHostForAzureDeploy(d);
      expect(d.frontDoorRouting.host).toBe('miso-controller-frontdoor-routing-host');
    });

    it('leaves literal host unchanged', () => {
      const d = {
        key: 'x',
        frontDoorRouting: { host: 'controller.example.com', enabled: true }
      };
      rewriteFrontDoorHostForAzureDeploy(d);
      expect(d.frontDoorRouting.host).toBe('controller.example.com');
    });
  });

  describe('parseEnvironmentVariables url:// with app.key', () => {
    const variablesConfig = {
      app: { key: 'miso-controller' }
    };

    it('emits keyvault entries with vault secret names, no url:// left', () => {
      const template = [
        'MISO_WEB_SERVER_URL=url://public',
        'MISO_CONTROLLER_URL=url://internal',
        'KEYCLOAK_SERVER_URL=url://keycloak-public',
        'KEYCLOAK_INTERNAL_SERVER_URL=url://keycloak-internal'
      ].join('\n');
      const cfg = parseEnvironmentVariables(template, variablesConfig);
      const byName = Object.fromEntries(cfg.map((c) => [c.name, c]));
      expect(byName.MISO_WEB_SERVER_URL).toEqual({
        name: 'MISO_WEB_SERVER_URL',
        value: 'miso-controller-web-server-url',
        location: 'keyvault',
        required: true
      });
      expect(byName.MISO_CONTROLLER_URL.value).toBe('miso-controller-internal-server-url');
      expect(byName.KEYCLOAK_SERVER_URL.value).toBe('keycloak-web-server-url');
      expect(byName.KEYCLOAK_INTERNAL_SERVER_URL.value).toBe('keycloak-internal-server-url');
    });

    it('throws when url:// present but app.key missing', () => {
      const template = 'X=url://public\n';
      expect(() => parseEnvironmentVariables(template, null)).toThrow(/app\.key is required/);
    });

    it('maps comma-separated url:// tokens to Key Vault secret names each', () => {
      const template =
        'ALLOWED_ORIGINS=url://host-public,url://host-private\n' +
        'MISO_ALLOWED_ORIGINS=url://public,url://internal\n';
      const cfg = parseEnvironmentVariables(template, variablesConfig);
      const byName = Object.fromEntries(cfg.map((c) => [c.name, c]));
      expect(byName.ALLOWED_ORIGINS).toEqual({
        name: 'ALLOWED_ORIGINS',
        value: 'miso-controller-host-public,miso-controller-host-internal',
        location: 'keyvault',
        required: true
      });
      expect(byName.MISO_ALLOWED_ORIGINS).toEqual({
        name: 'MISO_ALLOWED_ORIGINS',
        value: 'miso-controller-web-server-url,miso-controller-internal-server-url',
        location: 'keyvault',
        required: true
      });
    });

    it('preserves non-url:// segments in comma-separated url:// lists', () => {
      const template = 'ALLOWED_ORIGINS=url://host-public,http://localhost:*\n';
      const cfg = parseEnvironmentVariables(template, variablesConfig);
      expect(cfg.find((c) => c.name === 'ALLOWED_ORIGINS').value).toBe(
        'miso-controller-host-public,http://localhost:*'
      );
    });
  });
});
