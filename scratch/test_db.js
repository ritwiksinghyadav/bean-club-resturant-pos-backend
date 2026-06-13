import pg from "pg";
const { Client } = pg;

async function testConnection() {
  const client = new Client({
    connectionString: "postgres://postgres:postgres@localhost:5432/bean_club",
  });
  
  try {
    console.log("Connecting to local PostgreSQL...");
    await client.connect();
    console.log("✅ Successfully connected to local PostgreSQL!");
    await client.end();
  } catch (err) {
    console.error("❌ Failed to connect to local PostgreSQL:", err.message);
  }
}

testConnection();
