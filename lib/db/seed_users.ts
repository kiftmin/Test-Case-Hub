import { db, usersTable } from "./src/index";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding users...");
  
  const adminPassword = await bcrypt.hash("admin123", 10);
  const authorPassword = await bcrypt.hash("author123", 10);
  const userPassword = await bcrypt.hash("user123", 10);
  
  await db.insert(usersTable).values([
    {
      username: "admin",
      passwordHash: adminPassword,
      name: "System Administrator",
      email: "admin@example.com",
      role: "ADMIN"
    },
    {
      username: "author1",
      passwordHash: authorPassword,
      name: "Sarah Author",
      email: "sarah@example.com",
      role: "AUTHOR"
    },
    {
      username: "user1",
      passwordHash: userPassword,
      name: "Jane User",
      email: "jane@example.com",
      role: "USER"
    }
  ]).onConflictDoNothing();
  
  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
