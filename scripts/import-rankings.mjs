#!/usr/bin/env node
/*
 * Dependency-free CSV normalizer for a ranking export. It produces JSON in the
 * board shape documented by data/source-schema.json; copy reviewed values into
 * assets/data.js so the static app remains build-free.
 */
import { readFile, writeFile } from "node:fs/promises";

const [inputPath, outputPath, scoring = "ppr"] = process.argv.slice(2);
if (!inputPath || !outputPath || !["ppr", "halfPpr"].includes(scoring)) {
  console.error("Usage: node scripts/import-rankings.mjs <input.csv> <output.json> [ppr|halfPpr]");
  process.exit(1);
}

const parseCsvLine = (line) => {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
};

const normalizeKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, "");
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const csv = await readFile(inputPath, "utf8");
const [headerLine, ...rows] = csv.trim().split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(headerLine).map(normalizeKey);
const column = (names) => headers.findIndex((header) => names.includes(header));
const rankColumn = column(["rank", "overallrank", "rk"]);
const nameColumn = column(["player", "name", "playername"]);
const positionColumn = column(["position", "pos"]);
const teamColumn = column(["team"]);
const adpColumn = column(["adp", "averagepick", "averagepicknumber"]);

if (rankColumn < 0 || nameColumn < 0 || positionColumn < 0) {
  throw new Error("CSV must contain rank, player/name, and position/pos columns.");
}

const items = rows.map((line, index) => {
  const fields = parseCsvLine(line);
  const name = fields[nameColumn];
  const rank = number(fields[rankColumn], index + 1);
  const adp = number(fields[adpColumn], rank);
  return {
    id: slugify(name),
    name,
    position: fields[positionColumn].toUpperCase(),
    team: teamColumn < 0 ? "FA" : fields[teamColumn].toUpperCase(),
    rank,
    projectedPoints: 0,
    tier: Math.ceil(rank / 12),
    adp: { yahoo: adp, sleeper: adp, rtSports: adp, realTime: adp }
  };
});

const board = {
  label: scoring === "ppr" ? "PPR" : "Half-PPR",
  provisional: scoring === "halfPpr",
  note: scoring === "halfPpr" ? "Replace provisional values with a dedicated half-PPR source." : undefined,
  importedAt: new Date().toISOString(),
  items
};

await writeFile(outputPath, `${JSON.stringify(board, null, 2)}\n`, "utf8");
console.log(`Wrote ${items.length} ${board.label} rankings to ${outputPath}`);
