# Implementation Strategy: Milestone 1 (Webhook & Mock Script)

**Summary:** The webhook endpoint and mock script do not currently exist. The implementation requires creating a new Next.js API route that uses the Supabase service client to broadcast realtime events, and a simple Node.js script using native `fetch` to simulate the external system.

## 1. Observation
- `app/api/attendance/webhook/route.ts` does not exist in the filesystem.
- Review of `lib/supabase/server.ts` shows the presence of `createServiceClient()`, which initializes a Supabase client bypassing RLS, appropriate for backend API routes.
- The project runs on Next.js 14 and uses `@supabase/supabase-js` ^2.45.0. Node 18+ is available (implied by `@types/node` ^22.0.0 in `package.json`), which provides native `fetch`.
- As defined in `PROJECT.md`, the webhook must receive a POST payload (`{ "email", "password", "outlet_id", "branch_name", "cashier_name" }`) and relay it to the `attendance_events` channel.

## 2. Logic Chain
- **API Webhook:** Since the webhook must receive a POST request, we need to export an async `POST` function in `app/api/attendance/webhook/route.ts`. It must parse `req.json()` and validate the fields.
- **Supabase Realtime:** To broadcast the event, the server should instantiate the Supabase client using `createServiceClient()`. Then it needs to get the channel (`supabase.channel('attendance_events')`), wait for the subscription to succeed, and send a broadcast message with the type `broadcast` and event `attendance_login` (or similar). Finally, it must remove the channel to prevent memory leaks.
- **Mock Script:** The `mock-attendance.js` script can be created in the root directory. It should use `fetch` to send a POST request with a sample JSON payload to `http://localhost:3000/api/attendance/webhook`. It can accept command line arguments for flexibility but should have sensible defaults.

## 3. Caveats
- Supabase Realtime requires the client to successfully subscribe before sending a broadcast message. The `channel.send()` method should be called only after the `SUBSCRIBED` status is received.
- Realtime must be properly configured in the Supabase project dashboard (channels must not be disabled), but this is an infrastructure assumption outside the code.

## 4. Conclusion
We can proceed with implementing Milestone 1 by:
1. Creating `app/api/attendance/webhook/route.ts` with the Next.js App Router POST convention and Supabase channel broadcast logic.
2. Creating `mock-attendance.js` in the project root to perform a POST request to `http://localhost:3000/api/attendance/webhook`.

**Proposed Code Snippets:**

`app/api/attendance/webhook/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, outlet_id, branch_name, cashier_name } = body

    if (!email || !password || !branch_name || !cashier_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const channel = supabase.channel('attendance_events')

    await new Promise((resolve, reject) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const res = await channel.send({
            type: 'broadcast',
            event: 'attendance_login',
            payload: { email, password, outlet_id, branch_name, cashier_name }
          })
          resolve(res)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          reject(new Error(`Channel error: ${status}`))
        }
      })
    })

    supabase.removeChannel(channel)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

`mock-attendance.js`:
```javascript
const API_URL = 'http://localhost:3000/api/attendance/webhook';

async function run() {
  const payload = {
    email: process.argv[2] || "kasir@example.com",
    password: process.argv[3] || "password123",
    outlet_id: process.argv[4] || "default-outlet-id",
    branch_name: process.argv[5] || "Cabang Utama",
    cashier_name: process.argv[6] || "Ahmad Kasir"
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', data);
}

run();
```

## 5. Verification Method
1. Start the development server using `npm run dev`.
2. Execute `node mock-attendance.js` in a separate terminal.
3. Verify that the output shows `Status: 200` and `Response: { success: true }`.
4. (Optional) Write a temporary frontend component to listen on `attendance_events` and console log received events to ensure the broadcast goes through.
