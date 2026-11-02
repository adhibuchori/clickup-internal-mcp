# Using It From Any MCP Client

clickup-internal-mcp is a standard **stdio** MCP server. Any MCP client that can start a local
server works: Claude Desktop, Claude Code, Cursor, Windsurf, VS Code (Copilot Chat agent mode),
Gemini CLI, Codex CLI, and others. The tools, their descriptions and the server instructions are
written for any model, not for one assistant.

The exact snippet for your machine is printed by the server itself:

```bash
<executable> setup                    # every client
<executable> setup --client cursor    # one client: claude-desktop, claude-code, cursor,
                                      # windsurf, vscode, gemini-cli, codex-cli, other
bun run setup                         # the same, from a checkout
```

It uses absolute paths (GUI apps on macOS do not see your terminal's PATH) and never contains the
token: the server reads the token from its own settings file, so it never sits in a client's config,
and clients that filter `*TOKEN*` variables (Gemini CLI, Codex CLI) cannot drop it.

## For a Teammate Who Does Not Write Code

You need: the executable for your computer (from the person who maintains this tool), your own
ClickUp account, and an MCP client from the table below.

1. **Make a folder** for the tool, for example `C:\Tools\clickup-mcp\` on Windows or
   `~/Applications/clickup-mcp/` on a Mac, and put the executable in it:
   `clickup-internal-mcp-windows-x64.exe` (Windows) or `clickup-internal-mcp-darwin-arm64`
   (Mac with Apple silicon; `-darwin-x64` for Intel Macs).
   On a Mac, allow it once: right-click the file → Open, or run
   `xattr -d com.apple.quarantine <file>` in Terminal.
2. **Create your own ClickUp token.** ClickUp → Settings → Apps → API tokens → Create token,
   named `clickup-mcp`. Never share it and never paste it into a chat.
3. **Make the settings file** next to the executable, named `clickup-internal-mcp.env` (a plain
   text file; in Notepad choose "All files" when saving so it does not become `.env.txt`):

   ```
   CLICKUP_API_TOKEN=pk_...your token...
   CLICKUP_WORKSPACE_ID=the number right after the host in any ClickUp URL
   ```

4. **Check it.** Open a terminal (Windows: PowerShell) in that folder and run
   `.\clickup-internal-mcp-windows-x64.exe doctor` (Mac: `./clickup-internal-mcp-darwin-arm64 doctor`).
   Every line should start with `ok`.
5. **Connect your app.** Run the same executable with `setup --client <your app>` and paste the
   snippet where it says. Restart the app.
6. **Try it:** ask *"Browse ClickUp"* or paste a ClickUp doc link and ask for its requirements.

## Clients

| Client | Where the config goes | Notes |
| ------ | --------------------- | ----- |
| Claude Desktop | Settings → Developer → Edit Config (`claude_desktop_config.json`), key `mcpServers` | Shows images from `view_image`. |
| Claude Code | `claude mcp add clickup-internal --scope user -- <command>` | |
| Cursor | `~/.cursor/mcp.json` (`%USERPROFILE%\.cursor\mcp.json`), key `mcpServers` | Settings → MCP shows its status. |
| Windsurf | `~/.codeium/windsurf/mcp_config.json`, key `mcpServers` | Restart after editing. |
| VS Code | "MCP: Open User Configuration" (`mcp.json`), key `servers`, with `"type": "stdio"` | Copilot Chat in agent mode. `type` is required. |
| Gemini CLI | `~/.gemini/settings.json`, key `mcpServers` | Check with `/mcp`. |
| Codex CLI | `~/.codex/config.toml`, table `[mcp_servers.clickup-internal]` | TOML, not JSON. |
| Others | any client with stdio MCP support | command = the executable, no arguments, no env. |

Images: `view_image` returns the image as MCP image content. Clients that do not show images from
tools still get the text part and every saved note; describe images from a client that shows them.

## Not Supported Yet: Web Apps

claude.ai in the browser, ChatGPT and ClickUp Brain only connect to **remote** MCP servers over
HTTPS. That needs this server hosted somewhere reachable, with authentication, which also changes
where the ClickUp token lives (on a server instead of each person's laptop). It is a separate
decision with its own security review; see phase 8 in [plan.md](plan.md).
