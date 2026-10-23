const apiPort = Number(process.env.BEVDIST_E2E_API_PORT || 5017);
const webPort = Number(process.env.BEVDIST_E2E_WEB_PORT || 8087);
if (![apiPort, webPort].every(port => Number.isInteger(port) && port > 0 && port <= 65535) || apiPort === webPort) {
  throw new Error('E2E API and web ports must be distinct integers from 1 to 65535');
}

module.exports = {
  outputRoot: apiPort === 5017 && webPort === 8087 ? 'dist' : `dist/e2e-${apiPort}-${webPort}`,
  apiURL: `http://127.0.0.1:${apiPort}`,
  webURL: `http://127.0.0.1:${webPort}`,
  username: 'playwright-operator',
  password: 'e2e-only-password-2026',
};
