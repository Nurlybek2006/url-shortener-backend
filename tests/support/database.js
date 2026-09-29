const { randomUUID } = require("crypto");

// A small query-boundary double: real controllers, services, JWT and bcrypt run.
// PostgreSQL SQL/constraints are verified separately by postgres.integration.test.
const rows = { user: [], link: [], click: [] };

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return value.every((part) => matches(row, part));
    if (key === "OR") return value.some((part) => matches(row, part));
    if (key === "link") return matches(rows.link.find((link) => link.id === row.linkId) || {}, value);
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("in" in value) return value.in.includes(row[key]);
      if ("gte" in value) return row[key] >= value.gte;
      if ("not" in value) return row[key] !== value.not;
      if ("equals" in value) return row[key] === value.equals;
    }
    return row[key] === value;
  });
}

function project(row, select) {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.fromEntries(Object.entries(select).filter(([, enabled]) => enabled).map(([key, enabled]) => {
    if (key === "user") return [key, project(rows.user.find((user) => user.id === row.userId), enabled.select)];
    return [key, row[key]];
  }));
}

function query(model, args = {}) {
  let result = rows[model].filter((row) => matches(row, args.where));
  if (args.orderBy) {
    const [field, direction] = Object.entries(args.orderBy)[0];
    result.sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (direction === "desc" ? -1 : 1));
  }
  return result.slice(args.skip || 0, args.take == null ? undefined : (args.skip || 0) + args.take);
}

function insert(model, data) {
  const unique = model === "user" ? "email" : model === "link" ? "slug" : "id";
  if (rows[model].some((row) => row[unique] === data[unique])) {
    throw Object.assign(new Error("Unique constraint violation"), { code: "P2002" });
  }
  const defaults = model === "user" ? { role: "USER" } : model === "link" ? {
    status: "ACTIVE", password: null, title: null, expiresAt: null, maxClicks: null,
    clickCount: 0, tags: [], qrCodeUrl: null, updatedAt: new Date(),
  } : { clickedAt: new Date() };
  const row = { id: randomUUID(), createdAt: new Date(), ...defaults, ...data };
  rows[model].push(row);
  return row;
}

const db = {};
for (const model of Object.keys(rows)) {
  db[model] = {
    findUnique: jest.fn(async (args) => project(query(model, args)[0], args.select)),
    findFirst: jest.fn(async (args = {}) => project(query(model, args)[0], args.select)),
    findMany: jest.fn(async (args = {}) => query(model, args).map((row) => project(row, args.select))),
    count: jest.fn(async (args = {}) => query(model, args).length),
    create: jest.fn(async ({ data, select }) => project(insert(model, data), select)),
    createMany: jest.fn(async ({ data, skipDuplicates }) => {
      let count = 0;
      for (const row of Array.isArray(data) ? data : [data]) {
        try { insert(model, row); count++; } catch (error) { if (!skipDuplicates) throw error; }
      }
      return { count };
    }),
    update: jest.fn(async ({ where, data, select }) => {
      const row = rows[model].find((item) => matches(item, where));
      if (!row) throw Object.assign(new Error("Record not found"), { code: "P2025" });
      for (const [key, value] of Object.entries(data)) {
        row[key] = value && typeof value === "object" && "increment" in value ? row[key] + value.increment : value;
      }
      return project(row, select);
    }),
    updateMany: jest.fn(async ({ where, data }) => {
      const matching = rows[model].filter((row) => matches(row, where));
      for (const row of matching) Object.assign(row, data);
      return { count: matching.length };
    }),
    delete: jest.fn(async ({ where }) => {
      const index = rows[model].findIndex((row) => matches(row, where));
      if (index < 0) throw Object.assign(new Error("Record not found"), { code: "P2025" });
      return rows[model].splice(index, 1)[0];
    }),
    groupBy: jest.fn(async ({ by, where }) => {
      const field = by[0];
      const grouped = new Map();
      for (const row of query(model, { where })) grouped.set(row[field], (grouped.get(row[field]) || 0) + 1);
      return [...grouped].map(([name, count]) => ({ [field]: name, _count: { id: count } }));
    }),
  };
}

db.$transaction = jest.fn(async (queries) => typeof queries === "function" ? queries(db) : Promise.all(queries));
db.$queryRaw = jest.fn(async (parts, ...values) => {
  const sql = parts.join("?");
  if (sql.includes("SELECT 1")) return [{ "?column?": 1 }];
  const clicks = rows.click.filter((click) => click.linkId === values[0] && (!values[1] || click.clickedAt >= values[1]));
  if (sql.includes("COUNT(DISTINCT")) return [{ count: new Set(clicks.map((click) => click.ip)).size }];
  if (sql.includes("GROUP BY")) {
    const hourly = sql.includes("EXTRACT(HOUR");
    const counts = new Map();
    for (const click of clicks) {
      const key = hourly ? click.clickedAt.getUTCHours() : click.clickedAt.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts].map(([key, count]) => ({ [hourly ? "hour" : "date"]: key, count }));
  }
  throw new Error("Unimplemented database double query");
});
db.$queryRawUnsafe = jest.fn(async () => [{ "?column?": 1 }]);
db.$connect = jest.fn(async () => {});
db.$disconnect = jest.fn(async () => {});
db.rows = rows;
db.reset = () => Object.values(rows).forEach((table) => table.splice(0));
module.exports = db;
