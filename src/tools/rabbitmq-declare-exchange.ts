import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withChannel } from '../connection.js';
import { jsonResult, errorResult } from '../results.js';

export function registerRabbitMqDeclareExchange(server: McpServer): void {
  server.registerTool(
    'rabbitmq_declare_exchange',
    {
      title: 'Declare exchange',
      description: 'Create/re-declare an exchange.',
      inputSchema: {
        exchange: z.string().describe('Exchange name.'),
        type: z
          .enum(['direct', 'fanout', 'topic', 'headers'])
          .default('direct')
          .describe('Exchange type.'),
        durable: z.boolean().default(true).describe('Survive broker restarts.'),
        autoDelete: z
          .boolean()
          .default(false)
          .describe('Delete when no bindings left.'),
      },
      annotations: { openWorldHint: true },
    },
    async ({ exchange, type, durable, autoDelete }) => {
      try {
        const res = await withChannel((ch) =>
          ch.assertExchange(exchange, type, { durable, autoDelete })
        );
        return jsonResult({ exchange: res.exchange, type });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
