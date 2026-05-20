/**
 * @fileoverview Parse controller users.csv-style files for identity apply
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');

/**
 * Parse one CSV line respecting double-quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/**
 * @param {string} filePath
 * @param {string} [filterPrefix]
 * @returns {{ headers: string[], rows: Object[] }}
 */
function parseUsersCsvFile(filePath, filterPrefix = '') {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row');
  }
  const headers = parseCsvLine(lines[0]);
  const prefix = String(filterPrefix || '').trim();
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] !== undefined ? cells[idx] : '';
    });
    const id = String(row.Id || row.id || '').trim();
    if (prefix && id && !id.startsWith(prefix)) {
      continue;
    }
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Build unique entities from CSV rows (users.csv shape).
 * @param {Object[]} rows
 * @returns {{ groups: Map<string, { name: string, displayName: string }>, users: Map<string, Object>, memberships: { userKey: string, groupName: string }[] }}
 */
// eslint-disable-next-line complexity -- row shape varies; logic is linear per field
function buildApplyPlanFromRows(rows) {
  const groups = new Map();
  const users = new Map();
  const memberships = [];

  for (const row of rows) {
    const csvId = String(row.Id || row.id || '').trim();
    const email = String(row.Email || row.email || '').trim();
    if (!email) {
      continue;
    }
    const userKey = csvId || email;
    const groupName = String(row.GroupId || row.groupId || '').trim();
    const groupDisplay = String(row.GroupName || row.groupName || groupName).trim();
    if (groupName) {
      if (!groups.has(groupName)) {
        groups.set(groupName, { name: groupName, displayName: groupDisplay || groupName });
      }
      memberships.push({ userKey, groupName });
    }
    if (!users.has(userKey)) {
      users.set(userKey, {
        csvId,
        email,
        firstName: String(row.FirstName || row.firstName || '').trim() || undefined,
        lastName: String(row.LastName || row.lastName || '').trim() || undefined,
        displayName: String(row.DisplayName || row.displayName || '').trim() || undefined,
        username: String(row.UserPrincipalName || row.userPrincipalName || row.username || '').trim() || undefined
      });
    }
  }

  return { groups, users, memberships };
}

module.exports = {
  parseCsvLine,
  parseUsersCsvFile,
  buildApplyPlanFromRows
};
