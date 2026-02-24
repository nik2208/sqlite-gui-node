import express, { Request, Response, NextFunction, type Application } from "express";
import bodyParser from "body-parser";
import path from "path";
import { SqliteAdapter } from "./adapters/SqliteAdapter";
import type { IDatabaseAdapter } from "./adapters/IDatabaseAdapter";
import logger from "./Utils/logger";
import tableRoutes from "./routes/tables";
import type { Database } from "sqlite3";

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "../public")));
app.use(bodyParser.json());

app.use((req: Request, res: Response, next) => {
  res.locals.basePath = req.baseUrl;
  next();
});

// Routes
app.get("/query", (req, res) => {
  res.render("query", { title: "Query Page" });
});

app.get("/home", (req, res) => {
  res.render("index", { title: "Home Page" });
});

app.get("/createtable", (req, res) => {
  res.render("createTable", { title: "Create Table Page" });
});

app.get("/insert/:table", (req, res) => {
  const tableName = req.params.table;
  res.render("insert", { tableName });
});

app.get("/edit/:table/:label/:id", (req, res) => {
  const tableName = req.params.table;
  const id = req.params.id;
  res.render("edit", { tableName, id });
});

// ---------------------------------------------------------------------------
// Public API – adapter-based (supports SQLite, MySQL, PostgreSQL, …)
// ---------------------------------------------------------------------------

/**
 * Start the GUI server using any supported database adapter.
 *
 * @example – MySQL
 * ```ts
 * import mysql from "mysql2/promise";
 * import { MysqlAdapter } from "sqlite-gui-node/dist/adapters/MysqlAdapter";
 * import { SqliteGuiNodeWithAdapter } from "sqlite-gui-node";
 *
 * const pool = mysql.createPool({ host: "localhost", user: "root", password: "secret", database: "mydb" });
 * SqliteGuiNodeWithAdapter(new MysqlAdapter(pool), 8080);
 * ```
 *
 * @example – PostgreSQL
 * ```ts
 * import { Pool } from "pg";
 * import { PostgresAdapter } from "sqlite-gui-node/dist/adapters/PostgresAdapter";
 * import { SqliteGuiNodeWithAdapter } from "sqlite-gui-node";
 *
 * const pool = new Pool({ host: "localhost", user: "postgres", database: "mydb" });
 * SqliteGuiNodeWithAdapter(new PostgresAdapter(pool), 8080);
 * ```
 */
export async function SqliteGuiNodeWithAdapter(
  adapter: IDatabaseAdapter,
  port = 8080
) {
  await adapter.InitializeDB();
  app.use("/api/tables", tableRoutes(adapter));
  app.listen(port, () => {
    logger.info(
      `Web Admin Tool running at http://localhost:${port}/home`
    );
  });
}

// ---------------------------------------------------------------------------
// Legacy SQLite-specific API – kept for backward compatibility
// ---------------------------------------------------------------------------

/** @deprecated Use {@link SqliteGuiNodeWithAdapter} with a {@link SqliteAdapter} instead. */
export async function SqliteGuiNode(db: Database, port = 8080) {
  const adapter = new SqliteAdapter(db);
  await adapter.InitializeDB();
  app.use("/api/tables", tableRoutes(adapter));
  app.listen(port, () => {
    logger.info(
      `SQLite Web Admin Tool running at http://localhost:${port}/home`
    );
  });
}

/** @deprecated Use {@link SqliteGuiNodeWithAdapter} with a {@link SqliteAdapter} instead. */
export async function createSqliteGuiApp(db: Database): Promise<Application> {
  const adapter = new SqliteAdapter(db);
  await adapter.InitializeDB();
  app.use("/api/tables", tableRoutes(adapter));

  return app;
}

/** @deprecated Use {@link SqliteGuiNodeWithAdapter} with a {@link SqliteAdapter} instead. */
export function SqliteGuiNodeMiddleware(app: any, db: Database) {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      const adapter = new SqliteAdapter(db);
      await adapter.InitializeDB();
      app.set("view engine", "ejs");
      app.set("views", path.join(__dirname, "../views"));

      app.use(bodyParser.urlencoded({ extended: false }));
      app.use(express.static(path.join(__dirname, "../public")));
      app.use(bodyParser.json());

      // Routes
      app.get("/query", (req: Request, res: Response) => {
        res.render("query", { title: "Query Page" });
      });

      app.get("/", (req: Request, res: Response) => {
        res.render("index", { title: "Home Page" });
      });

      app.get("/createtable", (req: Request, res: Response) => {
        res.render("createTable", { title: "Create Table Page" });
      });

      app.get("/insert/:table", (req: Request, res: Response) => {
        const tableName = req.params.table;
        res.render("insert", { tableName });
      });

      app.get("/edit/:table/:label/:id", (req: Request, res: Response) => {
        const tableName = req.params.table;
        const id = req.params.id;
        res.render("edit", { tableName, id });
      });
      app.use("/api/tables", tableRoutes(adapter)); // Add table routes
      app.get("/home", (req: Request, res: Response) => {
        res.render("index", { title: "Home Page" });
      });

      next(); // Proceed to the next middleware/route handler
    } catch (error) {
      // Handle any errors during DB initialization
      logger.error("Error initializing the database:", error);
      res.status(500).send("Error initializing the database.");
    }
  };
}

// Re-export adapters and interface for convenience
export { SqliteAdapter } from "./adapters/SqliteAdapter";
export { MysqlAdapter } from "./adapters/MysqlAdapter";
export { PostgresAdapter } from "./adapters/PostgresAdapter";
export type { IDatabaseAdapter } from "./adapters/IDatabaseAdapter";
