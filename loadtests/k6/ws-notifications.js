import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter, Gauge } from 'k6/metrics';
import { apiBase, wsBaseUrl, ensureTestContext, parseJSON, uniqueSuffix } from './lib/helpers.js';

const API_BASE = apiBase();
const WS_URL = wsBaseUrl();
const WS_DWELL_SECONDS = Number(__ENV.WS_DWELL_SECONDS || 20);

const wsDuration = new Trend('ws_connection_duration', true);
const wsMessages = new Counter('ws_messages_total');
const wsErrors = new Counter('ws_errors_total');
const wsMessageGauge = new Gauge('ws_messages_per_connection');

export const options = {
  scenarios: {
    websocketClients: {
      executor: 'ramping-vus',
      exec: 'notificationSockets',
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 15 },
        { duration: '1m', target: 30 },
        { duration: '30s', target: 5 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    ws_connection_duration: ['p(95)<25000'],
    ws_errors_total: ['count==0'],
    checks: ['rate>0.95'],
  },
};

export function setup() {
  return ensureTestContext();
}

export function notificationSockets(data) {
  const ctx = buildContext(data);
  const task = createTask(ctx);
  if (!task || !task.id) {
    wsErrors.add(1);
    return;
  }

  const start = Date.now();
  let receivedMessages = 0;
  const params = {
    headers: { Authorization: `Bearer ${ctx.token}` },
    tags: { name: 'ws_notifications' },
  };

  const res = ws.connect(`${WS_URL}?ts=${Date.now()}`, params, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'subscribe', organizationId: ctx.orgId }));
      socket.setInterval(() => socket.ping(), 15000);
      socket.setTimeout(() => triggerActivity(ctx, task.id), 1000);
      socket.setTimeout(() => triggerActivity(ctx, task.id), 4000);
    });

    socket.on('message', (msg) => {
      receivedMessages += 1;
      wsMessages.add(1);
      try {
        const parsed = JSON.parse(msg);
        if (!parsed || typeof parsed.type === 'undefined') {
          wsErrors.add(1);
        }
      } catch (err) {
        wsErrors.add(1);
      }
    });

    socket.on('error', () => {
      wsErrors.add(1);
    });

    socket.setTimeout(() => {
      socket.close();
    }, WS_DWELL_SECONDS * 1000);
  });

  wsDuration.add(Date.now() - start);
  wsMessageGauge.add(receivedMessages);
  check(res, { 'ws handshake 101': (r) => r && r.status === 101 });
  sleep(Math.random() * 0.5);
}

function createTask(ctx) {
  const payload = {
    title: `WS Task ${uniqueSuffix()}`,
    description: 'Created for websocket activity test',
    organizationId: ctx.orgId,
    status: 'open',
    priority: 'medium',
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
    tags: { name: 'task_create_ws' },
  });
  check(res, { 'ws task create 201': (r) => r.status === 201 });
  return parseJSON(res);
}

function triggerActivity(ctx, taskId) {
  const body = JSON.stringify({ content: `ws comment ${uniqueSuffix()}` });
  const res = http.post(`${API_BASE}/tasks/${taskId}/comments`, body, {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
    },
    tags: { name: 'comment_create_ws' },
  });
  check(res, { 'ws comment 201': (r) => r.status === 201 });
}

function buildContext(data) {
  if (!data || !data.token) {
    throw new Error('missing auth context for ws test');
  }
  return {
    token: data.token,
    orgId: data.orgId,
    userId: data.userId,
    assigneeId: data.assigneeId,
  };
}
