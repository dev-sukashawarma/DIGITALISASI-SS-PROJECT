const webhookUrl = 'https://script.google.com/macros/s/AKfycbx2AicMeb86mYuSRipb9w-RHedioqD2yTyFtATEOjvkdUcrZ4KYRwgfT8xmpQA8D2Gs/exec';

const payload = {
  event: 'ORDER_COMPLETED',
  timestamp: new Date().toISOString(),
  day_of_month: 22, // Since they wanted day 22 for July, or I can use current date. Let's send it to day 22.
  order_number: 'TEST-DUMMY-001',
  outlet_name: 'SUKA SHAWARMA EMPANG', // Using exact outlet name
  channel: 'OFFLINE', // So it finds the offline section
  payment_method: 'CASH',
  items: [
    {
      menu_item_name: 'ORIGINAL AYAM SEDANG', // One of the menu items from the image
      quantity: 5, // Testing with 5
      unit_price: 14500,
      subtotal: 72500
    },
    {
      menu_item_name: 'SUKA SAMYANG',
      quantity: 2,
      unit_price: 18000,
      subtotal: 36000
    }
  ]
};

async function testWebhook() {
  console.log('Sending payload to Google Sheets Webhook:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
    
    if (response.ok) {
      console.log('Success! HTTP Status:', response.status);
      const text = await response.text();
      console.log('Response Body:', text);
    } else {
      console.error('Failed! HTTP Status:', response.status);
      const text = await response.text();
      console.error('Error Body:', text);
    }
  } catch (e) {
    console.error('Fetch Error:', e);
  }
}

testWebhook();
