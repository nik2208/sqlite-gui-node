// Common interfaces shared across adapters
export interface ColumnInfo {
  field: string;
  type: string;
  fk?: any[];
}

export interface ForeignKeyInfo {
  table: string;
  from: string;
  to: string;
}

export interface FetchTableForeignKeysResult {
  bool: boolean;
  data?: ForeignKeyInfo[];
  error?: string;
}

export interface QueryRecord {
  id: number;
  name: string;
  sqlstatement: string;
}

export interface PaginationMeta {
  total: number | unknown;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Common interface for all database adapters (SQLite, MySQL, PostgreSQL, …).
 * Each implementation uses the database's own reflection / information_schema
 * to discover tables and columns at runtime, so no manual schema definition
 * is required.
 */
export interface IDatabaseAdapter {
  /** Return the properly-quoted identifier for this database dialect. */
  quoteIdentifier(name: string): string;

  /** Ensure the internal `query` table used to store saved queries exists. */
  InitializeDB(): Promise<void>;

  /** List all user tables. */
  fetchAllTables(): Promise<{ bool: boolean; data?: any[] }>;

  /** Fetch a paginated slice of a table's rows. */
  fetchTable(
    table: string,
    pagination?: { page: number; perPage: number }
  ): Promise<{ bool: boolean; data?: any[]; meta: PaginationMeta }>;

  /** Fetch column metadata for insert/edit forms (may exclude auto columns). */
  fetchTableInfo(table: string): Promise<{ bool: boolean; data?: ColumnInfo[] }>;

  /** Fetch all column metadata for display (includes auto columns). */
  fetchAllTableInfo(
    table: string
  ): Promise<{ bool: boolean; data?: ColumnInfo[] }>;

  /** Fetch foreign-key relationships declared on a table. */
  fetchTableForeignKeys(
    table: string
  ): Promise<FetchTableForeignKeysResult>;

  /** Fetch the distinct values of a column (used to populate FK dropdowns). */
  fetchFK(
    table: string,
    column: string
  ): Promise<{ bool: boolean; data: any[] }>;

  /** Fetch a single row identified by a label/value pair. */
  fetchRecord(
    table: string,
    label: string,
    id: number | string
  ): Promise<{ bool: boolean; data?: any[] }>;

  /** Execute a non-SELECT statement (INSERT / UPDATE / DELETE / CREATE / DROP). */
  runQuery(
    sqlStatement: string
  ): Promise<{ bool: boolean; error?: string }>;

  /** Execute a SELECT statement and return the result rows. */
  runSelectQuery(
    sqlStatement: string
  ): Promise<{ bool: boolean; data?: any[] }>;

  /** Persist a named SQL query to the `query` table. */
  insertQuery(
    name: string,
    sqlStatement: string
  ): Promise<{ bool: boolean; error?: string }>;

  /** Retrieve all saved queries from the `query` table. */
  fetchQueries(): Promise<{ bool: boolean; data?: QueryRecord[] }>;

  /**
   * Check whether a column has a DEFAULT value defined.
   * Used by the INSERT SQL generator to skip columns that will be auto-filled.
   */
  checkColumnHasDefault(
    tableName: string,
    columnType: string,
    columnName: string
  ): Promise<{ bool: boolean; message?: string; error?: string }>;

  /** Delete a row from a table by its `id` value. */
  deleteFromTable(
    name: string,
    id: number | string
  ): Promise<{ bool: boolean; error?: string }>;

  /** Dump the entire database to an SQL file in `public/output.sql`. */
  exportDatabaseToSQL(): Promise<{
    bool: boolean;
    filePath?: string;
    error?: string;
  }>;
}
