import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withChannel } from '../connection.js';
import { jsonResult, errorResult } from '../results.js';

export function registerRabbitMqPublish(server: McpServer): void {
  server.registerTool(
    'rabbitmq_publish',
    {
      title: 'Publish message',
      description:
        'Publish a message to an exchange, or a queue (exchange="").',
      inputSchema: {
        exchange: z
          .string()
          .default('')
          .describe(
            'Target exchange; "" = default.'
          ),
        routingKey: z
          .string()
          .describe('Routing key; = queue name when exchange="."'),
        message: z.string().describe('Body (UTF-8).'),
        contentType: z.string().default('text/plain').describe('Content-Type header.'),
        persistent: z
          .boolean()
          .default(false)
          .describe('Survive broker restarts.'),
        headers: z
          .record(z.string(), z.string())
          .optional()
          .describe('Extra headers (string→string).'),
      },
      annotations: { openWorldHint: true },
    },
    async ({ exchange, routingKey, message, contentType, persistent, headers }) => {
      try {
        await withChannel((ch) => {
          const content = Buffer.from(message, 'utf8');
          ch.publish(exchange, routingKey, content, { contentType, persistent, headers });
          return Promise.resolve(true);
        });
        return jsonResult({
          published: true,
          exchange,
          routingKey,
          bytes: Buffer.byteLength(message, 'utf8'),
        });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
