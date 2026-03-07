export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lines = splitLines(trimmed);
  if (lines.length === 0) return [];
  const headers = parseLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

export function stringifyCsv(rows: CsvRow[], headers?: string[]): string {
  const keys = headers ?? Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const output = [keys.map(escapeField).join(",")];
  for (const row of rows) {
    output.push(keys.map((key) => escapeField(row[key] ?? "")).join(","));
  }
  return output.join("\n");
}

function splitLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current.length > 0) {
        lines.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function escapeField(value: string): string {
  const needsQuotes = value.includes(",") || value.includes("\n") || value.includes('"');
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}
