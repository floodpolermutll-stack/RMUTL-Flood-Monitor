const { stations } = window.WATER_APP_CONFIG;

const state = {
  selectedStationId: stations[0].id,
  selectedDate: "",
  data: {},
  chart: null,
  map: null,
};

const $ = (selector) => document.querySelector(selector);

function parseCsv(csv) {
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(",")
        .map((cell) => cell.trim().replace(/^"|"$/g, ""))
    );

  const headers = rows.shift().map((header) => header.toLowerCase());

  const timestampIndex = headers.findIndex((header) =>
    ["timestamp", "datetime", "date", "วันที่เวลา"].includes(header)
  );

  const levelIndex = headers.findIndex((header) =>
    ["level", "water_level", "ระดับน้ำ"].includes(header)
  );

  if (timestampIndex < 0 || levelIndex < 0) {
    throw new Error("ไม่พบคอลัมน์ timestamp และ level");
  }

  return rows
    .map((row) => ({
      timestamp: row[timestampIndex],
      level: Number(row[levelIndex]),
    }))
    .filter((row) => row.timestamp && Number.isFinite(row.level))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function loadStation(station) {
  if (!station.deployed || !station.googleSheetCsv) {
    return [];
  }

  const response = await fetch(station.googleSheetCsv, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("ไม่สามารถโหลด Google Sheets ได้");
  }

  return parseCsv(await response.text());
}

