const secretKey = 'MRCOACH_EVENT_SYNC_2026_SECRET';

const payload = {
  user_name: "Live Test Customer",
  user_email: "livetest@example.com",
  verified_mobile_number: "+919999988888",
  event_id: "EVT002",
  event_title: "Live Production Test Workshop",
  booking_id: "BK_PROD_1001",
  website_order_id: "ORD_PROD_1001",
  payment_gateway_order_id: "order_Prod9999",
  payment_id: "pay_Prod9999",
  payment_status: "PAID",
  amount_paid: 2000.00,
  currency: "INR",
  ticket_quantity: 1,
  booking_date_time: new Date().toISOString(),
  event_date: "2026-07-01",
  booking_source: "Website"
};

async function runProductionTest() {
  console.log("Sending live event booking sync webhook to https://mrcoach-backendfile.onrender.com/api/events/sync-booking...");
  
  try {
    const response = await fetch("https://mrcoach-backendfile.onrender.com/api/events/sync-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`,
        "X-API-KEY": secretKey
      },
      body: JSON.stringify(payload)
    });

    console.log("Production Server Response Status:", response.status);
    const data = await response.json();
    console.log("Production Server Response Payload:\n", JSON.stringify(data, null, 2));

  } catch (error) {
    console.error("Production test failed:", error);
  }
}

runProductionTest();
