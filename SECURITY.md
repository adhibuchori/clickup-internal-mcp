# Security

clickup-internal-mcp reads a ClickUp workspace with a person's own token and hands what it reads to
an AI assistant, so it is built to be read-only toward ClickUp, to keep secrets out of every answer,
and to write as little as possible to disk. The threat model is in
[.claude/rules/security/read-only.md](.claude/rules/security/read-only.md), and the user-facing
summary in the README's "Data and privacy" section.

## Supported Versions

Only the latest release gets fixes.

## Reporting a Vulnerability

Please report it privately: open a
[security advisory](https://github.com/adhibuchori/clickup-internal-mcp/security/advisories/new) on
this repository, or contact the maintainer ([@adhibuchori](https://github.com/adhibuchori))
directly. Do not open a public issue, and leave company content out of the report. Include:

- what can be read, written, sent or reached that should not be;
- the tool call (with ids replaced) or the command that shows it;
- the version (`<executable> version`), the platform and the MCP client.

You will get an answer within a week.

## What Counts

| In scope | Out of scope |
| -------- | ------------ |
| Any request to ClickUp other than GET, or any change made in ClickUp | What the token's own ClickUp permissions already allow it to read |
| The token sent to a host other than ClickUp's, or shown in an answer, a log or an error | The MCP client's or the AI provider's handling of what the server returns |
| A secret pasted into ClickUp content reaching an answer unredacted | Prompt injection in ClickUp content that only changes what the model writes |
| A download from a host off the allowlist, also through a redirect | Content of untracked docs held in memory for a few minutes |
| Untracked content written to disk, or tracked content left behind after `remove` or `purge` | Disk encryption (FileVault, BitLocker) |
| A path outside the data or mirror folder written by the server | |

## If the Token Leaked

Revoke it first, then investigate: ClickUp → Settings → Apps → API tokens → delete the token, create
a new one, and put it in the settings file (`.env` or `clickup-internal-mcp.env`). Run `doctor` to
confirm. A token is personal: each person revokes their own.
