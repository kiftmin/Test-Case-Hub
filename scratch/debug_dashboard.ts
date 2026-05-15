import { db, testRunUseCasesTable, testRunsTable, usersTable, projectsTable } from "./lib/db/src/index";
import { eq, inArray } from "drizzle-orm";

async function main() {
  const users = await db.select().from(usersTable);
  const runs = await db.select().from(testRunsTable);
  const assignments = await db.select().from(testRunUseCasesTable);
  
  console.log("--- USERS ---");
  users.forEach(u => console.log(`${u.id}: ${u.name} (@${u.username}) [${u.role}]`));
  
  console.log("\n--- TEST RUNS ---");
  runs.forEach(r => console.log(`${r.id}: ${r.name} status=${r.status} projectId=${r.projectId}`));
  
  console.log("\n--- ASSIGNMENTS ---");
  assignments.forEach(a => {
    if (a.assignedTesterId) {
        console.log(`Run ${a.testRunId}: UseCase ${a.useCaseId} assigned to User ${a.assignedTesterId}`);
    }
  });

  // Simulate the dashboard query
  const brad = users.find(u => u.name === "Brad Tester");
  if (brad) {
    console.log(`\n--- DEBUGGING FOR BRAD (ID: ${brad.id}) ---`);
    const bradAssignments = assignments.filter(a => a.assignedTesterId === brad.id);
    console.log(`Brad has ${bradAssignments.length} assignments.`);
    const runIds = [...new Set(bradAssignments.map(a => a.testRunId))];
    console.log(`Assigned Run IDs: ${runIds.join(", ")}`);
    
    if (runIds.length > 0) {
        const bradRuns = runs.filter(r => runIds.includes(r.id) && ["scheduled", "in_progress"].includes(r.status));
        console.log(`Runs found for dashboard: ${bradRuns.length}`);
        bradRuns.forEach(r => console.log(`- ${r.name} (${r.status})`));
    }
  }
}

main().catch(console.error);
