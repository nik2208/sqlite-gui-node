import type { DataItem } from "../types";
import type { IDatabaseAdapter } from "../adapters/IDatabaseAdapter";
import { isEmpty, quoteValue } from "./helpers";

// Re-export the interface so callers can reference it from this module.
export type { IDatabaseAdapter };

/** Identity quoter – used as the default when no adapter is provided. */
const noQuote = (s: string) => s;

async function generateInsertSQL(
  adapter: IDatabaseAdapter,
  tableName: string,
  data: DataItem[]
): Promise<string> {
  // Extract field names and escape values (optional for TEXT and BLOB)
  const columns: string[] = [];
  const values: string[] = [];
  const q = adapter.quoteIdentifier.bind(adapter);

  await Promise.all(
    data.map(async (item) => {
      const hasDefault = await adapter.checkColumnHasDefault(
        tableName,
        item.type.toUpperCase(),
        item.field
      );

      if (isEmpty(item.value) && hasDefault.bool) return;

      columns.push(q(item.field));
      values.push(quoteValue(item));
    })
  );

  // Form the SQL statement
  const sql = `INSERT INTO ${q(tableName)} (${columns.join(
    ", "
  )}) VALUES (${values.join(", ")});`;

  return sql;
}

function generateUpdateSQL(
  tableName: string,
  data: DataItem[],
  id: number | string,
  id_label: string,
  quoter: (s: string) => string = noQuote
): string {
  // Extract field names and values with proper handling
  const setClauses = data
    .map((item) => `${quoter(item.field)} = ${quoteValue(item)}`)
    .join(", ");
  // Form the SQL statement
  const sql = `UPDATE ${quoter(tableName)} SET ${setClauses} WHERE ${id_label} = ${
    typeof id === "string" ? `'${id}'` : id
  };`;

  return sql;
}

function generateCreateTableSQL(
  tableName: string,
  data: DataItem[],
  quoter: (s: string) => string = noQuote
): string {
  // Map through data to generate column definitions
  const fk_array: string[] = [];
  const columnDefinitions = data
    .map((item) => {
      let columnType: string;
      if (item.fk !== "No") {
        fk_array.push(item.fk);
      }
      switch (item.type) {
        case "TEXT":
          columnType = "TEXT";
          break;
        case "INTEGER":
          columnType = "INTEGER";
          break;
        case "REAL":
          columnType = "REAL";
          break;
        case "DATE":
          columnType = "DATETIME DEFAULT CURRENT_TIMESTAMP";
          break;
        default:
          throw new Error(`Unknown type: ${item.type}`);
      }

      let columnDefinition = `${quoter(item.name)} ${columnType}`;
      if (item.pk) {
        columnDefinition += ` ${item.pk}`; // Include primary key constraint
      }
      if (item.default !== null && item.default !== undefined) {
        columnDefinition += ` DEFAULT ${item.default}`; // Include default value
      }
      return columnDefinition;
    })
    .join(", ");

  // Form the SQL statement
  let sql;
  if (fk_array.length !== 0) {
    sql = `CREATE TABLE IF NOT EXISTS ${quoter(tableName)} (${columnDefinitions} ${
      "," + fk_array.join(",")
    });`;
  } else {
    sql = `CREATE TABLE IF NOT EXISTS ${quoter(tableName)} (${columnDefinitions});`;
  }

  return sql;
}

export default {
  generateInsertSQL,
  generateUpdateSQL,
  generateCreateTableSQL,
};
