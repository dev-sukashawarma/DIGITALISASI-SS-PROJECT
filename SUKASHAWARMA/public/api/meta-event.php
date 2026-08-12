<?php
// ============================================================
//  Meta Conversions API — Server-side endpoint
//  File: /api/meta-event.php
//  Dipanggil dari browser (kemitraan.js) untuk meneruskan
//  event ke server Meta tanpa mengekspos Access Token.
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://sukashawarma.com');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Tangani preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Hanya izinkan POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Konfigurasi ─────────────────────────────────────────────
define('PIXEL_ID',       '1615991350099796');
define('ACCESS_TOKEN',   'EAAgDnOrr2QQBSK9BqdR7OVGIucAnSiA54uw4UWlL3zoFbn72lTUkAzqczQPnhXJVQcoZBVsOQ1pLi5ja4ZBkI90DoRfi7xYQjrVZCAsSqapUyHu4bhZCGhD5fE11hyPJBAl3r2AKsOVSObIrNocGZAYyLoakEvhRbCWVtZAx0Bv3ZCwtdmNqotZAeZA36ZBFHdRQZDZD');
define('API_VERSION',    'v21.0');
define('META_ENDPOINT',  'https://graph.facebook.com/' . API_VERSION . '/'. PIXEL_ID . '/events');
// ────────────────────────────────────────────────────────────

// Baca body JSON dari request
$body = file_get_contents('php://input');
$data = json_decode($body, true);

if (!$data || !isset($data['event_name'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

// Ambil IP & User Agent dari header
$clientIP  = $_SERVER['HTTP_X_FORWARDED_FOR']
           ?? $_SERVER['REMOTE_ADDR']
           ?? null;

// Jika ada beberapa IP (proxy), ambil yang pertama
if ($clientIP && strpos($clientIP, ',') !== false) {
    $clientIP = trim(explode(',', $clientIP)[0]);
}

$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
$fbp       = $data['fbp'] ?? null;   // cookie _fbp dari browser
$fbc       = $data['fbc'] ?? null;   // cookie _fbc dari browser

// Bangun payload event
$event = [
    'event_name'       => $data['event_name'],
    'event_time'       => time(),
    'event_source_url' => $data['event_source_url'] ?? 'https://sukashawarma.com/kemitraan/',
    'action_source'    => 'website',
    'user_data'        => [
        'client_ip_address' => $clientIP,
        'client_user_agent' => $userAgent,
    ],
];

// Tambahkan event_id untuk deduplication dengan browser pixel
if (!empty($data['event_id'])) {
    $event['event_id'] = $data['event_id'];
}

// Tambahkan fbp / fbc jika tersedia
if ($fbp) $event['user_data']['fbp'] = $fbp;
if ($fbc) $event['user_data']['fbc'] = $fbc;

// Tambahkan custom_data jika ada
if (!empty($data['custom_data'])) {
    $event['custom_data'] = $data['custom_data'];
}

// Payload ke Meta Graph API
$payload = [
    'data'         => [$event],
    'access_token' => ACCESS_TOKEN,
];

// Kirim ke Meta menggunakan cURL
$ch = curl_init(META_ENDPOINT);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'cURL error', 'detail' => $curlError]);
    exit;
}

// Teruskan response dari Meta ke browser
http_response_code($httpCode);
echo $response;
