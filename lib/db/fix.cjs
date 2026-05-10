const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_TdaPpt92OmNR@ep-winter-sun-amflvahi-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  });

  try {
    console.log('Connecting to DB to alter executions table...');
    
    // Add status column if it doesn't exist
    await pool.query(`
      ALTER TABLE executions 
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress';
    `);
    console.log('Added status column');

    // Drop columns that drizzle is trying to drop
    await pool.query(`ALTER TABLE executions DROP COLUMN IF EXISTS actual_result;`);
    await pool.query(`ALTER TABLE executions DROP COLUMN IF EXISTS comments;`);
    await pool.query(`ALTER TABLE executions DROP COLUMN IF EXISTS passed;`);
    console.log('Dropped old result columns');

  } catch (error) {
    console.error('Error modifying database:', error);
  } finally {
    await pool.end();
  }
}

run();
