import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withChannel } from '../connection.js';
import { jsonResult, errorResult } from '../results.js';

export function registerRabbitMqDeleteQueue(server: McpServer): void {
  server.registerTool(
    'rabbitmq_delete_queue',
    {
      title: 'Delete queue',
      description:
        'Delete a queue (destructive: removes it + messages, unless ifEmpty/ifUnused).',
      inputSchema: {
        queue: z.string().describe('Queue name.'),
        ifEmpty: z.boolean().default(false).describe('Only if no messages.'),
        ifUnused: z
          .boolean()
          .default(false)
          .describe('Only if no consumers.'),
      },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async ({ queue, ifEmpty, ifUnused }) => {
      try {
        const res = await withChannel((ch) => ch.deleteQueue(queue, { ifEmpty, ifUnused }));
        return jsonResult({ deleted: true, queue, messageCount: res.messageCount });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
