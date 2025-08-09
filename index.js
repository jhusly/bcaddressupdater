import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// BigCommerce API credentials
const BC_STORE_HASH = process.env.BC_STORE_HASH;
const BC_ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;
const BC_API_URL = `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v2`;

// Your fixed warehouse address
const WAREHOUSE_ADDRESS = {
  first_name: "Warehouse",
  last_name: "Pickup",
  street_1: "123 Warehouse Street",
  city: "Durham",
  state: "North Carolina",
  zip: "27701",
  country: "United States",
  phone: "1234567890"
};

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

    // Get order details
    const orderRes = await fetch(`${BC_API_URL}/orders/${orderId}`, {
      headers: {
        "X-Auth-Token": BC_ACCESS_TOKEN,
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    });

    const order = await orderRes.json();
    console.log("Order shipping_methods:", JSON.stringify(order.shipping_methods, null, 2));

    // Check if any shipping method contains "pickup"
    const hasPickup = order.shipping_methods?.some(method =>
      /pickup/i.test(method.shipping_method)
    );

    if (hasPickup) {
      console.log(`Order ${orderId} uses Store Pickup`);

      // Get shipping addresses
      const shipAddrRes = await fetch(`${BC_API_URL}/orders/${orderId}/shipping_addresses`, {
        headers: {
          "X-Auth-Token": BC_ACCESS_TOKEN,
          "Accept": "application/json"
        }
      });

      const shipAddrs = await shipAddrRes.json();
      const shippingAddressId = shipAddrs[0]?.id;

      if (shippingAddressId) {
        // Update shipping address
        await fetch(`${BC_API_URL}/orders/${orderId}/shipping_addresses/${shippingAddressId}`, {
          method: "PUT",
          headers: {
            "X-Auth-Token": BC_ACCESS_TOKEN,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(WAREHOUSE_ADDRESS)
        });

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

// Render will use PORT provided in env
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pickup updater running on port ${PORT}`);
});
