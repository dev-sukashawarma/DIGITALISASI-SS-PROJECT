async function getLatLng(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Antigravity-Agent/1.0' }});
    const data = await res.json();
    if (data.length > 0) {
      console.log("Found:", data[0].display_name);
      console.log(`LAT: ${data[0].lat}, LNG: ${data[0].lon}`);
    } else {
      console.log("Address not found.");
    }
  } catch (err) {
    console.error("Error fetching lat/lng:", err);
  }
}
getLatLng("Jalan Pahlawan, Empang, Bogor");
