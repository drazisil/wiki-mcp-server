# wiki MCP server

Lightweight personal wiki for Claude to save memories, plans, and notes into — with full-text
search and `[[wikilink]]`-style backlinks, unlike the flat auto-memory files.

Pages are markdown files with a small frontmatter header, stored one-per-file in `data/`
(a separate git repo for history). No native dependencies — pure JS, no build step.

## Tools

- `wiki_create_page(title, content, tags?)` — create a page; content can use `[[slug]]` to link
- `wiki_get_page(slugOrTitle)` — fetch a page and its outgoing links
- `wiki_update_page(slug, content, title?, tags?, mode: replace|append)`
- `wiki_delete_page(slug)`
- `wiki_list_pages(tag?)` — sorted by most recently updated
- `wiki_search(query, limit?)` — ranked full-text search with snippets
- `wiki_backlinks(slug)` — pages that link to this one
- `wiki_graph()` — full node/edge graph, useful for spotting orphan pages or clusters

## Config

Data directory defaults to `./data` next to this file; override with `WIKI_DATA_DIR`.
Registered globally in `~/.claude.json` under `mcpServers.wiki`.
