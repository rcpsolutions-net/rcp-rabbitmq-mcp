import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withChannel } from '../connection.js';
import { jsonResult, errorResult } from '../results.js';

export function registerRabbitMqDeclareQueue(server: McpServer): void {
  server.registerTool(
    'rabbitmq_declare_queue',
    {
      title: 'Declare queue',
      description:
        'Create/re-declare a queue (idempotent if options match).',
      inputSchema: {
        queue: z.string().describe('Queue name.'),
        durable: z.boolean().default(true).describe('Survive broker restarts.'),
        exclusive: z
          .boolean()
          .default(false)
          .describe('Scoped to this connection.'),
        autoDelete: z
          .boolean()
          .default(false)
          .describe('Delete when last consumer disconnects.'),
        messageTtl: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('TTL (ms).'),
      },
      annotations: { openWorldHint: true },
    },
    async ({ queue, durable, exclusive, autoDelete, messageTtl }) => {
      try {
        const res = await withChannel((ch) =>
          ch.assertQueue(queue, { durable, exclusive, autoDelete, messageTtl })
        );
        return jsonResult({
          queue: res.queue,
          messageCount: res.messageCount,
          consumerCount: res.consumerCount,
        });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
