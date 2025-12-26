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
      } else if (text === "ข้อมูลโดยรวม") {
        const waterText = await getWaterLevel();
        const floodText = await getFloodReports();
        const combinedText = `💦 ข้อมูลโดยรวม:\n\n${waterText}\n\n${floodText}`;
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: combinedText,
        });
      }
    }
  }
  res.sendStatus(200);
});

async function getWaterLevel() {
  const { data, error } = await supabase
    .from("water_readings")
    .select("level, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data || data.length === 0) {
    return "ไม่สามารถดึงข้อมูลระดับน้ำได้";
  }

  const latest = data[0];
  const oldest = data[data.length - 1];

  const deltaLevel = latest.level - oldest.level; // cm
  const deltaTime = (new Date(latest.created_at) - new Date(oldest.created_at)) / 1000 / 3600; // hours
  const rate = deltaTime > 0 ? (deltaLevel / deltaTime).toFixed(2) : 0;

  const trendArrow = deltaLevel > 0 ? "⬆️ สูงขึ้น" : deltaLevel < 0 ? "⬇️ ลดลง" : "➡️ คงที่";

  const timestampFull = new Date(latest.created_at).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour12: false,
  });

  const hoursAgo = Math.floor((new Date() - new Date(latest.created_at)) / 1000 / 3600);

  return `💧 ระดับน้ำปัจจุบัน: ${latest.level} ซม.\n📈 แนวโน้ม: ${trendArrow} (${rate} ซม./ชม.)\n🕒 เวลา: ${timestampFull} (${hoursAgo} ชั่วโมงที่แล้ว)`;
}

async function getFloodReports() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("flood_reports")
    .select("area_name, severity, description, created_at")
    .gte("created_at", yesterday.toISOString())
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    return "ไม่พบรายงานน้ำท่วมใน 24 ชั่วโมงที่ผ่านมา";
  }

  return data
    .map((r) => {
      const created = new Date(r.created_at);
      const timestampFull = created.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour12: false,
      });
      const hoursAgo = Math.floor((now - created) / 1000 / 3600);
      return `🏘️ ${r.area_name}\n⚠️ ความรุนแรง: ${r.severity}\n📝 รายละเอียด: ${r.description}\n🕒 เวลา: ${timestampFull} (${hoursAgo} ชั่วโมงที่แล้ว)`;
    })
    .join("\n\n");
}

app.get("/", (req, res) => res.send("LINE Bot is running"));

app.listen(process.env.PORT || 3000, () => console.log("Server started"));
