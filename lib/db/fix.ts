import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load the appropriate .env file
dotenv.config({ path: path.resolve(__dirname, '../../artifacts/api-server/.env') });

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
