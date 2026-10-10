const { getUser } = require('./db/users');
function register() { return getUser; }
module.exports = { register };
