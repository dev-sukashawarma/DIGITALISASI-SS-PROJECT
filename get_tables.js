const axios = require('axios');

async function main() {
  const url = 'https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';
  try {
    const res = await axios.get(url);
    const definitions = res.data.definitions;
    console.log('Tables:', Object.keys(definitions));
  } catch (e) {
    console.error(e);
  }
}
main();
