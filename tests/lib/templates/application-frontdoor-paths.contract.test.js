/**
 * @fileoverview Contract: shipped application.yaml front-door paths align with nginx → Traefik docs (plan 018 frontdoor-paths).
 * Miso: /miso/*; Dataplane: /data/* with optional /dev|/tst prefix when env-scoped resources apply.
 */

'use strict';

// Real fs: other suites jest.mock('fs') with existsSync always true; that would fake a marker under tests/ and break repo root.
const fs = jest.requireActual('node:fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Repo root for shipped app YAML under templates/applications (each app folder has application.yaml).
 * global.PROJECT_ROOT can be wrong (e.g. tests/); only trust it when the miso-controller marker exists there.
 */
function resolveRepoRootForShippedApplicationTemplates() {
  const misoRel = path.join('templates', 'applications', 'miso-controller', 'application.yaml');
  const fromGlobal =
    global.PROJECT_ROOT && typeof global.PROJECT_ROOT === 'string'
      ? path.resolve(global.PROJECT_ROOT.trim())
      : null;
  if (fromGlobal && fs.existsSync(path.join(fromGlobal, misoRel))) {
    return fromGlobal;
  }
  let dir = path.resolve(__dirname);
  for (let i = 0; i < 24; i++) {
    if (fs.existsSync(path.join(dir, misoRel))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error(
    `Could not find shipped ${misoRel} (checked PROJECT_ROOT and parents of ${__dirname})`
  );
}

const projectRoot = resolveRepoRootForShippedApplicationTemplates();

function loadAppYaml(relativeUnderTemplates) {
  const p = path.join(projectRoot, 'templates', 'applications', relativeUnderTemplates, 'application.yaml');
  if (!fs.existsSync(p)) {
    throw new Error(`Missing template: ${p}`);
  }
  return yaml.load(fs.readFileSync(p, 'utf8'));
}

describe('application.yaml front-door path contract (shipped templates)', () => {
  it('miso-controller uses /miso/* and does not enable environmentScopedResources', () => {
    const doc = loadAppYaml('miso-controller');
    expect(doc.app && doc.app.key).toBe('miso-controller');
    expect(doc.frontDoorRouting && doc.frontDoorRouting.enabled).toBe(true);
    expect(doc.frontDoorRouting.pattern).toBe('/miso/*');
    expect(doc.environmentScopedResources).not.toBe(true);
  });

  it('keycloak uses /auth/* for Traefik PathPrefix (IdP vdir)', () => {
    const doc = loadAppYaml('keycloak');
    expect(doc.app && doc.app.key).toBe('keycloak');
    expect(doc.frontDoorRouting && doc.frontDoorRouting.enabled).toBe(true);
    expect(doc.frontDoorRouting.pattern).toBe('/auth/*');
    expect(doc.environmentScopedResources).not.toBe(true);
  });

  it('dataplane uses /data/* and enables environmentScopedResources for dev|tst path prefixing', () => {
    const doc = loadAppYaml('dataplane');
    expect(doc.app && doc.app.key).toBe('dataplane');
    expect(doc.frontDoorRouting && doc.frontDoorRouting.enabled).toBe(true);
    expect(doc.frontDoorRouting.pattern).toBe('/data/*');
    expect(doc.environmentScopedResources).toBe(true);
  });
});
