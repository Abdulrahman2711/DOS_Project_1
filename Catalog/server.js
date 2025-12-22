const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4001;
const DB_FILE = process.env.DB_FILE || "catalog.db";
const PEER_URL = process.env.PEER_URL;

const db = new sqlite3.Database(`./db/${DB_FILE}`);

//------------- QUERY -----

app.get("/query/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM books WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).send(err);
    res.json(row);
  });
});

//------------- UPDATE STOCK ----------

app.post("/update", async (req, res) => {
  const { id, stock } = req.body;

  // Invalidate cache first
  await axios.post(`http://front:4000/invalidate/${id}`);

  db.run(
    "UPDATE books SET stock = ? WHERE id = ?",
    [stock, id],
    async () => {
      // Replicate write
      if (PEER_URL) {
        await axios.post(`${PEER_URL}/replicate`, { id, stock });
      }
      res.send("Updated");
    }
  );
});

//--------------- REPLICATION ------

app.post("/replicate", (req, res) => {
  const { id, stock } = req.body;
  db.run(
    "UPDATE books SET stock = ? WHERE id = ?",
    [stock, id],
    () => res.send("Replica updated")
  );
});

app.listen(PORT, () => {
  console.log(`Catalog replica running on port ${PORT}`);
});
