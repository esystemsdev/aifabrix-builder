/**
 * @fileoverview Renders real compose.yaml.hbs to verify Traefik forwarded-headers CLI args (plan 018)
 */

// compose.test.js mocks `fs` in the same Jest worker; always read the real template from disk.
jest.unmock('fs');

const path = require('path');
const fs = jest.requireActual('fs');
const handlebars = require('handlebars');
const { registerHandlebarsHelper } = require('../../../lib/infrastructure/helpers');

describe('compose.yaml.hbs Traefik forwarded headers', () => {
  const tplPath = path.join(__dirname, '../../../templates/infra/compose.yaml.hbs');

  function baseContext(traefikOverrides) {
    return {
      devId: '1',
      postgresPort: 5532,
      redisPort: 6479,
      pgadminPort: 5150,
      redisCommanderPort: 8181,
      traefikHttpPort: 180,
      traefikHttpsPort: 443,
      networkName: 'infra-dev1-aifabrix-network',
      serversJsonPath: '/tmp/servers.json',
      serversJsonBind: '/tmp/servers.json',
      pgpassPath: '/tmp/pgpass',
      infraDir: '/tmp/infra',
      initScriptsBind: '/tmp/init',
      pgadmin: { enabled: false },
      redisCommander: { enabled: false },
      traefik: {
        enabled: true,
        certStore: null,
        certFile: null,
        keyFile: null,
        trustForwardedHeaders: false,
        ...traefikOverrides
      }
    };
  }

  function render(traefikPartial) {
    registerHandlebarsHelper();
    const raw = fs.readFileSync(tplPath, 'utf8');
    const tpl = handlebars.compile(raw);
    return tpl(baseContext(traefikPartial));
  }

  it('includes entrypoints.web.forwardedHeaders.insecure when traefik.trustForwardedHeaders is true', () => {
    const yaml = render({ trustForwardedHeaders: true });
    expect(yaml).toContain('forwardedHeaders.insecure=true');
  });

  it('omits forwardedHeaders.insecure when traefik.trustForwardedHeaders is false', () => {
    const yaml = render({ trustForwardedHeaders: false });
    expect(yaml).not.toContain('forwardedHeaders.insecure');
  });

  it('includes providers.docker.allowEmptyServices for local dev routing during Docker health start', () => {
    const yaml = render({ trustForwardedHeaders: false });
    expect(yaml).toContain('--providers.docker.allowEmptyServices=true');
  });

  it('includes MASTER_PASSWORD_REQUIRED=False when pgAdmin is enabled (Docker has no OS keyring)', () => {
    registerHandlebarsHelper();
    const raw = fs.readFileSync(tplPath, 'utf8');
    const tpl = handlebars.compile(raw);
    const ctx = baseContext({ trustForwardedHeaders: false });
    ctx.pgadmin = { enabled: true, pgpassBootstrapBind: '/tmp/.pgpass.bootstrap' };
    const yaml = tpl(ctx);
    expect(yaml).toContain('PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED');
    expect(yaml).toContain('\'False\'');
  });

  it('includes DESKTOP_USER bound to PGADMIN_DEFAULT_EMAIL when pgAdmin is enabled', () => {
    registerHandlebarsHelper();
    const raw = fs.readFileSync(tplPath, 'utf8');
    const tpl = handlebars.compile(raw);
    const ctx = baseContext({ trustForwardedHeaders: false });
    ctx.pgadmin = { enabled: true, pgpassBootstrapBind: '/tmp/.pgpass.bootstrap' };
    const yaml = tpl(ctx);
    expect(yaml).toContain('PGADMIN_CONFIG_DESKTOP_USER');
    expect(yaml).toContain('\'${PGADMIN_DEFAULT_EMAIL}\'');
  });
});
