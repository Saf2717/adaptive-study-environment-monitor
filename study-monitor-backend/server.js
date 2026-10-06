require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let latestReading = null;
let latestWeather = null;
let lastAlertTime = 0;

let currentRoom = "Bedroom";

let minuteBuffer = [];
let lastMinuteSave = Date.now();

const LATITUDE = 51.5074;
const LONGITUDE = -0.1278;

function getRecommendation(data, weather = latestWeather) {
  if (!data) return "Waiting for data...";

  const indoorTemp = Number(data.temperature);
  const indoorHumidity = Number(data.humidity);
  const noise = Number(data.noise);

  const outdoorTemp = weather?.outdoorTemperature;
  const outdoorHumidity = weather?.outdoorHumidity;

  if (noise > 150) {
    return "Noise is high. Try moving to a quieter room or reducing background sound.";
  }

  if (indoorTemp > 25) {
    if (outdoorTemp !== undefined && outdoorTemp < indoorTemp - 3) {
      return "Room is warm, but outside is cooler. Opening a window may improve comfort.";
    }

    return "Room is warm. Consider ventilation or moving to a cooler room.";
  }

  if (indoorTemp < 18) {
    if (outdoorTemp !== undefined && outdoorTemp > indoorTemp + 3) {
      return "Room is cold, but outside is warmer. Ventilation may help slightly.";
    }

    return "Room is cold. Increasing heating may improve study comfort.";
  }

  if (indoorHumidity > 65) {
    if (outdoorHumidity !== undefined && outdoorHumidity < indoorHumidity - 10) {
      return "Humidity is high indoors, but lower outside. Ventilation may improve comfort.";
    }

    return "Humidity is high. The room may feel uncomfortable for long study sessions.";
  }

  if (indoorHumidity < 35) {
    return "Humidity is low. The room may feel dry during longer study periods.";
  }

  if (
    outdoorTemp !== undefined &&
    Math.abs(indoorTemp - outdoorTemp) <= 3
  ) {
    return "Indoor and outdoor temperatures are well balanced. The room is suitable for studying.";
  }

  return "Environment is suitable for studying.";
}

function calculateWeatherAdjustedFocus(indoor, weather) {
  let adjustedScore = indoor.focusScore;

  if (!weather) return adjustedScore;

  const tempDifference = Math.abs(indoor.temperature - weather.outdoorTemperature);
  const humidityDifference = Math.abs(indoor.humidity - weather.outdoorHumidity);

  if (tempDifference > 8) adjustedScore -= 10;
  else if (tempDifference > 5) adjustedScore -= 5;

  if (humidityDifference > 25) adjustedScore -= 10;
  else if (humidityDifference > 15) adjustedScore -= 5;

  if (indoor.temperature > 25 && weather.outdoorTemperature < indoor.temperature) {
    adjustedScore -= 10;
  }

  return Math.max(0, Math.min(100, adjustedScore));
}

async function fetchWeather() {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
      `&current=temperature_2m,relative_humidity_2m`;

    const response = await fetch(url);
    const data = await response.json();

    latestWeather = {
      outdoorTemperature: data.current.temperature_2m,
      outdoorHumidity: data.current.relative_humidity_2m,
      time: data.current.time
    };

    console.log("Weather updated:", latestWeather);
  } catch (error) {
    console.log("Weather API error:", error.message);
  }
}

async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const now = Date.now();

  if (now - lastAlertTime < 5 * 60 * 1000) return;

  lastAlertTime = now;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message
      })
    });
  } catch (error) {
    console.log("Telegram alert error:", error.message);
  }
}

