/**
 * Generates 002_seed_events.sql by parsing lib/data.ts and lib/metro-events.ts
 * Run: node scripts/generate-seed-sql.cjs
 */
const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../lib/data.ts");
const metroPath = path.join(__dirname, "../lib/metro-events.ts");

function extractEvents(content, idPrefix = "") {
  const events = [];
  const eventRegex = /\{\s*id:\s*["']([^"']+)["'],\s*title:\s*["']((?:[^"\\]|\\.)*)["'],\s*type:\s*["']([^"']+)["'],\s*intensity:\s*["']([^"']+)["'],\s*date:\s*["']([^"']+)["'],\s*excerpt:\s*["']((?:[^"\\]|\\.)*)["'],\s*description:\s*["']((?:[^"\\]|\\.)*)["'],\s*location:\s*["']((?:[^"\\]|\\.)*)["'],\s*coords:\s*\{\s*lat:\s*([\d.-]+),\s*lng:\s*([\d.-]+)\s*\}[\s\S]*?\}/g;
  let m;
  while ((m = eventRegex.exec(content)) !== null) {
    events.push({
      id: m[1],
      title: m[2].replace(/\\'/g, "'"),
      type: m[3],
      intensity: m[4],
      date: m[5],
      excerpt: m[6].replace(/\\'/g, "'"),
      description: m[7].replace(/\\'/g, "'"),
      location: m[8].replace(/\\'/g, "'"),
      lat: parseFloat(m[9]),
      lng: parseFloat(m[10]),
    });
  }
  // Multi-line description pattern
  const altRegex = /\{\s*id:\s*["']([^"']+)["'],\s*title:\s*["']((?:[^"\\]|\\.)*)["'],\s*type:\s*["']([^"']+)["'],\s*intensity:\s*["']([^"']+)["'],\s*date:\s*["']([^"']+)["'],\s*excerpt:\s*["']((?:[^"\\]|\\.)*)["'],\s*description:\s*([\s\S]*?),\s*location:\s*["']((?:[^"\\]|\\.)*)["'],\s*coords:\s*\{\s*lat:\s*([\d.-]+),\s*lng:\s*([\d.-]+)\s*\}/g;
  return events;
}

// Simpler: match each object by balancing braces
function extractEventObjects(content) {
  const events = [];
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("id:") && line.includes("e0") || line.includes("me")) {
      let obj = "";
      let depth = 0;
      let start = line.indexOf("{");
      if (start === -1) {
        i++;
        continue;
      }
      obj = line.substring(start);
      depth = (obj.match(/\{/g) || []).length - (obj.match(/\}/g) || []).length;
      i++;
      while (depth > 0 && i < lines.length) {
        obj += "\n" + lines[i];
        depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
        i++;
      }
      const e = parseEventObj(obj);
      if (e) events.push(e);
    } else {
      i++;
    }
  }
  return events;
}

function extractQuoted(str, key) {
  const idx = str.indexOf(key);
  if (idx === -1) return null;
  const afterKey = str.slice(idx + key.length).replace(/^\s*:\s*/, "");
  const start = afterKey.indexOf('"');
  if (start === -1) return null;
  let result = "";
  let i = start + 1;
  while (i < afterKey.length) {
    const c = afterKey[i];
    if (c === "\\" && i + 1 < afterKey.length) {
      result += afterKey[i + 1];
      i += 2;
      continue;
    }
    if (c === '"') break;
    result += c;
    i++;
  }
  return result;
}

function parseEventObj(obj) {
  const id = /id:\s*["']([^"']+)["']/.exec(obj)?.[1];
  const title = extractQuoted(obj, "title") || /title:\s*["']((?:[^"\\]|\\.)*)["']/.exec(obj)?.[1]?.replace(/\\'/g, "'");
  const type = /type:\s*["']([^"']+)["']/.exec(obj)?.[1];
  const intensity = /intensity:\s*["']([^"']+)["']/.exec(obj)?.[1];
  const date = /date:\s*["']([^"']+)["']/.exec(obj)?.[1];
  const description = extractQuoted(obj, "description") || "";
  const location = extractQuoted(obj, "location") || "";
  const lat = parseFloat(/lat:\s*([\d.-]+)/.exec(obj)?.[1] || "0");
  const lng = parseFloat(/lng:\s*([\d.-]+)/.exec(obj)?.[1] || "0");
  if (!id || !type || !date || !description) return null;
  return { id, title: title || "", type, intensity: intensity || "3", date, description, location, lat, lng };
}

