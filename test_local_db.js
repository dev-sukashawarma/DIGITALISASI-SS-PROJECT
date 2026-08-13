const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres'
});

async function main() {
  try {
    await client.connect();
    const res = await client.query('SELECT current_database();');
    console.log('Connected to:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection error', err.stack);
  }
}

main();
