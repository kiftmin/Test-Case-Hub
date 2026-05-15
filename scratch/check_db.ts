import { db, testRunUseCasesTable, usersTable, testRunsTable } from "./lib/db/src/index";
import { eq } from "drizzle-orm";

async function debug() {
  try {
    const users = await db.select().from(usersTable);
    console.log("Users:", users.map(u => ({ id: u.id, name: u.name, username: u.username })));

    const assignments = await db.select().from(testRunUseCasesTable);
    console.log("Assignments:", assignments.map(a => ({ 
      id: a.id, 
      testRunId: a.testRunId, 
      testerId: a.assignedTesterId 
    })));

    const runs = await db.select().from(testRunsTable);
    console.log("Test Runs:", runs.map(r => ({ id: r.id, name: r.name, status: r.status })));
  } catch (err) {
    console.error(err);
  }
}

debug();
