import test from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError } from 'axios';
import apiClient, { setAuthToken, setUnauthorizedHandler } from '../src/api/client.js';
import { authAPI } from '../src/api/index.js';

const originalAdapter = apiClient.defaults.adapter;
const response = (config, data = {}, status = 200) => ({ config, data, status, statusText: '', headers: {} });
const unauthorized = config => new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, response(config, {}, 401));

test('authentication attaches the token and successful logout removes it', async () => {
  try {
    apiClient.defaults.adapter = async config => {
      if (config.url === '/auth/login') {
        assert.deepEqual(JSON.parse(config.data), { username: 'operator', password: 'password' });
        return response(config, { token: 'token-one', user: { username: 'operator' } });
      }
      if (config.url === '/auth/logout') assert.equal(config.headers.Authorization, 'Bearer token-one');
      else assert.equal(config.headers.Authorization, undefined);
      return response(config);
    };
    await authAPI.login('operator', 'password');
    await authAPI.logout();
    await apiClient.get('/after-logout');
  } finally { setAuthToken(null); apiClient.defaults.adapter = originalAdapter; }
});

test('failed login never establishes a session and network failure during logout permits retry', async () => {
  let expired = 0;
  const unsubscribe = setUnauthorizedHandler(() => expired++);
  try {
    setAuthToken(null);
    apiClient.defaults.adapter = async config => { throw unauthorized(config); };
    await assert.rejects(authAPI.login('operator', 'wrong'));
    assert.equal(expired, 0);
    setAuthToken('valid-token');
    apiClient.defaults.adapter = async () => { throw new AxiosError('Offline', 'ERR_NETWORK'); };
    await assert.rejects(authAPI.logout());
    apiClient.defaults.adapter = async config => {
      assert.equal(config.headers.Authorization, 'Bearer valid-token');
      return response(config);
    };
    await apiClient.get('/retry');
  } finally { unsubscribe(); setAuthToken(null); apiClient.defaults.adapter = originalAdapter; }
});

test('an expired session is cleared once and old responses cannot clear a newer login', async () => {
  let expired = 0;
  const unsubscribe = setUnauthorizedHandler(() => expired++);
  try {
    setAuthToken('expired');
    apiClient.defaults.adapter = async config => { throw unauthorized(config); };
    await assert.rejects(apiClient.get('/protected'));
    assert.equal(expired, 1);
    apiClient.defaults.adapter = async config => {
      assert.equal(config.headers.Authorization, undefined);
      return response(config);
    };
    await apiClient.get('/cleared');
    setAuthToken('old');
    apiClient.defaults.adapter = async config => {
      setAuthToken('new');
      throw unauthorized(config);
    };
    await assert.rejects(apiClient.get('/slow-old-request'));
    assert.equal(expired, 1);
    apiClient.defaults.adapter = async config => {
      assert.equal(config.headers.Authorization, 'Bearer new');
      return response(config);
    };
    await apiClient.get('/new-session');
  } finally { unsubscribe(); setAuthToken(null); apiClient.defaults.adapter = originalAdapter; }
});
