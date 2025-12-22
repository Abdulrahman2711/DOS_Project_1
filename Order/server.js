const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5001;
const DB_FILE = process.env.DB_FILE || "order.db";
const PEER_URL = process.env.PEER_URL;

const db = new sqlite3.Database(`./db/${DB_FILE}`);

//-------------- BUY ---------

app.post("/buy", async (req, res) => {
  const { bookId, quantity } = req.body;

  // Invalidate cache before write
  await axios.post(`http://front:4000/invalidate/${bookId}`);

  db.run(
    "INSERT INTO orders(bookId, quantity) VALUES (?, ?)",
    [bookId, quantity],
    async () => {
      // Replicate order
      if (PEER_URL) {
        await axios.post(`${PEER_URL}/replicate`, { bookId, quantity });
      }
      res.send("Order placed");
    }
  );
});

//------------- REPLICATION ---------

app.post("/replicate", (req, res) => {
  const { bookId, quantity } = req.body;
  db.run(
    "INSERT INTO orders(bookId, quantity) VALUES (?, ?)",
    [bookId, quantity],
    () => res.send("Replica order stored")
  );
});

app.listen(PORT, () => {
  console.log(`Order replica running on port ${PORT}`);
});
