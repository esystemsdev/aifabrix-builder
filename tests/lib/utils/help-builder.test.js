/**
 * Tests for help-builder (categorized CLI help).
 *
 * @fileoverview Unit tests for lib/utils/help-builder.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { Command } = require('commander');
const { buildCategorizedHelp, CATEGORIES } = require('../../../lib/utils/help-builder');

describe('help-builder', () => {
  describe('CATEGORIES', () => {
    it('should include Applications category with run, shell, install, lint, logs, stop', () => {
      const appCat = CATEGORIES.find(c => c.name === 'Applications (Create & Develop)');
      expect(appCat).toBeDefined();
      const names = appCat.commands.map(c => c.name);
      expect(names).toContain('run');
      expect(names).toContain('shell');
      expect(names).toContain('install');
      expect(names).toContain('lint');
      expect(names).toContain('logs');
      expect(names).toContain('stop');
    });

    it('should include Deployment category with deploy', () => {
      const depCat = CATEGORIES.find(c => c.name === 'Deployment');
      expect(depCat).toBeDefined();
      expect(depCat.commands.map(c => c.name)).toContain('deploy');
    });

    it('should include show in Configuration & Validation', () => {
      const cfgCat = CATEGORIES.find(c => c.name === 'Configuration & Validation');
      expect(cfgCat).toBeDefined();
      expect(cfgCat.commands.map(c => c.name)).toContain('show');
    });

    it('should include integration-client in Application & Management', () => {
      const mgmtCat = CATEGORIES.find(c => c.name === 'Application & Management');
      expect(mgmtCat).toBeDefined();
      expect(mgmtCat.commands.map(c => c.name)).toContain('integration-client');
    });

    it('should list wizard first in External Systems as entrypoint', () => {
      const extCat = CATEGORIES.find(c => c.name === 'External Systems');
      expect(extCat).toBeDefined();
      expect(extCat.commands[0]).toEqual({ name: 'wizard', term: 'wizard [systemKey]' });
      const appCat = CATEGORIES.find(c => c.name === 'Applications (Create & Develop)');
      expect(appCat.commands.map(c => c.name)).not.toContain('wizard');
    });

    it('should include test-e2e and test-integration in External Systems', () => {
      const extCat = CATEGORIES.find(c => c.name === 'External Systems');
      expect(extCat).toBeDefined();
      expect(extCat.commands.map(c => c.name)).toContain('test-e2e');
      expect(extCat.commands.map(c => c.name)).toContain('test-integration');
    });

    it('should include upload in External Systems', () => {
      const extCat = CATEGORIES.find(c => c.name === 'External Systems');
      expect(extCat).toBeDefined();
      expect(extCat.commands.map(c => c.name)).toContain('upload');
    });

    it('should include convert in Configuration & Validation', () => {
      const cfgCat = CATEGORIES.find(c => c.name === 'Configuration & Validation');
      expect(cfgCat).toBeDefined();
      expect(cfgCat.commands.map(c => c.name)).toContain('convert');
    });

    it('should include credential and deployment in Application & Management', () => {
      const mgmtCat = CATEGORIES.find(c => c.name === 'Application & Management');
      expect(mgmtCat).toBeDefined();
      expect(mgmtCat.commands.map(c => c.name)).toContain('credential');
      expect(mgmtCat.commands.map(c => c.name)).toContain('deployment');
    });

    it('should include dimension, identity, and protection in Application & Management', () => {
      const mgmtCat = CATEGORIES.find(c => c.name === 'Application & Management');
      expect(mgmtCat).toBeDefined();
      const names = mgmtCat.commands.map(c => c.name);
      expect(names).toContain('dimension');
      expect(names).toContain('dimension value');
      expect(names).toContain('identity');
      expect(names).toContain('protection');
    });

    it('should not list dimension, identity, or protection under External Systems', () => {
      const extCat = CATEGORIES.find(c => c.name === 'External Systems');
      expect(extCat).toBeDefined();
      const names = extCat.commands.map(c => c.name);
      expect(names).not.toContain('dimension');
      expect(names).not.toContain('dimension value');
      expect(names).not.toContain('identity');
      expect(names).not.toContain('protection');
    });

    it('should include only env in Environments category', () => {
      const envCat = CATEGORIES.find(c => c.name === 'Environments');
      expect(envCat).toBeDefined();
      expect(envCat.commands.map(c => c.name)).toEqual(['env']);
    });
  });

  describe('buildCategorizedHelp', () => {
    it('should include run and deploy in output when program has those commands', () => {
      const program = new Command();
      program.name('aifabrix').description('Test CLI');
      program.command('run <app>').description('Run application locally (or remotely on your Docker host)');
      program.command('deploy <appKey|systemKey>').description('Deploy to Azure or locally via Miso Controller');

      const help = buildCategorizedHelp(program);
      expect(help).toContain('run <appKey>');
      expect(help).toContain('deploy <appKey|systemKey>');
      expect(help).toContain('remotely on your Docker host');
      expect(help).toContain('Azure or locally');
    });

    it('should include shell, logs, stop, show, integration-client when present', () => {
      const program = new Command();
      program.name('aifabrix').description('Test CLI');
      program.command('shell <app>').description('Open interactive shell');
      program.command('logs <app>').description('Show application container logs');
      program.command('stop <app>').description('Stop and remove application container');
      program.command('show <appKey|systemKey>').description('Show application info');
      program.command('integration-client').description('Manage integration clients');

      const help = buildCategorizedHelp(program);
      expect(help).toContain('shell <appKey>');
      expect(help).toContain('logs <appKey>');
      expect(help).toContain('stop <appKey>');
      expect(help).toContain('show <appKey|systemKey>');
      expect(help).toContain('integration-client');
    });

    it('should include Help section with help [command]', () => {
      const program = new Command();
      program.name('aifabrix').description('Test');
      program.command('run <app>').description('Run app');

      const help = buildCategorizedHelp(program);
      expect(help).toContain('Help:');
      expect(help).toContain('help [command]');
      expect(help).toContain('Tip:');
      expect(help).toContain('aifabrix <command> --help');
    });

    it('should include upload, convert, credential, deployment when those commands are registered', () => {
      const program = new Command();
      program.name('aifabrix').description('Test');
      program.command('upload <systemKey>').description('Upload external system to dataplane');
      program.command('convert <appKey|systemKey>').description('Convert config between JSON and YAML');
      program.command('credential').description('Manage credentials');
      program.command('deployment').description('List deployments');

      const help = buildCategorizedHelp(program);
      expect(help).toContain('upload <systemKey>');
      expect(help).toContain('convert <appKey|systemKey>');
      expect(help).toContain('credential');
      expect(help).toContain('deployment');
    });
  });

  describe('full CLI registration', () => {
    /** Load full CLI once for both integration checks (module load not counted in per-test duration). */
    let setupCommands;
    beforeAll(() => {
      setupCommands = require('../../../lib/cli').setupCommands;
    });

    describe('help coverage', () => {
      it('should list every registered top-level command in CATEGORIES', () => {
        const program = new Command();
        program.name('aifabrix').description('Test');
        setupCommands(program);

        const inHelp = new Set();
        for (const cat of CATEGORIES) {
          for (const spec of cat.commands) inHelp.add(spec.name);
        }

        const allowedOmissions = new Set(['down-app']); // alias for stop; only stop is shown in help
        const missing = program.commands
          .filter((c) => !inHelp.has(c.name()) && !allowedOmissions.has(c.name()))
          .map((c) => c.name());
        expect(missing).toEqual([]);
      });
    });

    describe('CLI command descriptions', () => {
      /**
       * @param {import('commander').Command} cmd
       * @param {string[]} lineage
       * @param {string[]} issues
       */
      function assertNonEmptyDescriptions(cmd, lineage, issues) {
        for (const sub of cmd.commands || []) {
          const next = [...lineage, sub.name()].filter(Boolean);
          const desc = sub.description();
          if (!desc || !String(desc).trim()) {
            issues.push(next.join(' '));
          }
          assertNonEmptyDescriptions(sub, next, issues);
        }
      }

      it('should give every registered command and subcommand a non-empty description', () => {
        const program = new Command();
        program.name('aifabrix').description('Test');
        setupCommands(program);
        const issues = [];
        assertNonEmptyDescriptions(program, [], issues);
        expect(issues).toEqual([]);
      });
    });
  });
});
