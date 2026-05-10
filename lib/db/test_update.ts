
import { db, testStepsTable } from "./src/index";
import { eq } from "drizzle-orm";

async function test() {
  const steps = await db.select().from(testStepsTable).limit(1);
  if (steps.length === 0) {
    console.log("No steps found to test");
    process.exit(0);
  }

  const step = steps[0];
  console.log("Testing update for step ID:", step.id);

  const [updated] = await db
    .update(testStepsTable)
    .set({ instruction: step.instruction + " (updated)" })
    .where(eq(testStepsTable.id, step.id))
    .returning();

  if (updated) {
    console.log("Update successful:", updated.instruction);
    // Revert
    await db.update(testStepsTable).set({ instruction: step.instruction }).where(eq(testStepsTable.id, step.id));
  } else {
    console.log("Update failed - no row returned");
  }
  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
