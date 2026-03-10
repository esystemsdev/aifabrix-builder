/**
 * Handlebars helpers for Docker Compose templates.
 * @fileoverview Compose template helpers (pgQuote, pgUser, isVectorDatabase, etc.)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const handlebars = require('handlebars');
const { isVectorDatabaseName } = require('./compose-vector-helper');

/**
 * Registers Handlebars helpers used by Docker Compose templates.
 */
function registerComposeHelpers() {
  handlebars.registerHelper('eq', (a, b) => a === b);

  handlebars.registerHelper('pgQuote', (identifier) => {
    if (!identifier) return '';
    return new handlebars.SafeString(`"${String(identifier).replace(/"/g, '""')}"`);
  });

  handlebars.registerHelper('pgUser', (dbName) => {
    if (!dbName) return '';
    const userName = `${String(dbName).replace(/-/g, '_')}_user`;
    return new handlebars.SafeString(`"${userName.replace(/"/g, '""')}"`);
  });

  handlebars.registerHelper('pgUserOld', (dbName) => {
    if (!dbName) return '';
    const userName = `${String(dbName)}_user`;
    return new handlebars.SafeString(userName);
  });

  handlebars.registerHelper('pgUserName', (dbName) => {
    if (!dbName) return '';
    const userName = `${String(dbName).replace(/-/g, '_')}_user`;
    return new handlebars.SafeString(userName);
  });

  handlebars.registerHelper('isVectorDatabase', (name) => isVectorDatabaseName(name));

  /** Returns list of extension names for this database (config extensions + vector if name ends with "vector"). */
  handlebars.registerHelper('extensionsForDb', (db) => {
    if (!db) return [];
    const explicit = Array.isArray(db.extensions) ? db.extensions : [];
    const list = [...explicit];
    if (isVectorDatabaseName(db.name) && !list.includes('vector')) {
      list.push('vector');
    }
    return list;
  });
}

module.exports = { registerComposeHelpers };