function formatDate(
  value,
  options = {
    dateStyle: "medium",
    timeStyle: "short",
  }
) {
  return new Intl.DateTimeFormat("th-TH", options).format(
    new Date(value)
  );
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function latest(station) {
  const data = state.data[station.id] || [];
  return data[data.length - 1];
}

function statusFor(station, reading) {
  if (!station.deployed) {
    return ["pending", "รอติดตั้ง"];
  }

  if (!reading) {
    return ["offline", "ยังไม่มีข้อมูล"];
  }

  if (reading.level >= station.warningLevel) {
    return ["warning", "เฝ้าระวัง"];
  }

  return ["normal", "ปกติ"];
}

function renderCards() {
  $("#stationCards").innerHTML = stations
    .map((station) => {
      const reading = latest(station);
      const [status, label] = statusFor(station, reading);

      const value = reading
        ? `${reading.level.toFixed(2)} <small>${station.unit}</small>`
        : "—";

      const update = reading
        ? `อัปเดต ${formatDate(reading.timestamp)}`
        : station.deployed
          ? "กรุณาตรวจสอบการเชื่อมต่อข้อมูล"
          : "พร้อมรองรับเมื่อเริ่มติดตั้งสถานี";

      return `
        <button
          class="station-card ${
            station.id === state.selectedStationId ? "selected" : ""
          }"
          data-station="${station.id}"
        >
          <span class="status ${status}">${label}</span>
          <h2>${station.name}</h2>
          <strong>${value}</strong>
          <p>${update}</p>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-station]").forEach((button) => {
    button.addEventListener("click", () => {
      selectStation(button.dataset.station);
    });
  });
}

function renderStationOptions() {
  $("#stationSelect").innerHTML = stations
    .map(
      (station) =>
        `<option value="${station.id}">${station.name}</option>`
    )
    .join("");

  $("#stationSelect").value = state.selectedStationId;
}

function renderDates() {
  const readings = state.data[state.selectedStationId] || [];

  const dates = [
    ...new Set(readings.map((reading) => dateKey(reading.timestamp))),
  ].sort();

  const input = $("#dateInput");

  if (!dates.length) {
    input.value = "";
    input.min = "";
    input.max = "";
    return;
  }

  if (!state.selectedDate || !dates.includes(state.selectedDate)) {
    state.selectedDate = dates[dates.length - 1];
  }

  input.min = dates[0];
  input.max = dates[dates.length - 1];
  input.value = state.selectedDate;
}

function renderChart() {
  const station = stations.find(
    (item) => item.id === state.selectedStationId
  );

  const readings = (state.data[station.id] || []).filter(
    (item) => dateKey(item.timestamp) === state.selectedDate
  );

  $("#chartTitle").textContent =
    `กราฟระดับน้ำ: ${station.shortName}`;

  $("#chartDateLabel").textContent = state.selectedDate
    ? formatDate(state.selectedDate, {
        dateStyle: "full",
      })
    : "ยังไม่มีข้อมูล";

  $("#unitLabel").textContent = station.unit;

  if (!station.deployed) {
    $("#chartNotice").textContent =
      "สถานีนี้ยังไม่ได้ติดตั้ง เมื่อพร้อม ให้ตั้งค่า deployed เป็น true และใส่ลิงก์ Google Sheets ใน config.js";
  } else if (!readings.length) {
    $("#chartNotice").textContent =
      "ยังไม่มีข้อมูลสำหรับวันที่ที่เลือก";
  } else {
    $("#chartNotice").textContent =
      "เส้นประแสดงระดับเฝ้าระวัง";
  }

  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart($("#waterChart"), {
    type: "line",

    data: {
      labels: readings.map((item) =>
        formatDate(item.timestamp, {
          timeStyle: "short",
        })
      ),

      datasets: [
        {
          label: "ระดับน้ำ",
          data: readings.map((item) => item.level),
          borderColor: "#087e8b",
          backgroundColor: "rgba(8,126,139,.12)",
          fill: true,
          tension: 0.28,
          pointRadius: 3,
        },
        {
          label: "ระดับเฝ้าระวัง",
          data: readings.map(() => station.warningLevel),
          borderColor: "#ef8354",
          borderDash: [6, 5],
          pointRadius: 0,
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          position: "bottom",
        },
      },

      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: station.unit,
          },
        },
      },
    },
  });
}

function setupMap() {
  state.map = L.map("map").setView(
    [stations[0].latitude, stations[0].longitude],
    12
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "© OpenStreetMap contributors",
    }
  ).addTo(state.map);

  stations.forEach((station) => {
    const reading = latest(station);
    const [, label] = statusFor(station, reading);

    const detail = reading
      ? `<br>ระดับน้ำ ${reading.level.toFixed(2)} ${station.unit}`
      : "";

    const marker = L.marker([
      station.latitude,
      station.longitude,
    ])
      .addTo(state.map)
      .bindPopup(`
        <strong>${station.name}</strong><br>
        ${label}
        ${detail}
      `);

    marker.on("click", () => {
      selectStation(station.id);
    });
  });
}

function selectStation(id) {
  state.selectedStationId = id;
  state.selectedDate = "";

  renderCards();
  renderStationOptions();
  renderDates();
  renderChart();

  const station = stations.find((item) => item.id === id);

  state.map.flyTo(
    [station.latitude, station.longitude],
    14
  );
}

function changeDate(offset) {
  const readings = state.data[state.selectedStationId] || [];

  const dates = [
    ...new Set(readings.map((reading) => dateKey(reading.timestamp))),
  ].sort();

  const index = dates.indexOf(state.selectedDate);

  if (index < 0) {
    return;
  }

  const nextIndex = Math.max(
    0,
    Math.min(dates.length - 1, index + offset)
  );

  state.selectedDate = dates[nextIndex];

  renderDates();
  renderChart();
}

function updateLiveClock() {
  const now = new Date();

  $("#liveClock").textContent =
    `เวลาปัจจุบัน ${new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(now)}`;
}

async function refresh() {
  $("#globalUpdated").textContent = "กำลังโหลดข้อมูล…";

  await Promise.all(
    stations.map(async (station) => {
      try {
        state.data[station.id] = await loadStation(station);
      } catch (error) {
        console.error(station.id, error);
        state.data[station.id] = [];
      }
    })
  );

  renderCards();
  renderStationOptions();
  renderDates();
  renderChart();

  if (!state.map) {
    setupMap();
  }

  const newest = stations
    .map(latest)
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    )[0];

  $("#globalUpdated").textContent = newest
    ? `ข้อมูลล่าสุด ${formatDate(newest.timestamp)}`
    : "ยังไม่มีข้อมูลจากสถานี";
}

$("#stationSelect").addEventListener("change", (event) => {
  selectStation(event.target.value);
});

$("#dateInput").addEventListener("change", (event) => {
  state.selectedDate = event.target.value;
  renderChart();
});

$("#previousDate").addEventListener("click", () => {
  changeDate(-1);
});

$("#nextDate").addEventListener("click", () => {
  changeDate(1);
});

$("#refreshButton").addEventListener("click", () => {
  refresh();
});
