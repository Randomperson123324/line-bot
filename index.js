const express = require("express");
const line = require("@line/bot-sdk");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// LINE config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const client = new line.Client(lineConfig);

app.post("/callback", line.middleware(lineConfig), async (req, res) => {
  for (const event of req.body.events) {
    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text.trim();

      if (text === "ระดับน้ำ") {
        const replyText = await getWaterLevel();
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: replyText,
        });
      }
    }
  }
  res.sendStatus(200);
});

async function getWaterLevel() {
  const { data, error } = await supabase
    .from("water_level")
    .select("level, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return "ไม่สามารถดึงข้อมูลระดับน้ำได้";
  }

  return `💧 ระดับน้ำปัจจุบัน: ${data.level} ซม.`;
}

app.get("/", (req, res) => {
  res.send("LINE Bot is running");
});

app.listen(process.env.PORT || 3000);
