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

// Constants
const LEVEL_WARNING = 50;
const LEVEL_DANGER = 100;

// Image Assets (GitHub Host)
// Replace 'YOUR_USER/YOUR_REPO' with actual path when deploying
const GITHUB_IMAGE_BASE = "https://github.com/Randomperson123324/line-bot.git";
const IMG_NORMAL = GITHUB_IMAGE_BASE + "normal.png";
const IMG_WARNING = GITHUB_IMAGE_BASE + "warning.png";
const IMG_DANGER = GITHUB_IMAGE_BASE + "danger.png";
const IMG_DEFAULT = GITHUB_IMAGE_BASE + "default.png";

const client = new line.Client(lineConfig);

app.post("/callback", line.middleware(lineConfig), async (req, res) => {
  try {
    for (const event of req.body.events) {
      if (event.type === "message" && event.message.type === "text") {
        const text = event.message.text.trim();

        if (text === "ระดับน้ำล่าสุด") {
          const rawData = await fetchLatestWaterReads(5); // Get extra for trend
          const flexMsg = createCurrentLevelFlex(rawData);
          await client.replyMessage(event.replyToken, flexMsg);

        } else if (text === "ระดับน้ำในอดีต") {
          const rawData = await fetchHistoricalReads(20);
          const flexMsg = createHistoryFlex(rawData);
          await client.replyMessage(event.replyToken, flexMsg);

        } else if (text === "รายงานน้ำท่วม") {
          const rawData = await fetchFloodReports(24);
          const flexMsg = createFloodFlex(rawData);
          await client.replyMessage(event.replyToken, flexMsg);

        } else if (text === "ข้อมูลโดยรวม") {
          const levelData = await fetchLatestWaterReads(5);
          const floodData = await fetchFloodReports(24);
          const flexMsg = createOverallFlex(levelData, floodData);
          await client.replyMessage(event.replyToken, flexMsg);
        }
      }
    }
  } catch (error) {
    console.error("Error handling request:", error);
  }
  res.sendStatus(200);
});

// --- Data Fetching Helpers ---

async function fetchLatestWaterReads(limit) {
  const { data, error } = await supabase
    .from("water_readings")
    .select("level, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data;
}

async function fetchHistoricalReads(limit) {
  // Reuse same query logic but maybe different sorting needs if we want strict history?
  // Actually usually same query, just limit
  return fetchLatestWaterReads(limit);
}

async function fetchFloodReports(hours) {
  const now = new Date();
  const past = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("flood_reports")
    .select("area_name, severity, description, created_at")
    .gte("created_at", past.toISOString())
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data;
}

// --- Flex Message Generators ---

function createCurrentLevelFlex(data) {
  if (!data || data.length === 0) {
    return { type: "text", text: "ไม่สามารถดึงข้อมูลระดับน้ำได้" };
  }

  const latest = data[0];
  const oldest = data[data.length - 1]; // for trend
  const deltaLevel = latest.level - oldest.level;
  const deltaTime = (new Date(latest.created_at) - new Date(oldest.created_at)) / 1000 / 3600;
  const rate = deltaTime > 0 ? (deltaLevel / deltaTime).toFixed(2) : 0;
  const trendArrow = deltaLevel > 0 ? "⬆️ สูงขึ้น" : deltaLevel < 0 ? "⬇️ ลดลง" : "➡️ คงที่";
  
  const timestampFull = new Date(latest.created_at).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour12: false,
  });

  // Determine Severity & Image
  let bgImage = IMG_NORMAL;
  let severityColor = "#1DB446"; // Green
  let statusText = "ปกติ";

  if (latest.level >= LEVEL_DANGER) {
    bgImage = IMG_DANGER;
    severityColor = "#FF334B";
    statusText = "อันตราย!";
  } else if (latest.level >= LEVEL_WARNING) {
    bgImage = IMG_WARNING;
    severityColor = "#FFC107";
    statusText = "เฝ้าระวัง";
  }

  // Construct Bubble
  const bubble = {
    type: "bubble",
    hero: {
      type: "image",
      url: bgImage,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
      action: { type: "uri", uri: "http://linecorp.com/" }
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "ระดับน้ำล่าสุด (Current Level)",
          weight: "bold",
          size: "sm",
          color: "#888888"
        },
        {
          type: "text",
          text: `${latest.level} ซม.`,
          weight: "bold",
          size: "xxl",
          margin: "md",
          color: severityColor
        },
        {
          type: "text",
          text: statusText,
          size: "xs",
          color: "#aaaaaa",
          wrap: true
        },
        {
          type: "separator",
          margin: "xxl"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "xxl",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "baseline",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: "แนวโน้ม",
                  color: "#aaaaaa",
                  size: "sm",
                  flex: 2
                },
                {
                  type: "text",
                  text: `${trendArrow} (${rate}/hr)`,
                  wrap: true,
                  color: "#666666",
                  size: "sm",
                  flex: 4
                }
              ]
            },
            {
              type: "box",
              layout: "baseline",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: "เวลา",
                  color: "#aaaaaa",
                  size: "sm",
                  flex: 2
                },
                {
                  type: "text",
                  text: timestampFull,
                  wrap: true,
                  color: "#666666",
                  size: "sm",
                  flex: 4
                }
              ]
            }
          ]
        }
      ]
    }
  };

  return { type: "flex", altText: `ระดับน้ำล่าสุด: ${latest.level} ซม.`, contents: bubble };
}

