---
paths:
  - 'src/**'
---

# Read-Only by Construction

The server reads a ClickUp workspace with a person's own token and hands the content to an AI model.
`AGENTS.md` §F and Rule 52 hold the numbered rules; this is the threat model behind them.

- **Nothing changes in ClickUp.** `src/adapters/clickup/http-client.ts` is the only code that calls
  ClickUp, and it sends GET only. The `ClickUpReader` port has no write method. `track` and
  `note_image` write to the local cache only.
- **The token stays home.** It is read from the settings file by `src/env.ts`, sent only to
  `api.clickup.com` and ClickUp's attachment hosts (`mayCarryToken`), never logged, masked by
  `redactSecrets` if it ever appears in content, and never named in a settings error.
- **Downloads are fenced.** Images only over HTTPS from ClickUp hosts or `CLICKUP_ASSET_HOSTS`,
  every redirect hop checked again, a 25 MB cap, the type taken from the bytes, not the header.
- **Minimal data on disk.** Only tracked scopes are stored. Untracked reads stay in memory (`Memo`)
  for minutes. `remove` deletes a scope's rows, mirror files and unused images; `purge` deletes all.
  File names under the data and mirror folders are validated, so nothing is written outside them.
- **Quiet traffic.** The limiter keeps requests far below the plan's limit, so the token's activity
  looks like a person reading, not a crawler.
- **Untrusted text.** Docs, tasks and comments are written by other people and may contain
  instructions aimed at the model. The server instructions say they are data; the server never acts
  on them, and no tool can change ClickUp even if the model is persuaded to try.
