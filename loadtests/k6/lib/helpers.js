import http from 'k6/http';
import { check, sleep } from 'k6';

export function baseUrl() {
  return (__ENV.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
}

export function apiBase() {
  return `${baseUrl()}/api`;
}

export function wsBaseUrl() {
  if (__ENV.WS_URL) {
    return __ENV.WS_URL.replace(/\/$/, '');
  }
  const url = baseUrl();
  if (url.startsWith('https://')) {
    return url.replace('https://', 'wss://') + '/api/ws';
  }
  if (url.startsWith('http://')) {
    return url.replace('http://', 'ws://') + '/api/ws';
  }
  return `ws://${url}/api/ws`;
}

export function boolFromEnv(key, defaultValue) {
  const raw = (__ENV[key] || '').toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return defaultValue;
}

const AUTO_SIGNUP = boolFromEnv('K6_AUTO_SIGNUP', true);
const AUTO_CREATE_ORG = boolFromEnv('K6_AUTO_CREATE_ORG', true);
const SIGNUP_RETRIES = Math.max(1, Number(__ENV.K6_SIGNUP_RETRIES || 3));
const SIGNUP_RETRY_DELAY = Math.max(0.25, Number(__ENV.K6_SIGNUP_RETRY_DELAY || 1));
const HAS_STATIC_USER = Boolean(__ENV.USER_EMAIL);

export function ensureTestContext() {
  const auth = ensureUserSession();
  const orgId = ensureOrganization(auth);
  const assigneeId = __ENV.ASSIGNEE_ID || (auth.user && auth.user.id) || '';
  return {
    token: auth.token,
    refreshToken: auth.refreshToken,
    user: auth.user,
    email: auth.email,
    password: auth.password,
    orgId,
    userId: (auth.user && auth.user.id) || '',
    assigneeId,
  };
}

function ensureUserSession() {
  let email = __ENV.USER_EMAIL;
  let password = __ENV.USER_PASSWORD;
  if (HAS_STATIC_USER && !password) {
    throw new Error('USER_PASSWORD is required when USER_EMAIL is provided');
  }

  if (!HAS_STATIC_USER) {
    return createRandomUserSession();
  }

  const loginAttempt = loginUser(email, password);
  if (loginAttempt.success) {
    return normalizeSession(loginAttempt.tokens, email, password);
  }

  if (!AUTO_SIGNUP) {
    const status = loginAttempt.response ? loginAttempt.response.status : 'unknown';
    throw new Error(`Login failed for ${email}: ${loginAttempt.error || status}`);
  }

  const profile = buildProfile({ email, password });
  const signup = signupUser(profile);
  console.log(`[k6] Auto-registered missing user ${profile.email}`);
  const result = finalizeSession(signup, profile);
  if (result.session) {
    return result.session;
  }
  throw new Error(`Login failed immediately after signup for ${profile.email}: ${result.error || 'unknown'}`);
}

function ensureOrganization(auth) {
  let token = auth.token;
  let lastStatus = 0;
  let lastBody = '';
  if (__ENV.ORG_ID) {
    return __ENV.ORG_ID;
  }
  if (!AUTO_CREATE_ORG) {
    throw new Error('ORG_ID not provided and auto organization creation disabled (set K6_AUTO_CREATE_ORG=true)');
  }
  const payload = {
    name: `K6 Org ${uniqueSuffix()}`,
    description: 'Automatically created for load testing',
  };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = http.post(`${apiBase()}/organizations`, JSON.stringify(payload), {
      headers: authHeaders(token),
      tags: { name: 'org_create' },
    });
    lastStatus = res.status;
    lastBody = res.body;
    if (res.status === 201) {
      const body = unwrapApiResponse(res) || {};
      const orgId = body.id || body.organizationId;
      if (!orgId) {
        throw new Error('Organization create response missing id');
      }
      console.log(`[k6] Created test organization ${orgId}`);
      return orgId;
    }
    if (res.status === 401 && auth.email && auth.password) {
      const login = loginUser(auth.email, auth.password);
      if (login.success) {
        auth.token = login.tokens.accessToken;
        auth.refreshToken = login.tokens.refreshToken;
        auth.user = login.tokens.user;
        token = auth.token;
        console.warn('[k6] organization create got 401, refreshed token and retrying');
        sleep(1 * attempt);
        continue;
      }
      if (!HAS_STATIC_USER && AUTO_SIGNUP) {
        console.warn('[k6] organization create 401 persisted, creating fresh user');
        const fresh = createRandomUserSession();
        auth.token = fresh.token;
        auth.refreshToken = fresh.refreshToken;
        auth.user = fresh.user;
        auth.email = fresh.email;
        auth.password = fresh.password;
        token = auth.token;
        sleep(1 * attempt);
        continue;
      }
    }
    sleep(1 * attempt);
    throw new Error(`Failed to create organization: ${res.status} ${res.body}`);
  }
  throw new Error(`Failed to create organization after retries (last status ${lastStatus}): ${lastBody}`);
}

