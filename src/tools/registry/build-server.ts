/** The MCP server with every tool registered, in a stable order. */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browseTool } from '../browse/index.ts';
import { readDocTool } from '../docs/index.ts';
import { noteImageTool, viewImageTool } from '../images/index.ts';
import { searchTool } from '../search/index.ts';
import { listTasksTool, readTaskTool } from '../tasks/index.ts';
import { changesTool, trackTool } from '../tracking/index.ts';
import type { ToolContext, ToolRegistrar } from './define-tool.ts';
import { serverInstructions } from './instructions.ts';

const TOOLS: readonly ToolRegistrar[] = [
  browseTool,
  readDocTool,
  readTaskTool,
  listTasksTool,
  searchTool,
  trackTool,
  changesTool,
  viewImageTool,
  noteImageTool,
];

const SERVER_NAME = 'clickup-internal-mcp';

export function buildMcpServer(context: ToolContext, version: string): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version },
    { instructions: serverInstructions(context.deps.stores.tracked.list().length) },
  );
  for (const register of TOOLS) register(server, context);
  return server;
}
