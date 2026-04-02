/**
 * @fileoverview Optional hosts-file helper for dev init: map Builder Server hostname to an IP on this machine.
 * Wildcard DNS (*.host) is documented for router/DNS; hosts file only supports exact hostnames (OS limitation).
 * Writing hosts usually requires administrator rights on Windows and macOS.
 *
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const fsp = require('fs').promises;
const dns = require('dns').promises;
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;

/**
 * @param {string} url - https://builder02.local or similar
 * @returns {string} Hostname only
 */
function hostnameFromServerUrl(url) {
  try {
    return new URL(url.trim()).hostname;
  } catch {
    throw new Error('Invalid --server URL for hosts setup');
  }
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function isValidIpv4(s) {
  return typeof s === 'string' && IPV4_RE.test(s.trim());
}

/**
 * Path to system hosts file.
 * @returns {string}
 */
function getHostsFilePath() {
  if (process.platform === 'win32') {
    const windir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
    return path.join(windir, 'System32', 'drivers', 'etc', 'hosts');
  }
  return '/etc/hosts';
}

/**
 * True if hosts file already maps hostname (any IP).
 * @param {string} hostsPath
 * @param {string} hostname
 * @returns {boolean}
 */
function hostsFileHasHostname(hostsPath, hostname) {
  let text;
  try {
    text = fs.readFileSync(hostsPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
  if (typeof text !== 'string') return false;
  for (const line of text.split(/\r?\n/)) {
    const t = line.replace(/#.*/, '').trim();
    if (!t) continue;
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const names = parts.slice(1);
    if (names.includes(hostname)) return true;
  }
  return false;
}

/**
 * @param {string} question
 * @returns {Promise<string>}
 */
function promptLine(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

/**
 * @param {string} question
 * @returns {Promise<boolean>}
 */
async function promptYesNo(question) {
  const a = (await promptLine(question)).toLowerCase();
  return a === 'y' || a === 'yes';
}

/**
 * Try IPv4 lookup for hostname.
 * @param {string} hostname
 * @returns {Promise<string|null>}
 */
async function lookupIpv4(hostname) {
  try {
    const r = await dns.lookup(hostname, { family: 4 });
    return r.address || null;
  } catch {
    return null;
  }
}

/**
 * Print how to add the line with admin/sudo when direct write failed.
 * @param {{ log: function }} logger
 * @param {string} hostsPath
 * @param {string} line
 */
function printManualHostsInstructions(logger, hostsPath, line) {
  if (process.platform === 'win32') {
    logger.log(chalk.yellow('\n  Could not write hosts file (need Administrator). Run PowerShell as Administrator, then:\n'));
    logger.log(chalk.cyan(`  Add-Content -Path "${hostsPath}" -Value "\`r\`n${line}\`r\`n"`));
  } else {
    logger.log(chalk.yellow('\n  Could not write hosts file (need elevated permissions). Run:\n'));
    logger.log(chalk.cyan(`  echo '${line}' | sudo tee -a ${hostsPath}`));
  }
}

/**
 * @param {{ log: function }} logger
 * @param {string} hostname
 */
function logHostsIntro(logger, hostname) {
  logger.log(chalk.blue('\n📍 Local name resolution (optional)\n'));
  logger.log(
    chalk.gray(
      `  For subdomains such as *.${hostname}, configure your router, DNS server, or split DNS so the zone points to your Builder Server IP.`
    )
  );
  logger.log(
    chalk.gray(
      '  The hosts file on this computer only supports exact names (no wildcard). This step adds one line for the hostname in --server.'
    )
  );
  logger.log('');
}

/**
 * @param {string} hostname
 * @param {string|undefined} hostsIp - From --hosts-ip
 * @param {{ log: function }} logger
 * @returns {Promise<string|null>} IPv4 or null if user skipped
 */
async function resolveHostsIpForInit(hostname, hostsIp, logger) {
  let ip = typeof hostsIp === 'string' && hostsIp.trim() ? hostsIp.trim() : null;
  if (ip && !isValidIpv4(ip)) {
    throw new Error(`Invalid --hosts-ip: "${ip}" (use an IPv4 address, e.g. 192.168.1.25)`);
  }
  if (!ip) {
    const lookedUp = await lookupIpv4(hostname);
    if (lookedUp && isValidIpv4(lookedUp)) {
      logger.log(chalk.gray(`  ${hostname} currently resolves to ${lookedUp} (DNS or existing hosts).`));
      ip = lookedUp;
    }
  }
  if (ip) return ip;
  const entered = await promptLine(chalk.yellow(`  Enter IPv4 address for ${hostname} (e.g. 192.168.1.25): `));
  if (!entered) {
    logger.log(chalk.gray('  Skipping hosts file (no IP entered).\n'));
    return null;
  }
  if (!isValidIpv4(entered)) {
    throw new Error(`Invalid IP address: "${entered}"`);
  }
  return entered;
}

/**
 * @param {string} hostsPath
 * @param {string} hostname
 * @param {string} ip
 * @param {boolean} skipConfirm
 * @param {{ log: function }} logger
 * @returns {Promise<void>}
 */
async function tryWriteHostsEntry(hostsPath, hostname, ip, skipConfirm, logger) {
  const line = `${ip} ${hostname}`;
  logger.log(chalk.gray(`  Suggested hosts line: ${line}`));
  if (hostsFileHasHostname(hostsPath, hostname)) {
    logger.log(chalk.green(`  ✓ ${hostname} is already listed in ${hostsPath}. Nothing to do.\n`));
    return;
  }
  const yn = chalk.yellow(`  Add this line to ${hostsPath}? This may require administrator approval. (y/n) `);
  const confirm = skipConfirm || (await promptYesNo(yn));
  if (!confirm) {
    logger.log(chalk.gray('  Skipping hosts file update.\n'));
    return;
  }
  const block = `\n# aifabrix dev init — ${hostname}\n${line}\n`;
  try {
    await fsp.appendFile(hostsPath, block, { encoding: 'utf8' });
    logger.log(chalk.green(`  ✓ Updated ${hostsPath}\n`));
  } catch (e) {
    if (e.code === 'EACCES' || e.code === 'EPERM') {
      logger.log(chalk.yellow(`  ✗ Could not write ${hostsPath} (permission denied).`));
      printManualHostsInstructions(logger, hostsPath, line);
      logger.log('');
      return;
    }
    throw e;
  }
}

/**
 * Optional hosts setup for dev init (--add-hosts).
 * @param {Object} params
 * @param {string} params.baseUrl - Builder Server URL
 * @param {string} [params.hostsIp] - From --hosts-ip
 * @param {boolean} params.skipConfirm - When true (-y), append without y/n
 * @param {{ log: function }} params.logger - logger like lib/utils/logger
 * @returns {Promise<void>}
 */
async function runOptionalHostsSetup({ baseUrl, hostsIp, skipConfirm, logger }) {
  const hostname = hostnameFromServerUrl(baseUrl);
  logHostsIntro(logger, hostname);
  const ip = await resolveHostsIpForInit(hostname, hostsIp, logger);
  if (ip === null) return;
  await tryWriteHostsEntry(getHostsFilePath(), hostname, ip, skipConfirm, logger);
}

module.exports = {
  hostnameFromServerUrl,
  isValidIpv4,
  getHostsFilePath,
  hostsFileHasHostname,
  runOptionalHostsSetup
};