function signupUser(profile, options = {}) {
  const { regenerateOnConflict = false } = options;
  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 1; attempt <= SIGNUP_RETRIES; attempt += 1) {
    const payload = {
      email: profile.email,
      password: profile.password,
      firstName: profile.firstName,
      lastName: profile.lastName,
    };
    const res = http.post(`${apiBase()}/auth/signup`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_signup' },
    });
    const parsed = unwrapApiResponse(res) || {};
    if (res.status === 201) {
      check(res, { 'signup created': () => true });
      return parsed;
    }
    if (res.status === 409) {
      const login = loginUser(profile.email, profile.password);
      if (login.success) {
        console.warn(`[k6] signup detected existing user ${profile.email}, using login response`);
        return login.tokens;
      }
      if (regenerateOnConflict) {
        const fresh = buildProfile();
        profile.email = fresh.email;
        profile.password = fresh.password;
        profile.firstName = fresh.firstName;
        profile.lastName = fresh.lastName;
        console.warn(`[k6] email conflict, generated new user ${profile.email}`);
        continue;
      }
    }
    check(res, { 'signup created': () => false });
    lastStatus = res.status;
    lastBody = res.body;
    console.warn(`[k6] signup attempt ${attempt} failed (status=${res.status})`);
    if (attempt < SIGNUP_RETRIES) {
      sleep(SIGNUP_RETRY_DELAY * attempt);
    }
  }
  throw new Error(`Signup failed for ${profile.email} after ${SIGNUP_RETRIES} attempts: ${lastStatus} ${lastBody}`);
}

function loginUser(email, password) {
  const res = http.post(`${apiBase()}/auth/login`, JSON.stringify({
    identifier: email,
    password,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'auth_login' },
  });
  if (res.status >= 200 && res.status < 300) {
    const body = unwrapApiResponse(res) || {};
    if (!body.accessToken) {
      return { success: false, response: res, error: 'missing access token' };
      }
    return { success: true, tokens: body };
  }
  return { success: false, response: res, error: res.body };
}

function buildProfile(overrides = {}) {
  const suffix = uniqueSuffix();
  return {
    email: overrides.email || `k6-${suffix}@loadtests.local`,
    password: overrides.password || `K6!${randomString(12)}`,
    firstName: overrides.firstName || `K6${suffix.slice(0, 4)}`,
    lastName: overrides.lastName || 'User',
  };
}

function createRandomUserSession() {
  let profile = buildProfile();
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const signup = signupUser(profile, { regenerateOnConflict: true });
    console.log(`[k6] Registered test user ${profile.email}`);
    const { session, error } = finalizeSession(signup, profile);
    if (session) {
      return session;
    }
    lastError = error || lastError;
    console.warn(`[k6] bootstrap attempt ${attempt} failed for ${profile.email} (reason: ${lastError}), trying new user`);
    profile = buildProfile();
    sleep(0.75 * attempt);
  }
  throw new Error(`Failed to bootstrap random user session after retries: ${lastError}`);
}

function finalizeSession(signup, profile) {
  const login = loginUser(profile.email, profile.password);
  if (login.success) {
    return { session: normalizeSession(login.tokens, profile.email, profile.password), error: null };
  }
  if (signup && signup.accessToken) {
    console.warn(`[k6] login after signup failed (${login.error || (login.response && login.response.status)}), using signup token`);
    return { session: normalizeSession(signup, profile.email, profile.password), error: null };
  }
  const error = login.error || (login.response && login.response.status) || 'unknown';
  return { session: null, error };
}

function normalizeSession(tokens, email, password) {
  if (!tokens || !tokens.accessToken) {
    throw new Error('auth tokens missing accessToken');
  }
  const trimmedToken = String(tokens.accessToken || '').trim();
  if (!trimmedToken) {
    throw new Error('auth accessToken empty after trim');
  }
  return {
    token: trimmedToken,
    refreshToken: (tokens.refreshToken || '').trim(),
    user: tokens.user,
    email,
    password,
  };
}

export function unwrapApiResponse(res) {
  const parsed = parseJSON(res);
  if (parsed && typeof parsed === 'object') {
    if (parsed.data && typeof parsed.data === 'object') {
      return parsed.data;
    }
    if (parsed.result && typeof parsed.result === 'object') {
      return parsed.result;
    }
  }
  return parsed;
}

export function parseJSON(res) {
  if (!res) return null;
  try {
    return res.json();
  } catch (err) {
    try {
      return JSON.parse(res.body);
    } catch (_) {
      return null;
    }
  }
}

export function uniqueSuffix() {
  const vu = typeof __VU === 'undefined' ? 'vu' : __VU;
  const iter = typeof __ITER === 'undefined' ? 'it' : __ITER;
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}-${vu}-${iter}`;
}

export function randomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function authHeaders(token, extra = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach((key) => {
      headers[key] = extra[key];
    });
  }
  return headers;
}
