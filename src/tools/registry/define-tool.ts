/**
 * How a tool is declared and registered. Every answer is redacted and held under the response
 * budget, and every failure becomes an `isError` result the model can act on (a ToolError keeps its
 * message and hint; anything else stays generic and is logged). A tool may add one image to its
 * answer; the image is never redacted or cut, only the text is.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { describeError, ToolError } from '../../core/errors/tool-error.ts';
import { truncateText } from '../../core/output/budget.ts';
import { redactSecrets } from '../../core/security/redact.ts';
import type { EngineDeps } from '../../engine/deps/engine-deps.types.ts';

export interface ToolContext {
  readonly deps: EngineDeps;
  /** Character budget for one answer. */
  readonly budget: number;
}

interface ToolAnswer {
  readonly text: string;
  readonly image?: { readonly data: string; readonly mimeType: string };
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  /* Tools reach ClickUp, a system outside this machine. */
  openWorldHint: true,
};

export interface ToolDef<Shape extends z.ZodRawShape> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: Shape;
  /** Only for a tool that changes local state (track, note_image); the default is read-only. */
  readonly annotations?: Partial<typeof READ_ONLY>;
  run(args: z.output<z.ZodObject<Shape>>, context: ToolContext): Promise<string | ToolAnswer>;
}

export type ToolRegistrar = (server: McpServer, context: ToolContext) => void;

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };
type Result = { content: Content[]; isError?: boolean };

function toContent(answer: string | ToolAnswer, budget: number): Content[] {
  const { text, image } = typeof answer === 'string' ? { text: answer, image: undefined } : answer;
  const content: Content[] = [{ type: 'text', text: truncateText(redactSecrets(text), budget) }];
  if (image) content.push({ type: 'image', data: image.data, mimeType: image.mimeType });
  return content;
}

/** Arguments arrive already validated by the SDK; parsing them again gives the tool its exact types. */
async function execute<Shape extends z.ZodRawShape>(
  def: ToolDef<Shape>,
  args: unknown,
  context: ToolContext,
): Promise<Result> {
  const { clock, logger } = context.deps;
  const started = clock.now();
  try {
    const parsed = z.object(def.input).parse(args);
    const content = toContent(await def.run(parsed, context), context.budget);
    const chars = content[0]?.type === 'text' ? content[0].text.length : 0;
    logger.info('tool', {
      tool: def.name,
      ms: clock.now() - started,
      chars,
      tokens: Math.ceil(chars / 4),
      image: content.length > 1,
    });
    return { content };
  } catch (error) {
    if (!(error instanceof ToolError))
      logger.error('tool failed', {
        tool: def.name,
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
    return { content: [{ type: 'text', text: `Error: ${describeError(error)}` }], isError: true };
  }
}

export function defineTool<Shape extends z.ZodRawShape>(def: ToolDef<Shape>): ToolRegistrar {
  /* Widened to the plain shape type so the SDK's callback type resolves; execute() restores the
     exact argument types by parsing. */
  const inputSchema: z.ZodRawShape = def.input;
  return (server, context) => {
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema,
        annotations: { title: def.title, ...READ_ONLY, ...def.annotations },
      },
      (args: unknown) => execute(def, args, context),
    );
  };
}
