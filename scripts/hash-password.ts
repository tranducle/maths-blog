import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

// RT-06: reads the plaintext from stdin ONLY. Never a hardcoded literal, never
// written to any file. Prints the bcrypt hash to paste into ADMIN_PASSWORD_HASH
// (.env.local locally + Vercel env in production). Rotate the password before launch.
async function main() {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const password = (await rl.question("Enter admin password (input echoed): ")).trim();
  rl.close();

  if (password.length < 12) {
    console.error("Refusing: use a password of at least 12 characters.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  console.log("\nADMIN_PASSWORD_HASH=" + hash);
  console.log("\nPaste the line above into .env.local and your Vercel env vars.");
}

main();
