const API_URL = 'http://localhost:3001/api/attendance/webhook';

async function run() {
  const payload = {
    email: process.argv[2] || "kasir@example.com",
    password: process.argv[3] || "password123",
    outlet_id: process.argv[4] || "default-outlet-id",
    branch_name: process.argv[5] || "Cabang Utama",
    cashier_name: process.argv[6] || "Ahmad Kasir"
  };

  console.log('Sending payload to:', API_URL);
  console.log(payload);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
