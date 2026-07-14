// Run this yourself: node_modules/.bin/tsx scripts/reset-admin-password.ts
// It will prompt you to type a new password directly into YOUR terminal --
// this script never hardcodes or logs the password anywhere.
import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

async function main() {
  const username = process.argv[2] || "admin";
  const rl = createInterface({ input: stdin, output: stdout });
  const newPassword = await rl.question(`New password for "${username}" (min 8 chars): `);
  rl.close();

  if (!newPassword || newPassword.length < 8) {
    console.error("Password must be at least 8 characters. Aborted, nothing changed.");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`No user found with username "${username}". Nothing changed.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false, passwordChanged: true, isLocked: false, lockedReason: null },
  });

  console.log(`Password updated for "${username}". You can log in with the new password now.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
