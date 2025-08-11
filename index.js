import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// BigCommerce API credentials
const BC_STORE_HASH = process.env.BC_STORE_HASH;
const BC_ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;
const BC_API_URL = `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v3`;

// Fixed warehouse address
const WAREHOUSE_ADDRESS = {
  first_name: "MAD",
  last_name: "Store Pickup",
  street_1: "4000 Parliament Court, Suite 100",
  city: "Durham",
  state: "North Carolina",
  zip: "27701",
  country: "United States",
  phone: "1234567890"
};

// Helper: retry order fetch
async function fetchOrderWithRetry(orderId, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    const orderRes = await fetch(
      `${BC_API_URL}/orders/${orderId}?include=shipping_addresses`,
      {
        headers: {
          "X-Auth-Token": BC_ACCESS_TOKEN,
          "Accept": "application/json",
          "Content-Type": "application/json"
        }
      }
    );

    const orderData = await orderRes.json();
    if (orderData.data) {
      return orderData.data; // Found order
    }

    console.log(`Order ${orderId} not found yet. Retry ${i + 1}/${retries}...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return null; // All retries failed
}

// Webhook endpoint
app.post("/bc-pickup-updater", async (req, res) => {
  console.log("=== Webhook Triggered ===");
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Payload:", JSON.stringify(req.body, null, 2));

  try {
    const orderId = req.body.data?.id;
    if (!orderId) {
      console.log("No order ID found in payload");
      return res.status(400).send("No order ID");
    }

    // Get order details with retry
    const order = await fetchOrderWithRetry(orderId);

    if (!order) {
      console.log(`Order ${orderId} still not found after retries`);
      return res.status(404).send("Order not found");
    }

    // Debug: log shipping method
    console.log(`Order shipping_method: ${JSON.stringify(order.shipping_method)}`);

    // Check if Store Pickup
    if (order.shipping_method && /pickup/i.test(order.shipping_method)) {
      console.log(`Order ${orderId} uses Store Pickup`);

      const shippingAddressId = order.shipping_addresses?.[0]?.id;
      if (shippingAddressId) {
        // Update shipping address
        const updateRes = await fetch(
          `${BC_API_URL}/orders/${orderId}/shipping_addresses/${shippingAddressId}`,
          {
            method: "PUT",
            headers: {
              "X-Auth-Token": BC_ACCESS_TOKEN,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(WAREHOUSE_ADDRESS)
          }
        );

        if (!updateRes.ok) {
          const errorText = await updateRes.text();
          throw new Error(`Failed to update address: ${errorText}`);
        }

        console.log(`Order ${orderId} shipping address updated to warehouse.`);
      } else {
        console.log(`No shipping address found for order ${orderId}`);
      }
    } else {
      console.log(`Order ${orderId} is NOT Store Pickup`);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error updating shipping address:", err);
    res.status(500).send("Error");
  }
});

// Render will use PORT from env
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pickup updater running on port ${PORT}`);
});
