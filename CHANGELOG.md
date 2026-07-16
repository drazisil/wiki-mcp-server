# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-07-16

### Added

- `wiki_get_outline` — list a page's headings (index, level, text) without fetching the body.
- `wiki_get_section` — fetch a single section (a heading through the next heading at the same
  or shallower level), matched by exact/substring heading text or outline index.
- `wiki_update_section` — replace or append to a single section's content without rewriting the
  whole page.
- `wiki_search_sections` — full-text search scored per-section instead of per-page, so a section
  can be found by its content even when its heading text doesn't restate the topic.

Together these let a large page be searched and edited at section granularity instead of always
reading/writing the whole body.

## [1.0.0] - 2026-07-16

### Added

- Initial release: `wiki_create_page`, `wiki_get_page`, `wiki_update_page`, `wiki_delete_page`,
  `wiki_list_pages`, `wiki_search`, `wiki_backlinks`, `wiki_graph`.
- Plain-markdown-file storage with frontmatter (`title`, `tags`, `created`, `updated`).
- `[[slug]]`-style backlinks and a whole-wiki link graph.
- MIT license, README.
