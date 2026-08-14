
import * as dotenv from 'dotenv'
import path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const API_KEY = process.env.VALIDATION_API_KEY || 'hermes_secret_123'
const BASE_URL = 'http://127.0.0.1:3005'

// Get yesterday's date to ensure we have data, or today's date
const date = new Date()
// date.setDate(date.getDate() - 1) // uncomment to test yesterday's data
const dateString = date.toISOString().split('T')[0]

async function testSummary() {
  console.log(`\n--- Menguji Endpoint Summary untuk tanggal ${dateString} ---`)
  const response = await fetch(`${BASE_URL}/api/v1/validation/tiktok-go/summary?date=${dateString}`, {
    method: 'GET',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    }
  })
  
  const data = await response.json()
  console.log(`Status: ${response.status}`)
  console.log('Response:', data)
}

async function testTransactions() {
  console.log(`\n--- Menguji Endpoint Transactions untuk tanggal ${dateString} ---`)
  const response = await fetch(`${BASE_URL}/api/v1/validation/tiktok-go/transactions?date=${dateString}`, {
    method: 'GET',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    }
  })
  
  const data = await response.json()
  console.log(`Status: ${response.status}`)
  console.log('Response:', data)
}

async function testUnauthorized() {
  console.log(`\n--- Menguji Endpoint Tanpa API Key ---`)
  const response = await fetch(`${BASE_URL}/api/v1/validation/tiktok-go/summary?date=${dateString}`, {
    method: 'GET'
    // no x-api-key header
  })
  
  const data = await response.json()
  console.log(`Status: ${response.status}`)
  console.log('Response:', data)
}

async function runTests() {
  await testUnauthorized()
  await testSummary()
  await testTransactions()
}

runTests().catch(console.error)