async function saveMinuteAverageToSupabase() {
  if (minuteBuffer.length === 0) return;

  const count = minuteBuffer.length;
  const lastReading = minuteBuffer[minuteBuffer.length - 1];

  const avg = {
    room: lastReading.room,
    temperature: minuteBuffer.reduce((sum, r) => sum + r.temperature, 0) / count,
    humidity: minuteBuffer.reduce((sum, r) => sum + r.humidity, 0) / count,
    noise: Math.round(minuteBuffer.reduce((sum, r) => sum + r.noise, 0) / count),
    focusScore: Math.round(minuteBuffer.reduce((sum, r) => sum + r.focusScore, 0) / count),
    weatherAdjustedFocus: Math.round(
      minuteBuffer.reduce((sum, r) => sum + r.weatherAdjustedFocus, 0) / count
    ),
    status: lastReading.status,
    recommendation: lastReading.recommendation
  };

  const { error } = await supabase.from("study_readings").insert({
    room: avg.room,
    temperature: avg.temperature,
    humidity: avg.humidity,
    noise: avg.noise,
    focus_score: avg.focusScore,
    weather_adjusted_focus: avg.weatherAdjustedFocus,
    status: avg.status,
    recommendation: avg.recommendation,
    outdoor_temperature: latestWeather?.outdoorTemperature ?? null,
    outdoor_humidity: latestWeather?.outdoorHumidity ?? null
  });

  if (error) {
    console.log("Supabase insert error:", error.message);
  } else {
    console.log("Saved 1-minute average to Supabase:", avg);
  }

  minuteBuffer = [];
  lastMinuteSave = Date.now();
}

app.post("/data", async (req, res) => {
  latestReading = {
    room: currentRoom,
    temperature: Number(req.body.temperature),
    humidity: Number(req.body.humidity),
    noise: Number(req.body.noise),
    focusScore: Number(req.body.focusScore),
    status: req.body.status || "UNKNOWN",
    recommendation: getRecommendation(req.body, latestWeather),
    receivedAt: new Date().toISOString()
  };

  latestReading.weatherAdjustedFocus = calculateWeatherAdjustedFocus(
    latestReading,
    latestWeather
  );

  minuteBuffer.push(latestReading);

  if (Date.now() - lastMinuteSave >= 60 * 1000) {
    await saveMinuteAverageToSupabase();
  }

  if (latestReading.weatherAdjustedFocus < 50) {
    sendTelegramAlert(
      `⚠️ Poor study environment detected in ${latestReading.room}\n` +
      `Weather-adjusted focus: ${latestReading.weatherAdjustedFocus}\n` +
      `Noise: ${latestReading.noise}\n` +
      `Recommendation: ${latestReading.recommendation}`
    );
  }

  console.log("Received Data:", latestReading);

  res.json({ success: true, reading: latestReading });
});

app.get("/latest", (req, res) => {
  res.json(latestReading || {});
});

app.get("/weather", (req, res) => {
  res.json(latestWeather || {});
});

app.get("/room", (req, res) => {
  res.json({ room: currentRoom });
});

app.post("/room", (req, res) => {
  currentRoom = req.body.room || "Bedroom";
  console.log("Room changed to:", currentRoom);
  res.json({ success: true, room: currentRoom });
});

