/**
 * CLI infrastructure command setup (up-infra, up-platform, up-miso, up-dataplane, down-infra, doctor, status, restart).
 *
 * @fileoverview Infrastructure command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const infra = require('../infrastructure');
const appLib = require('../app');
const validator = require('../validation/validator');
const config = require('../core/config');
const logger = require('../utils/logger');
const { handleCommandError, isAuthenticationError } = require('../utils/cli-utils');
const { resolveControllerUrl } = require('../utils/controller-url');
const { handleLogin } = require('../commands/login');
const { handleUpMiso } = require('../commands/up-miso');
const { handleUpDataplane } = require('../commands/up-dataplane');
const { cleanBuilderAppDirs } = require('../commands/up-common');

/**
 * Persists optional service flag to config when explicitly set.
 * @param {Object} cfg - Config object (mutated)
 * @param {string} key - Config key (traefik, pgadmin, redisCommander)
 * @param {boolean} value - Value to set
 * @param {string} label - Label for log message
 */
async function persistOptionalServiceFlag(cfg, key, value, label) {
  cfg[key] = value;
  await config.saveConfig(cfg);
  logger.log(chalk.green(`✓ ${label} ${value ? 'enabled' : 'disabled'} and saved to config`));
}

/**
 * Resolves effective boolean from option vs config.
 * @param {*} optValue - options.traefik | options.pgAdmin | options.redisAdmin
 * @param {*} cfgValue - cfg.traefik | cfg.pgadmin | cfg.redisCommander
 * @param {boolean} defaultWhenUndef - Default when config value is undefined
 * @returns {boolean}
 */
function resolveFlag(optValue, cfgValue, defaultWhenUndef = true) {
  if (optValue === true) return true;
  if (optValue === false) return false;
  return cfgValue !== false && (cfgValue === true || defaultWhenUndef);
}

/**
 * Runs the up-infra command: resolves developer ID, traefik, pgAdmin, redisAdmin, and starts infra.
 * @param {Object} options - Commander options (developer, traefik, pgAdmin, redisAdmin)
 * @returns {Promise<void>}
 */
async function runUpInfraCommand(options) {
  await config.ensureSecretsEncryptionKey();
  let developerId = null;
  if (options.developer) {
    const id = parseInt(options.developer, 10);
    if (isNaN(id) || id < 0) {
      throw new Error('Developer ID must be a non-negative number (0 = default infra, > 0 = developer-specific)');
    }
    await config.setDeveloperId(id);
    process.env.AIFABRIX_DEVELOPERID = id.toString();
    developerId = id;
    logger.log(chalk.green(`✓ Developer ID set to ${id}`));
  }
  const cfg = await config.getConfig();
  const flagSpecs = [
    { opt: options.traefik, key: 'traefik', label: 'Traefik' },
    { opt: options.pgAdmin, key: 'pgadmin', label: 'pgAdmin' },
    { opt: options.redisAdmin, key: 'redisCommander', label: 'Redis Commander' }
  ];
  for (const { opt, key, label } of flagSpecs) {
    if (opt === true || opt === false) {
      await persistOptionalServiceFlag(cfg, key, opt, label);
    }
  }
  await infra.startInfra(developerId, {
    traefik: resolveFlag(options.traefik, cfg.traefik, false),
    pgadmin: resolveFlag(options.pgAdmin, cfg.pgadmin, true),
    redisCommander: resolveFlag(options.redisAdmin, cfg.redisCommander, true),
    adminPwd: options.adminPwd
  });
}

function setupUpInfraCommand(program) {
  program.command('up-infra')
    .description('Start local infrastructure: Postgres, Redis, optional pgAdmin, Redis Commander, Traefik')
    .option('-d, --developer <id>', 'Set developer ID and start infrastructure')
    .option('--adminPwd <password>', 'Override default admin password for new install (Postgres, pgAdmin, Redis Commander)')
    .option('--pgAdmin', 'Include pgAdmin web UI and save to config')
    .option('--no-pgAdmin', 'Exclude pgAdmin and save to config')
    .option('--redisAdmin', 'Include Redis Commander web UI and save to config')
    .option('--no-redisAdmin', 'Exclude Redis Commander and save to config')
    .option('--traefik', 'Include Traefik reverse proxy and save to config')
    .option('--no-traefik', 'Exclude Traefik and save to config')
    .action(async(options) => {
      try {
        await runUpInfraCommand(options);
      } catch (error) {
        handleCommandError(error, 'up-infra');
        process.exit(1);
      }
    });
}

