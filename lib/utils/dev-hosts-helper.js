/**
 * @fileoverview Optional hosts-file helper for dev init: map Builder Server hostname to an IP on this machine.
 * Wildcard DNS (*.host) is documented for router/DNS; hosts file only supports exact hostnames (OS limitation).
 * Writing hosts usually requires administrator rights on Windows and macOS.
 *
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const dns = require('dns').promises;
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const { nodeFs } = require('../internal/node-fs');

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
 * Hostnames to map to the Builder Server IP: the URL host plus devNN.url-host for
 * per-developer subdomains. Wildcards (*.zone) are not supported by OS hosts files.
 * @param {string|undefined} developerId - e.g. "02"
 * @param {string} primaryHostname - Hostname from --server (e.g. builder02.local)
 * @returns {string[]} Deduped list (primary first, then per-dev if applicable)
 */
function hostsNamesForDevInit(developerId, primaryHostname) {
  const primary = String(primaryHostname || '').trim();
  if (!primary) return [];
  const names = [primary];
  const id = developerId !== undefined && developerId !== null ? String(developerId).trim() : '';
  if (!id || isValidIpv4(primary)) return names;
  if (/^dev\d+\./i.test(primary)) return names;
  const perDev = `dev${id}.${primary}`;
  if (perDev !== primary && !names.includes(perDev)) names.push(perDev);
  return names;
}

/**
 * Display URL for the per-developer host (devNN.zone), same scheme and port as --server.
 * @param {string|undefined} developerId
 * @param {string} baseUrl - Builder Server URL
 * @returns {string|null} e.g. https://dev02.builder02.local
 */
function perDeveloperServerDisplayUrl(developerId, baseUrl) {
  let u;
  try {
    u = new URL(String(baseUrl || '').trim());
  } catch {
    return null;
  }
  const list = hostsNamesForDevInit(developerId, u.hostname);
  if (list.length < 2) return null;
  const perDevHost = list[1];
  u.hostname = perDevHost;
  const portPart = u.port ? `:${u.port}` : '';
  return `${u.protocol}//${u.hostname}${portPart}`;
}

/**
 * @param {{ log: function }} logger
 * @param {string|undefined} developerId
 * @param {string} baseUrl
 * @returns {void}
 */
function logPerDeveloperUrlHint(logger, developerId, baseUrl) {
  const displayUrl = perDeveloperServerDisplayUrl(developerId, baseUrl);
  if (!displayUrl) return;
  logger.log(chalk.green('  Your per-developer URL: ') + chalk.cyan(displayUrl));
  logger.log('');
}

/**
 * True if hosts file already maps hostname (any IP).
 * @param {string} hostsPath
 * @param {string} hostname
 * @returns {boolean}
 */
function hostsFileHasHostname(hostsPath, hostname) {
  const want = String(hostname || '').trim();
  if (!want) return false;
  let text;
  try {
    text = nodeFs().readFileSync(hostsPath, 'utf8');
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
    const names = parts.slice(1).map((n) => String(n).trim());
    if (names.includes(want)) return true;
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
 * @param {string[]} hostnames - Names we may add (URL host + optional devNN.zone)
 */
function logHostsIntro(logger, hostnames) {
  const list = (hostnames && hostnames.length ? hostnames : []).join(', ');
  logger.log(chalk.blue('\n📍 Local name resolution (optional)\n'));
  logger.log(
    chalk.gray(
      '  Wildcards such as *.local are not supported in the hosts file (OS limitation). '
      + 'Use DNS or router DNS for wildcard zones; here we add exact names only.'
    )
  );
  logger.log(chalk.gray(`  Names to map to that IP (same line where possible): ${list}`));
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
 * @param {string} block - Full text to append
 * @param {string} line - Single-line form for manual instructions
 * @param {{ log: function }} logger
 * @returns {Promise<void>}
 */
async function appendHostsBlockOrPrintManual(hostsPath, block, line, logger) {
  try {
    await nodeFs().promises.appendFile(hostsPath, block, { encoding: 'utf8' });
    logger.log(chalk.green(`  ✔ Updated ${hostsPath}\n`));
  } catch (e) {
    if (e.code === 'EACCES' || e.code === 'EPERM') {
      logger.log(chalk.yellow(`  ✖ Could not write ${hostsPath} (permission denied).`));
      printManualHostsInstructions(logger, hostsPath, line);
      logger.log('');
      return;
    }
    throw e;
  }
}

/**
 * @param {string} hostsPath
 * @param {string[]} hostnames
 * @param {string} ip
 * @param {boolean} skipConfirm
 * @param {{ log: function }} logger
 * @returns {Promise<void>}
 */
async function tryWriteHostsEntry(hostsPath, hostnames, ip, skipConfirm, logger) {
  const missing = hostnames.filter((h) => !hostsFileHasHostname(hostsPath, h));
  if (missing.length === 0) {
    logger.log(chalk.green(`  ✔ Required hostnames are already listed in ${hostsPath}. Nothing to do.\n`));
    return;
  }
  const line = `${ip} ${missing.join(' ')}`;
  logger.log(chalk.gray(`  Suggested hosts line: ${line}`));
  const yn = chalk.yellow(`  Add this line to ${hostsPath}? This may require administrator approval. (y/n) `);
  const confirm = skipConfirm || (await promptYesNo(yn));
  if (!confirm) {
    logger.log(chalk.gray('  Skipping hosts file update.\n'));
    return;
  }
  const block = `\n# aifabrix dev init — ${missing.join(', ')}\n${line}\n`;
  await appendHostsBlockOrPrintManual(hostsPath, block, line, logger);
}

/**
 * Optional hosts setup for dev init (--add-hosts).
 * @param {Object} params
 * @param {string} params.baseUrl - Builder Server URL
 * @param {string} [params.developerId] - From --developer-id (adds devNN.hostname)
 * @param {string} [params.hostsIp] - From --hosts-ip
 * @param {boolean} params.skipConfirm - When true (-y), append without y/n
 * @param {{ log: function }} params.logger - logger like lib/utils/logger
 * @returns {Promise<void>}
 */
async function runOptionalHostsSetup({ baseUrl, developerId, hostsIp, skipConfirm, logger }) {
  const primary = hostnameFromServerUrl(baseUrl);
  const hostnames = hostsNamesForDevInit(developerId, primary);
  logHostsIntro(logger, hostnames);
  const ip = await resolveHostsIpForInit(primary, hostsIp, logger);
  if (ip === null) return;
  await tryWriteHostsEntry(getHostsFilePath(), hostnames, ip, skipConfirm, logger);
  logPerDeveloperUrlHint(logger, developerId, baseUrl);
}

module.exports = {
  hostnameFromServerUrl,
  hostsNamesForDevInit,
  perDeveloperServerDisplayUrl,
  isValidIpv4,
  getHostsFilePath,
  hostsFileHasHostname,
  runOptionalHostsSetup
};
