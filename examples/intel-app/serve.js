const { Pool } = require('pg');
const routes = require('./routes');
const port = process.env.PORT || 3000;
routes.register();
require('http').createServer(routes.handler).listen(port);
