# wiki-mcp-server

A lightweight personal wiki [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server —
give Claude (or any MCP-compatible client) a place to save notes, plans, and memories as
connected markdown pages with full-text search and `[[wikilink]]`-style backlinks.

Think of it as a tiny, file-based "second brain" your AI assistant can read and write to directly,
without you needing to run a database or a hosted wiki.

## Why

Most AI coding assistants either forget everything between sessions, or bolt on a flat list of
memory snippets with no way to search them or see how they connect. `wiki-mcp-server` gives an
assistant a proper (if minimal) knowledge base instead:

- **Full-text search** — ranked results with snippets, across titles, tags, and body text.
- **Backlinks** — write `[[some-page-slug]]` in any page and the link is tracked automatically.
- **A link graph** — see the whole wiki as nodes and edges, e.g. to spot orphan pages.
- **Plain markdown files** — every page is just a `.md` file with a small frontmatter header. No
  database, no lock-in, easy to grep, diff, or back up with git.
- **Zero native dependencies** — pure JavaScript, installs anywhere Node.js runs.

## Features

| Tool | What it does |
|---|---|
| `wiki_create_page` | Create a new page (title, markdown content, optional tags) |
| `wiki_get_page` | Fetch a page by slug or title, including its outgoing links |
| `wiki_update_page` | Replace or append to a page's content, retitle, or retag it |
| `wiki_delete_page` | Delete a page |
| `wiki_list_pages` | List all pages, optionally filtered by tag, newest-updated first |
| `wiki_search` | Ranked full-text search with snippets |
| `wiki_backlinks` | List every page that links to a given page |
| `wiki_graph` | Get the whole wiki as a `{ nodes, edges }` graph |

## Installation

```bash
git clone https://github.com/drazisil/wiki-mcp-server.git
cd wiki-mcp-server
npm install
```

Requires Node.js 18+.

## Usage with Claude Code / Claude Desktop

Add it to your MCP server config (e.g. `~/.claude.json` for Claude Code, or the equivalent
`claude_desktop_config.json` for Claude Desktop):

```json
{
  "mcpServers": {
    "wiki": {
      "command": "node",
      "args": ["/absolute/path/to/wiki-mcp-server/index.js"]
    }
  }
}
```

Restart the client and the `wiki_*` tools will be available.

### Configuration

| Environment variable | Default | Purpose |
|---|---|---|
| `WIKI_DATA_DIR` | `./data` (next to `index.js`) | Where page files are stored |

## How pages are stored

Each page is a single markdown file, `data/<slug>.md`, with a short frontmatter header:

```markdown
---
title: My Page Title
tags: example, notes
created: 2026-07-16T12:00:00.000Z
updated: 2026-07-16T12:00:00.000Z
---

The page body goes here. Link to another page with [[other-page-slug]] and
it'll show up in that page's backlinks.
```

Because it's just files, you can version them with git, sync them with any file-sync tool, or
edit them by hand — the server just re-reads the directory on every call.

## Example

```
wiki_create_page({
  title: "Project Roadmap",
  content: "Next milestone links to [[api-redesign]].",
  tags: ["planning"]
})

wiki_search({ query: "roadmap" })
// → ranked matches with snippets

wiki_backlinks({ slug: "api-redesign" })
// → [{ slug: "project-roadmap", title: "Project Roadmap" }]
```

## License

[MIT](./LICENSE)
