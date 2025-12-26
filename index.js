const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

// LINE config (set these in Render Environment Variables)
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// webhook middleware
app.post(
  "/callback",
  line.middleware(config),
  async (req, res) => {
    const events = req.body.events;

    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        if (event.message.text.toLowerCase() === "hello") {
          await reply(event.replyToken, "hi");
        }
      }
    }
    res.sendStatus(200);
  }
);

function reply(replyToken, text) {
  const client = new line.Client(config);
  return client.replyMessage(replyToken, {
    type: "text",
    text: text,
  });
}

app.get("/", (req, res) => {
  res.send("LINE Bot is running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
