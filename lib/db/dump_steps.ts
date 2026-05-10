import { db, testStepsTable } from "./src";

async function main() {
  const allSteps = await db.select().from(testStepsTable);
  console.log(JSON.stringify(allSteps, null, 2));
  process.exit(0);
}

main().catch(console.error);
