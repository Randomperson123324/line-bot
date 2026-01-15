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

if (text === "ระดับน้ำล่าสุด") {
  const replyFlex = await getCurrentWaterLevelFlex();
  await client.replyMessage(event.replyToken, replyFlex);

      } else if (text === "ระดับน้ำในอดีต") {
        const replyText = await getHistoricalWaterLevels();
        await client.replyMessage(event.replyToken, replyFlex);
        
      } else if (text === "รายงานน้ำท่วม") {
        const replyText = await getFloodReports();
        await client.replyMessage(event.replyToken, replyFlex);

      } else if (text === "ข้อมูลโดยรวม") {
        const currentText = await getCurrentWaterLevel();
        const floodText = await getFloodReports();
        const combinedText = `ข้อมูลโดยรวม:\n\n${currentText}\n\n${floodText}`;
        await client.replyMessage(event.replyToken, replyFlex);

      }
    }
  }
  res.sendStatus(200);
});

// Current water level (last 5 readings for trend)
async function getCurrentWaterLevelFlex() { //flex messages
  const { data, error } = await supabase
    .from("water_readings")
    .select("level, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data || data.length === 0) {
    return {
      type: "text",
      text: "ไม่สามารถดึงข้อมูลระดับน้ำได้",
    };
  }

  const latest = data[0];
  const oldest = data[data.length - 1];

  const deltaLevel = latest.level - oldest.level;
  const deltaTime =
    (new Date(latest.created_at) - new Date(oldest.created_at)) /
    1000 /
    3600;

  const rate = deltaTime > 0 ? (deltaLevel / deltaTime).toFixed(2) : "0";
  const trend =
    deltaLevel > 0 ? "⬆️ สูงขึ้น" : deltaLevel < 0 ? "⬇️ ลดลง" : "➡️ คงที่";

  const timestamp = new Date(latest.created_at).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour12: false,
  });

  return {
    type: "flex",
    altText: "ระดับน้ำล่าสุด",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "💧 ระดับน้ำล่าสุด",
            weight: "bold",
            size: "xl",
          },
          {
            type: "box",
            layout: "baseline",
            contents: [
              { type: "text", text: "ระดับน้ำ", size: "sm", color: "#555555" },
              {
                type: "text",
                text: `${latest.level} ซม.`,
                weight: "bold",
                margin: "md",
              },
            ],
          },
          {
            type: "box",
            layout: "baseline",
            contents: [
              { type: "text", text: "แนวโน้ม", size: "sm", color: "#555555" },
              {
                type: "text",
                text: `${trend} (${rate} ซม./ชม.)`,
                margin: "md",
              },
            ],
          },
          {
            type: "text",
            text: `🕒 ${timestamp}`,
            size: "sm",
            color: "#888888",
            wrap: true,
          },
        ],
      },
    },
  };
}


// Historical water readings (last 20)
async function getHistoricalWaterLevels() {
  const { data, error } = await supabase
    .from("water_readings")
    .select("level, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    return "ไม่พบข้อมูลน้ำย้อนหลัง";
  }

  const now = new Date();

  return data
    .map((r, idx) => {
      const ts = new Date(r.created_at);
      const timestampFull = ts.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
      const hoursAgo = Math.floor((now - ts) / 1000 / 3600);
      return `${idx + 1}. 💧 ${r.level} ซม. - ${timestampFull} (${hoursAgo} ชั่วโมงที่แล้ว)`;
    })
    .join("\n");
}

// Flood reports (last 24h)
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
      const timestampFull = created.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
      const hoursAgo = Math.floor((now - created) / 1000 / 3600);
      return `🏘️ ${r.area_name}\n⚠️ ความรุนแรง: ${r.severity}\n📝 รายละเอียด: ${r.description}\n🕒 เวลา: ${timestampFull} (${hoursAgo} ชั่วโมงที่แล้ว)`;
    })
    .join("\n\n");
}

app.get("/", (req, res) => res.send("LINE Bot is running"));

app.listen(process.env.PORT || 3000, () => console.log("Server started"));
