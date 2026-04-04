/**
 * @fileoverview File watch + debounce for datasource validation CLI (plan §3.14).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('node:fs');
const path = require('path');
const chalk = require('chalk');
const logger = require('./logger');

const DEFAULT_DEBOUNCE_MS = 500;
const MAX_DIR_DEPTH = 14;

const SKIP_DIR_NAMES = new Set(['node_modules', '.git', 'dist', 'logs', '.turbo']);

/**
 * @param {Object|null|undefined} envelope
 * @returns {string}
 */
function fingerprintForWatchDiff(envelope) {
  if (!envelope || typeof envelope !== 'object') return '';
  const capList = (Array.isArray(envelope.capabilities) ? envelope.capabilities : [])
    .map(c =>
      c && c.key !== undefined && c.key !== null ? `${c.key}:${c.status}` : '?'
    )
    .sort()
    .join('|');
  const certSt = envelope.certificate && envelope.certificate.status;
  return `status=${envelope.status}|cert=${certSt || 'none'}|caps=${capList}`;
}

/**
 * @param {string|null} prev
 * @param {string} next
 * @param {boolean} fullDiff
 * @returns {string|null}
 */
function formatWatchFingerprintDiff(prev, next, fullDiff) {
  if (prev === null || prev === undefined || prev === next) return null;
  if (fullDiff) {
    return `Watch diff:\n  before: ${prev}\n  after:  ${next}`;
  }
  return `Watch diff: ${chalk.yellow(prev)} → ${chalk.green(next)}`;
}

/**
 * @param {string} root
 * @param {number} maxDepth
 * @param {number} depth
 * @returns {string[]}
 */
function listDirectoriesRecursive(root, maxDepth, depth = 0) {
  const out = [];
  if (depth > maxDepth || !fs.existsSync(root)) return out;
  let st;
  try {
    st = fs.statSync(root);
  } catch {
    return out;
  }
  if (!st.isDirectory()) {
    return [root];
  }
  out.push(root);
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (SKIP_DIR_NAMES.has(ent.name)) continue;
    if (ent.isDirectory()) {
      out.push(...listDirectoriesRecursive(path.join(root, ent.name), maxDepth, depth + 1));
    }
  }
  return out;
}

/**
 * @param {string} appKey
 * @param {string[]} [extraPaths]
 * @param {boolean} [includeApplicationYaml]
 * @returns {{ kind: 'file'|'dir', path: string }[]}
 */
function buildWatchTargetList(appKey, extraPaths = [], includeApplicationYaml = false) {
  const { getIntegrationPath } = require('./paths');
  const integrationRoot = getIntegrationPath(appKey);
  const seen = new Set();
  /** @type {{ kind: 'file'|'dir', path: string }[]} */
  const list = [];

  function addFile(abs) {
    if (!fs.existsSync(abs) || seen.has(abs)) return;
    seen.add(abs);
    list.push({ kind: 'file', path: abs });
  }

  function addDirTree(absRoot) {
    if (!fs.existsSync(absRoot)) return;
    const st = fs.statSync(absRoot);
    if (st.isFile()) {
      addFile(absRoot);
      return;
    }
    const dirs = listDirectoriesRecursive(absRoot, MAX_DIR_DEPTH);
    for (const d of dirs) {
      if (seen.has(d)) continue;
      seen.add(d);
      list.push({ kind: 'dir', path: d });
    }
  }

  addDirTree(integrationRoot);

  for (const p of extraPaths) {
    if (!p || typeof p !== 'string') continue;
    const abs = path.resolve(p.trim());
    if (!fs.existsSync(abs)) continue;
    const pst = fs.statSync(abs);
    if (pst.isFile()) {
      addFile(abs);
    } else {
      addDirTree(abs);
    }
  }

  if (includeApplicationYaml) {
    const y = path.join(integrationRoot, 'application.yaml');
    addFile(y);
  }

  return list;
}

/**
 * @param {() => void} fn
 * @param {number} ms
 * @returns {() => void}
 */
function debounce(fn, ms) {
  let t = null;
  return () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn();
    }, ms);
  };
}

/**
 * @param {{ kind: 'file'|'dir', path: string }[]} targets
 * @param {() => void} onEvent
 * @returns {() => void}
 */
function startWatchers(targets, onEvent) {
  const handles = [];
  for (const t of targets) {
    try {
      handles.push(fs.watch(t.path, () => onEvent()));
    } catch {
      // ignore unreadable paths
    }
  }
  return () => {
    for (const h of handles) {
      try {
        h.close();
      } catch {
        // ignore
      }
    }
  };
}

/**
 * @param {Object} opts
 * @param {string} opts.appKey
 * @param {string[]} [opts.extraPaths]
 * @param {boolean} [opts.includeApplicationYaml]
 * @param {number} [opts.debounceMs]
 * @param {boolean} [opts.watchCi]
 * @param {boolean} [opts.watchFullDiff]
 * @param {() => Promise<{ exitCode: number, envelope: Object|null }>} opts.runOnce
 * @returns {Promise<void>}
 */
async function runDatasourceValidationWatchLoop(opts) {
  const {
    appKey,
    extraPaths = [],
    includeApplicationYaml = false,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    watchCi = false,
    watchFullDiff = false,
    runOnce
  } = opts;

  const targets = buildWatchTargetList(appKey, extraPaths, includeApplicationYaml);
  if (targets.length === 0) {
    logger.warn(chalk.yellow('Watch: no directories or files to watch; check integration path.'));
    process.exit(4);
    return;
  }

  let prevFp = null;
  let running = false;

  const execute = async() => {
    if (running) return;
    running = true;
    try {
      logger.log(chalk.blue('\n[watch] Running validation…'));
      const { exitCode, envelope } = await runOnce();
      const fp = fingerprintForWatchDiff(envelope);
      const diffMsg = formatWatchFingerprintDiff(prevFp, fp, watchFullDiff);
      if (diffMsg) logger.log(diffMsg);
      prevFp = fp;
      if (watchCi) {
        process.exit(exitCode);
        return;
      }
      logger.log(chalk.gray(`[watch] exit code ${exitCode} — waiting for file changes (Ctrl+C to stop)`));
    } finally {
      running = false;
    }
  };

  await execute();

  // In production, watchCi triggers process.exit inside execute; with a mocked exit (tests),
  // still skip watcher setup so the async function can finish and no duplicate runs occur.
  if (watchCi) {
    return;
  }

  const onFs = debounce(execute, debounceMs);
  const closeAll = startWatchers(targets, onFs);

  const onSig = () => {
    closeAll();
    process.exit(130);
  };
  process.on('SIGINT', onSig);
  process.on('SIGTERM', onSig);
}

module.exports = {
  DEFAULT_DEBOUNCE_MS,
  fingerprintForWatchDiff,
  formatWatchFingerprintDiff,
  buildWatchTargetList,
  debounce,
  startWatchers,
  runDatasourceValidationWatchLoop
};
