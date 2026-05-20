import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function run() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log("Connecting to DB to alter executions table...");

    await pool.query(`
      ALTER TABLE executions 
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress';
    `);
    console.log("Added status column");

    await pool.query(`ALTER TABLE executions DROP COLUMN IF EXISTS actual_result;`);
    await pool.query(`ALTER TABLE executions DROP COLUMN IF EXISTS comments;`);
    await pool.query(`ALTER TABLE executions DROP COLUMN IF EXISTS passed;`);
    console.log("Dropped old result columns");
  } catch (error) {
    console.error("Error modifying database:", error);
  } finally {
    await pool.end();
  }
}

run();
