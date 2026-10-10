function format(level, msg, meta) {
  const ts = new Date().toISOString();
  console.log(JSON.stringify({ ts, level, msg, ...meta }));
}

const logger = {
  info: (msg, meta) => format('info', msg, meta),
  debug: (msg, meta) => format('debug', msg, meta),
};

module.exports = { logger };
