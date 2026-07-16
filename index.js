#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as db from "./db.js";

const server = new McpServer({
  name: "wiki",
  version: "1.0.0",
});

function text(obj) {
  return { content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] };
}

function errorResult(err) {
  return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
}

server.registerTool(
  "wiki_create_page",
  {
    title: "Create wiki page",
    description:
      "Create a new wiki page. Use [[slug]] in the content to link to other pages by their slug (a lowercased, hyphenated version of their title). Fails if a page with the same title already exists.",
    inputSchema: {
      title: z.string().describe("Page title, e.g. 'MCity NPS Protocol Notes'"),
      content: z.string().describe("Markdown body. Use [[other-page-slug]] to link to other pages."),
      tags: z.array(z.string()).optional().describe("Optional tags for filtering/organization"),
    },
  },
  async ({ title, content, tags }) => {
    try {
      const page = await db.createPage({ title, content, tags });
      return text(page);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_get_page",
  {
    title: "Get wiki page",
    description: "Fetch a wiki page by slug or exact title, including its outgoing links.",
    inputSchema: {
      slugOrTitle: z.string(),
    },
  },
  async ({ slugOrTitle }) => {
    try {
      const page = await db.getPage(slugOrTitle);
      return text(page);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_update_page",
  {
    title: "Update wiki page",
    description:
      "Update an existing page's content, title, or tags. mode='replace' (default) overwrites the body; mode='append' adds content to the end. Fails if the page doesn't exist.",
    inputSchema: {
      slug: z.string().describe("Slug of the page to update"),
      content: z.string().describe("New content, or content to append"),
      title: z.string().optional().describe("New title, if renaming"),
      tags: z.array(z.string()).optional().describe("Replace the tag list"),
      mode: z.enum(["replace", "append"]).optional().default("replace"),
    },
  },
  async ({ slug, content, title, tags, mode }) => {
    try {
      const page = await db.updatePage({ slug, content, title, tags, mode });
      return text(page);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_delete_page",
  {
    title: "Delete wiki page",
    description: "Permanently delete a wiki page by slug.",
    inputSchema: {
      slug: z.string(),
    },
  },
  async ({ slug }) => {
    try {
      const result = await db.deletePage(slug);
      return text(result);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_list_pages",
  {
    title: "List wiki pages",
    description: "List all wiki pages (slug, title, tags, timestamps), optionally filtered by tag. Sorted by most recently updated.",
    inputSchema: {
      tag: z.string().optional(),
    },
  },
  async ({ tag }) => {
    try {
      const pages = await db.listPages({ tag });
      return text(pages);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_search",
  {
    title: "Search wiki",
    description:
      "Full-text search across page titles, tags, and body content. Returns ranked results with a text snippet around the first match.",
    inputSchema: {
      query: z.string(),
      limit: z.number().int().positive().max(50).optional().default(10),
    },
  },
  async ({ query, limit }) => {
    try {
      const results = await db.search(query, { limit });
      return text(results);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_search_sections",
  {
    title: "Search within page sections",
    description:
      "Full-text search scored per-section instead of per-page: each result is a specific heading plus everything under it, not a whole-page snippet. This is the direct way to find which section covers a topic — skip the outline-then-guess-the-heading step, since a section's content can be about X even when its heading text doesn't say X. Optionally scope to one page via slugOrTitle; omit to search every page's sections.",
    inputSchema: {
      query: z.string(),
      slugOrTitle: z.string().optional().describe("Restrict to one page's sections; omit to search across all pages"),
      limit: z.number().int().positive().max(50).optional().default(10),
    },
  },
  async ({ query, slugOrTitle, limit }) => {
    try {
      const results = await db.searchSections(query, { slugOrTitle, limit });
      return text(results);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_get_outline",
  {
    title: "Get wiki page outline",
    description:
      "List a page's markdown headings (index, level, heading text) without fetching the body. Use this first on a large page to see what sections exist, then pass the heading text or its index to wiki_get_section/wiki_update_section.",
    inputSchema: {
      slugOrTitle: z.string(),
    },
  },
  async ({ slugOrTitle }) => {
    try {
      const outline = await db.getOutline(slugOrTitle);
      return text(outline);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_get_section",
  {
    title: "Get one section of a wiki page",
    description:
      "Fetch a single section (a heading plus everything under it, up to the next heading of the same or shallower level) instead of the whole page. Match by 'heading' (exact text, or a case-insensitive substring if unambiguous) or by 'index' (1-based, from wiki_get_outline). Errors with a candidate list if the heading substring is ambiguous.",
    inputSchema: {
      slugOrTitle: z.string(),
      heading: z.string().optional().describe("Exact heading text, or a unique case-insensitive substring of it"),
      index: z.number().int().positive().optional().describe("1-based section index from wiki_get_outline"),
    },
  },
  async ({ slugOrTitle, heading, index }) => {
    try {
      const section = await db.getSection(slugOrTitle, { heading, index });
      return text(section);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_update_section",
  {
    title: "Update one section of a wiki page",
    description:
      "Replace or append to a single section's content without touching the rest of the page. Match the section the same way as wiki_get_section ('heading' or 'index'). mode='replace' (default) overwrites the whole section including its heading line (include the heading line in 'content' — omitting it deletes the heading); mode='append' adds content to the end of the existing section, keeping its current heading and body.",
    inputSchema: {
      slug: z.string().describe("Slug of the page to update"),
      heading: z.string().optional().describe("Exact heading text, or a unique case-insensitive substring of it"),
      index: z.number().int().positive().optional().describe("1-based section index from wiki_get_outline"),
      content: z.string().describe("New section content (replace mode: include the heading line; append mode: just the text to add)"),
      mode: z.enum(["replace", "append"]).optional().default("replace"),
    },
  },
  async ({ slug, heading, index, content, mode }) => {
    try {
      const page = await db.updateSection({ slug, heading, index, content, mode });
      return text(page);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_backlinks",
  {
    title: "Get backlinks",
    description: "List all pages that link to the given page via [[slug]] syntax.",
    inputSchema: {
      slug: z.string(),
    },
  },
  async ({ slug }) => {
    try {
      const links = await db.backlinks(slug);
      return text(links);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "wiki_graph",
  {
    title: "Get link graph",
    description: "Return the full wiki as a node/edge graph (nodes = pages, edges = [[slug]] links between them). Useful for spotting orphan pages or clusters.",
    inputSchema: {},
  },
  async () => {
    try {
      const g = await db.graph();
      return text(g);
    } catch (err) {
      return errorResult(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
