import * as fs from "fs";
import * as path from "path";
import logger from "../Utils/logger";
import type {
  IDatabaseAdapter,
  ColumnInfo,
  FetchTableForeignKeysResult,
  QueryRecord,
  PaginationMeta,
} from "./IDatabaseAdapter";

// Type-only import – the `pg` package is not required at compile time for
// users who only use SQLite or MySQL.
import type { Pool as PgPool } from "pg";

function requirePg(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("pg");
  } catch {
    throw new Error(
      "The 'pg' package is required for PostgresAdapter. " +
        "Install it with: npm install pg"
    );
  }
}

/**
 * PostgreSQL adapter.
 *
 * Schema introspection is performed via `information_schema` so no manual
 * schema definition is needed – the GUI discovers tables and columns at
 * runtime through database reflection.
 *
 * @example
 * ```ts
 * import { Pool } from "pg";
 * import { PostgresAdapter } from "sqlite-gui-node/adapters/PostgresAdapter";
 * import { SqliteGuiNodeWithAdapter } from "sqlite-gui-node";
 *
 * const pool = new Pool({ host: "localhost", user: "postgres", password: "secret", database: "mydb" });
 * const adapter = new PostgresAdapter(pool);
 * SqliteGuiNodeWithAdapter(adapter, 8080);
 * ```
 */
export class PostgresAdapter implements IDatabaseAdapter {
  private readonly pool: PgPool;

  constructor(pool: PgPool) {
    requirePg();
    this.pool = pool;
  }

  quoteIdentifier(name: string): string {
    return '"' + name.replace(/"/g, '""') + '"';
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  private async query<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  // ------------------------------------------------------------------
  // IDatabaseAdapter implementation
  // ------------------------------------------------------------------

  async InitializeDB(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS "query" (
        id SERIAL PRIMARY KEY,
        name TEXT,
        sqlstatement TEXT
      )
    `);
  }

  async fetchAllTables(): Promise<{ bool: boolean; data?: any[] }> {
    try {
      const rows = await this.query<{ name: string }>(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE'
         ORDER BY table_name`
      );
      return { bool: true, data: rows };
    } catch (error: any) {
      logger.error("Error while fetching tables:", error.message);
      return { bool: false };
    }
  }