app.get("/history", async (req, res) => {
  const { data, error } = await supabase
    .from("study_readings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1440);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data.reverse());
});

app.get("/room-stats", async (req, res) => {
  const { data, error } = await supabase
    .from("study_readings")
    .select("*");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const rooms = {};

  data.forEach((r) => {
    if (!rooms[r.room]) {
      rooms[r.room] = {
        count: 0,
        focus: 0,
        noise: 0
      };
    }

    rooms[r.room].count += 1;
    rooms[r.room].focus += Number(r.weather_adjusted_focus || 0);
    rooms[r.room].noise += Number(r.noise || 0);
  });

  Object.keys(rooms).forEach((room) => {
    rooms[room].focus = Math.round(rooms[room].focus / rooms[room].count);
    rooms[room].noise = Math.round(rooms[room].noise / rooms[room].count);
  });

  res.json(rooms);
});

app.get("/test-alert", async (req, res) => {
  await sendTelegramAlert("Test alert from Adaptive Study Monitor");
  res.json({ success: true });
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Adaptive Study Monitor</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #0f172a;
      color: #e5e7eb;
    }

    header {
      padding: 24px 40px;
      background: #111827;
      border-bottom: 1px solid #1f2937;
    }

    h1 {
      margin: 0;
      font-size: 28px;
    }

    .subtitle {
      margin-top: 6px;
      color: #9ca3af;
    }

    main {
      padding: 30px 40px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
      margin-bottom: 24px;
    }

    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    }

    .label {
      color: #9ca3af;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .value {
      font-size: 34px;
      font-weight: bold;
    }

    .small {
      font-size: 16px;
      color: #cbd5e1;
      line-height: 1.7;
    }

    .focus {
      font-size: 58px;
      font-weight: bold;
    }

    .good { color: #22c55e; }
    .ok { color: #facc15; }
    .poor { color: #ef4444; }

    select {
      background: #1f2937;
      color: white;
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 8px 10px;
      margin-top: 8px;
      width: 100%;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }

    th, td {
      padding: 10px;
      border-bottom: 1px solid #374151;
    }

    th {
      color: #9ca3af;
      text-align: left;
    }

    td.center, th.center {
      text-align: center;
    }

    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 24px;
    }

    canvas {
      max-height: 280px;
    }

    @media (max-width: 900px) {
      .grid, .two-col {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body>
  <header>
    <h1>Adaptive Study Environment Monitor</h1>
    <div class="subtitle">Live IoT dashboard with room comparison and 1-minute averaged Supabase history</div>
  </header>

  <main>
    <section class="grid">
      <div class="card">
        <div class="label">Current room</div>
        <div class="value" id="room">--</div>
        <select id="roomSelect" onchange="changeRoom()">
          <option value="Bedroom">Bedroom</option>
          <option value="Kitchen">Kitchen</option>
          <option value="Living Room">Living Room</option>
          <option value="Library">Library</option>
        </select>
      </div>

      <div class="card">
        <div class="label">Temperature</div>
        <div class="value"><span id="temp">--</span>°C</div>
      </div>

      <div class="card">
        <div class="label">Humidity</div>
        <div class="value"><span id="hum">--</span>%</div>
      </div>

      <div class="card">
        <div class="label">Noise</div>
        <div class="value" id="noise">--</div>
      </div>
    </section>

    <section class="two-col">
      <div class="card">
        <div class="label">Weather-adjusted focus score</div>
        <div class="focus" id="weatherFocus">--</div>
        <div class="small">Indoor score: <span id="focusScore">--</span></div>
        <div class="small">Status: <span id="status">--</span></div>
      </div>

      <div class="card">
        <div class="label">Recommendation</div>
        <div class="small" id="recommendation">Waiting for data...</div>
      </div>
    </section>

    <section class="two-col">
      <div class="card">
        <div class="label">Outdoor weather comparison</div>
        <div class="small">Outdoor temp: <span id="outTemp">--</span>°C</div>
        <div class="small">Outdoor humidity: <span id="outHum">--</span>%</div>
        <div class="small">Temp difference: <span id="tempDiff">--</span>°C</div>
        <div class="small">Humidity difference: <span id="humDiff">--</span>%</div>
      </div>

      <div class="card">
        <div class="label">System status</div>
        <div class="small">Last live update: <span id="updated">--</span></div>
        <div class="small">Historical points: <span id="historyCount">0</span></div>
        <div class="small">Storage: Supabase, averaged per minute</div>
      </div>
    </section>

    <section class="card">
      <div class="label">Room comparison</div>

      <table id="roomTable">
        <thead>
          <tr>
            <th>Room</th>
            <th class="center">Avg focus</th>
            <th class="center">Avg noise</th>
            <th class="center">Samples</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="4">Loading...</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="two-col">
      <div class="card">
        <div class="label">Noise over time</div>
        <canvas id="noiseChart"></canvas>
      </div>

      <div class="card">
        <div class="label">Focus score trend</div>
        <canvas id="focusChart"></canvas>
      </div>
    </section>
  </main>

<script>
const noiseChart = new Chart(document.getElementById("noiseChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "1-minute avg noise",
      data: [],
      borderWidth: 2,
      tension: 0.35
    }]
  }
});

const focusChart = new Chart(document.getElementById("focusChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "1-minute avg weather-adjusted focus",
      data: [],
      borderWidth: 2,
      tension: 0.35
    }]
  },
  options: {
    scales: {
      y: { min: 0, max: 100 }
    }
  }
});

