'use strict';
function fail(msg, asJson) {
  if (asJson) return out(JSON.stringify({ error: msg }));
  console.error('codequest: ' + msg);
  process.exitCode = 1;
}
function out(s) { console.log(s); }
module.exports = { fail, out };
