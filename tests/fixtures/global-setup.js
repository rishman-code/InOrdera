const { start } = require('./fake-smtp');

module.exports = async () => {
  const server = await start();
  return () => new Promise(r => server.close(r));
};
