/**
 * Load application.yaml for url:// resolution (current app via variablesPath, else builder-relative).
 * @fileoverview
 */
'use strict';

const path = require('path');
const yaml = require('js-yaml');
const fsRealSync = require('../internal/fs-real-sync');

/**
 * @param {string} cfgPath
 * @returns {object|null}
 */
function tryReadApplicationYamlAt(cfgPath) {
  try {
    if (!fsRealSync.existsSync(cfgPath)) {
      return null;
    }
    const raw = fsRealSync.readFileSync(cfgPath, 'utf8');
    const doc = yaml.load(raw);
    return doc && typeof doc === 'object' ? doc : null;
  } catch {
    return null;
  }
}

/**
 * Prefer projectRoot/builder (fixtures, tests); then {@link pathsUtil.getBuilderPath} (global npm).
 * @param {string} appKey
 * @param {object} pathsUtil
 * @returns {string[]}
 */
function collectApplicationYamlPathsForUrlResolve(appKey, pathsUtil) {
  const list = [];
  const root = pathsUtil.getProjectRoot();
  if (root) {
    list.push(path.resolve(path.join(root, 'builder', appKey, 'application.yaml')));
  }
  try {
    const viaBuilder = path.resolve(path.join(pathsUtil.getBuilderPath(appKey), 'application.yaml'));
    if (!list.length || path.resolve(list[0]) !== viaBuilder) {
      list.push(viaBuilder);
    }
  } catch {
    /* ignore getBuilderPath errors */
  }
  return list;
}

/**
 * @param {string} appKey
 * @param {Object} ctx
 * @param {object} pathsUtil - paths module (getProjectRoot, getBuilderPath)
 * @returns {object|null}
 */
function loadApplicationYamlDocForUrlResolve(appKey, ctx, pathsUtil) {
  try {
    const current = ctx.currentAppKey || '';
    if (appKey === current && ctx.variablesPath) {
      const vp = path.resolve(String(ctx.variablesPath));
      const fromVars = tryReadApplicationYamlAt(vp);
      if (fromVars) {
        return fromVars;
      }
    }
    for (const cfgPath of collectApplicationYamlPathsForUrlResolve(appKey, pathsUtil)) {
      const doc = tryReadApplicationYamlAt(cfgPath);
      if (doc) {
        return doc;
      }
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  loadApplicationYamlDocForUrlResolve
};
