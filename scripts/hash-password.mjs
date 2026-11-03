// Creates the bcrypt hash for ADMIN_PASSWORD_HASH, so the real password is never written to any file.
//
//   npm run hash-password
//
// You will be asked for the password (it is not shown on screen). Copy the printed line into .env.
import readline from "node:readline";
import bcrypt from "bcryptjs";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

// Hide what is typed.
rl._writeToOutput = function (s) {
  if (rl.stdoutMuted) rl.output.write(s.includes("\n") || s.includes("\r") ? s : "*");
  else rl.output.write(s);
};

const ask = (q) =>
  new Promise((resolve) => {
    rl.stdoutMuted = false;
    rl.question(q, (a) => {
      rl.stdoutMuted = false;
      resolve(a);
    });
    rl.stdoutMuted = true;
  });

const pw = await ask("New admin password: ");
console.log();
const again = await ask("Repeat it: ");
console.log();
rl.close();

const problems = [];
if (pw !== again) problems.push("The two passwords do not match.");
if (pw.length < 12) problems.push("Use at least 12 characters.");
if (pw.length > 128) problems.push("Use at most 128 characters.");
if ([/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length < 3)
  problems.push("Use at least three of: lowercase, uppercase, numbers, symbols.");

if (problems.length) {
  console.error("\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}

const hash = bcrypt.hashSync(pw, 12);
console.log("\nAdd this line to backend/.env (together with ADMIN_EMAIL=you@example.com):\n");
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
