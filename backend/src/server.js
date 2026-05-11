const express = require("express");
const cors = require("cors");
require("dotenv").config();

require("./mqtt");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "backend" });
});

app.post("/api/game/move", (req, res) => {
  const { direction } = req.body;

  if (!direction) {
    return res.status(400).json({ error: "direction required" });
  }

  res.json({
    message: "move received",
    direction
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});