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

// Type-only import so the package is not required at compile time
// for users who don't need MySQL support.
import type { Pool as MysqlPool, PoolConnection } from "mysql2/promise";

function requireMysql(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("mysql2/promise");
  } catch {
    throw new Error(
      "The 'mysql2' package is required for MysqlAdapter. " +
        "Install it with: npm install mysql2"
    );
  }
}

/**
 * MySQL / MariaDB adapter.
 *
 * Schema introspection is performed via `information_schema` so no manual
 * schema definition is needed – the GUI discovers tables and columns at
 * runtime through database reflection.
 *
 * @example
 * ```ts
 * import mysql from "mysql2/promise";
 * import { MysqlAdapter } from "sqlite-gui-node/adapters/MysqlAdapter";
 * import { SqliteGuiNodeWithAdapter } from "sqlite-gui-node";
 *
 * const pool = mysql.createPool({ host: "localhost", user: "root", password: "secret", database: "mydb" });
 * const adapter = new MysqlAdapter(pool);
 * SqliteGuiNodeWithAdapter(adapter, 8080);
 * ```
 */
export class MysqlAdapter implements IDatabaseAdapter {
  private readonly pool: MysqlPool;

  constructor(pool: MysqlPool) {
    // Eagerly verify the package is available when the adapter is constructed.
    requireMysql();
    this.pool = pool;
  }

  quoteIdentifier(name: string): string {
    return "`" + name.replace(/`/g, "``") + "`";
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  private async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }

  private async execute(
    sql: string,
    params: any[] = []
  ): Promise<void> {
    await this.pool.execute(sql, params);
  }

  // ------------------------------------------------------------------
  // IDatabaseAdapter implementation
  // ------------------------------------------------------------------

  async InitializeDB(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS \`query\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name TEXT,
        sqlstatement TEXT
      )
    `);
  }

  async fetchAllTables(): Promise<{ bool: boolean; data?: any[] }> {
    try {
      const rows = await this.query<{ name: string }>(
        `SELECT TABLE_NAME AS name
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY TABLE_NAME`
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
        `SELECT * FROM ${this.quoteIdentifier(table)} LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const countRows = await this.query<Record<string, number>>(
        `SELECT COUNT(*) AS cnt FROM ${this.quoteIdentifier(table)}`
      );
      const total = countRows[0]?.cnt ?? 0;
      return {
        bool: true,
        data: rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(Number(total) / limit),
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
        `SELECT COLUMN_NAME AS field, COLUMN_TYPE AS type
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
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
           kcu.COLUMN_NAME             AS \`from\`,
           kcu.REFERENCED_TABLE_NAME   AS \`table\`,
           kcu.REFERENCED_COLUMN_NAME  AS \`to\`
         FROM information_schema.KEY_COLUMN_USAGE kcu
         WHERE kcu.TABLE_SCHEMA = DATABASE()
           AND kcu.TABLE_NAME = ?
           AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
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
        `SELECT * FROM ${this.quoteIdentifier(table)} WHERE ${this.quoteIdentifier(label)} = ?`,
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
      await this.pool.execute(sqlStatement);
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
      await this.execute(
        "INSERT INTO `query` (name, sqlstatement) VALUES (?, ?)",
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
      const rows = await this.query<QueryRecord>("SELECT * FROM `query`");
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
      const rows = await this.query<{ COLUMN_DEFAULT: string | null }>(
        `SELECT COLUMN_DEFAULT
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
      );
      const hasDefault =
        rows.length > 0 && rows[0].COLUMN_DEFAULT !== null;
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
      await this.execute(
        `DELETE FROM ${this.quoteIdentifier(name)} WHERE id = ?`,
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
        `SELECT TABLE_NAME AS name
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_TYPE = 'BASE TABLE'`
      );

      for (const { name: tableName } of tables) {
        const q = this.quoteIdentifier.bind(this);

        const columns = await this.query<{ field: string; type: string }>(
          `SELECT COLUMN_NAME AS field, COLUMN_TYPE AS type
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [tableName]
        );

        sql += `-- Dumping data for table ${q(tableName)}\n`;
        sql += `CREATE TABLE IF NOT EXISTS ${q(tableName)} (${columns
          .map((c) => `${q(c.field)} ${c.type}`)
          .join(", ")});\n`;

        const rows = await this.query(
          `SELECT * FROM ${q(tableName)}`
        );
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