  async fetchTable(
    table: string,
    pagination = { page: 1, perPage: 50 }
  ): Promise<{ bool: boolean; data?: any[]; meta: PaginationMeta }> {
    const { page, perPage } = pagination;
    const limit = perPage;
    const offset = (page - 1) * limit;
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.quoteIdentifier(table)} LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      const countRows = await this.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM ${this.quoteIdentifier(table)}`
      );
      const total = parseInt(countRows[0]?.cnt ?? "0", 10);
      return {
        bool: true,
        data: rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error("Error while fetching table:", error.message);
      throw { bool: false, error: error.message };
    }
  }

  async fetchTableInfo(
    table: string
  ): Promise<{ bool: boolean; data?: ColumnInfo[] }> {
    return this._fetchColumns(table);
  }

  async fetchAllTableInfo(
    table: string
  ): Promise<{ bool: boolean; data?: ColumnInfo[] }> {
    return this._fetchColumns(table);
  }

  private async _fetchColumns(
    table: string
  ): Promise<{ bool: boolean; data?: ColumnInfo[] }> {
    try {
      const rows = await this.query<{ field: string; type: string }>(
        `SELECT column_name AS field, data_type AS type
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );
      if (rows.length === 0) {
        return { bool: false };
      }
      return { bool: true, data: rows };
    } catch (error: any) {
      logger.error("Error while fetching table info:", error.message);
      throw { bool: false, error: error.message };
    }
  }

  async fetchTableForeignKeys(
    table: string
  ): Promise<FetchTableForeignKeysResult> {
    try {
      const rows = await this.query<{
        from: string;
        table: string;
        to: string;
      }>(
        `SELECT
           kcu.column_name                AS "from",
           ccu.table_name                 AS "table",
           ccu.column_name                AS "to"
         FROM information_schema.table_constraints   tc
         JOIN information_schema.key_column_usage    kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema    = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema    = ccu.table_schema
         WHERE tc.table_schema   = 'public'
           AND tc.table_name     = $1
           AND tc.constraint_type = 'FOREIGN KEY'`,
        [table]
      );
      if (rows.length === 0) {
        return { bool: false, data: [] };
      }
      return { bool: true, data: rows };
    } catch (error: any) {
      logger.error("Error while fetching foreign keys:", error.message);
      throw { bool: false, error: error.message };
    }
  }

  async fetchFK(
    table: string,
    column: string
  ): Promise<{ bool: boolean; data: any[] }> {
    try {
      const rows = await this.query(
        `SELECT ${this.quoteIdentifier(column)} FROM ${this.quoteIdentifier(table)}`
      );
      return { bool: true, data: rows };
    } catch (error: any) {
      logger.error("Error while fetching FK values:", error.message);
      throw { bool: false, data: [], error: error.message };
    }
  }

  async fetchRecord(
    table: string,
    label: string,
    id: number | string
  ): Promise<{ bool: boolean; data?: any[] }> {
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.quoteIdentifier(table)} WHERE ${this.quoteIdentifier(label)} = $1`,
        [id]
      );
      return { bool: true, data: rows };
    } catch (error: any) {
      logger.error("Error while fetching record:", error.message);
      throw { bool: false, error: error.message };
    }
  }

  async runQuery(
    sqlStatement: string
  ): Promise<{ bool: boolean; error?: string }> {
    try {
      await this.pool.query(sqlStatement);
      return { bool: true };
    } catch (error: any) {
      logger.error("SQL Statement: " + sqlStatement);
      logger.error(error.message);
      throw { bool: false, error: error.message };
    }
  }

  async runSelectQuery(
    sqlStatement: string
  ): Promise<{ bool: boolean; data?: any[] }> {
    try {
      const rows = await this.query(sqlStatement);
      return { bool: true, data: rows };
    } catch (error: any) {
      logger.error("SQL Statement: " + sqlStatement);
      logger.error(error.message);
      throw { bool: false, error: error.message };
    }
  }

  async insertQuery(
    name: string,
    sqlStatement: string
  ): Promise<{ bool: boolean; error?: string }> {
    try {
      await this.pool.query(
        'INSERT INTO "query" (name, sqlstatement) VALUES ($1, $2)',
        [name, sqlStatement]
      );
      return { bool: true };
    } catch (error: any) {
      logger.error(error.message);
      throw { bool: false, error: error.message };
    }
  }

  async fetchQueries(): Promise<{ bool: boolean; data?: QueryRecord[] }> {
    try {
      const rows = await this.query<QueryRecord>('SELECT * FROM "query"');
      return { bool: true, data: rows };
    } catch (error: any) {
      logger.error("Error while fetching queries:", error.message);
      throw { bool: false, error: error.message };
    }
  }

  async checkColumnHasDefault(
    tableName: string,
    _columnType: string,
    columnName: string
  ): Promise<{ bool: boolean; message?: string; error?: string }> {
    try {
      const rows = await this.query<{ column_default: string | null }>(
        `SELECT column_default
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = $1
           AND column_name  = $2`,
        [tableName, columnName]
      );
      const hasDefault =
        rows.length > 0 && rows[0].column_default !== null;
      return { bool: hasDefault, message: "" };
    } catch (error: any) {
      throw {
        bool: false,
        message: "Error while executing query",
        error: error.message,
      };
    }
  }

  async deleteFromTable(
    name: string,
    id: number | string
  ): Promise<{ bool: boolean; error?: string }> {
    try {
      await this.pool.query(
        `DELETE FROM ${this.quoteIdentifier(name)} WHERE id = $1`,
        [id]
      );
      return { bool: true };
    } catch (error: any) {
      logger.error("Error while deleting:", error.message);
      throw { bool: false, error: error.message };
    }
  }

  async exportDatabaseToSQL(): Promise<{
    bool: boolean;
    filePath?: string;
    error?: string;
  }> {
    try {
      const outputPath = path.resolve(
        __dirname,
        "..",
        "..",
        "public",
        "output.sql"
      );
      let sql = "";

      const tables = await this.query<{ name: string }>(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
      );

      for (const { name: tableName } of tables) {
        const q = this.quoteIdentifier.bind(this);

        const columns = await this.query<{ field: string; type: string }>(
          `SELECT column_name AS field, data_type AS type
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [tableName]
        );

        sql += `-- Dumping data for table ${q(tableName)}\n`;
        sql += `CREATE TABLE IF NOT EXISTS ${q(tableName)} (${columns
          .map((c) => `${q(c.field)} ${c.type}`)
          .join(", ")});\n`;

        const rows = await this.query(`SELECT * FROM ${q(tableName)}`);
        for (const row of rows) {
          const cols = Object.keys(row).map(q).join(", ");
          const vals = Object.values(row)
            .map((v) =>
              v === null || v === undefined
                ? "NULL"
                : `'${String(v).replace(/'/g, "''")}'`
            )
            .join(", ");
          sql += `INSERT INTO ${q(tableName)} (${cols}) VALUES (${vals});\n`;
        }
      }

      await fs.promises.writeFile(outputPath, sql);
      return { bool: true, filePath: outputPath };
    } catch (error: any) {
      return { bool: false, error: error.message };
    }
  }
}
