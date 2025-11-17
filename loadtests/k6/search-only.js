import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { apiBase, ensureTestContext, unwrapApiResponse } from './lib/helpers.js';

const API_BASE = apiBase();
const SEARCH_TYPES = (__ENV.SEARCH_TYPES || 'task,comment,user')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

const searchTerms = new SharedArray('searchTerms', () => [
  'task backlog',
  'comment review',
  'critical bug',
  'deploy checklist',
  'notification email',
  'feature spec',
  'test plan',
  'status update',
  'customer feedback',
  'priority high',
  'design document',
  'standup notes',
  'retro action',
  'roadmap item',
  'api gateway',
  'search service',
  'websocket event',
]);

const searchTrend = new Trend('so_search_duration', true);
const suggestTrend = new Trend('so_suggest_duration', true);
const failureCounter = new Counter('so_failures');

export const options = {
  scenarios: {
    rampingQueries: {
      executor: 'ramping-arrival-rate',
      exec: 'searchLoad',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 200,
      stages: [
        { target: 20, duration: '1m' },
        { target: 60, duration: '1m30s' },
        { target: 120, duration: '1m30s' },
        { target: 10, duration: '30s' },
      ],
    },
    suggestFlood: {
      executor: 'constant-arrival-rate',
      exec: 'suggestLoad',
      rate: 45,
      timeUnit: '1s',
      preAllocatedVUs: 15,
      maxVUs: 150,
      duration: '2m',
      startTime: '45s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    so_search_duration: ['p(95)<900'],
    so_suggest_duration: ['p(95)<600'],
    checks: ['rate>0.97'],
  },
};

export function setup() {
  return ensureTestContext();
}

export function searchLoad(data) {
  const ctx = buildContext(data);
  const query = pickTerm();
  const limit = Math.random() > 0.7 ? 5 : 20;
  const typesParam = SEARCH_TYPES.length
    ? `&types=${SEARCH_TYPES.map((t) => encodeURIComponent(t)).join(',')}`
    : '';
  const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}&organizationId=${encodeURIComponent(ctx.orgId)}` +
    (ctx.userId ? `&userId=${encodeURIComponent(ctx.userId)}` : '') +
    typesParam;
  const res = http.get(url, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    tags: { name: 'search_query' },
  });
  searchTrend.add(res.timings.duration);
  const body = unwrapApiResponse(res) || {};
  if (!check(res, {
    'search status 200': (r) => r.status === 200,
    'search has json': () => Array.isArray(body.results),
  })) {
    failureCounter.add(1);
  }
  if (Math.random() > 0.6) {
    sleep(0.05);
  }
}

export function suggestLoad(data) {
  const ctx = buildContext(data);
  const seed = pickTerm();
  const prefix = seed.slice(0, Math.max(3, Math.min(12, Math.floor(seed.length / 2))));
  const url = `${API_BASE}/search/suggest?q=${encodeURIComponent(prefix)}&limit=8&organizationId=${encodeURIComponent(ctx.orgId)}` +
    (ctx.userId ? `&userId=${encodeURIComponent(ctx.userId)}` : '');
  const res = http.get(url, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    tags: { name: 'search_suggest' },
  });
  suggestTrend.add(res.timings.duration);
  const body = unwrapApiResponse(res) || {};
  if (!check(res, {
    'suggest status 200': (r) => r.status === 200,
    'suggest results array': () => Array.isArray(body.results),
  })) {
    failureCounter.add(1);
  }
  sleep(0.05);
}

function buildContext(data) {
  if (!data || !data.token) {
    throw new Error('setup state missing token');
  }
  return {
    token: data.token,
    orgId: data.orgId,
    userId: data.userId,
  };
}

function pickTerm() {
  return searchTerms[Math.floor(Math.random() * searchTerms.length)];
}
