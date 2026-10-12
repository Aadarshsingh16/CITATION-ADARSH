import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

export async function GET() {
  let dbStatus: "ok" | "error" = "ok";

  try {
    if (!process.env.DATABASE_URL) {
      dbStatus = "error";
    } else {
      await db.execute(sql`SELECT 1`);
    }
  } catch {
    dbStatus = "error";
  }

  if (dbStatus === "error") {
    return NextResponse.json(
      { status: "error", db: "error" },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { status: "ok", db: "ok" },
    { status: 200 }
  );
}
