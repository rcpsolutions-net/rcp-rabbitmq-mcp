import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { rabbitUrl } from '../connection.js';
import { jsonResult, errorResult } from '../results.js';

/* ------------------------------------------------------------------ *
 * Management HTTP API (used for listing all queues)
 *
 * The AMQP protocol can't enumerate queues, so listing goes through the
 * RabbitMQ management HTTP API (default port 15672, requires the management
 * plugin). Base URL is derived from RABBITMQ_URL unless RABBITMQ_MANAGEMENT_URL
 * is set.
 * ------------------------------------------------------------------ */

function managementBase(): { base: string; auth: string } {
  const override = process.env.RABBITMQ_MANAGEMENT_URL;
  if (override) {
    const u = new URL(override);
    const auth = Buffer.from(`${u.username}:${u.password}`).toString('base64');
    return { base: `${u.protocol}//${u.host}`, auth: `Basic ${auth}` };
  }
  const u = new URL(rabbitUrl());
  const auth = Buffer.from(`${u.username}:${u.password}`).toString('base64');
  return { base: `http://${u.hostname}:15672`, auth: `Basic ${auth}` };
}

/** Percent-encoded vhost path segment derived from RABBITMQ_URL (e.g. "%2F" for the default "/"). */
function vhostPath(): string {
  const seg = new URL(rabbitUrl()).pathname.replace(/^\//, '');
  return seg === '' ? '%2F' : seg;
}

async function managementFetch<T = unknown>(path: string): Promise<T> {
  const { base, auth } = managementBase();
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `RabbitMQ management API ${res.status} ${res.statusText}${body ? `: ${body}` : ''}`
    );
  }
  return (await res.json()) as T;
}

export function registerRabbitMqListQueues(server: McpServer): void {
  server.registerTool(
    'rabbitmq_list_queues',
    {
      title: 'List queues',
      description:
        'List all queues in the vhost (name, message/consumer counts) via management HTTP API (needs management plugin, port 15672).',
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe('Filter by name substring.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ name }) => {
      try {
        const queues = await managementFetch<Array<Record<string, unknown>>>(
          `/api/queues/${vhostPath()}`
        );
        const filtered = name ? queues.filter((q) => String(q.name).includes(name)) : queues;
        return jsonResult({
          count: filtered.length,
          queues: filtered.map((q) => ({
            name: q.name,
            messages: q.messages,
            messagesReady: q.messages_ready,
            messagesUnacknowledged: q.messages_unacknowledged,
            consumers: q.consumers,
            durable: q.durable,
            autoDelete: q.auto_delete,
          })),
        });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
