/**
 * @fileoverview Contract: shipped application.yaml front-door paths align with nginx → Traefik docs (plan 018 frontdoor-paths).
 * Miso: /miso/*; Dataplane: /data/* with optional /dev|/tst prefix when env-scoped resources apply.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const projectRoot = path.resolve(__dirname, '..', '..', '..');

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
