import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const TABLES = new Set([
  "users",
  "orders",
  "assembledunits",
  "kits",
  "kitdata",
  "servomodeldata",
  "customers",
  "kitimages",
  "auditlogs",
  "messages",
  "config"
]);

const PORT = Number(process.env.PORT || 3000);
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

type QueryFilter = { column: string; value: unknown };
type SortFilter = { column: string; ascending: boolean };
type QueryPayload = {
  operation: "select" | "insert" | "upsert" | "update" | "delete";
  values?: any;
  filters?: QueryFilter[];
  order?: SortFilter;
  limit?: number;
  single?: boolean;
};

let pool: any;

function loadMysql() {
  try {
    return require("mysql2/promise");
  } catch (error) {
    throw new Error(
      "Dependência mysql2 não encontrada. Rode `npm install` após atualizar as dependências do projeto."
    );
  }
}

function parseDatabaseUrl(databaseUrl?: string) {
  if (!databaseUrl) return {};
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "")
  };
}

function mysqlConfig() {
  const fromUrl = parseDatabaseUrl(process.env.DATABASE_URL || process.env.MYSQL_URL);
  return {
    host: process.env.MYSQL_HOST || fromUrl.host || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || fromUrl.port || 3306),
    user: process.env.MYSQL_USER || fromUrl.user || "root",
    password: process.env.MYSQL_PASSWORD || fromUrl.password || "",
    database: process.env.MYSQL_DATABASE || fromUrl.database || "safisa_app",
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    namedPlaceholders: true
  };
}

function assertTable(table: string) {
  const normalized = table.toLowerCase();
  if (!TABLES.has(normalized)) {
    throw new Error(`Tabela não permitida: ${table}`);
  }
  return normalized;
}

function jsonPathExpression(column: string) {
  if (column === "id") return "id";
  if (!/^[a-zA-Z0-9_]+$/.test(column)) throw new Error(`Coluna inválida: ${column}`);
  return `JSON_UNQUOTE(JSON_EXTRACT(data, '$.${column}'))`;
}

function normalizeRow(row: any) {
  const parsedData = typeof row.data === "string" ? JSON.parse(row.data || "{}") : row.data || {};
  return { id: row.id, data: parsedData };
}

function normalizeRecord(input: any) {
  const id = input?.id || crypto.randomUUID();
  const data = input?.data !== undefined ? input.data : { ...input, id };
  return { id: String(id), data: JSON.stringify(data ?? {}) };
}