function setupUpPlatformCommand(program) {
  program.command('up-platform')
    .description('Start platform (Keycloak, Miso Controller, Dataplane) from community images; infra must be up')
    .option('-r, --registry <url>', 'Override registry for all apps (e.g. myacr.azurecr.io)')
    .option('--registry-mode <mode>', 'Override registry mode (acr|external)')
    .option('-i, --image <key>=<value>', 'Override image (e.g. keycloak=myreg/k:v1, miso-controller=myreg/m:v1, dataplane=myreg/d:v1); can be repeated', (v, prev) => (prev || []).concat([v]))
    .option('-f, --force', 'Clean builder/keycloak, builder/miso-controller, builder/dataplane and re-fetch from templates')
    .action(async(options) => {
      try {
        if (options.force) {
          await cleanBuilderAppDirs(['keycloak', 'miso-controller', 'dataplane']);
        }
        await handleUpMiso(options);
        await handleUpDataplane(options);
      } catch (error) {
        if (isAuthenticationError(error)) {
          const controllerUrl = error.controllerUrl || await resolveControllerUrl();
          logger.log(chalk.blue('\nAuthentication required. Running aifabrix login...\n'));
          try {
            await handleLogin({ method: 'device', controller: controllerUrl });
            await handleUpDataplane(options);
            return;
          } catch (loginOrRetryError) {
            handleCommandError(loginOrRetryError, 'up-platform');
            process.exit(1);
          }
        }
        handleCommandError(error, 'up-platform');
        process.exit(1);
      }
    });
}

function setupUpMisoCommand(program) {
  program.command('up-miso')
    .description('Install keycloak and miso-controller from images (no build). Infra must be up. For dataplane use up-dataplane. Uses auto-generated secrets for testing.')
    .option('-r, --registry <url>', 'Override registry for all apps (e.g. myacr.azurecr.io)')
    .option('--registry-mode <mode>', 'Override registry mode (acr|external)')
    .option('-i, --image <key>=<value>', 'Override image (e.g. keycloak=myreg/k:v1, miso-controller=myreg/m:v1); can be repeated', (v, prev) => (prev || []).concat([v]))
    .option('-f, --force', 'Clean builder/keycloak and builder/miso-controller and re-fetch from templates')
    .action(async(options) => {
      try {
        if (options.force) {
          await cleanBuilderAppDirs(['keycloak', 'miso-controller']);
        }
        await handleUpMiso(options);
      } catch (error) {
        handleCommandError(error, 'up-miso');
        process.exit(1);
      }
    });
}

function setupUpDataplaneCommand(program) {
  program.command('up-dataplane')
    .description('Register, deploy, then run dataplane app locally in dev (always local deployment; requires login, environment must be dev)')
    .option('-r, --registry <url>', 'Override registry for dataplane image')
    .option('--registry-mode <mode>', 'Override registry mode (acr|external)')
    .option('-i, --image <ref>', 'Override dataplane image reference (e.g. myreg/dataplane:latest)')
    .option('-f, --force', 'Clean builder/dataplane and re-fetch from templates')
    .action(async(options) => {
      try {
        if (options.force) {
          await cleanBuilderAppDirs(['dataplane']);
        }
        await handleUpDataplane(options);
      } catch (error) {
        if (isAuthenticationError(error)) {
          const controllerUrl = error.controllerUrl || await resolveControllerUrl();
          logger.log(chalk.blue('\nAuthentication required. Running aifabrix login...\n'));
          try {
            await handleLogin({ method: 'device', controller: controllerUrl });
            await handleUpDataplane(options);
            return;
          } catch (loginOrRetryError) {
            handleCommandError(loginOrRetryError, 'up-dataplane');
            process.exit(1);
          }
        }
        handleCommandError(error, 'up-dataplane');
        process.exit(1);
      }
    });
}

function setupDownInfraCommand(program) {
  program.command('down-infra [app]')
    .description('Stop and remove local infrastructure services or a specific application')
    .option('-v, --volumes', 'Remove volumes (deletes all data)')
    .action(async(appName, options) => {
      try {
        if (typeof appName === 'string' && appName.trim().length > 0) {
          await appLib.downApp(appName, { volumes: !!options.volumes });
        } else {
          if (options.volumes) await infra.stopInfraWithVolumes();
          else await infra.stopInfra();
        }
      } catch (error) {
        handleCommandError(error, 'down-infra');
        process.exit(1);
      }
    });
}

