#!/usr/bin/env node
/**
 * Generate the bcrypt hash for ADMIN_PASSWORD_HASH.
 *
 *   npm run hash-password
 *
 * Reads the password from a hidden prompt so it never lands in shell history.
 * Pass `--stdin` to pipe it instead (useful in scripts).
 */

import { createInterface } from "node:readline";
import { stdin, stdout, argv, exit } from "node:process";
import bcrypt from "bcryptjs";

const COST = 12;
const MIN_LENGTH = 12;

/** Prompt without echoing keystrokes to the terminal. */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(
        new Error("Not a TTY — rerun with --stdin and pipe the password."),
      );
      return;
    }

    const rl = createInterface({
      input: stdin,
      output: stdout,
      terminal: true,
    });

    // Suppress echo by swallowing the output writes while the answer is typed.
    let muted = false;
    const originalWrite = stdout.write.bind(stdout);
    stdout.write = (chunk, encoding, callback) => {
      if (muted) {
        if (typeof callback === "function") callback();
        return true;
      }
      return originalWrite(chunk, encoding, callback);
    };

    rl.question(question, (answer) => {
      muted = false;
      stdout.write = originalWrite;
      originalWrite("\n");
      rl.close();
      resolve(answer);
    });

    muted = true;
  });
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      data += chunk;
    });
    stdin.on("end", () => resolve(data.trim()));
  });
}

async function main() {
  const useStdin = argv.includes("--stdin");

  const password = useStdin
    ? await readStdin()
    : await promptHidden("Admin password: ");

  if (!password) {
    console.error("No password provided.");
    exit(1);
  }

  if (password.length < MIN_LENGTH) {
    console.error(
      `Password must be at least ${MIN_LENGTH} characters. This is the only credential protecting the admin panel.`,
    );
    exit(1);
  }

  if (!useStdin) {
    const confirmation = await promptHidden("Confirm password: ");
    if (confirmation !== password) {
      console.error("Passwords do not match.");
      exit(1);
    }
  }

  const hash = await bcrypt.hash(password, COST);

  // Next.js runs dotenv variable expansion over .env files, so an unescaped
  // `$2b$12$...` is read as three empty `$VAR` references and silently mangled.
  // Quoting does not help; only backslash-escaping does.
  const escaped = hash.replaceAll("$", "\\$");

  console.log(
    "\n--- .env.local (dollar signs escaped, required) -------------\n",
  );
  console.log(`ADMIN_PASSWORD_HASH=${escaped}\n`);
  console.log(
    "--- Vercel dashboard (paste verbatim, no escaping) ----------\n",
  );
  console.log(hash);
  console.log(
    "\nVercel's environment variables are not dotenv-parsed, so the raw hash\n" +
      "is correct there. The plaintext password was never written to disk.\n",
  );
}

main().catch((error) => {
  console.error(error.message);
  exit(1);
});
