import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Admin Setup...");

  // 1. Ensure SUPER_ADMIN role exists
  const superAdminRole = await prisma.role.upsert({
    where: { name: "SUPER_ADMIN" },
    update: { isSystem: true },
    create: { 
      name: "SUPER_ADMIN", 
      description: "Super Administrator - Full Access",
      isSystem: true
    }
  });
  console.log("✔ SUPER_ADMIN role verified.");

  // 2. Hash the new password
  const password = "Admin@Password123";
  const hashedPassword = await bcrypt.hash(password, 12);

  // 3. Create or Update the admin user
  const adminEmail = "admin@lana.local";
  const adminUsername = "admin";
  
  const adminUser = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      email: adminEmail,
      name: "System Admin",
      passwordHash: hashedPassword,
      isActive: true,
      emailVerified: new Date(),
    },
    create: {
      username: adminUsername,
      email: adminEmail,
      name: "System Admin",
      passwordHash: hashedPassword,
      isActive: true,
      emailVerified: new Date(),
    }
  });
  console.log("✔ Admin user created/updated.");

  // 4. Link admin user to SUPER_ADMIN role
  await prisma.userRole.upsert({
    where: { 
      userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } 
    },
    update: {},
    create: { userId: adminUser.id, roleId: superAdminRole.id }
  });
  console.log("✔ Admin assigned to SUPER_ADMIN role.");

  console.log("=========================================");
  console.log("Admin Setup Completed Successfully!");
  console.log("Username: " + adminUsername);
  console.log("Email:    " + adminEmail);
  console.log("Password: " + password);
  console.log("Role:     SUPER_ADMIN");
  console.log("Status:   ACTIVE");
  console.log("=========================================");
}

main()
  .catch((e) => {
    console.error("Error setting up admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
