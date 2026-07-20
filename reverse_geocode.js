async function getAddress(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Antigravity-Agent/1.0' }});
    const data = await res.json();
    console.log("Full Address:", data.display_name);
    console.log("Details:", JSON.stringify(data.address, null, 2));
  } catch (err) {
    console.error("Error fetching address:", err);
  }
}
getAddress(-6.7848878, 106.7808839);