function setFocusColour(value) {
  const el = document.getElementById("weatherFocus");
  el.className = "focus";

  if (value >= 75) el.classList.add("good");
  else if (value >= 50) el.classList.add("ok");
  else el.classList.add("poor");
}

async function changeRoom() {
  const selectedRoom = document.getElementById("roomSelect").value;

  await fetch("/room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room: selectedRoom
    })
  });

  document.getElementById("room").textContent = selectedRoom;
}

async function loadRoomStats() {
  const stats = await (await fetch("/room-stats")).json();
  const tbody = document.querySelector("#roomTable tbody");

  tbody.innerHTML = "";

  Object.entries(stats).forEach(([room, data]) => {
    const row = document.createElement("tr");

    row.innerHTML = \`
      <td>\${room}</td>
      <td class="center">\${data.focus}</td>
      <td class="center">\${data.noise}</td>
      <td class="center">\${data.count}</td>
    \`;

    tbody.appendChild(row);
  });

  if (tbody.innerHTML === "") {
    tbody.innerHTML = "<tr><td colspan='4'>No room data recorded yet.</td></tr>";
  }
}

async function loadData() {
  const latest = await (await fetch("/latest")).json();
  const weather = await (await fetch("/weather")).json();
  const history = await (await fetch("/history")).json();
  const roomData = await (await fetch("/room")).json();

  const activeRoom = latest.room || roomData.room || "--";

  document.getElementById("room").textContent = activeRoom;

  if (activeRoom !== "--") {
    document.getElementById("roomSelect").value = activeRoom;
  }

  document.getElementById("temp").textContent = latest.temperature ?? "--";
  document.getElementById("hum").textContent = latest.humidity ?? "--";
  document.getElementById("noise").textContent = latest.noise ?? "--";
  document.getElementById("focusScore").textContent = latest.focusScore ?? "--";
  document.getElementById("weatherFocus").textContent = latest.weatherAdjustedFocus ?? "--";
  document.getElementById("status").textContent = latest.status ?? "--";
  document.getElementById("recommendation").textContent = latest.recommendation ?? "Waiting for data...";
  document.getElementById("updated").textContent = latest.receivedAt
    ? new Date(latest.receivedAt).toLocaleTimeString()
    : "--";

  if (latest.weatherAdjustedFocus !== undefined) {
    setFocusColour(latest.weatherAdjustedFocus);
  }

  document.getElementById("outTemp").textContent = weather.outdoorTemperature ?? "--";
  document.getElementById("outHum").textContent = weather.outdoorHumidity ?? "--";

  if (latest.temperature !== undefined && weather.outdoorTemperature !== undefined) {
    document.getElementById("tempDiff").textContent =
      (latest.temperature - weather.outdoorTemperature).toFixed(1);
  }

  if (latest.humidity !== undefined && weather.outdoorHumidity !== undefined) {
    document.getElementById("humDiff").textContent =
      (latest.humidity - weather.outdoorHumidity).toFixed(1);
  }

  document.getElementById("historyCount").textContent = history.length;

  const labels = history.map(r => new Date(r.created_at).toLocaleTimeString());

  noiseChart.data.labels = labels;
  noiseChart.data.datasets[0].data = history.map(r => r.noise);
  noiseChart.update();

  focusChart.data.labels = labels;
  focusChart.data.datasets[0].data = history.map(r => r.weather_adjusted_focus);
  focusChart.update();

  await loadRoomStats();
}

loadData();
setInterval(loadData, 3000);
</script>
</body>
</html>
  `);
});

fetchWeather();
setInterval(fetchWeather, 10 * 60 * 1000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port \${PORT}`);
});