async function initDatabase() {
  const mysql = loadMysql();
  const config = mysqlConfig();
  pool = mysql.createPool(config);

  for (const table of TABLES) {
    await pool.execute(`CREATE TABLE IF NOT EXISTS \`${table}\` (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      data JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  await pool.execute(
    "INSERT IGNORE INTO `config` (id, data) VALUES (?, ?)",
    [
      "global",
      JSON.stringify({
        passwords: {
          ADMIN: "123",
          ASSEMBLY: "123",
          EXPEDITION: "123",
          SYSTEM_SETTINGS: "123"
        },
        currentSequence: 61000
      })
    ]
  );
}

async function selectRows(table: string, payload: QueryPayload) {
  const params: any[] = [];
  const where = (payload.filters || []).map(filter => {
    const expression = jsonPathExpression(filter.column);
    params.push(filter.value);
    return `${expression} = ?`;
  });

  let sql = `SELECT id, data FROM \`${table}\``;
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  if (payload.order) {
    const expression = jsonPathExpression(payload.order.column);
    sql += ` ORDER BY ${expression} ${payload.order.ascending ? "ASC" : "DESC"}`;
  }
  if (payload.limit) {
    sql += " LIMIT ?";
    params.push(Number(payload.limit));
  }

  const [rows] = await pool.execute(sql, params);
  const data = rows.map(normalizeRow);
  return payload.single ? data[0] || null : data;
}

async function insertRows(table: string, values: any, upsert = false) {
  const records = (Array.isArray(values) ? values : [values]).map(normalizeRecord);
  if (!records.length) return [];

  const placeholders = records.map(() => "(?, ?)").join(", ");
  const params = records.flatMap(record => [record.id, record.data]);
  const suffix = upsert ? " ON DUPLICATE KEY UPDATE data = VALUES(data)" : "";
  await pool.execute(`INSERT INTO \`${table}\` (id, data) VALUES ${placeholders}${suffix}`, params);
  return records.map(record => ({ id: record.id, data: JSON.parse(record.data) }));
}

async function updateRows(table: string, payload: QueryPayload) {
  const value = normalizeRecord(payload.values || {});
  const patch = JSON.parse(value.data);
  const params: any[] = [];
  const where = (payload.filters || []).map(filter => {
    const expression = jsonPathExpression(filter.column);
    params.push(filter.value);
    return `${expression} = ?`;
  });

  if (!where.length) throw new Error("Atualização sem filtro não é permitida.");

  const [rows] = await pool.execute(`SELECT id, data FROM \`${table}\` WHERE ${where.join(" AND ")}`, params);
  for (const row of rows) {
    const current = normalizeRow(row);
    const merged = JSON.stringify({ ...current.data, ...patch });
    await pool.execute(`UPDATE \`${table}\` SET data = ? WHERE id = ?`, [merged, current.id]);
  }

  return null;
}

async function deleteRows(table: string, payload: QueryPayload) {
  const params: any[] = [];
  const where = (payload.filters || []).map(filter => {
    const expression = jsonPathExpression(filter.column);
    params.push(filter.value);
    return `${expression} = ?`;
  });

  if (!where.length) throw new Error("Exclusão sem filtro não é permitida.");
  await pool.execute(`DELETE FROM \`${table}\` WHERE ${where.join(" AND ")}`, params);
  return null;
}

async function runQuery(table: string, payload: QueryPayload) {
  switch (payload.operation) {
    case "select":
      return selectRows(table, payload);
    case "insert":
      return insertRows(table, payload.values, false);
    case "upsert":
      return insertRows(table, payload.values, true);
    case "update":
      return updateRows(table, payload);
    case "delete":
      return deleteRows(table, payload);
    default:
      throw new Error("Operação inválida.");
  }
}

async function startServer() {
  await initDatabase();

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "20mb" }));
  app.use("/uploads", express.static(UPLOADS_DIR));

  app.post("/api/db/:table", async (req, res) => {
    try {
      const table = assertTable(req.params.table);
      const data = await runQuery(table, req.body);
      res.json({ data });
    } catch (error) {
      console.error("Erro no banco MySQL:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro no banco MySQL." });
    }
  });

  app.post(/^\/api\/storage\/([^/]+)\/(.+)$/, express.raw({ type: "*/*", limit: "20mb" }), async (req, res) => {
    try {
      const [, bucket, filePath] = req.path.match(/^\/api\/storage\/([^/]+)\/(.+)$/) || [];
      if (!bucket || !filePath) throw new Error("Caminho de upload inválido.");

      const safeBucket = decodeURIComponent(bucket).replace(/[^a-zA-Z0-9-_]/g, "");
      const decodedPath = decodeURIComponent(filePath).replace(/\.\./g, "");
      const targetPath = path.join(UPLOADS_DIR, safeBucket, decodedPath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, req.body);

      res.json({ publicUrl: `/uploads/${safeBucket}/${decodedPath}` });
    } catch (error) {
      console.error("Erro no upload:", error);
      res.status(500).json({ error: "Erro ao enviar arquivo." });
    }
  });

  // --- API Endpoints para o Sistema de Estoque ---
  app.get("/api/inventory/units", async (_req, res) => {
    try {
      const data = await selectRows("assembledunits", { operation: "select" });
      res.json(data.map((d: any) => ({ ...d.data, id: d.id })));
    } catch {
      res.status(500).json({ error: "Erro ao buscar unidades." });
    }
  });

  app.post("/api/inventory/units", async (req, res) => {
    try {
      const [unit] = await insertRows("assembledunits", { id: crypto.randomUUID(), data: req.body }, false);
      res.status(201).json({ id: unit.id, ...unit.data });
    } catch {
      res.status(500).json({ error: "Erro ao adicionar unidade." });
    }
  });

  app.put("/api/inventory/units/:id", async (req, res) => {
    try {
      await updateRows("assembledunits", { operation: "update", values: { data: req.body }, filters: [{ column: "id", value: req.params.id }] });
      res.json({ message: "Unidade atualizada com sucesso." });
    } catch {
      res.status(500).json({ error: "Erro ao atualizar unidade." });
    }
  });

  app.delete("/api/inventory/units/:id", async (req, res) => {
    try {
      await deleteRows("assembledunits", { operation: "delete", filters: [{ column: "id", value: req.params.id }] });
      res.json({ message: "Unidade deletada com sucesso." });
    } catch {
      res.status(500).json({ error: "Erro ao deletar unidade." });
    }
  });

  app.get("/api/inventory/kits", async (_req, res) => {
    try {
      const data = await selectRows("kits", { operation: "select" });
      res.json(data.map((d: any) => ({ ...d.data, id: d.id })));
    } catch {
      res.status(500).json({ error: "Erro ao buscar kits." });
    }
  });

  app.post("/api/inventory/kits", async (req, res) => {
    try {
      const [kit] = await insertRows("kits", { id: crypto.randomUUID(), data: req.body }, false);
      res.status(201).json({ id: kit.id, ...kit.data });
    } catch {
      res.status(500).json({ error: "Erro ao adicionar kit." });
    }
  });

  app.put("/api/inventory/kits/:id", async (req, res) => {
    try {
      await updateRows("kits", { operation: "update", values: { data: req.body }, filters: [{ column: "id", value: req.params.id }] });
      res.json({ message: "Kit atualizado com sucesso." });
    } catch {
      res.status(500).json({ error: "Erro ao atualizar kit." });
    }
  });

  app.delete("/api/inventory/kits/:id", async (req, res) => {
    try {
      await deleteRows("kits", { operation: "delete", filters: [{ column: "id", value: req.params.id }] });
      res.json({ message: "Kit deletado com sucesso." });
    } catch {
      res.status(500).json({ error: "Erro ao deletar kit." });
    }
  });

  app.get("/api/inventory/dispatched-kits", async (_req, res) => {
    try {
      const rows = await selectRows("orders", { operation: "select" });
      const orders = rows.map((d: any) => ({ ...d.data, id: d.id }));
      const result = orders
        .filter((order: any) => order.status === "COMPLETED" || order.dispatchedAt)
        .map((order: any) => {
          const kitCounts: Record<string, number> = {};
          if (Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              if (item.type === "KIT" && item.model) kitCounts[item.model] = (kitCounts[item.model] || 0) + 1;
              if (item.type === "SERVO" && item.installationKit) kitCounts[item.installationKit] = (kitCounts[item.installationKit] || 0) + 1;
            });
          }
          return {
            orderId: order.id,
            customerName: order.customerName,
            negotiationNumber: order.negotiationNumber,
            dispatchedAt: order.dispatchedAt ? new Date(order.dispatchedAt).toISOString() : null,
            kits: Object.entries(kitCounts).map(([name, quantity]) => ({ name, quantity }))
          };
        })
        .filter((item: any) => item.kits.length > 0);

      res.json(result);
    } catch (error) {
      console.error("Erro ao buscar kits despachados:", error);
      res.status(500).json({ error: "Erro ao buscar kits despachados." });
    }
  });

  app.get("/api/database/export", async (_req, res) => {
    try {
      const collectionsToExport = [
        "orders",
        "assembledUnits",
        "kits",
        "kitData",
        "servoModelData",
        "customers",
        "kitImages",
        "messages"
      ];
      const exportData: Record<string, any[]> = {};

      for (const collectionName of collectionsToExport) {
        const rows = await selectRows(collectionName.toLowerCase(), { operation: "select" });
        exportData[collectionName] = rows.map((d: any) => ({ ...d.data, id: d.id }));
      }

      const config = await selectRows("config", { operation: "select", filters: [{ column: "id", value: "global" }] });
      if (config[0]) exportData.config = [{ ...config[0].data, id: "global" }];
      res.json(exportData);
    } catch (error) {
      console.error("Erro ao exportar banco de dados:", error);
      res.status(500).json({ error: "Erro ao exportar banco de dados." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`MySQL database: ${mysqlConfig().database}@${mysqlConfig().host}:${mysqlConfig().port}`);
  });
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
