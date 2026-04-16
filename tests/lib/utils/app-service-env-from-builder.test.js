/**
 * @fileoverview Plan 126 — app *_HOST / *_PORT from builder manifests
 */

'use strict';

jest.unmock('fs');
jest.unmock('node:fs');

const fs = jest.requireActual('fs');
const path = require('path');
const os = require('os');

const {
  buildAppServiceEnvOverlay,
  localWorkstationPortsForDoc,
  manifestPortOrNull
} = require('../../../lib/utils/app-service-env-from-builder');

describe('app-service-env-from-builder', () => {
  function withTempProject(layoutFn) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aifb-app-svc-env-'));
    try {
      layoutFn(tmp);
      return tmp;
    } catch (e) {
      fs.rmSync(tmp, { recursive: true, force: true });
      throw e;
    }
  }

  it('buildAppServiceEnvOverlay skips missing builder/', () => {
    const tmp = withTempProject(() => {});
    try {
      expect(buildAppServiceEnvOverlay(tmp)).toEqual({ docker: {}, local: {} });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('maps dataplane application.yaml port into overlay', () => {
    const tmp = withTempProject((root) => {
      const appDir = path.join(root, 'builder', 'dataplane');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, 'application.yaml'),
        'app:\n  key: dataplane\nport: 9999\n',
        'utf8'
      );
    });
    try {
      const o = buildAppServiceEnvOverlay(tmp);
      expect(o.docker.DATAPLANE_HOST).toBe('dataplane');
      expect(o.docker.DATAPLANE_PORT).toBe(9999);
      expect(o.docker.DATAPLANE_PUBLIC_PORT).toBe(9999);
      expect(o.local.DATAPLANE_HOST).toBe('localhost');
      expect(o.local.DATAPLANE_PORT).toBe(10009);
      expect(o.local.DATAPLANE_PUBLIC_PORT).toBe(10009);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('uses containerPort for docker *_PORT when split from manifest port', () => {
    const tmp = withTempProject((root) => {
      const appDir = path.join(root, 'builder', 'keycloak');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, 'application.yaml'),
        'app:\n  key: keycloak\nport: 8082\nbuild:\n  containerPort: 8080\n',
        'utf8'
      );
    });
    try {
      const o = buildAppServiceEnvOverlay(tmp);
      expect(o.docker.KEYCLOAK_PORT).toBe(8080);
      expect(o.docker.KEYCLOAK_PUBLIC_PORT).toBe(8082);
      expect(o.local.KEYCLOAK_PORT).toBe(8082);
      expect(o.local.KEYCLOAK_PUBLIC_PORT).toBe(8082);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('manifestPortOrNull accepts numeric string port', () => {
    expect(manifestPortOrNull({ port: '3001' })).toBe(3001);
  });

  it('localWorkstationPortsForDoc uses manifest when published differs from container', () => {
    const doc = { port: 8082, build: { containerPort: 8080 } };
    expect(localWorkstationPortsForDoc(doc)).toEqual({ port: 8082, publicPort: 8082 });
  });
});
