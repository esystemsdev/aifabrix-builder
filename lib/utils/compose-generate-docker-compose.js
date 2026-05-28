/**
 * Docker Compose file generation (extracted from compose-generator).
 *
 * @fileoverview Satisfies ESLint max-lines / max-lines-per-function on compose-generator
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fsSync = require('fs');
const path = require('path');
const buildCopy = require('./build-copy');
const paths = require('./paths');
const { getInfraDirName } = require('../infrastructure/helpers');
const { resolveMisoEnvironment } = require('./compose-miso-env');

/**
 * When running a pulled Python image (no bind-mounted source), the image CMD may invoke the
 * `uvicorn` console script, which is not always on PATH. Derive a `python -m uvicorn` command from
 * `build.reloadStart` so generated compose matches the same app entrypoint as hot-reload runs.
 *
 * @param {string|undefined} reloadStart - Value from application.yaml `build.reloadStart`
 * @returns {string|null} Shell command fragment (no `cd`, no `exec`; image compose prepends `exec ` in JS)
 */
function derivePythonImageStartFromReload(reloadStart) {
  if (typeof reloadStart !== 'string' || !reloadStart.trim()) {
    return null;
  }
  const trimmed = reloadStart.trim().replace(/\s+--reload\b/g, '').trim();
  if (/^python3?\s+-m\s+uvicorn\s+/i.test(trimmed)) {
    return normalizeComposeShellPortRef(trimmed);
  }
  if (trimmed.startsWith('uvicorn ')) {
    const rest = trimmed.slice('uvicorn '.length);
    return normalizeComposeShellPortRef(`python -m uvicorn ${rest}`);
  }
  return null;
}

/**
 * Compose sets `PORT` in the service environment; replace `${PORT:-...}` with `$$PORT` in the
 * fragment so the compose file avoids ambiguous `:` parsing in flow scalars and Compose expands
 * `$$` to `$` for the container shell (which then expands `PORT` from the service environment).
 *
 * @param {string} cmd - Shell command fragment
 * @returns {string} Same fragment with `${PORT:-...}` replaced by `$$PORT` (Compose escapes `$$` → `$` for the shell)
 */
function normalizeComposeShellPortRef(cmd) {
  return cmd.replace(/\$\{PORT:-[^}]+\}/g, () => '$$PORT');
}

/**
 * Normalizes `build.reloadStart` for Python when using a bind-mounted source in compose.
 *
 * @param {string} raw - Trimmed reload command
 * @returns {string} Command suitable for `cd /app && …` in compose
 */