// Handle multi-line description
function extractAll(content) {
  const events = [];
  const objRegex = /\{\s*id:\s*["']([^"']+)["']\s*,\s*title:\s*["']([^"']*(?:\\.[^"']*)*)["']\s*,\s*type:\s*["']([^"']+)["']\s*,\s*intensity:\s*["']([^"']+)["']\s*,\s*date:\s*["']([^"']+)["']\s*,\s*excerpt:\s*["']([^"']*(?:\\.[^"']*)*)["']\s*,\s*description:\s*["']([^"']*(?:\\.[^"']*)*)["']\s*,\s*location:\s*["']([^"']*(?:\\.[^"']*)*)["']\s*,\s*coords:\s*\{\s*lat:\s*([\d.-]+)\s*,\s*lng:\s*([\d.-]+)\s*\}[\s\S]*?\},?(?=\s*(?:\}|\{[^}]*id:))/g;
  // Simpler: split by "},\n  {" pattern and parse each
  const parts = content.split(/\},\s*\n\s*\{/);
  for (const part of parts) {
    const e = parseEventObj("{" + part.replace(/^\s*\{\s*/, "").replace(/\}\s*$/, "}") + "}");
    if (e && (e.id.startsWith("e") || e.id.startsWith("me"))) events.push(e);
  }
  return events;
}

// Manual extraction: use a state machine
function parseEventsFromFile(content) {
  const events = [];
  let pos = 0;
  const len = content.length;
  while (pos < len) {
    const start = content.indexOf("{", pos);
    if (start === -1) break;
    let depth = 1;
    let end = start + 1;
    while (depth > 0 && end < len) {
      const c = content[end++];
      if (c === "{") depth++;
      else if (c === "}") depth--;
    }
    const block = content.substring(start, end);
    if (block.includes("id:") && block.includes("coords:")) {
      const e = parseEventObj(block);
      if (e && (e.id.match(/^e\d+$/) || e.id.match(/^me\d+$/))) events.push(e);
    }
    pos = end;
  }
  return events;
}

function esc(s) {
  return (s || "").replace(/'/g, "''");
}

const dataContent = fs.readFileSync(dataPath, "utf8");
const metroContent = fs.readFileSync(metroPath, "utf8");

const baseEvents = parseEventsFromFile(dataContent).filter((e) => e.id.match(/^e\d+$/));
const metroEvents = parseEventsFromFile(metroContent).filter((e) => e.id.match(/^me\d+$/));
const allEvents = [...baseEvents, ...metroEvents];

console.error(`Parsed ${baseEvents.length} base + ${metroEvents.length} metro = ${allEvents.length} events`);

const inserts = allEvents.map((e) => {
  const occurredAt = `${e.date}T12:00:00Z`;
  const title = e.title ? `'${esc(e.title)}'` : "NULL";
  const loc = e.location ? `'${esc(e.location)}'` : "NULL";
  return `INSERT INTO events (event_type, location, occurred_at, description, title, location_label, emotional_intensity, is_anonymous, status)
VALUES (
  '${e.type}'::event_type,
  ST_SetSRID(ST_MakePoint(${e.lng}, ${e.lat}), 4326)::geography,
  '${occurredAt}'::timestamptz,
  '${esc(e.description)}',
  ${title},
  ${loc},
  '${e.intensity}'::emotional_intensity,
  true,
  'approved'::event_status
);`;
});

const sql = `-- Seed events from lib/data.ts and lib/metro-events.ts
-- Generated by scripts/generate-seed-sql.cjs

${inserts.join("\n\n")}
`;

fs.writeFileSync(path.join(__dirname, "../supabase/migrations/002_seed_events.sql"), sql);
console.error("Wrote supabase/migrations/002_seed_events.sql");
