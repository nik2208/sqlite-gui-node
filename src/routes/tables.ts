import express, { Request, Response } from "express";
import sqlGenerator from "../Utils/sqlGenerator";
import type { IDatabaseAdapter } from "../adapters/IDatabaseAdapter";

const router = express.Router();

function tableRoutes(adapter: IDatabaseAdapter) {
  router.get("/", async (req: Request, res: Response) => {
    try {
      await adapter.exportDatabaseToSQL();
      const tables = await adapter.fetchAllTables();
      res.status(200).json(tables);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get("/local/query", async (req: Request, res: Response) => {
    try {
      await adapter.InitializeDB();
      const queries = await adapter.fetchQueries();
      res.status(200).json(queries);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/local/query", async (req: Request, res: Response) => {
    try {
      await adapter.InitializeDB();
      const { name, sqlStatement } = req.body;
      const response = await adapter.insertQuery(name, sqlStatement);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get("/:name", async (req: Request, res: Response) => {
    const { name } = req.params;
    const { page, perPage } = req.query;

    try {
      const response = await adapter.fetchTable(name, {
        page: Number(page),
        perPage: Number(perPage),
      });
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get("/infos/:name", async (req: Request, res: Response) => {
    const { name } = req.params;
    try {
      const response = await adapter.fetchTableInfo(name);
      const fk = await adapter.fetchTableForeignKeys(name);
      if (fk.bool && fk.data !== undefined) {
        fk.data.forEach((element) => {
          adapter.fetchFK(element.table, element.to).then((fk_response) => {
            if (response.data !== undefined) {
              response.data.forEach((item) => {
                if (item.field === element.from) {
                  item.fk = fk_response.data.map(
                    (obj: any) => obj[element.to]
                  );
                }
              });
            }
          });
        });
      }
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get("/all/infos/:name", async (req: Request, res: Response) => {
    const { name } = req.params;
    try {
      const response = await adapter.fetchAllTableInfo(name);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/insert", async (req: Request, res: Response) => {
    try {
      const { tablename, dataArray } = req.body;
      const sql = await sqlGenerator.generateInsertSQL(
        adapter,
        tablename,
        dataArray
      );
      const response = await adapter.runQuery(sql);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/generate/insert", async (req: Request, res: Response) => {
    try {
      const { tablename, dataArray } = req.body;
      const sql = await sqlGenerator.generateInsertSQL(
        adapter,
        tablename,
        dataArray
      );
      res.status(200).json(sql);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/query", async (req: Request, res: Response) => {
    try {
      const { sqlQuery } = req.body;
      const lowersqlQuery = sqlQuery.toLowerCase();
      if (lowersqlQuery.startsWith("select")) {
        const response = await adapter.runSelectQuery(sqlQuery);
        if (lowersqlQuery.startsWith("select count(*)")) {
          if (response.data !== undefined) {
            res.status(200).json({
              type: "string",
              data: "Count result is " + response.data[0]["count(*)"],
            });
          } else {
            res.status(500).json({
              type: "string",
              data: "Database error",
            });
          }
        } else {
          res.status(200).json({ type: "table", data: response.data });
        }
      } else {
        await adapter.runQuery(sqlQuery);
        let message = "";
        if (lowersqlQuery.startsWith("update"))
          message = "Updated Successfully";
        if (lowersqlQuery.startsWith("insert"))
          message = "Inserted Successfully";
        if (lowersqlQuery.startsWith("delete"))
          message = "Deleted Successfully";
        if (lowersqlQuery.startsWith("create"))
          message = "Created Successfully";
        res.status(200).json({ type: "string", data: message });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/create", async (req: Request, res: Response) => {
    try {
      const { tableName, data } = req.body;
      const q = adapter.quoteIdentifier.bind(adapter);
      const sql = sqlGenerator.generateCreateTableSQL(tableName, data, q);
      const response = await adapter.runQuery(sql);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/generate/create", async (req: Request, res: Response) => {
    try {
      const { tableName, data } = req.body;
      const q = adapter.quoteIdentifier.bind(adapter);
      const sql = sqlGenerator.generateCreateTableSQL(tableName, data, q);
      res.status(200).json(sql);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/update", async (req: Request, res: Response) => {
    try {
      const { tablename, dataArray, userId, id_label } = req.body;
      const q = adapter.quoteIdentifier.bind(adapter);
      const sql = sqlGenerator.generateUpdateSQL(
        tablename,
        dataArray,
        userId,
        id_label,
        q
      );
      const response = await adapter.runQuery(sql);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/generate/update", async (req: Request, res: Response) => {
    try {
      const { tablename, dataArray, userId, id_label } = req.body;
      const q = adapter.quoteIdentifier.bind(adapter);
      const sql = sqlGenerator.generateUpdateSQL(
        tablename,
        dataArray,
        userId,
        id_label,
        q
      );
      res.status(200).json(sql);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get(
    "/getrecord/:tablename/:label/:id",
    async (req: Request, res: Response) => {
      try {
        const { tablename, label, id } = req.params;
        const response = await adapter.fetchRecord(tablename, label, id);
        res.status(200).json(response);
      } catch (error) {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.post("/delete", async (req: Request, res: Response) => {
    try {
      const { tablename, id } = req.body;
      const response = await adapter.deleteFromTable(tablename, id);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/table/delete", async (req: Request, res: Response) => {
    try {
      const { tablename } = req.body;
      const sql = `DROP TABLE ${adapter.quoteIdentifier(tablename)};`;
      const response = await adapter.runQuery(sql);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return router;
}

export default tableRoutes;
