import type { Database } from "sqlite3";
import databaseFunctions from "../Utils/databaseFunctions";
import type {
  IDatabaseAdapter,
  ColumnInfo,
  FetchTableForeignKeysResult,
  QueryRecord,
  PaginationMeta,
} from "./IDatabaseAdapter";

/**
 * SQLite adapter – delegates every operation to the existing
 * `databaseFunctions` module so that all SQLite-specific behaviour
 * (PRAGMA introspection, sqlite_master, etc.) is preserved as-is.
 */
export class SqliteAdapter implements IDatabaseAdapter {
  constructor(private readonly db: Database) {}

  quoteIdentifier(name: string): string {
    return "`" + name + "`";
  }

  InitializeDB(): Promise<void> {
    return databaseFunctions.InitializeDB(this.db);
  }

  fetchAllTables(): Promise<{ bool: boolean; data?: any[] }> {
    return databaseFunctions.fetchAllTables(this.db);
  }

  fetchTable(
    table: string,
    pagination = { page: 1, perPage: 50 }
  ): Promise<{ bool: boolean; data?: any[]; meta: PaginationMeta }> {
    return databaseFunctions.fetchTable(this.db, table, pagination);
  }

  fetchTableInfo(
    table: string
  ): Promise<{ bool: boolean; data?: ColumnInfo[] }> {
    return databaseFunctions.fetchTableInfo(this.db, table);
  }

  fetchAllTableInfo(
    table: string
  ): Promise<{ bool: boolean; data?: ColumnInfo[] }> {
    return databaseFunctions.fetchAllTableInfo(this.db, table);
  }

  fetchTableForeignKeys(
    table: string
  ): Promise<FetchTableForeignKeysResult> {
    return databaseFunctions.fetchTableForeignKeys(this.db, table);
  }

  fetchFK(
    table: string,
    column: string
  ): Promise<{ bool: boolean; data: any[] }> {
    return databaseFunctions.fetchFK(this.db, table, column);
  }

  fetchRecord(
    table: string,
    label: string,
    id: number | string
  ): Promise<{ bool: boolean; data?: any[] }> {
    return databaseFunctions.fetchRecord(this.db, table, label, id);
  }

  runQuery(
    sqlStatement: string
  ): Promise<{ bool: boolean; error?: string }> {
    return databaseFunctions.runQuery(this.db, sqlStatement);
  }

  runSelectQuery(
    sqlStatement: string
  ): Promise<{ bool: boolean; data?: any[] }> {
    return databaseFunctions.runSelectQuery(this.db, sqlStatement);
  }

  insertQuery(
    name: string,
    sqlStatement: string
  ): Promise<{ bool: boolean; error?: string }> {
    return databaseFunctions.insertQuery(this.db, name, sqlStatement);
  }

  fetchQueries(): Promise<{ bool: boolean; data?: QueryRecord[] }> {
    return databaseFunctions.fetchQueries(this.db) as Promise<{
      bool: boolean;
      data?: QueryRecord[];
    }>;
  }

  checkColumnHasDefault(
    tableName: string,
    columnType: string,
    columnName: string
  ): Promise<{ bool: boolean; message?: string; error?: string }> {
    return databaseFunctions.checkColumnHasDefault(
      this.db,
      tableName,
      columnType,
      columnName
    );
  }

  deleteFromTable(
    name: string,
    id: number | string
  ): Promise<{ bool: boolean; error?: string }> {
    return databaseFunctions.deleteFromTable(this.db, name, id);
  }

  exportDatabaseToSQL(): Promise<{
    bool: boolean;
    filePath?: string;
    error?: string;
  }> {
    return databaseFunctions.exportDatabaseToSQL(this.db);
  }
}
