const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json());

const PORT = 4000;

// -------- LOAD BALANCERS ------------

const catalogServers = [
  "http://catalog1:4001",
  "http://catalog2:4002"
];

const orderServers = [
  "http://order1:5001",
  "http://order2:5002"
];

let catalogIndex = 0;
let orderIndex = 0;

function nextCatalog() {
  const s = catalogServers[catalogIndex];
  catalogIndex = (catalogIndex + 1) % catalogServers.length;
  return s;
}

function nextOrder() {
  const s = orderServers[orderIndex];
  orderIndex = (orderIndex + 1) % orderServers.length;
  return s;
}

// ---------- LRU CACHE --------

const cache = new Map();
const MAX_CACHE = 50;

function getCache(key) {
  if (!cache.has(key)) return null;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function setCache(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

//------------- ROUTES ------

// Catalog query (READ – cached)
app.get("/query/:id", async (req, res) => {
  const bookId = req.params.id;

  const cached = getCache(bookId);
  if (cached) {
    return res.json({ source: "cache", data: cached });
  }

  try {
    const server = nextCatalog();
    const response = await axios.get(`${server}/query/${bookId}`);
    setCache(bookId, response.data);
    res.json({ source: "catalog", data: response.data });
  } catch (err) {
    res.status(500).send("Catalog error");
  }
});

// Buy book (WRITE – no cache)
app.post("/buy", async (req, res) => {
  try {
    const server = nextOrder();
    const response = await axios.post(`${server}/buy`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).send("Order error");
  }
});

// Cache invalidation (server-push)
app.post("/invalidate/:id", (req, res) => {
  cache.delete(req.params.id);
  res.send("Invalidated");
});

app.listen(PORT, () => {
  console.log(`Front server running on port ${PORT}`);
});
