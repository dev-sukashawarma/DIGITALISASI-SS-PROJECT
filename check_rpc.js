const axios = require('axios');
require('dotenv').config();
async function run() {
  const url = process.env.SUPABASE_URL + '/rest/v1/rpc/match_face_mobile';
  console.log('Testing url:', url);
}
run();
