const express = require("express");
const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);

  // Start the Discord bot after the web server is ready
  require("./index.js");
});
