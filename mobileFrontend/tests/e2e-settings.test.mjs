import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('browser test ports keep loopback origins isolated and reject invalid or overlapping ports', () => {
  const run = (api, web) => spawnSync(process.execPath, ['-e', 'const {apiURL,webURL,outputRoot}=require("./tests/e2e/settings.cjs"); console.log(JSON.stringify({apiURL,webURL,outputRoot}));'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8',
    env: { ...process.env, BEVDIST_E2E_API_PORT: api, BEVDIST_E2E_WEB_PORT: web },
  });
  assert.deepEqual(JSON.parse(run('5017', '8087').stdout), { apiURL: 'http://127.0.0.1:5017', webURL: 'http://127.0.0.1:8087', outputRoot: 'dist' });
  assert.deepEqual(JSON.parse(run('5018', '8088').stdout), { apiURL: 'http://127.0.0.1:5018', webURL: 'http://127.0.0.1:8088', outputRoot: 'dist/e2e-5018-8088' });
  for (const [api, web] of [['0', '8088'], ['65536', '8088'], ['5018.5', '8088'], ['localhost', '8088'], ['5018', '5018']]) assert.notEqual(run(api, web).status, 0);
});
