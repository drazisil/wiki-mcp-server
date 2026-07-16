import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.WIKI_DATA_DIR || path.join(__dirname, "data");

const LINK_RE = /\[\[([a-z0-9_-]+)\]\]/gi;

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function serializeFrontmatter(meta) {
  const lines = ["---"];
  lines.push(`title: ${meta.title}`);
  lines.push(`tags: ${(meta.tags || []).join(", ")}`);
  lines.push(`created: ${meta.created}`);
  lines.push(`updated: ${meta.updated}`);
  lines.push("---");
  return lines.join("\n");
}

function parseFrontmatter(raw) {
  const meta = { title: "", tags: [], created: "", updated: "" };
  if (!raw.startsWith("---\n")) {
    return { meta, body: raw };
  }
  const end = raw.indexOf("\n---", 4);
  if (end === -1) {
    return { meta, body: raw };
  }
  const header = raw.slice(4, end);
  const body = raw.slice(end + 4).replace(/^\n+/, "");
  for (const line of header.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === "tags") {
      meta.tags = value ? value.split(",").map((t) => t.trim()).filter(Boolean) : [];
    } else if (key in meta) {
      meta[key] = value;
    }
  }
  return { meta, body };
}

function extractLinks(body) {
  const links = new Set();
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(body)) !== null) {
    links.add(m[1].toLowerCase());
  }
  return [...links];
}

async function pagePath(slug) {
  return path.join(DATA_DIR, `${slug}.md`);
}

async function slugExists(slug) {
  try {
    await fs.access(await pagePath(slug));
    return true;
  } catch {
    return false;
  }
}

async function listSlugs() {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  return files.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
}

async function readPage(slug) {
  const raw = await fs.readFile(await pagePath(slug), "utf8");
  const { meta, body } = parseFrontmatter(raw);
  return {
    slug,
    title: meta.title || slug,
    tags: meta.tags,
    created: meta.created,
    updated: meta.updated,
    body,
    links: extractLinks(body),
  };
}

async function loadAll() {
  const slugs = await listSlugs();
  const pages = await Promise.all(slugs.map((s) => readPage(s).catch(() => null)));
  return pages.filter(Boolean);
}

export async function createPage({ title, content, tags = [] }) {
  await ensureDataDir();
  if (!title || !title.trim()) throw new Error("title is required");
  let slug = slugify(title);
  let n = 2;
  while (await slugExists(slug)) {
    // If the existing page has the same title, treat this as a duplicate error;
    // otherwise disambiguate with a numeric suffix.
    const existing = await readPage(slug);
    if (existing.title.toLowerCase() === title.toLowerCase()) {
      throw new Error(
        `A page titled "${existing.title}" already exists (slug: ${slug}). Use wiki_update_page to edit it.`
      );
    }
    slug = `${slugify(title)}-${n++}`;
  }
  const now = new Date().toISOString();
  const meta = { title, tags, created: now, updated: now };
  const raw = `${serializeFrontmatter(meta)}\n\n${content.trim()}\n`;
  await fs.writeFile(await pagePath(slug), raw, "utf8");
  return readPage(slug);
}

export async function getPage(slugOrTitle) {
  await ensureDataDir();
  const slug = slugify(slugOrTitle);
  if (await slugExists(slug)) return readPage(slug);
  // fall back to exact/loose title match
  const all = await loadAll();
  const needle = slugOrTitle.trim().toLowerCase();
  const hit =
    all.find((p) => p.title.toLowerCase() === needle) ||
    all.find((p) => p.slug === needle);
  if (!hit) throw new Error(`No page found matching "${slugOrTitle}"`);
  return hit;
}

export async function updatePage({ slug, content, title, tags, mode = "replace" }) {
  const resolvedSlug = slugify(slug);
  if (!(await slugExists(resolvedSlug))) {
    throw new Error(`No page with slug "${resolvedSlug}". Use wiki_create_page to create it.`);
  }
  const existing = await readPage(resolvedSlug);
  const newBody =
    mode === "append" ? `${existing.body.trim()}\n\n${content.trim()}` : content.trim();
  const meta = {
    title: title || existing.title,
    tags: tags !== undefined ? tags : existing.tags,
    created: existing.created,
    updated: new Date().toISOString(),
  };
  const raw = `${serializeFrontmatter(meta)}\n\n${newBody}\n`;
  await fs.writeFile(await pagePath(resolvedSlug), raw, "utf8");
  return readPage(resolvedSlug);
}

export async function deletePage(slug) {
  const resolvedSlug = slugify(slug);
  if (!(await slugExists(resolvedSlug))) {
    throw new Error(`No page with slug "${resolvedSlug}"`);
  }
  await fs.unlink(await pagePath(resolvedSlug));
  return { slug: resolvedSlug, deleted: true };
}

export async function listPages({ tag } = {}) {
  const all = await loadAll();
  const filtered = tag
    ? all.filter((p) => p.tags.some((t) => t.toLowerCase() === tag.toLowerCase()))
    : all;
  return filtered
    .map(({ slug, title, tags, created, updated, links }) => ({
      slug,
      title,
      tags,
      created,
      updated,
      linkCount: links.length,
    }))
    .sort((a, b) => (a.updated < b.updated ? 1 : -1));
}

function snippet(body, idx, radius = 60) {
  const start = Math.max(0, idx - radius);
  const end = Math.min(body.length, idx + radius);
  return `${start > 0 ? "…" : ""}${body.slice(start, end).replace(/\s+/g, " ")}${
    end < body.length ? "…" : ""
  }`;
}

export async function search(query, { limit = 10 } = {}) {
  const all = await loadAll();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const results = [];
  for (const page of all) {
    const titleLower = page.title.toLowerCase();
    const bodyLower = page.body.toLowerCase();
    const tagsLower = page.tags.map((t) => t.toLowerCase());
    let score = 0;
    let firstIdx = -1;
    for (const term of terms) {
      if (titleLower.includes(term)) score += 10;
      if (tagsLower.some((t) => t.includes(term))) score += 5;
      const idx = bodyLower.indexOf(term);
      if (idx !== -1) {
        score += 1;
        let count = 0;
        let pos = idx;
        while (pos !== -1) {
          count++;
          pos = bodyLower.indexOf(term, pos + term.length);
        }
        score += count - 1;
        if (firstIdx === -1) firstIdx = idx;
      }
    }
    if (score > 0) {
      results.push({
        slug: page.slug,
        title: page.title,
        tags: page.tags,
        score,
        snippet: firstIdx !== -1 ? snippet(page.body, firstIdx) : "",
      });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export async function backlinks(slug) {
  const resolvedSlug = slugify(slug);
  const all = await loadAll();
  return all
    .filter((p) => p.links.includes(resolvedSlug))
    .map(({ slug, title }) => ({ slug, title }));
}

export async function graph() {
  const all = await loadAll();
  const slugSet = new Set(all.map((p) => p.slug));
  const nodes = all.map(({ slug, title, tags }) => ({ slug, title, tags }));
  const edges = [];
  for (const p of all) {
    for (const target of p.links) {
      if (slugSet.has(target)) edges.push({ from: p.slug, to: target });
    }
  }
  return { nodes, edges };
}

export function dataDir() {
  return DATA_DIR;
}
