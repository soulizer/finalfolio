import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function createId(bytes = 9) {
  return crypto.randomBytes(bytes).toString('base64url').replace(/[-_]/g, '').toLowerCase();
}

function createTrendBuckets({
  count,
  spanMs,
  nowMs,
  formatter,
}) {
  const startMs = nowMs - spanMs * (count - 1);
  const buckets = Array.from({ length: count }, (_, index) => {
    const bucketStartMs = startMs + spanMs * index;
    return {
      label: formatter(new Date(bucketStartMs)),
      total: 0,
      failures: 0,
    };
  });

  return {
    startMs,
    buckets,
  };
}

function populateTrendBuckets(events, { count, spanMs, nowMs, formatter }) {
  const { startMs, buckets } = createTrendBuckets({
    count,
    spanMs,
    nowMs,
    formatter,
  });

  events.forEach((event) => {
    const eventMs = Date.parse(event.createdAt);
    if (!Number.isFinite(eventMs) || eventMs < startMs || eventMs > nowMs) {
      return;
    }

    const index = Math.floor((eventMs - startMs) / spanMs);
    if (index < 0 || index >= buckets.length) {
      return;
    }

    buckets[index].total += 1;
    if (event.status === 'error') {
      buckets[index].failures += 1;
    }
  });

  return buckets;
}

export function createOpsStore({
  dataRoot,
  now = () => new Date().toISOString(),
} = {}) {
  const eventsDir = path.join(dataRoot, 'events');

  function eventPath(eventId) {
    return path.join(eventsDir, `${eventId}.json`);
  }

  async function ensureOpsDirectory() {
    await fs.mkdir(eventsDir, { recursive: true });
  }

  async function recordEvent({ type, status = 'ok', userId = null, projectId = null, detail = null } = {}) {
    const timestamp = now();
    const record = {
      id: `event-${createId()}`,
      type,
      status,
      userId,
      projectId,
      detail,
      createdAt: timestamp,
    };

    await ensureOpsDirectory();
    const filename = eventPath(record.id);
    const tempFile = `${filename}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(record, null, 2), 'utf8');
    await fs.rename(tempFile, filename);
    return record;
  }

  async function listEvents() {
    await ensureOpsDirectory();
    const entries = await fs.readdir(eventsDir, { withFileTypes: true });
    const events = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => JSON.parse(await fs.readFile(path.join(eventsDir, entry.name), 'utf8'))),
    );

    return events.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async function summarizeEvents() {
    const events = await listEvents();
    const nowMs = Date.parse(now()) || Date.now();
    const exports = events.filter((event) => event.type === 'export');
    const failures = events.filter((event) => event.status === 'error');
    const failureCounts = failures.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
      return counts;
    }, {});
    const successCounts = events.reduce((counts, event) => {
      if (event.status === 'ok') {
        counts[event.type] = (counts[event.type] ?? 0) + 1;
      }
      return counts;
    }, {});
    const typeBreakdown = events.reduce((counts, event) => {
      if (!counts[event.type]) {
        counts[event.type] = {
          total: 0,
          failures: 0,
        };
      }

      counts[event.type].total += 1;
      if (event.status === 'error') {
        counts[event.type].failures += 1;
      }
      return counts;
    }, {});

    return {
      exportCount: exports.length,
      exportFailureCount: exports.filter((event) => event.status === 'error').length,
      failureCounts,
      successCounts,
      typeBreakdown,
      recentFailures: failures.slice(-12).reverse(),
      recentEvents: events.slice(-24).reverse(),
      trends: {
        last24Hours: populateTrendBuckets(events, {
          count: 24,
          spanMs: 60 * 60 * 1000,
          nowMs,
          formatter: (date) =>
            date.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            }),
        }),
        last7Days: populateTrendBuckets(events, {
          count: 7,
          spanMs: 24 * 60 * 60 * 1000,
          nowMs,
          formatter: (date) =>
            date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            }),
        }),
      },
    };
  }

  return {
    eventsDir,
    ensureOpsDirectory,
    recordEvent,
    listEvents,
    summarizeEvents,
  };
}
