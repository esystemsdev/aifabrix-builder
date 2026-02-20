/**
 * Mutagen binary auto-install: download from GitHub releases into ~/.aifabrix/bin/.
 * Per remote-docker.md: CLI installs Mutagen when missing; never rely on system PATH.
 *
 * @fileoverview Download and install Mutagen to AI Fabrix bin directory
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const { getAifabrixHome } = require('./paths');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const fsPromises = fs.promises;

const MUTAGEN_RELEASE_API = 'https://api.github.com/repos/mutagen-io/mutagen/releases/latest';

/**
 * Platform/arch to Mutagen asset basename (e.g. mutagen_linux_amd64).
 * @returns {string|null} Basename without version or extension, or null if unsupported
 */
function getPlatformAssetBasename() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32') {
    return arch === 'x64' ? 'mutagen_windows_amd64' : arch === 'arm64' ? 'mutagen_windows_arm64' : null;
  }
  if (platform === 'darwin') {
    return arch === 'x64' ? 'mutagen_darwin_amd64' : arch === 'arm64' ? 'mutagen_darwin_arm64' : null;
  }
  if (platform === 'linux') {
    if (arch === 'x64') return 'mutagen_linux_amd64';
    if (arch === 'arm64') return 'mutagen_linux_arm64';
    if (arch === 'arm') return 'mutagen_linux_arm';
    if (arch === 'ia32') return 'mutagen_linux_386';
  }
  return null;
}

/**
 * Fetch latest release info from GitHub API.
 * @returns {Promise<{ tagName: string, assets: Array<{ name: string, browser_download_url: string }> }>}
 * @throws {Error} If request fails or response is invalid
 */
function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const req = https.get(MUTAGEN_RELEASE_API, {
      headers: { 'User-Agent': 'aifabrix-builder-cli' }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API returned ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const tagName = data.tag_name;
          const assets = (data.assets || []).map(a => ({ name: a.name, browser_download_url: a.browser_download_url }));
          if (!tagName || !Array.isArray(assets)) {
            reject(new Error('Invalid GitHub release response'));
            return;
          }
          resolve({ tagName, assets });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(); reject(new Error('Request timeout'));
    });
  });
}

/**
 * Download URL to a file.
 * @param {string} url - Download URL
 * @param {string} destPath - Full path to write file
 * @param {(msg: string) => void} [log] - Optional progress logger
 * @returns {Promise<void>}
 */
function downloadToFile(url, destPath, log) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath, { flags: 'w' });
    const req = https.get(url, { headers: { 'User-Agent': 'aifabrix-builder-cli' } }, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`Download returned ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve());
      });
    });
    req.on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
    req.setTimeout(120000, () => {
      req.destroy(); reject(new Error('Download timeout'));
    });
    if (typeof log === 'function') log('Downloading Mutagen...');
  });
}

/**
 * Extract .tar.gz using system tar; find binary and copy to destPath.
 * Mutagen tarballs may have binary at root or inside a single top-level directory.
 * @param {string} archivePath - Path to .tar.gz
 * @param {string} destPath - Final binary path
 * @param {string} binaryName - mutagen or mutagen.exe
 */
async function extractAndInstall(archivePath, destPath, binaryName) {
  const tmpDir = path.join(path.dirname(archivePath), `mutagen-extract-${Date.now()}`);
  await fsPromises.mkdir(tmpDir, { recursive: true });
  try {
    await execAsync(`tar -xzf "${archivePath}" -C "${tmpDir}"`, { timeout: 60000 });
    let sourcePath = path.join(tmpDir, binaryName);
    if (!fs.existsSync(sourcePath)) {
      const entries = await fsPromises.readdir(tmpDir, { withFileTypes: true });
      const sub = entries.length === 1 && entries[0].isDirectory() ? path.join(tmpDir, entries[0].name) : tmpDir;
      sourcePath = path.join(sub, binaryName);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Binary ${binaryName} not found in archive`);
      }
    }
    await fsPromises.copyFile(sourcePath, destPath);
    if (process.platform !== 'win32') {
      await fsPromises.chmod(destPath, 0o755);
    }
  } finally {
    await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Resolve install paths: bin dir, binary name, dest path, and archive path.
 * @returns {{ binDir: string, binaryName: string, destPath: string, archivePath: string }}
 */
function getInstallPaths() {
  const home = getAifabrixHome();
  const binDir = path.join(home, 'bin');
  const binaryName = process.platform === 'win32' ? 'mutagen.exe' : 'mutagen';
  const destPath = path.join(binDir, binaryName);
  const archivePath = path.join(binDir, `mutagen-dl-${Date.now()}.tar.gz`);
  return { binDir, binaryName, destPath, archivePath };
}

/**
 * Download and install Mutagen to ~/.aifabrix/bin/. Uses internal path only (no PATH).
 * @param {(msg: string) => void} [log] - Optional progress logger
 * @returns {Promise<string>} Path to installed binary
 * @throws {Error} If platform unsupported, download fails, or install fails
 */
async function installMutagen(log) {
  const basename = getPlatformAssetBasename();
  if (!basename) {
    throw new Error(`Mutagen does not provide a binary for ${process.platform}/${process.arch}. Install manually to ~/.aifabrix/bin/.`);
  }
  const { tagName, assets } = await fetchLatestRelease();
  const version = tagName.replace(/^v/, '');
  const assetName = `${basename}_v${version}.tar.gz`;
  const asset = assets.find(a => a.name === assetName);
  if (!asset) {
    throw new Error(`Mutagen release ${tagName} has no asset ${assetName}. Install manually to ~/.aifabrix/bin/.`);
  }
  const { binDir, binaryName, destPath, archivePath } = getInstallPaths();
  await fsPromises.mkdir(binDir, { recursive: true });
  try {
    await downloadToFile(asset.browser_download_url, archivePath, log);
    if (typeof log === 'function') log('Installing Mutagen...');
    await extractAndInstall(archivePath, destPath, binaryName);
  } finally {
    await fsPromises.unlink(archivePath).catch(() => {});
  }
  return destPath;
}

module.exports = {
  getPlatformAssetBasename,
  fetchLatestRelease,
  installMutagen
};
