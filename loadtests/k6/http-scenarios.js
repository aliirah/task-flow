import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { apiBase, ensureTestContext, parseJSON, uniqueSuffix, unwrapApiResponse } from './lib/helpers.js';

const API_BASE = apiBase();
const SEARCH_TYPES = (__ENV.SEARCH_TYPES || 'task,comment,user')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

const taskCreateDuration = new Trend('task_create_duration', true);
const taskUpdateDuration = new Trend('task_update_duration', true);
const commentCreateDuration = new Trend('comment_create_duration', true);
const notificationListDuration = new Trend('notification_list_duration', true);
const searchDuration = new Trend('search_duration', true);
const suggestDuration = new Trend('suggest_duration', true);
const scenarioFailures = new Counter('scenario_failures');

export const options = {
  scenarios: {
    userJourneys: {
      executor: 'ramping-vus',
      exec: 'userJourney',
      gracefulRampDown: '10s',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 15 },
        { duration: '1m', target: 15 },
        { duration: '30s', target: 0 },
      ],
    },
    notificationPollers: {
      executor: 'constant-arrival-rate',
      exec: 'notificationPoller',
      rate: 20,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
    searchers: {
      executor: 'constant-arrival-rate',
      exec: 'searchTraffic',
      rate: 35,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 10,
      maxVUs: 40,
      startTime: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1200'],
    checks: ['rate>0.95'],
    task_create_duration: ['p(95)<1500'],
    task_update_duration: ['p(95)<1200'],
    comment_create_duration: ['p(95)<1200'],
    search_duration: ['p(95)<1000'],
  },
};

export function setup() {
  return ensureTestContext();
}

export function userJourney(data) {
  const ctx = buildContext(data);
  const suffix = uniqueSuffix();
  group('task lifecycle', () => {
    const task = createTask(ctx, suffix);
    if (!task || !task.id) {
      scenarioFailures.add(1);
      return;
    }

    updateTask(ctx, task.id, suffix);
    const comment = createComment(ctx, task.id, suffix);
    if (comment && comment.id) {
      fetchComments(ctx, task.id);
    }
    getTask(ctx, task.id);
  });

  group('search + notifications', () => {
    runSearch(ctx, suffix);
    suggest(ctx, suffix);
    listNotifications(ctx);
  });

  sleep(Math.random() + 0.5);
}

export function notificationPoller(data) {
  const ctx = buildContext(data);
  const res = http.get(`${API_BASE}/notifications?limit=20`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    tags: { name: 'notifications_list' },
  });
  notificationListDuration.add(res.timings.duration);
  if (!check(res, { 'notifications returned 200': (r) => r.status === 200 })) {
    scenarioFailures.add(1);
    return;
  }
  const body = parseJSON(res) || {};
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems.filter(Boolean);
  if (items.length > 0) {
    const target = items[Math.floor(Math.random() * items.length)];
    http.patch(`${API_BASE}/notifications/${target.id}/read`, null, {
      headers: { Authorization: `Bearer ${ctx.token}` },
      tags: { name: 'notifications_mark_read' },
    });
  }
  sleep(0.2 + Math.random() * 0.3);
}

export function searchTraffic(data) {
  const ctx = buildContext(data);
  const query = pickQuery();
  runSearch(ctx, query);
  if (Math.random() > 0.4) {
    suggest(ctx, query.slice(0, 8));
  }
  sleep(Math.random() * 0.2);
}

function createTask(ctx, suffix) {
  const payload = {
    title: `Perf Task ${suffix}`,
    description: `Synthetic task created by k6 (${suffix})`,
    organizationId: ctx.orgId,
    priority: 'medium',
    status: 'open',
    type: 'task',
  };
  if (ctx.assigneeId) {
    payload.assigneeId = ctx.assigneeId;
  }
  if (ctx.userId) {
    payload.reporterId = ctx.userId;
  }
  const res = http.post(`${API_BASE}/tasks`, JSON.stringify(payload), {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
    },
    tags: { name: 'task_create' },
  });
  taskCreateDuration.add(res.timings.duration);
  check(res, { 'task created 201': (r) => r.status === 201 });
  return parseJSON(res);
}

function updateTask(ctx, taskId, suffix) {
  const payload = {
    status: 'in_progress',
    description: `Updated at ${new Date().toISOString()} (${suffix})`,
  };
  const res = http.patch(`${API_BASE}/tasks/${taskId}`, JSON.stringify(payload), {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
    },
    tags: { name: 'task_update' },
  });
  taskUpdateDuration.add(res.timings.duration);
  check(res, { 'task updated 200': (r) => r.status === 200 });
}

function createComment(ctx, taskId, suffix) {
  const payload = {
    content: `New k6 comment ${suffix}`,
  };
  const res = http.post(`${API_BASE}/tasks/${taskId}/comments`, JSON.stringify(payload), {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
    },
    tags: { name: 'comment_create' },
  });
  commentCreateDuration.add(res.timings.duration);
  check(res, { 'comment created 201': (r) => r.status === 201 });
  return parseJSON(res);
}

function fetchComments(ctx, taskId) {
  const res = http.get(`${API_BASE}/tasks/${taskId}/comments`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    tags: { name: 'comment_list' },
  });
  check(res, { 'comments fetched 200': (r) => r.status === 200 });
}

function getTask(ctx, taskId) {
  const res = http.get(`${API_BASE}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    tags: { name: 'task_get' },
  });
  check(res, { 'task fetched 200': (r) => r.status === 200 });
}

function listNotifications(ctx) {
  const res = http.get(`${API_BASE}/notifications?limit=10`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    tags: { name: 'notifications_list' },
  });
  notificationListDuration.add(res.timings.duration);
  check(res, { 'notifications ok': (r) => r.status === 200 });
}

function runSearch(ctx, query) {
  const typesParam = SEARCH_TYPES.length
    ? `&types=${SEARCH_TYPES.map((t) => encodeURIComponent(t)).join(',')}`
    : '';
  const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&organizationId=${encodeURIComponent(ctx.orgId)}` +
    (ctx.userId ? `&userId=${encodeURIComponent(ctx.userId)}` : '') +
    typesParam;
  const res = http.get(url, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    tags: { name: 'search_query' },
  });
  searchDuration.add(res.timings.duration);
  const body = unwrapApiResponse(res) || {};
  check(res, {
    'search 200': (r) => r.status === 200,
    'search has results array': () => Array.isArray(body.results),
  });
}

function suggest(ctx, query) {
  const url = `${API_BASE}/search/suggest?q=${encodeURIComponent(query)}&organizationId=${encodeURIComponent(ctx.orgId)}` +
    (ctx.userId ? `&userId=${encodeURIComponent(ctx.userId)}` : '');
  const res = http.get(url, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    tags: { name: 'search_suggest' },
  });
  suggestDuration.add(res.timings.duration);
  const body = unwrapApiResponse(res) || {};
  check(res, {
    'suggest 200': (r) => r.status === 200,
    'suggest has results': () => Array.isArray(body.results),
  });
}

function buildContext(data) {
  if (!data || !data.token) {
    throw new Error('Missing setup data – did auto bootstrap fail?');
  }
  return {
    token: data.token,
    orgId: data.orgId,
    userId: data.userId,
    assigneeId: data.assigneeId,
  };
}

function pickQuery() {
  const candidates = [
    'task',
    'comment',
    'status',
    'priority',
    'owner',
    'search',
    'notification',
  ];
  return candidates[Math.floor(Math.random() * candidates.length)] + ` ${Math.floor(Math.random() * 1000)}`;
}
