#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerRabbitMqTools } from './rabbitmq.js';

/**
 * Standalone RabbitMQ MCP server.
 *
 * Speaks the MCP protocol over stdio — plug it into any MCP client
 * (OpenCode, Claude Desktop, etc.):
 *
 *   {
 *     "mcpServers": {
 *       "rabbitmq": {
 *         "command": "node",
 *         "args": ["/abs/path/to/rcp-rabbitmq-mcp/dist/index.js"],
 *         "env": { "RABBITMQ_URL": "amqp://guest:guest@localhost:5672/" }
 *       }
 *     }
 *   }
 *
 * All logging goes to stderr so stdout stays clean for the MCP protocol.
 */
async function main(): Promise<void> {
  const server = new McpServer({
    name: 'rabbitmq',
    version: '0.1.0',
  });

  registerRabbitMqTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[rcp-rabbitmq-mcp] RabbitMQ MCP server running on stdio.');
}

main().catch((err) => {
  console.error('[rcp-rabbitmq-mcp] fatal:', err);
  process.exit(1);
});
