import { db, pool } from "../src/db/index.js";
import { admins } from "../src/db/schema.js";

async function runTest() {
  console.log("Connecting to remote Neon Database...");
  try {
    const start = Date.now();
    const result = await db.select().from(admins).limit(5);
    console.log(`✅ Connection successful! Fetched ${result.length} admins in ${Date.now() - start}ms`);
    console.log("Admins:", result.map(a => ({ id: a.id, email: a.email, role: a.role })));
  } catch (err) {
    console.error("❌ Failed to query remote database:", err);
  } finally {
    await pool.end();
    console.log("Database pool closed.");
  }
}

runTest();
