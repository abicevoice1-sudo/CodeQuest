const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function getUser(id) { return pool.query('SELECT * FROM users WHERE id = $1', [id]); }
module.exports = { getUser };
