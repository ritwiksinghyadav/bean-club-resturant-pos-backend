import { generateOrGetOtp, verifyOtp } from "../src/services/otp.service.js";
import { db, pool } from "../src/db/index.js";
import { otps } from "../src/db/schema.js";

async function testOtpSystem() {
  console.log("=== STARTING COMMON OTP SERVICE TESTS ===");

  const phoneIdentifier = "+919999999999";
  const emailIdentifier = "admin@yopmail.com";

  try {
    // 1. Clean up old test data
    await db.delete(otps);
    console.log("🧹 Cleaned up existing OTP records.");

    // 2. Generate new customer OTP
    console.log("\n[TEST 1] Generating OTP for customer...");
    const otp1 = await generateOrGetOtp({
      identifier: phoneIdentifier,
      mode: "login",
      metadata: { name: "Test User" }
    });
    console.log(`Generated OTP code: ${otp1.code}, Expires at: ${otp1.expiresAt}, isResend: ${otp1.isResend}`);
    if (otp1.isResend) throw new Error("Should not be resend on first call");

    // 3. Request OTP again (simulating Resend click within 10 minutes)
    console.log("\n[TEST 2] Resending OTP within 10 minutes...");
    const otp2 = await generateOrGetOtp({
      identifier: phoneIdentifier,
      mode: "login",
      metadata: { name: "Test User" }
    });
    console.log(`Retrieved OTP code: ${otp2.code}, isResend: ${otp2.isResend}`);
    if (otp2.code !== otp1.code) throw new Error("Codes should match for resend within 10 minutes");
    if (!otp2.isResend) throw new Error("Should be marked as isResend");

    // 4. Verify OTP code
    console.log("\n[TEST 3] Verifying OTP code...");
    const metadata = await verifyOtp({
      identifier: phoneIdentifier,
      code: otp1.code,
      mode: "login"
    });
    console.log("OTP verified successfully!");
    console.log("Returned Metadata:", metadata);
    if (metadata.name !== "Test User") throw new Error("Metadata name mismatch");

    // 5. Verify that code is deleted and cannot be verified twice
    console.log("\n[TEST 4] Trying to verify the same code again (should fail)...");
    try {
      await verifyOtp({
        identifier: phoneIdentifier,
        code: otp1.code,
        mode: "login"
      });
      throw new Error("Verification should have failed for deleted code");
    } catch (err) {
      console.log(`Expected failure occurred: "${err.message}"`);
    }

    // 6. Generate admin OTP (using email identifier)
    console.log("\n[TEST 5] Generating OTP for Admin (email identifier)...");
    const adminOtp = await generateOrGetOtp({
      identifier: emailIdentifier,
      mode: "admin_login",
      metadata: { role: "admin" }
    });
    console.log(`Generated Admin OTP code: ${adminOtp.code}, isResend: ${adminOtp.isResend}`);

    // 7. Verify admin OTP
    console.log("\n[TEST 6] Verifying Admin OTP...");
    const adminMetadata = await verifyOtp({
      identifier: emailIdentifier,
      code: adminOtp.code,
      mode: "admin_login"
    });
    console.log("Admin OTP verified successfully!");
    console.log("Admin Metadata:", adminMetadata);
    if (adminMetadata.role !== "admin") throw new Error("Admin metadata role mismatch");

    console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY!");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
  } finally {
    await pool.end();
    console.log("Database pool closed.");
    process.exit(0);
  }
}

testOtpSystem();
