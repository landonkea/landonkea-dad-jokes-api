#!/usr/bin/env node
// =============================================================================
// generate-test-summary.js, Runs both test suites, writes a persisted summary
// =============================================================================
// WHAT: Runs "vitest run" for both server/ and client/ with the JSON reporter,
//       then combines the pass/fail counts from both into a single summary
//       written to test-results/latest.json (machine-readable) and
//       test-results/latest.md (human-readable).
// WHY:  So CI (and local runs) leave behind a persisted artifact answering
//       "did the tests pass, how many, and when was this run" without having
//       to dig through raw CI logs. Wired into GitHub Actions as an
//       actions/upload-artifact step (see .github/workflows/ci.yml).
// HOW:  Shells out to "npx vitest run --reporter=json --outputFile=..." in
//       each package, parses the resulting JSON report, and aggregates it.
//       Exits non-zero if either suite failed, so this can also be used as a
//       CI gate on its own if desired (not required, CI already runs the
//       suites separately as its primary gate; this script does not replace
//       those steps).
// =============================================================================
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "test-results");

/**
 * Runs "vitest run" with the JSON reporter inside the given package directory,
 * and returns the parsed pass/fail counts. Vitest exits non-zero when tests
 * fail, so we still parse the JSON report it wrote even if execSync throws.
 */
function runSuite(name, cwd) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rawOutFile = path.join(OUT_DIR, `${name}.raw.json`);

  let ranSuccessfully = true;
  try {
    execSync(
      `npx vitest run --reporter=json --outputFile=${JSON.stringify(rawOutFile)}`,
      { cwd, stdio: "inherit", env: process.env }
    );
  } catch (err) {
    // Non-zero exit just means "some tests failed", the JSON report is still
    // written. We only treat this as a hard failure below if we can't read it.
    ranSuccessfully = false;
  }

  const summary = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    pendingTests: 0,
    success: ranSuccessfully,
  };

  if (fs.existsSync(rawOutFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(rawOutFile, "utf-8"));
      summary.totalTests = raw.numTotalTests ?? 0;
      summary.passedTests = raw.numPassedTests ?? 0;
      summary.failedTests = raw.numFailedTests ?? 0;
      summary.pendingTests = raw.numPendingTests ?? 0;
      summary.success = raw.success ?? ranSuccessfully;
    } catch (parseErr) {
      console.error(`Failed to parse ${rawOutFile}: ${parseErr.message}`);
      summary.success = false;
    }
  } else {
    console.error(`Expected vitest report at ${rawOutFile} but it wasn't written.`);
    summary.success = false;
  }

  return summary;
}

const timestamp = new Date().toISOString();

console.log("Running server tests...");
const server = runSuite("server", path.join(ROOT, "server"));

console.log("Running client tests...");
const client = runSuite("client", path.join(ROOT, "client"));

const totals = {
  tests: server.totalTests + client.totalTests,
  passed: server.passedTests + client.passedTests,
  failed: server.failedTests + client.failedTests,
  pending: server.pendingTests + client.pendingTests,
};
const success = server.success && client.success;

const combined = { timestamp, success, totals, suites: { server, client } };

fs.writeFileSync(
  path.join(OUT_DIR, "latest.json"),
  JSON.stringify(combined, null, 2) + "\n"
);

const md = `# Test Results

Last run: ${timestamp}

Overall: ${success ? "PASS" : "FAIL"}

| Suite | Total | Passed | Failed | Pending |
|---|---:|---:|---:|---:|
| Server | ${server.totalTests} | ${server.passedTests} | ${server.failedTests} | ${server.pendingTests} |
| Client | ${client.totalTests} | ${client.passedTests} | ${client.failedTests} | ${client.pendingTests} |
| **Total** | **${totals.tests}** | **${totals.passed}** | **${totals.failed}** | **${totals.pending}** |
`;

fs.writeFileSync(path.join(OUT_DIR, "latest.md"), md);

console.log(`\nWrote ${path.join(OUT_DIR, "latest.json")} and latest.md`);
console.log(
  `Total: ${totals.tests} tests, ${totals.passed} passed, ${totals.failed} failed, ${totals.pending} pending. Overall: ${success ? "PASS" : "FAIL"}`
);

if (!success) {
  process.exitCode = 1;
}
