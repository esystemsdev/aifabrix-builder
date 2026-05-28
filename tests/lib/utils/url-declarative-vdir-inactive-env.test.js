/**
 * @fileoverview Tests for inactive vdir-public env rewrite (path inactive → "/", no schema keys)
 */

'use strict';

// Default project shares workers with suites that mock `fs` / `fs-real-sync`; keep real I/O unambiguous.
jest.unmock('fs');
jest.unmock('node:fs');

const fsp = jest.requireActual('fs').promises;
const path = require('path');
const os = require('os');

const {
  URL_DECLARATIVE_VDIR_PUBLIC_TOKEN,
  INACTIVE_VDIR_PUBLIC_ENV_FALLBACK,
  rewriteInactiveDeclarativeVdirPublicContent
} = require('../../../lib/utils/url-declarative-vdir-inactive-env');

describe('url-declarative-vdir-inactive-env', () => {
  it('exports declarative token aligned with url-declarative-resolve-build', () => {
    expect(URL_DECLARATIVE_VDIR_PUBLIC_TOKEN).toBe('url://vdir-public');
    expect(INACTIVE_VDIR_PUBLIC_ENV_FALLBACK).toBe('/');
  });

  describe('rewriteInactiveDeclarativeVdirPublicContent', () => {
    let tmpDir;
    let variablesPath;

    beforeEach(async() => {
      tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aifx-vdir-'));
      variablesPath = path.join(tmpDir, 'application.yaml');
    });

    afterEach(async() => {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    });

    it('rewrites DATAPLANE_RELATIVE_PATH when path inactive and app.key is dataplane', async() => {
      await fsp.writeFile(
        variablesPath,
        `app:
  key: dataplane
port: 3001
frontDoorRouting:
  pattern: /data/*
`,
        'utf8'
      );
      const content = `DATAPLANE_RELATIVE_PATH=${URL_DECLARATIVE_VDIR_PUBLIC_TOKEN}\n`;
      const out = rewriteInactiveDeclarativeVdirPublicContent(content, variablesPath, { traefik: false });
      expect(out).toBe(`DATAPLANE_RELATIVE_PATH=${INACTIVE_VDIR_PUBLIC_ENV_FALLBACK}\n`);
    });

    it('rewrites MYAPP_RELATIVE_PATH when path inactive and app.key is myapp', async() => {
      await fsp.writeFile(
        variablesPath,
        `app:
  key: myapp
port: 3001
`,
        'utf8'
      );
      const content = `MYAPP_RELATIVE_PATH=${URL_DECLARATIVE_VDIR_PUBLIC_TOKEN}\n`;
      const out = rewriteInactiveDeclarativeVdirPublicContent(content, variablesPath, { traefik: false });
      expect(out).toBe(`MYAPP_RELATIVE_PATH=${INACTIVE_VDIR_PUBLIC_ENV_FALLBACK}\n`);
    });

    it('does not rewrite unrelated keys when path inactive', async() => {
      await fsp.writeFile(
        variablesPath,
        `app:
  key: dataplane
port: 3001
`,
        'utf8'
      );
      const content = `FOO=${URL_DECLARATIVE_VDIR_PUBLIC_TOKEN}\n`;
      const out = rewriteInactiveDeclarativeVdirPublicContent(content, variablesPath, { traefik: false });
      expect(out).toBe(content);
    });

    it('does not rewrite when traefik and frontDoorRouting.enabled are true', async() => {
      await fsp.writeFile(
        variablesPath,
        `app:
  key: dataplane
port: 8082
frontDoorRouting:
  pattern: /auth/*
  enabled: true
`,
        'utf8'
      );
      const content = `DATAPLANE_RELATIVE_PATH=${URL_DECLARATIVE_VDIR_PUBLIC_TOKEN}\n`;
      const out = rewriteInactiveDeclarativeVdirPublicContent(content, variablesPath, { traefik: true });
      expect(out).toBe(content);
    });

    it('still rewrites KC_HTTP_RELATIVE_PATH when traefik on but front door disabled', async() => {
      await fsp.writeFile(
        variablesPath,
        `app:
  key: keycloak
port: 8082
frontDoorRouting:
  pattern: /auth/*
`,
        'utf8'
      );
      const content = `KC_HTTP_RELATIVE_PATH=${URL_DECLARATIVE_VDIR_PUBLIC_TOKEN}\n`;
      const out = rewriteInactiveDeclarativeVdirPublicContent(content, variablesPath, { traefik: true });
      expect(out).toBe(`KC_HTTP_RELATIVE_PATH=${INACTIVE_VDIR_PUBLIC_ENV_FALLBACK}\n`);
    });
  });
});
