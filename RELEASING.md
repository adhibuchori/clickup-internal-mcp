# Releasing

How a version of clickup-internal-mcp ships. `package.json` holds the one version number. The MCP
`serverInfo`, `doctor` and `version` all read it from there.

## Choose the Number

[Semantic Versioning](https://semver.org):

| Bump      | When |
| --------- | ---- |
| **Major** | A tool or an argument is removed or renamed, a reference format changes, a default changes what an answer contains, a setting becomes required or is renamed, the cache needs a manual purge, or the minimum runtime goes up |
| **Minor** | A new tool, argument, mode, command, client in `setup`, or setting |
| **Patch** | A fix, a format tweak that keeps every argument, or docs |

A cache schema change (`SCHEMA_VERSION` in `src/adapters/store/schema.ts`) is not breaking on its
own: the cache rebuilds itself and keeps the tracked list. Say so in the changelog all the same,
because the first sync after the update downloads everything again.

## During Development

Every pull request that changes what users run (`src/` outside tests, runtime dependencies) adds a
line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md), in Keep a Changelog groups (Added,
Changed, Fixed, Removed, Security). A change a user has to act on starts with **Breaking:**. CI runs
`bun scripts/check/version-sync.ts --base <base>`, which fails a runtime change without a changelog
line, and a version that goes down.

## Cut a Release

1. On a branch `internal/release-X.Y.Z`:
   - set `version` in `package.json`;
   - move the `[Unreleased]` entries into a new `## [X.Y.Z] - YYYY-MM-DD` section;
   - update the compare links at the bottom.
2. Run the gates and the measurements:

   ```bash
   bash scripts/check/gates.sh
   bun run check:version
   bun run bench            # when budgets, formats, sync or search changed
   ```

   Update [docs/benchmarks.md](docs/benchmarks.md) when the numbers moved.

3. Open a pull request titled `chore: release vX.Y.Z`, wait for **Self Test**, and merge it with a
   merge commit.
4. Tag the merge commit, build the executables and publish the release with them attached:

   ```bash
   git switch main && git pull
   git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z
   bun run build
   gh release create vX.Y.Z dist/clickup-internal-mcp-* --title "vX.Y.Z" \
     --notes-file <(awk '/^## \[X.Y.Z\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md)
   ```

5. Tell the people who use it. From a checkout: `git pull && bun install`, then restart the MCP
   client. With an executable: download the new one from the release, replace the old file (keep
   `clickup-internal-mcp.env` beside it), run `<executable> version` and `<executable> doctor`, then
   restart the MCP client.

Tags never move. A mistake in a release is fixed by a new patch release.

## GitHub Settings

The repository is public, and every setting below is free for a public repository. If it ever goes
private, rulesets, secret scanning and the two security workflows need a paid plan; the pre-commit
hook and the Self Test workflow still guard the same things without them.

- A ruleset on `main`:
  - block force pushes and deletion;
  - require a pull request, merged with a merge commit;
  - require the **Self Test** status check from GitHub Actions;
  - no bypass, not even for admins.
- A tag ruleset on `v*` that blocks updates, force pushes and deletion.
- Immutable releases.
- Merge commits only, and delete the branch on merge.
- Actions:
  - workflow permissions are read-only;
  - no workflow may approve pull requests;
  - every action is pinned to a full commit SHA.
- Secret scanning with **push protection**.
- **Private vulnerability reporting.** The advisory link in [SECURITY.md](SECURITY.md) depends on it.
- **Dependabot alerts**, which also turn on the dependency graph that the dependency-review workflow
  needs.

The CodeQL and dependency-review workflows run on every pull request in a public repository. In a
private one they run only when GitHub Code Security is available and the repository variable
`CODE_SECURITY` is `true`.

Self Test runs only on pull requests, never on a push or a schedule.
