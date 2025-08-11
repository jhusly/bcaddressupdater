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
  first_name: "MAD - ",
  last_name: "Warehouse Pickup",
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

    // Get shipping addresses (v2 API)
    const shipAddrRes = await fetch(`${BC_API_URL}/orders/${orderId}/shipping_addresses`, {
      headers: {
        "X-Auth-Token": BC_ACCESS_TOKEN,
        "Accept": "application/json"
      }
    });
    const shipAddrs = await shipAddrRes.json();
    console.log("Shipping addresses:", JSON.stringify(shipAddrs, null, 2));

    const shippingAddress = shipAddrs[0];
    const methodName = shippingAddress?.shipping_method || "";

    if (/pickup|pick[\s-]?up/i.test(methodName)) {
      console.log(`Order ${orderId} uses Store Pickup`);

      // Update shipping address
      await fetch(`${BC_API_URL}/orders/${orderId}/shipping_addresses/${shippingAddress.id}`, {
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
      console.log(`Order ${orderId} is NOT Store Pickup (method: "${methodName}")`);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error updating shipping address:", err);
    res.status(500).send("Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pickup updater running on port ${PORT}`);
});
