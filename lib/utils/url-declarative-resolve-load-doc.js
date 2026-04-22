/**
 * Load application.yaml for url:// resolution (current app via variablesPath, else builder-relative).
 * @fileoverview
 */
'use strict';

const path = require('path');
const yaml = require('js-yaml');
const fsRealSync = require('../internal/fs-real-sync');

/**
 * @param {string} appKey
 * @param {Object} ctx
 * @param {object} pathsUtil - paths module (getProjectRoot)
 * @returns {object|null}
 */
function loadApplicationYamlDocForUrlResolve(appKey, ctx, pathsUtil) {
  try {
    const current = ctx.currentAppKey || '';
    if (appKey === current && ctx.variablesPath) {
      const vp = path.resolve(String(ctx.variablesPath));
      try {
        const raw = fsRealSync.readFileSync(vp, 'utf8');
        const doc = yaml.load(raw);
        if (doc && typeof doc === 'object') {
          return doc;
        }
      } catch {
        // Fall through to builder-relative resolution
      }
    }
    const root = pathsUtil.getProjectRoot();
    if (!root) {
      return null;
    }
    const cfgPath = path.resolve(path.join(root, 'builder', appKey, 'application.yaml'));
    try {
      const raw = fsRealSync.readFileSync(cfgPath, 'utf8');
      const doc = yaml.load(raw);
      return doc && typeof doc === 'object' ? doc : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

module.exports = {
  loadApplicationYamlDocForUrlResolve
};
