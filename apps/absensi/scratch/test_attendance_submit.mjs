async function testSubmit() {
  const payload = {
    id: crypto.randomUUID(),
    outlet_staff_id: '6b41b068-0feb-47d3-aea8-bae94f75fc09', // Reza in Cicurug
    outlet_id: 'd9a2ef93-c298-4501-a471-1c5e2b3dff08', // SUKA SHAWARMA CICURUG
    type: 'in',
    ts_client: new Date().toISOString(),
    // Simulated realistic user location offset (~26.6m from database coords -6.7851251, 106.7812358)
    gps_lat: -6.785300,
    gps_lng: 106.781400,
    gps_accuracy: 12.5,
    is_mock: false,
    match_distance: 0.32, // simulated face recognition distance (< 0.40)
    selfie_path: 'd9a2ef93-c298-4501-a471-1c5e2b3dff08/6b41b068-0feb-47d3-aea8-bae94f75fc09.jpg'
  };

  console.log('Sending payload:', payload);

  const ports = [3001, 3000];
  for (const port of ports) {
    try {
      console.log(`Trying http://localhost:${port}/api/submit-attendance...`);
      const res = await fetch(`http://localhost:${port}/api/submit-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log(`Response status (${port}):`, res.status);
      console.log('Response body:', JSON.stringify(data, null, 2));
      return { port, status: res.status, data };
    } catch (e) {
      console.log(`Could not connect to port ${port}:`, e.message);
    }
  }
}

testSubmit();
