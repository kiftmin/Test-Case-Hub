import { db, usersTable, projectAssignmentsTable } from "./src/index";
import { eq } from "drizzle-orm";

async function migrateRoles() {
  console.log("=== Role Migration ===");

  // 1. Global roles: OWNER -> ADMIN
  const ownerUsers = await db.update(usersTable)
    .set({ role: "ADMIN" })
    .where(eq(usersTable.role, "OWNER"))
    .returning({ id: usersTable.id, username: usersTable.username });
  console.log(`Migrated ${ownerUsers.length} user(s) from OWNER -> ADMIN`);
  ownerUsers.forEach(u => console.log(`  - ${u.username} (id: ${u.id})`));

  // 2. Global roles: TESTER -> USER (TESTER is now a project role, not global)
  const testerUsers = await db.update(usersTable)
    .set({ role: "USER" })
    .where(eq(usersTable.role, "TESTER"))
    .returning({ id: usersTable.id, username: usersTable.username });
  console.log(`Migrated ${testerUsers.length} user(s) from TESTER -> USER`);
  testerUsers.forEach(u => console.log(`  - ${u.username} (id: ${u.id})`));

  // 3. Project roles: OWNER -> BUSINESS_OWNER
  const ownerAssignments = await db.update(projectAssignmentsTable)
    .set({ role: "BUSINESS_OWNER" })
    .where(eq(projectAssignmentsTable.role, "OWNER"))
    .returning({ id: projectAssignmentsTable.id });
  console.log(`Migrated ${ownerAssignments.length} project assignment(s) from OWNER -> BUSINESS_OWNER`);

  // 4. Project roles: AUTHOR -> TEST_AUTHOR
  const authorAssignments = await db.update(projectAssignmentsTable)
    .set({ role: "TEST_AUTHOR" })
    .where(eq(projectAssignmentsTable.role, "AUTHOR"))
    .returning({ id: projectAssignmentsTable.id });
  console.log(`Migrated ${authorAssignments.length} project assignment(s) from AUTHOR -> TEST_AUTHOR`);

  console.log("=== Role migration complete ===");
  process.exit(0);
}

migrateRoles().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
