import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withChannel } from '../connection.js';
import { jsonResult, errorResult } from '../results.js';

export function registerRabbitMqCheckQueue(server: McpServer): void {
  server.registerTool(
    'rabbitmq_check_queue',
    {
      title: 'Inspect queue',
      description:
        'Inspect one queue (exists + message/consumer counts) via AMQP; no management plugin needed.',
      inputSchema: {
        queue: z.string().describe('Queue name.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ queue }) => {
      try {
        const res = await withChannel((ch) => ch.checkQueue(queue));
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
