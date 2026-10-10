'use strict';
const fs = require('fs');
const path = require('path');
function fail(msg, asJson) {
  if (asJson) return out(JSON.stringify({ error: msg }));
  console.error('aperio: ' + msg);
  process.exitCode = 1;
}
function out(s) { console.log(s); }
// Cache dir: `.aperio/` (new). Falls back to `.codequest/` for repos scanned
// with older versions, so upgrades don't lose history.
function cacheDir(dir) {
  const next = path.join(dir, '.aperio');
  const prev = path.join(dir, '.codequest');
  if (fs.existsSync(next)) return next;
  if (fs.existsSync(prev)) return prev;
  return next;
}
module.exports = { fail, out, cacheDir };
