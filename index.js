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
      } else if (text === "รายงานน้ำท่วม") {
        const replyText = await getFloodReports();
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
    .limit(2); // get latest 2 rows to calculate trend

  if (error || !data || data.length === 0) {
    return "ไม่สามารถดึงข้อมูลระดับน้ำได้";
  }

  const latest = data[0];
  let trend = "-";
  if (data.length > 1) {
    const diff = latest.level - data[1].level;
    if (diff > 0) trend = "⬆️ สูงขึ้น";
    else if (diff < 0) trend = "⬇️ ลดลง";
    else trend = "➡️ คงที่";
  }

  const now = new Date(latest.created_at);
  const timestamp = now.toLocaleString("th-TH", { hour12: false });

  return `💧 ระดับน้ำปัจจุบัน: ${latest.level} ซม.\n📈 แนวโน้ม: ${trend}\n🕒 เวลา: ${timestamp}`;
}

async function getFloodReports() {
  const { data, error } = await supabase
    .from("flood_reports")
    .select("area_name, severity, description, created_at")
    .order("created_at", { ascending: false })
    .limit(5); // latest 5 reports

  if (error || !data || data.length === 0) {
    return "ไม่พบรายงานน้ำท่วม";
  }

  return data
    .map((r) => {
      const time = new Date(r.created_at).toLocaleString("th-TH", { hour12: false });
      return `🏘️ ${r.area_name}\n⚠️ ความรุนแรง: ${r.severity}\n📝 รายละเอียด: ${r.description}\n🕒 เวลา: ${time}`;
    })
    .join("\n\n");
}

app.get("/", (req, res) => {
  res.send("LINE Bot is running");
});

app.listen(process.env.PORT || 3000, () => console.log("Server started"));
