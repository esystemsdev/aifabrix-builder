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
    it('should include Applications category with run, shell, test, logs, stop', () => {
      const appCat = CATEGORIES.find(c => c.name === 'Applications (Create & Develop)');
      expect(appCat).toBeDefined();
      const names = appCat.commands.map(c => c.name);
      expect(names).toContain('run');
      expect(names).toContain('shell');
      expect(names).toContain('test');
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

    it('should include service-user in Application & Datasource Management', () => {
      const mgmtCat = CATEGORIES.find(c => c.name === 'Application & Datasource Management');
      expect(mgmtCat).toBeDefined();
      expect(mgmtCat.commands.map(c => c.name)).toContain('service-user');
    });

    it('should include test-integration in External Systems', () => {
      const extCat = CATEGORIES.find(c => c.name === 'External Systems');
      expect(extCat).toBeDefined();
      expect(extCat.commands.map(c => c.name)).toContain('test-integration');
    });
  });

  describe('buildCategorizedHelp', () => {
    it('should include run and deploy in output when program has those commands', () => {
      const program = new Command();
      program.name('aifabrix').description('Test CLI');
      program.command('run <app>').description('Run application locally (or remotely on your Docker host)');
      program.command('deploy <app>').description('Deploy to Azure or locally via Miso Controller');

      const help = buildCategorizedHelp(program);
      expect(help).toContain('run <app>');
      expect(help).toContain('deploy <app>');
      expect(help).toContain('remotely on your Docker host');
      expect(help).toContain('Azure or locally');
    });

    it('should include shell, logs, stop, show, service-user when present', () => {
      const program = new Command();
      program.name('aifabrix').description('Test CLI');
      program.command('shell <app>').description('Open interactive shell');
      program.command('logs <app>').description('Show application container logs');
      program.command('stop <app>').description('Stop and remove application container');
      program.command('show <appKey>').description('Show application info');
      program.command('service-user').description('Create and manage service users');

      const help = buildCategorizedHelp(program);
      expect(help).toContain('shell <app>');
      expect(help).toContain('logs <app>');
      expect(help).toContain('stop <app>');
      expect(help).toContain('show <appKey>');
      expect(help).toContain('service-user');
    });

    it('should include Help section with help [command]', () => {
      const program = new Command();
      program.name('aifabrix').description('Test');
      program.command('run <app>').description('Run app');

      const help = buildCategorizedHelp(program);
      expect(help).toContain('Help:');
      expect(help).toContain('help [command]');
    });
  });
});
