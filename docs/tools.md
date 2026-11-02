# Tools

Nine tools. All of them are read-only toward ClickUp; `track` and `note_image` write to the local
cache only. Every tool accepts ClickUp URLs from any `*.clickup.com` host and the references the
others print. Answers are text, held under a character budget (40,000 by default); long answers
step down in detail first and then offer a cursor or a narrowing hint.

## References

| Reference | Example | Also accepted |
| --------- | ------- | ------------- |
| Task | `task:86c1abcde`, `task:ABC-123` (custom id) | `https://app.clickup.com/t/86c1abcde`, `.../t/<ws>/ABC-123`, `#86c1abcde` |
| Doc / page | `doc:8cdu22c-13133`, `doc:8cdu22c-13133/page:8cdu22c-4321` | `.../<ws>/v/dc/<doc>/<page>`, shared `.../d/h/<doc>/<hash>/<page>` |
| List, folder, space | `list:901812`, `folder:90181`, `space:90180` | `.../v/li/<id>`, `.../v/f/<id>`, `.../v/s/<id>`, view URLs `.../v/l/6-<id>-1` |
| Image | `img:3f2a9c1b7d4e` | the image URL `read_doc` printed |

A bare number is ambiguous (list, folder or space) and is refused with a hint.

## `browse`

`{ target?, fresh? }`. No target: the spaces. A space: its folders (with their lists), the lists
outside folders, and the docs directly under it. A folder or a list: what is inside, and its docs.
Answers are remembered in memory for ten minutes; `fresh` reloads.

## `read_doc`

`{ doc, page?, mode: auto | outline | full, fresh?, cursor? }`. A doc reference shows the outline
(page tree with sizes and image counts), or the page itself when the doc has one page. A page
reference, or `page` with an id or (part of) a name, shows that page. `full` shows every page. Each
image becomes one line:

- `[image img:… "alt". Note: …]` when it has a saved note,
- `[image img:… "alt": no note yet. view_image img:…, then note_image]` when it is cached,
- `[image "alt": not downloaded. view_image <url>]` for a doc that is not tracked.

Figma, whiteboard, other doc, task and video links are listed at the end. Tracked docs are served
from the cache and re-synced first when older than 30 minutes; if ClickUp is unreachable, the
cached copy is served with a note. Untracked docs are read live and kept in memory for 5 minutes.

## `read_task`

`{ task, comments? }`. Status, priority, list and folder, assignees, creator, tags, dates (in the
configured time zone), parent, URL, description (Markdown), custom fields (dropdowns, labels,
people and dates by name), subtasks, attachments, comments (oldest first). Read live, kept in
memory for one minute; a tracked copy is shown with a note when ClickUp is unreachable.

## `list_tasks`

`{ in, status?, assignee?, tag?, updated_since?, due_before?, include_closed?, page? }`. Tasks of a
list, folder or space, newest update first, 100 per page. `assignee` is `me` or a numeric user id.
Times are `7d`, `24h`, `2w` or a date such as `2026-11-01` (start of that day in your time zone).

## `search`

`{ query, kinds?: [docs, tasks, comments], in?, limit?, cursor? }`. Full-text over tracked content,
BM25 with titles weighted four times. Words match as prefixes, `"quoted phrases"` exactly. When no
result has every word, results with any word are shown and the answer says so. `in` narrows to a
tracked doc, list, folder or space.

## `track`

`{ action: add | remove | list | sync, target? }`.

- `add` a doc: its pages and images. A list: its tasks (incremental by update time), their
  comments, and the docs under the list. A folder or a space: the same for its lists and folders.
  The first sync waits up to 45 seconds, then continues in the background.
- `remove`: deletes the scope's docs, pages, revisions, tasks, comments, mirror files and any image
  no other page uses.
- `list`: each scope with its freshness and status, and how many images still lack a note.
- `sync`: one scope, or every scope.

## `changes`

`{ since?, sync? }`. Without `since`: changes since the previous call, which moves that mark. With
`since`: from that time, mark untouched. Page changes come with a line diff (up to 40 lines per
page); task events say what changed (status, assignees, priority, due date, description, tags,
subtasks, new tasks). Scopes older than ten minutes are synced first unless `sync` is false.

## `view_image`

`{ image }`. Returns the image itself (PNG, JPEG, GIF, WebP up to 5 MB) with its saved note. SVG,
PDF and larger files are described, not shown. A URL not seen before is downloaded from an allowed
host.

## `note_image`

`{ image, note }`. Saves a description of an image (up to 4,000 characters). `read_doc` prints it
in place of the image. The note belongs to the image content and is reused until the image changes.
