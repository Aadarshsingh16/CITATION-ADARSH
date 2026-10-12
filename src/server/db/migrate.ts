import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function runMigrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log("Applying migrations from src/server/db/migrations...");
  try {
    await migrate(db, { migrationsFolder: "src/server/db/migrations" });
    console.log("Migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

runMigrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
