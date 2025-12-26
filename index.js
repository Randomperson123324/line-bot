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
    .from("water_readings")            // updated table name
    .select("level, created_at")
    .order("created_at", { ascending: false })
    .limit(2);

  if (error || !data || data.length === 0) {
    return "ไม่สามารถดึงข้อมูลระดับน้ำได้";
  }

  const latest = data[0];
  let trend = "-";
  if (data.length > 1) {
    const diff = latest.level - data[1].level;
    trend = diff > 0 ? "⬆️ สูงขึ้น" : diff < 0 ? "⬇️ ลดลง" : "➡️ คงที่";
  }

  const timestamp = new Date(latest.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });

  return `💧 ระดับน้ำปัจจุบัน: ${latest.level} ซม.\n📈 แนวโน้ม: ${trend}\n🕒 เวลา: ${timestamp}`;
}

async function getFloodReports() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("flood_reports")
    .select("area_name, severity, description, created_at")
    .gte("created_at", yesterday.toISOString())  // only last 24h
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    return "ไม่พบรายงานน้ำท่วมใน 24 ชั่วโมงที่ผ่านมา";
  }

  return data
    .map((r) => {
      const time = new Date(r.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
      return `🏘️ ${r.area_name}\n⚠️ ความรุนแรง: ${r.severity}\n📝 รายละเอียด: ${r.description}\n🕒 เวลา: ${time}`;
    })
    .join("\n\n");
}

app.get("/", (req, res) => res.send("LINE Bot is running"));

app.listen(process.env.PORT || 3000, () => console.log("Server started"));
