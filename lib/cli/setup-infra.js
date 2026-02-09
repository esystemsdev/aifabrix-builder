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
const { handleCommandError } = require('../utils/cli-utils');
const { handleUpMiso } = require('../commands/up-miso');
const { handleUpDataplane } = require('../commands/up-dataplane');

/**
 * Runs the up-infra command: resolves developer ID, traefik, and starts infra.
 * @param {Object} options - Commander options (developer, traefik)
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
  if (options.traefik === true) {
    cfg.traefik = true;
    await config.saveConfig(cfg);
    logger.log(chalk.green('✓ Traefik enabled and saved to config'));
  } else if (options.traefik === false) {
    cfg.traefik = false;
    await config.saveConfig(cfg);
    logger.log(chalk.green('✓ Traefik disabled and saved to config'));
  }
  const useTraefik = options.traefik === true ? true : (options.traefik === false ? false : !!(cfg.traefik));
  await infra.startInfra(developerId, { traefik: useTraefik });
}

/**
 * Sets up infrastructure commands
 * @param {Command} program - Commander program instance
 */
function setupInfraCommands(program) {
  program.command('up-infra')
    .description('Start local infrastructure: Postgres, Redis, optional Traefik')
    .option('-d, --developer <id>', 'Set developer ID and start infrastructure')
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

  program.command('up-platform')
    .description('Start platform (Keycloak, Miso Controller, Dataplane) from community images; infra must be up')
    .option('-r, --registry <url>', 'Override registry for all apps (e.g. myacr.azurecr.io)')
    .option('--registry-mode <mode>', 'Override registry mode (acr|external)')
    .option('-i, --image <key>=<value>', 'Override image (e.g. keycloak=myreg/k:v1, miso-controller=myreg/m:v1, dataplane=myreg/d:v1); can be repeated', (v, prev) => (prev || []).concat([v]))
    .action(async(options) => {
      try {
        await handleUpMiso(options);
        await handleUpDataplane(options);
      } catch (error) {
        handleCommandError(error, 'up-platform');
        process.exit(1);
      }
    });

  program.command('up-miso')
    .description('Install keycloak and miso-controller from images (no build). Infra must be up. For dataplane use up-dataplane. Uses auto-generated secrets for testing.')
    .option('-r, --registry <url>', 'Override registry for all apps (e.g. myacr.azurecr.io)')
    .option('--registry-mode <mode>', 'Override registry mode (acr|external)')
    .option('-i, --image <key>=<value>', 'Override image (e.g. keycloak=myreg/k:v1, miso-controller=myreg/m:v1); can be repeated', (v, prev) => (prev || []).concat([v]))
    .action(async(options) => {
      try {
        await handleUpMiso(options);
      } catch (error) {
        handleCommandError(error, 'up-miso');
        process.exit(1);
      }
    });

  program.command('up-dataplane')
    .description('Register, deploy, then run dataplane app locally in dev (always local deployment; requires login, environment must be dev)')
    .option('-r, --registry <url>', 'Override registry for dataplane image')
    .option('--registry-mode <mode>', 'Override registry mode (acr|external)')
    .option('-i, --image <ref>', 'Override dataplane image reference (e.g. myreg/dataplane:latest)')
    .action(async(options) => {
      try {
        await handleUpDataplane(options);
      } catch (error) {
        handleCommandError(error, 'up-dataplane');
        process.exit(1);
      }
    });

  program.command('down-infra [app]')
    .description('Stop and remove local infrastructure services or a specific application')
    .option('-v, --volumes', 'Remove volumes (deletes all data)')
    .action(async(appName, options) => {
      try {
        if (typeof appName === 'string' && appName.trim().length > 0) {
          await appLib.downApp(appName, { volumes: !!options.volumes });
        } else {
          if (options.volumes) {
            await infra.stopInfraWithVolumes();
          } else {
            await infra.stopInfra();
          }
        }
      } catch (error) {
        handleCommandError(error, 'down-infra');
        process.exit(1);
      }
    });

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
            const health = await infra.checkInfraHealth();
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

  program.command('status')
    .description('Show detailed infrastructure service status and running applications')
    .action(async() => {
      try {
        const status = await infra.getInfraStatus();
        logger.log('\n📊 Infrastructure Status\n');

        Object.entries(status).forEach(([service, info]) => {
          const normalizedStatus = String(info.status).trim().toLowerCase();
          const icon = normalizedStatus === 'running' ? '✅' : '❌';
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
            const normalizedStatus = String(appInfo.status).trim().toLowerCase();
            const icon = normalizedStatus.includes('running') || normalizedStatus.includes('up') ? '✅' : '❌';
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

  program.command('restart <service>')
    .description('Restart a specific infrastructure service')
    .action(async(service) => {
      try {
        await infra.restartService(service);
        logger.log(`✅ ${service} service restarted successfully`);
      } catch (error) {
        handleCommandError(error, 'restart');
        process.exit(1);
      }
    });
}

module.exports = { setupInfraCommands };
