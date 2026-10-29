import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withChannel } from '../connection.js';
import { jsonResult, errorResult } from '../results.js';

export function registerRabbitMqBindQueue(server: McpServer): void {
  server.registerTool(
    'rabbitmq_bind_queue',
    {
      title: 'Bind queue',
      description:
        'Bind a queue to an exchange so messages on that routing key route to it.',
      inputSchema: {
        queue: z.string().describe('Queue.'),
        exchange: z.string().describe('Exchange.'),
        routingKey: z.string().default('').describe('Routing key.'),
      },
      annotations: { openWorldHint: true },
    },
    async ({ queue, exchange, routingKey }) => {
      try {
        await withChannel((ch) => ch.bindQueue(queue, exchange, routingKey));
        return jsonResult({ bound: true, queue, exchange, routingKey });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
