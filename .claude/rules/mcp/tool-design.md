---
paths:
  - 'src/tools/**'
  - 'src/engine/**'
---

# MCP Tool Design

Every answer is read by a model with a limited context, through whichever MCP client the user has;
tokens are the cost. `AGENTS.md` Rules 49–53 are the enforced subset.

- **Bounded by default.** Every tool has a default limit, a hard character budget and a cursor or a
  narrowing hint. No tool can return an unbounded list (Rule 49).
- **Step down, then cut.** Render the most detailed level that fits (`pickLevel`): full → trimmed
  description and fewer comments → essentials. Only the last level is ever truncated.
- **Text, not JSON.** No `structuredContent`. One line per item, the reference first.
- **References are inputs.** Every reference printed (`task:…`, `doc:…/page:…`, `list:…`, `img:…`)
  is accepted back, and so is any ClickUp URL from any `*.clickup.com` host.
- **Progressive disclosure.** `browse` before reading, an outline before page content, a note before
  the image itself.
- **Errors steer.** A `ToolError` says what was wrong and gives a hint with a valid example; ClickUp
  refusals become ToolErrors in `engine/api/guard.ts`. Any other error is logged and reported
  generically.
- **Client-neutral.** Descriptions and server instructions name no assistant and assume no client
  feature beyond tools. Images are an extra: every answer works as text alone.
- **Descriptions** are 3–4 sentences with one JSON example, under 2,048 characters, in English. Tool
  names are snake_case without dots.
- **≤ 9 tools.** More tools cost tokens on every request and confuse selection; extend an existing
  tool with a mode or argument before adding one.
- **Measure.** A change to budgets, formats, sync or search runs `bun run bench` before and after.
