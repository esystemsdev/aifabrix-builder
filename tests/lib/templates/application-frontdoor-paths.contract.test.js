/**
 * @fileoverview Contract: shipped application.yaml front-door paths align with nginx → Traefik docs (plan 018 frontdoor-paths).
 * Miso: /miso/*; Dataplane: /data/* with optional /dev|/tst prefix when env-scoped resources apply.
 */

'use strict';

// Real fs: other suites jest.mock('fs') with existsSync always true; that would fake a marker under tests/ and break repo root.
const fs = jest.requireActual('node:fs');
const path = require('path');
// Real js-yaml: other suites jest.mock('js-yaml', () => ({ load: () => ({}) })); must not yield empty docs here.
const yaml = jest.requireActual('js-yaml');

/**
 * Repo root for shipped app YAML under templates/applications (each app folder has application.yaml).
 * global.PROJECT_ROOT can be wrong (e.g. tests/); only trust it when the miso-controller marker exists there.
 * Also checks process.cwd() and an explicit path from this file (tests/lib/templates → three levels up): linked
 * or global installs can leave __dirname under node_modules so parent-walk never reaches the real repo.
 */
function resolveRepoRootForShippedApplicationTemplates() {
  const misoRel = path.join('templates', 'applications', 'miso-controller', 'application.yaml');
  const misoAbs = (root) => path.join(root, misoRel);

  /**
   * Require package.json at the candidate root so we never treat `tests/` (or any folder that only
   * mirrors `templates/…`) as the repo root when global.PROJECT_ROOT is wrong — see platform-env
   * contract tests and paths that pointed at tests/.
   */
  function isShippedTemplatesRoot(root) {
    const r = path.resolve(root);
    return fs.existsSync(path.join(r, 'package.json')) && fs.existsSync(misoAbs(r));
  }

  // This file lives at <repo>/tests/lib/templates/ → repo root is three levels up. Prefer this
  // before global.PROJECT_ROOT so mutated/wrong PROJECT_ROOT cannot win over the real checkout.
  const explicitRepo = path.resolve(__dirname, '..', '..', '..');
  if (isShippedTemplatesRoot(explicitRepo)) {
    return explicitRepo;
  }

  const cwd = path.resolve(process.cwd());
  if (isShippedTemplatesRoot(cwd)) {
    return cwd;
  }

  function walkUp(startDir) {
    let dir = path.resolve(startDir);
    for (let i = 0; i < 24; i++) {
      if (isShippedTemplatesRoot(dir)) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
    return null;
  }

  const fromCwdWalk = walkUp(cwd);
  if (fromCwdWalk) {
    return fromCwdWalk;
  }

  const fromDirnameWalk = walkUp(__dirname);
  if (fromDirnameWalk) {
    return fromDirnameWalk;
  }

  const fromGlobal =
    global.PROJECT_ROOT && typeof global.PROJECT_ROOT === 'string'
      ? path.resolve(global.PROJECT_ROOT.trim())
      : null;
  if (fromGlobal && isShippedTemplatesRoot(fromGlobal)) {
    return fromGlobal;
  }

  throw new Error(
    `Could not find shipped ${misoRel} next to package.json.\n` +
      `Tried: explicit ${explicitRepo}, cwd=${cwd}, parents of cwd / __dirname, ` +
      `PROJECT_ROOT=${fromGlobal || '(unset)'}.\n` +
      'Run tests from the aifabrix-builder repository root (where templates/applications exists), ' +
      'and ensure that path is in your checkout (not sparse-excluded).'
  );
}

let projectRoot;
try {
  projectRoot = resolveRepoRootForShippedApplicationTemplates();
} catch {
  projectRoot = null;
}

const describeContract = projectRoot ? describe : describe.skip;

describeContract('application.yaml front-door path contract (shipped templates)', () => {
  function loadAppYaml(relativeUnderTemplates) {
    const p = path.join(projectRoot, 'templates', 'applications', relativeUnderTemplates, 'application.yaml');
    if (!fs.existsSync(p)) {
      throw new Error(`Missing template: ${p}`);
    }
    return yaml.load(fs.readFileSync(p, 'utf8'));
  }

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
