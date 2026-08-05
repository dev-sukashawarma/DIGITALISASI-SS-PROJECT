const url = "https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8";

async function run() {
  const headers = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };

  const topupId = "0eec8bbc-636b-4a07-9c8a-996092e4ef4a";
  
  // Set the topup status to forwarded_to_finance
  const updateRes = await fetch(`${url}/petty_cash_topups?id=eq.${topupId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: "forwarded_to_finance"
    })
  });
  console.log("Update Topup Result:", await updateRes.json());
}

run().catch(console.error);
