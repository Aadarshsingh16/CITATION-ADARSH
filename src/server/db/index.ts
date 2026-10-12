import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD || "postgres",
        host: process.env.PGHOST || "localhost",
        port: parseInt(process.env.PGPORT || "5434", 10),
        database: process.env.PGDATABASE || "contract_analyser",
      }
);

export const db = drizzle(pool, { schema });
