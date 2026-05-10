import { db, usersTable } from "../../lib/db/src/index";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding users...");
  
  const adminPassword = await bcrypt.hash("admin123", 10);
  const testerPassword = await bcrypt.hash("tester123", 10);
  
  await db.insert(usersTable).values([
    {
      username: "admin",
      passwordHash: adminPassword,
      name: "System Administrator",
      email: "admin@example.com",
      role: "ADMIN"
    },
    {
      username: "tester1",
      passwordHash: testerPassword,
      name: "John Tester",
      email: "john@example.com",
      role: "TESTER"
    }
  ]).onConflictDoNothing();
  
  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
