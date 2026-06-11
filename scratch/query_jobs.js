import pg from "pg";
import { env } from "../src/config/env.js";

async function queryJobs() {
  const { Pool } = pg;
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to database to query pgboss jobs...");
    const client = await pool.connect();
    
    // Check tables in pgboss schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'pgboss'
    `);
    console.log("pgboss tables:", tablesRes.rows.map(r => r.table_name));

    // Query queue stats
    const queuesRes = await client.query("SELECT * FROM pgboss.queue");
    console.log("\nQueues registered in pgboss.queue:");
    console.table(queuesRes.rows);

    // Query jobs
    const jobsRes = await client.query(`
      SELECT id, name, state, retry_count, created_on, started_on, completed_on, keep_until,
             substring(data::text, 1, 100) as data_preview,
             substring(output::text, 1, 150) as output_preview
      FROM pgboss.job
      ORDER BY created_on DESC
      LIMIT 10
    `);
    console.log("\nRecent 10 jobs in pgboss.job:");
    console.table(jobsRes.rows);

    client.release();
  } catch (err) {
    console.error("Error querying jobs:", err);
  } finally {
    await pool.end();
  }
}

queryJobs().catch(console.error);
