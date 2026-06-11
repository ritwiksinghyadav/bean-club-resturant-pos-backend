import { PgBoss } from "pg-boss";
import { env } from "../src/config/env.js";

async function testSignature() {
  const boss = new PgBoss(env.DATABASE_URL);
  await boss.start();

  console.log("Creating queue 'test-signature'...");
  await boss.createQueue("test-signature");

  console.log("Registering worker for 'test-signature'...");
  await boss.work("test-signature", async (arg1, arg2, arg3) => {
    console.log("Worker called!");
    console.log("arg1 type:", typeof arg1, Array.isArray(arg1) ? "Array" : "Object");
    console.log("arg1 keys:", Object.keys(arg1 || {}));
    if (Array.isArray(arg1)) {
      console.log("arg1 is array of length:", arg1.length);
      console.log("First item keys:", Object.keys(arg1[0] || {}));
      console.log("First item data:", arg1[0].data);
    } else if (arg1) {
      console.log("arg1 data:", arg1.data);
    }
    console.log("arg2:", arg2);
    console.log("arg3:", arg3);
  });

  console.log("Publishing test job...");
  await boss.send("test-signature", { test: "data" });

  console.log("Waiting 4 seconds for job processing...");
  await new Promise((resolve) => setTimeout(resolve, 4000));

  await boss.stop();
  process.exit(0);
}

testSignature().catch(console.error);