function normalizePythonReloadForComposeMounted(raw) {
  const s = normalizeComposeShellPortRef(raw);
  if (/^python3?\s+-m\s+uvicorn\s+/i.test(s)) {
    return s;
  }
  const envPrefixed = s.match(/^((?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*)(uvicorn\s+.*)$/);
  if (envPrefixed) {
    return `${envPrefixed[1]}python -m uvicorn ${envPrefixed[2].slice('uvicorn '.length)}`;
  }
  if (s.startsWith('uvicorn ')) {
    return `python -m uvicorn ${s.slice('uvicorn '.length)}`;
  }
  return s;
}

/**
 * Builds the single `reloadStartCommand` passed to compose templates (`command: …` when set).
 *
 * `applications.<app>.reload` in config.yaml (and `aifabrix run --reload`) only controls **bind-mount +
 * `--reload`** via `devMountPath`. For pulled images without a mount, use optional `build.imageRun` in
 * application.yaml, or (Python only) derive from `build.reloadStart` when `imageRun` is unset.
 *
 * @param {string} language - `application.yaml` build.language
 * @param {string|null} devMountPath - Bind mount path when reload sync is active
 * @param {string|undefined} reloadRaw - `build.reloadStart`
 * @param {Object} [build] - `application.yaml` `build` object (`imageRun`, etc.)
 * @returns {string|null}
 */
function buildReloadStartCommandForCompose(language, devMountPath, reloadRaw, build = {}) {
  const buildObj = build && typeof build === 'object' ? build : {};
  const imageRunRaw = typeof buildObj.imageRun === 'string' ? buildObj.imageRun.trim() : '';
  const reloadTrimmed = typeof reloadRaw === 'string' ? reloadRaw.trim() : '';

  if (devMountPath) {
    if (!reloadTrimmed) {
      return null;
    }
    return language === 'python' ? normalizePythonReloadForComposeMounted(reloadTrimmed) : reloadTrimmed;
  }

  if (imageRunRaw) {
    return normalizeComposeShellPortRef(imageRunRaw);
  }

  if (!reloadTrimmed) {
    return null;
  }

  if (language === 'python') {
    const imageCmd = derivePythonImageStartFromReload(reloadTrimmed);
    return imageCmd ? `exec ${imageCmd}` : null;
  }

  return null;
}

/**
 * Resolve infra `pgpass` path: prefer system config dir; when home differs, allow legacy layout.
 * @param {string|number} devId - Developer id (infra vs infra-dev{n})
 * @param {{ getAifabrixSystemDir: Function, getAifabrixHome: Function }} pathsUtil - paths module
 * @param {(filePath: string) => boolean} [existsSyncFn] - sync existence check (default: fs.existsSync)
 * @returns {string} Candidate pgpass path (may not exist)
 */
function resolveInfraPgpassPath(devId, pathsUtil, existsSyncFn = fsSync.existsSync) {
  const infraName = getInfraDirName(devId);
  const sysPgpass = path.join(pathsUtil.getAifabrixSystemDir(), infraName, 'pgpass');
  const legPgpass = path.join(pathsUtil.getAifabrixHome(), infraName, 'pgpass');
  return existsSyncFn(sysPgpass) || pathsUtil.getAifabrixHome() === pathsUtil.getAifabrixSystemDir()
    ? sysPgpass
    : existsSyncFn(legPgpass)
      ? legPgpass
      : sysPgpass;
}

/**
 * @param {object} ctx - Template context fields
 * @returns {object} Spread-ready payload for Handlebars template
 */
function buildComposeTemplateContext(ctx) {
  return {
    ...ctx.serviceConfig,
    ...ctx.volumesConfig,
    ...ctx.networksConfig,
    envFile: ctx.envFileAbsolutePath,
    dbInitEnvFile: ctx.dbInitEnvFileAbsolutePath,
    databasePasswords: ctx.databasePasswords,
    devId: ctx.idNum,
    networkName: ctx.networkName,
    containerName: ctx.containerName,
    misoEnvironment: resolveMisoEnvironment(ctx.options),
    devMountPath: ctx.devMountPath,
    reloadStartCommand: ctx.reloadStartCommand,
    infraPgpassPath: ctx.useInfraPgpass ? ctx.infraPgpassPath : null,
    useInfraPgpass: !!ctx.useInfraPgpass
  };
}

/**
 * @param {Object} options - Run options
 * @returns {{ scoped: object|null }}
 */
function resolveScopedComposeOpts(options) {
  const runEnvKey = options.env ? String(options.env).toLowerCase() : 'dev';
  const scopeOpts = {
    effectiveEnvironmentScopedResources: options.effectiveEnvironmentScopedResources === true,
    runEnvKey
  };
  const useScope =
    scopeOpts.effectiveEnvironmentScopedResources && (runEnvKey === 'dev' || runEnvKey === 'tst');
  return { scoped: useScope ? scopeOpts : null };
}

function resolveDevMountPath(options) {
  return options.devMountPath && typeof options.devMountPath === 'string' ? options.devMountPath.trim() : null;
}

function resolveEnvFilePath(options, devDir) {
  const envFilePath =
    options.envFilePath && typeof options.envFilePath === 'string'
      ? path.resolve(options.envFilePath)
      : path.join(devDir, '.env');
  return envFilePath.replace(/\\/g, '/');
}

async function readDatabasePasswordsIfNeeded(readDatabasePasswords, requiresDatabase, databases, envPath, appName) {
  if (requiresDatabase || databases.length > 0) {
    return await readDatabasePasswords(envPath, databases, appName);
  }
  return { map: {}, array: [] };
}

/**
 * @param {object} deps
 * @param {string} appName
 * @param {object} appConfig
 * @param {object} options
 * @returns {Promise<object>}
 */
async function loadComposeHead(deps, appName, appConfig, options) {
  const { loadDockerComposeTemplate, resolveComposeImageOverrideString, getDeveloperIdAndNumeric, getRemoteServerForCompose } = deps;
  const language = appConfig.build?.language || appConfig.language || 'typescript';
  const template = loadDockerComposeTemplate(language);
  const port = options.port || appConfig.port || 3000;
  const imageOverride = resolveComposeImageOverrideString(appName, appConfig, options);
  const { devId, idNum } = await getDeveloperIdAndNumeric();
  const { scoped } = resolveScopedComposeOpts(options);
  let remoteServer = null;
  if (typeof getRemoteServerForCompose === 'function') {
    remoteServer = await getRemoteServerForCompose();
  }
  return { template, port, imageOverride, devId, idNum, scoped, remoteServer };
}

/**
 * @param {object} deps
 * @param {string} appName
 * @param {object} appConfig
 * @param {object} head - From loadComposeHead
 * @returns {object}
 */
function buildComposeLayouts(deps, appName, appConfig, head, options) {
  const { buildNetworkAndContainerNames, buildServiceConfig, buildVolumesConfig, buildNetworksConfig } = deps;
  const { port, imageOverride, devId, idNum, scoped, remoteServer } = head;
  const { networkName, containerName } = buildNetworkAndContainerNames(appName, devId, idNum, scoped);
  const serviceConfig = buildServiceConfig(appName, appConfig, port, devId, {
    imageOverride,
    scopeOpts: scoped,
    remoteServer,
    omitAppTraefikLabels: options && options.omitAppTraefikLabels === true
  });
  const volumesConfig = buildVolumesConfig(appName);
  const networksConfig = buildNetworksConfig(appConfig);
  return { networkName, containerName, serviceConfig, volumesConfig, networksConfig };
}

/**
 * @param {object} ctx
 * @param {object} ctx.options - Run options
 * @param {string} ctx.appName
 * @param {string|number} ctx.devId
 * @param {object} ctx.appConfig
 * @param {object} ctx.serviceCf - serviceConfig from layouts
 * @param {object} ctx.networksCf - networksConfig from layouts
 * @param {Function} ctx.readDatabasePasswords
 * @returns {Promise<object>}
 */
async function resolveComposePathsAndSecrets(ctx) {
  const { options, appName, devId, appConfig, serviceCf, networksCf, readDatabasePasswords } = ctx;
  const devDir = buildCopy.getDevDirectory(appName, devId);
  const envFileAbsolutePath = resolveEnvFilePath(options, devDir);
  const dbInitEnvFileAbsolutePath =
    options.dbInitEnvFilePath && typeof options.dbInitEnvFilePath === 'string'
      ? path.resolve(options.dbInitEnvFilePath).replace(/\\/g, '/')
      : null;
  const databasePasswords = await readDatabasePasswordsIfNeeded(
    readDatabasePasswords,
    serviceCf.requiresDatabase || false,
    networksCf.databases || [],
    envFileAbsolutePath,
    appName
  );
  const devMountPath = resolveDevMountPath(options);
  const reloadRaw = appConfig.build?.reloadStart;
  const language = appConfig.build?.language || appConfig.language || 'typescript';
  const reloadStartCommand = buildReloadStartCommandForCompose(
    language,
    devMountPath,
    reloadRaw,
    appConfig.build
  );
  const infraPgpassPath = resolveInfraPgpassPath(devId, paths, fsSync.existsSync);
  const useInfraPgpass = serviceCf.requiresDatabase && fsSync.existsSync(infraPgpassPath);
  return {
    envFileAbsolutePath,
    dbInitEnvFileAbsolutePath,
    databasePasswords,
    devMountPath,
    reloadStartCommand,
    infraPgpassPath,
    useInfraPgpass
  };
}

/**
 * @param {object} deps
 * @param {string} appName
 * @param {object} appConfig
 * @param {object} options
 * @returns {Promise<string>}
 */
async function generateDockerComposeImpl(deps, appName, appConfig, options) {
  const head = await loadComposeHead(deps, appName, appConfig, options);
  const layouts = buildComposeLayouts(deps, appName, appConfig, head, options);
  const side = await resolveComposePathsAndSecrets({
    options,
    appName,
    devId: head.devId,
    appConfig,
    serviceCf: layouts.serviceConfig,
    networksCf: layouts.networksConfig,
    readDatabasePasswords: deps.readDatabasePasswords
  });
  return head.template(
    buildComposeTemplateContext({
      ...layouts,
      ...side,
      idNum: head.idNum,
      options
    })
  );
}

/**
 * @param {object} deps - Functions from compose-generator
 * @returns {Function} async generateDockerCompose(appName, appConfig, options)
 */
function createGenerateDockerCompose(deps) {
  return (appName, appConfig, options) => generateDockerComposeImpl(deps, appName, appConfig, options);
}

module.exports = {
  createGenerateDockerCompose,
  resolveInfraPgpassPath,
  derivePythonImageStartFromReload,
  buildReloadStartCommandForCompose,
  normalizePythonReloadForComposeMounted
};
