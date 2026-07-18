import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { imageBase64, menuText } = await request.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'No OPENROUTER_API_KEY set' }, { status: 500 })

    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash'

    const prompt = `You are a receipt parser. Given this screenshot of a food delivery order (GoFood/GrabFood/ShopeeFood) and our menu list:\n${menuText}\n\nExtract the ordered items and subsidies. Return ONLY valid JSON with this exact schema:\n{\n  "items": [{ "name": "Exact name from our menu if matched, else raw name", "qty": 1, "matched": boolean, "price": 10000 }],\n  "subsidies": [{ "name": "Promo Name", "amount": -10000 }]\n}\n\nIf an item strictly matches our menu list, set matched to true. Amount for subsidies MUST be negative.`

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          }
        ]
      })
    })

    const data = await res.json()
    if (!data.choices || !data.choices[0].message.content) {
      console.error('OpenRouter response:', data)
      throw new Error('Invalid AI response or rate limit')
    }

    const parsed = JSON.parse(data.choices[0].message.content)
    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error('API parse-receipt error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
