import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import initSqlJs from 'sql.js';

const dirs = [
  process.env.LOCALAPPDATA +
    '/Google/Chrome/User Data/Default/Local Storage/leveldb',
  process.env.LOCALAPPDATA +
    '/Microsoft/Edge/User Data/Default/Local Storage/leveldb',
];

let best = '';
for (const dir of dirs) {
  let files = [];
  try {
    files = readdirSync(dir).filter(
      (f) => f.endsWith('.ldb') || f.endsWith('.log'),
    );
  } catch {
    continue;
  }
  for (const f of files) {
    const s = readFileSync(join(dir, f)).toString('latin1');
    let idx = 0;
    while ((idx = s.indexOf('taxopt-helper-db', idx)) !== -1) {
      const slice = s.slice(idx, idx + 5_000_000);
      const b64start = slice.indexOf('U1FMaXRl');
      if (b64start >= 0) {
        let i = b64start;
        let b64 = '';
        while (i < slice.length) {
          const c = slice[i];
          if (
            (c >= 'A' && c <= 'Z') ||
            (c >= 'a' && c <= 'z') ||
            (c >= '0' && c <= '9') ||
            c === '+' ||
            c === '/' ||
            c === '='
          ) {
            b64 += c;
            i++;
          } else break;
        }
        if (b64.length > best.length) {
          best = b64;
          console.log('best from', dir, f, b64.length);
        }
      }
      idx += 15;
    }
  }
}

if (!best) {
  console.error('no data');
  process.exit(1);
}

const bin = Buffer.from(best, 'base64');
console.log('decoded', bin.length);
const SQL = await initSqlJs({
  locateFile: (f) => join(process.cwd(), 'node_modules/sql.js/dist', f),
});

function tryExtract(bytes) {
  const db = new SQL.Database(new Uint8Array(bytes));
  const tables = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table'",
  );
  console.log(
    'tables',
    tables[0]?.values?.map((v) => v[0]),
  );
  const full = db.exec('SELECT nodes_json FROM board_layouts');
  if (full?.[0]?.values?.length) {
    // pick longest
    let bestN = '';
    for (const row of full[0].values) {
      const j = String(row[0] ?? '');
      if (j.length > bestN.length) bestN = j;
    }
    return bestN;
  }
  return null;
}

let nodesJson = null;
try {
  nodesJson = tryExtract(bin);
} catch (e) {
  console.log('full fail', e.message);
}

if (!nodesJson) {
  const maxPages = Math.floor(bin.length / 4096);
  for (let pages = maxPages; pages >= 4; pages--) {
    try {
      nodesJson = tryExtract(bin.subarray(0, pages * 4096));
      if (nodesJson) {
        console.log('recovered pages', pages);
        break;
      }
    } catch {
      /* */
    }
  }
}

if (!nodesJson) {
  console.error('failed');
  process.exit(1);
}

writeFileSync('extracted-layout.json', nodesJson);
const nodes = JSON.parse(nodesJson);
console.log('node count', nodes.length);
for (const n of nodes) {
  console.log(
    n.id,
    n.type,
    n.position,
    n.width,
    n.height,
  );
}