function createHistoryFlex(data) {
  if (!data || data.length === 0) {
    return { type: "text", text: "ไม่พบข้อมูลรน้ำย้อนหลัง" };
  }

  const chunks = [];
  const chunkSize = 5;
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }

  const bubbles = chunks.map((chunk, groupIdx) => {
    const listItems = chunk.map((r, i) => {
        const ts = new Date(r.created_at).toLocaleString("th-TH", {
             timeZone: "Asia/Bangkok", hour12: false, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        });
        return {
            type: "box",
            layout: "horizontal",
            contents: [
                { type: "text", text: `${i + 1 + (groupIdx * chunkSize)}.`, size: "sm", color: "#555555", flex: 1 },
                { type: "text", text: `${r.level}cm`, size: "sm", weight: "bold", color: "#111111", flex: 2 },
                { type: "text", text: ts, size: "xs", color: "#aaaaaa", flex: 4, align: "end" }
            ],
            margin: "sm"
        };
    });

    return {
      type: "bubble",
      hero: {
        type: "image",
        url: IMG_DEFAULT,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
            { type: "text", text: `ประวัติระดับน้ำ (หน้า ${groupIdx+1})`, weight: "bold", size: "md" },
            { type: "separator", margin: "md" },
            { type: "box", layout: "vertical", margin: "md", contents: listItems }
        ]
      }
    };
  });

  return { type: "flex", altText: "ระดับน้ำในอดีต", contents: { type: "carousel", contents: bubbles } };
}

function createFloodFlex(data) {
  if (!data || data.length === 0) {
    return { type: "text", text: "ไม่พบรายงานน้ำท่วมในช่วง 24 ชม." };
  }

  const bubbles = data.map((r) => {
    const ts = new Date(r.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
    return {
      type: "bubble",
      hero: {
         type: "image",
         url: IMG_DEFAULT,
         size: "full",
         aspectRatio: "20:13",
         aspectMode: "cover"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "รายงานน้ำท่วม", weight: "bold", color: "#e33d3d", size: "sm" },
          { type: "text", text: r.area_name, weight: "bold", size: "xl", margin: "md", wrap: true },
          { type: "text", text: `ความรุนแรง: ${r.severity}`, size: "sm", color: "#555555", margin: "sm" },
          { type: "text", text: r.description || "-", size: "sm", color: "#777777", wrap: true, margin: "md" },
          { type: "text", text: ts, size: "xs", color: "#aaaaaa", margin: "xl", align: "end" }
        ]
      }
    };
  });

  return { type: "flex", altText: "รายงานน้ำท่วม", contents: { type: "carousel", contents: bubbles } };
}

function createOverallFlex(levelData, floodData) {
    // Combine contents of Current Level (Bubble) + Flood Reports (Carousel Bubbles)
    const contents = [];

    // 1. Current Level Bubble
    const levelFlex = createCurrentLevelFlex(levelData);
    // If it returned a text message (error), we skip or handle?
    // Let's assume valid bubble for carousel if possible.
    if (levelFlex.contents && levelFlex.contents.type === 'bubble') {
        contents.push(levelFlex.contents);
    }

    // 2. Flood Bubbles
    const floodFlex = createFloodFlex(floodData);
    if (floodFlex.contents && floodFlex.contents.type === 'carousel') {
        contents.push(...floodFlex.contents.contents);
    } else if (floodFlex.contents && floodFlex.contents.type === 'bubble') { 
        // Single bubble case (if logic changed)
        contents.push(floodFlex.contents);
    }

    if (contents.length === 0) {
        return { type: "text", text: "ไม่พบข้อมูลโดยรวม" };
    }

    return { type: "flex", altText: "ข้อมูลโดยรวม", contents: { type: "carousel", contents: contents } };
}


app.get("/", (req, res) => res.send("LINE Bot is running"));

app.listen(process.env.PORT || 3000, () => console.log("Server started"));