function setupDoctorCommand(program) {
  program.command('doctor')
    .description('Check environment and configuration')
    .action(async() => {
      try {
        const result = await validator.checkEnvironment();
        logger.log('\n🔍 AI Fabrix Environment Check\n');
        logger.log(`Docker: ${result.docker === 'ok' ? '✅ Running' : '❌ Not available'}`);
        logger.log(`Ports: ${result.ports === 'ok' ? '✅ Available' : '⚠️  Some ports in use'}`);
        logger.log(`Secrets: ${result.secrets === 'ok' ? '✅ Configured' : '❌ Missing'}`);
        if (result.recommendations.length > 0) {
          logger.log('\n📋 Recommendations:');
          result.recommendations.forEach(rec => logger.log(`  • ${rec}`));
        }
        if (result.docker === 'ok') {
          try {
            const cfg = await config.getConfig();
            const health = await infra.checkInfraHealth(null, {
              pgadmin: cfg.pgadmin !== false,
              redisCommander: cfg.redisCommander !== false,
              traefik: !!cfg.traefik
            });
            logger.log('\n🏥 Infrastructure Health:');
            Object.entries(health).forEach(([service, status]) => {
              const icon = status === 'healthy' ? '✅' : status === 'unknown' ? '❓' : '❌';
              logger.log(`  ${icon} ${service}: ${status}`);
            });
          } catch (error) {
            logger.log('\n🏥 Infrastructure: Not running');
          }
        }
        logger.log('');
      } catch (error) {
        handleCommandError(error, 'doctor');
        process.exit(1);
      }
    });
}

function setupStatusCommand(program) {
  program.command('status')
    .description('Show detailed infrastructure service status and running applications')
    .action(async() => {
      try {
        const status = await infra.getInfraStatus();
        logger.log('\n📊 Infrastructure Status\n');
        Object.entries(status).forEach(([service, info]) => {
          const icon = String(info.status).trim().toLowerCase() === 'running' ? '✅' : '❌';
          logger.log(`${icon} ${service}:`);
          logger.log(`   Status: ${info.status}`);
          logger.log(`   Port: ${info.port}`);
          logger.log(`   URL: ${info.url}`);
          logger.log('');
        });
        const apps = await infra.getAppStatus();
        if (apps.length > 0) {
          logger.log('📱 Running Applications\n');
          apps.forEach((appInfo) => {
            const s = String(appInfo.status).trim().toLowerCase();
            const icon = s.includes('running') || s.includes('up') ? '✅' : '❌';
            logger.log(`${icon} ${appInfo.name}:`);
            logger.log(`   Container: ${appInfo.container}`);
            logger.log(`   Port: ${appInfo.port}`);
            logger.log(`   Status: ${appInfo.status}`);
            logger.log(`   URL: ${appInfo.url}`);
            logger.log('');
          });
        }
      } catch (error) {
        handleCommandError(error, 'status');
        process.exit(1);
      }
    });
}

const INFRA_SERVICES = ['postgres', 'redis', 'pgadmin', 'redis-commander', 'traefik'];

function setupRestartCommand(program) {
  program.command('restart <service>')
    .description('Restart an infrastructure service or a Docker application (builder/<app>)')
    .action(async(service) => {
      try {
        if (INFRA_SERVICES.includes(service)) {
          await infra.restartService(service);
          logger.log(`✅ ${service} service restarted successfully`);
        } else {
          await appLib.restartApp(service);
          logger.log(`✅ ${service} restarted successfully`);
        }
      } catch (error) {
        handleCommandError(error, 'restart');
        process.exit(1);
      }
    });
}

/**
 * Sets up infrastructure commands
 * @param {Command} program - Commander program instance
 */
function setupInfraCommands(program) {
  setupUpInfraCommand(program);
  setupUpPlatformCommand(program);
  setupUpMisoCommand(program);
  setupUpDataplaneCommand(program);
  setupDownInfraCommand(program);
  setupDoctorCommand(program);
  setupStatusCommand(program);
  setupRestartCommand(program);
}

module.exports = { setupInfraCommands };
