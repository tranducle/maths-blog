// Generate a new AGENT_API_KEY (32 random bytes as hex). Print it once and never
// write it to disk. The same value must go into:
//   - .env.local (local dev)
//   - Vercel env var AGENT_API_KEY (production + preview)
//
//   node scripts/generate-agent-key.mjs
import { randomBytes } from "node:crypto";

const key = randomBytes(32).toString("hex");
console.log("\nAGENT_API_KEY=" + key);
console.log("\nLength: " + key.length + " hex chars (" + (key.length / 2) + " bytes)");
console.log(
  "\nNext steps:",
  "  1. vercel env add AGENT_API_KEY production preview   (paste the value above)",
  "  2. echo 'AGENT_API_KEY=" + key + "' >> .env.local",
  "  3. vercel --prod   (redeploy)",
  "",
  "Agents authenticate with:  Authorization: Bearer " + key,
  "",
);
