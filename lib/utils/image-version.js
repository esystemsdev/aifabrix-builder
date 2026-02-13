/**
 * AI Fabrix Builder - Image Version Resolution
 *
 * Resolves application version from Docker image (OCI label or semver tag).
 * When template is empty or image version is greater, uses image version.
 *
 * @fileoverview Image version resolution utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const { getBuilderPath } = require('./paths');
const { resolveApplicationConfigPath } = require('./app-config-resolver');
const { loadConfigFile, writeConfigFile } = require('./config-format');
const composeGenerator = require('./compose-generator');
const containerHelpers = require('./app-run-containers');

const execAsync = promisify(exec);

const OCI_VERSION_LABEL = 'org.opencontainers.image.version';
const SEMVER_REGEX = /^v?(\d+\.\d+\.\d+)(?:-[-.\w]+)?(?:\+[-.\w]+)?$/i;

/**
 * Gets version from Docker image via OCI label or semver tag
 * @async
 * @param {string} imageName - Image name (e.g. aifabrix/dataplane)
 * @param {string} imageTag - Image tag (e.g. v1.0.0, latest)
 * @returns {Promise<string|null>} Version string or null if not found
 */
async function getVersionFromImage(imageName, imageTag) {
  if (!imageName || typeof imageName !== 'string') {
    return null;
  }
  const tag = imageTag || 'latest';
  const fullImage = `${imageName}:${tag}`;

  try {
    const labelFormat = `{{index .Config.Labels "${OCI_VERSION_LABEL}"}}`;
    const { stdout } = await execAsync(
      `docker inspect --format '${labelFormat}' "${fullImage}" 2>/dev/null || true`,
      { timeout: 10000 }
    );
    const labelValue = (stdout || '').trim();
    if (labelValue && labelValue !== '<no value>') {
      return labelValue;
    }

    const tagMatch = tag.match(SEMVER_REGEX);
    if (tagMatch) {
      return tagMatch[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compares two semantic versions
 * @param {string} a - First version
 * @param {string} b - Second version
 * @returns {number} -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareSemver(a, b) {
  if (!a || !b) {
    return 0;
  }
  const parse = (v) => {
    const m = String(v).match(SEMVER_REGEX);
    if (!m) return null;
    const parts = m[1].split('.').map(Number);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
  return 0;
}

/**
 * Resolves version for external app (app.version or externalIntegration.version)
 * @param {Object} variables - Parsed application config
 * @returns {string}
 */
function resolveExternalVersion(variables) {
  const version =
    variables.app?.version ||
    variables.externalIntegration?.version ||
    '1.0.0';
  return String(version).trim() || '1.0.0';
}

/**
 * Resolves version for regular app when image exists
 * @async
 * @param {string} imageName - Image name
 * @param {string} imageTag - Image tag
 * @param {string} templateVersion - Template version (may be empty)
 * @returns {Promise<{ version: string, fromImage: boolean }>}
 */
async function resolveRegularVersion(imageName, imageTag, templateVersion) {
  const templateEmpty =
    templateVersion === undefined ||
    templateVersion === null ||
    String(templateVersion).trim() === '';
  const templateStr = String(templateVersion || '').trim();

  const imageVersion = await getVersionFromImage(imageName, imageTag);
  const useImage =
    imageVersion &&
    (templateEmpty || compareSemver(imageVersion, templateStr) >= 0);

  const version = useImage ? imageVersion : (templateEmpty ? '1.0.0' : templateStr);
  return { version, fromImage: Boolean(useImage) };
}

/**
 * Resolves version for an app: from image when image exists and template empty or smaller
 * @async
 * @param {string} appName - Application name
 * @param {Object} variables - Parsed application config
 * @param {Object} [options] - Options
 * @param {boolean} [options.updateBuilder] - When true, update builder application config if fromImage
 * @param {string} [options.builderPath] - Builder path (defaults to getBuilderPath(appName))
 * @returns {Promise<{ version: string, fromImage: boolean, updated: boolean }>}
 */
async function resolveVersionForApp(appName, variables, options = {}) {
  if (!appName || typeof appName !== 'string') {
    return { version: '1.0.0', fromImage: false, updated: false };
  }

  if (variables?.externalIntegration) {
    const version = resolveExternalVersion(variables);
    return { version, fromImage: false, updated: false };
  }

  const imageName = composeGenerator.getImageName(variables, appName);
  const imageTag = variables?.image?.tag || 'latest';
  const imageExists = await containerHelpers.checkImageExists(imageName, imageTag);

  if (!imageExists) {
    const templateVersion = variables?.app?.version;
    const templateEmpty =
      templateVersion === undefined ||
      templateVersion === null ||
      String(templateVersion).trim() === '';
    const fallback = templateEmpty ? '1.0.0' : String(templateVersion).trim();
    return { version: fallback, fromImage: false, updated: false };
  }

  const { version, fromImage } = await resolveRegularVersion(
    imageName,
    imageTag,
    variables?.app?.version
  );

  let updated = false;
  if (fromImage && options.updateBuilder) {
    const builderPath = options.builderPath || getBuilderPath(appName);
    updated = updateAppVersionInVariablesYaml(builderPath, version);
  }

  return { version, fromImage, updated };
}

/**
 * Updates app.version in builder application config
 * @param {string} builderPath - Path to builder app directory
 * @param {string} version - Version to set
 * @returns {boolean} True if file was updated
 */
function updateAppVersionInVariablesYaml(builderPath, version) {
  if (!builderPath || !version || typeof version !== 'string') {
    return false;
  }
  try {
    const configPath = resolveApplicationConfigPath(builderPath);
    const parsed = loadConfigFile(configPath) || {};
    if (!parsed.app) {
      parsed.app = {};
    }
    parsed.app.version = version;
    writeConfigFile(configPath, parsed);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getVersionFromImage,
  compareSemver,
  resolveVersionForApp,
  updateAppVersionInVariablesYaml
};
