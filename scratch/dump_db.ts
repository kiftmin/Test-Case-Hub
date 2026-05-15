import { db, testRunUseCasesTable, usersTable } from "./lib/db/src/index";

async function main() {
  const assignments = await db.select().from(testRunUseCasesTable);
  const users = await db.select().from(usersTable);
  console.log("USERS:");
  console.log(JSON.stringify(users.map(u => ({ id: u.id, name: u.name })), null, 2));
  console.log("ASSIGNMENTS:");
  console.log(JSON.stringify(assignments, null, 2));
}

main().catch(console.error);
