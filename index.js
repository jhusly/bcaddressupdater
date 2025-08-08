import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const BC_STORE_HASH = process.env.BC_STORE_HASH;
const BC_ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;
const BC_API_URL = `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v2`;

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
  try {
    const orderId = req.body.data.id;

    const orderRes = await fetch(`${BC_API_URL}/orders/${orderId}`, {
      headers: {
        "X-Auth-Token": BC_ACCESS_TOKEN,
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    });
    const order = await orderRes.json();

    if (order.shipping_methods && order.shipping_methods[0].toLowerCase().includes("store pickup")) {
      const shipAddrRes = await fetch(`${BC_API_URL}/orders/${orderId}/shipping_addresses`, {
        headers: {
          "X-Auth-Token": BC_ACCESS_TOKEN,
          "Accept": "application/json"
        }
      });
      const shipAddrs = await shipAddrRes.json();
      const shippingAddressId = shipAddrs[0].id;

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
