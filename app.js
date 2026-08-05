const { stations } = window.WATER_APP_CONFIG;

const state = {
  selectedStationId: stations[0].id,
  data: {},
  chart: null,
  map: null,
  markers: [],
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

  const csv = await response.text();
  return parseCsv(csv);
}

function formatDate(
  value,
  options = {
    dateStyle: "medium",
    timeStyle: "short",
  }
) {
  return new Intl.DateTimeFormat("th-TH", options).format(new Date(value));
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
  const cards = stations.map((station) => {
    const reading = latest(station);
    const [status, label] = statusFor(station, reading);

    const displayLevel = reading
      ? `${reading.level.toFixed(2)} <small>${station.unit}</small>`
      : "—";

    const description = reading
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
        <strong>${displayLevel}</strong>
        <p>${description}</p>
      </button>
    `;
  });

  $("#stationCards").innerHTML = cards.join("");

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

  const dates = [...new Set(readings.map((reading) => dateKey(reading.timestamp)))]
    .reverse();

  if (!dates.length) {
    $("#dateSelect").innerHTML =
      '<option value="all">ไม่มีข้อมูล</option>';
    return;
  }

  $("#dateSelect").innerHTML = `
    <option value="all">ทุกวันที่มีข้อมูล</option>
    ${dates
      .map(
        (date) =>
          `<option value="${date}">
            ${formatDate(date, { dateStyle: "full" })}
          </option>`
      )
      .join("")}
  `;
}

function renderChart() {
  const station = stations.find(
    (item) => item.id === state.selectedStationId
  );

  const chosenDate = $("#dateSelect").value;
  const allReadings = state.data[station.id] || [];

  const readings =
    chosenDate === "all"
      ? allReadings
      : allReadings.filter(
          (item) => dateKey(item.timestamp) === chosenDate
        );

  $("#chartTitle").textContent =
    `กราฟระดับน้ำ: ${station.shortName}`;

  $("#unitLabel").textContent = station.unit;

  if (!station.deployed) {
    $("#chartNotice").textContent =
      "สถานีนี้ยังไม่ได้ติดตั้ง เมื่อพร้อม ให้ตั้งค่า deployed เป็น true และใส่ลิงก์ Google Sheets ใน config.js";
  } else if (!readings.length) {
    $("#chartNotice").textContent =
      "ยังไม่มีข้อมูลสำหรับแสดงผล กรุณาตรวจสอบลิงก์ Google Sheets และรูปแบบคอลัมน์";
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
      labels: readings.map((item) => formatDate(item.timestamp)),

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

    state.markers.push({
      id: station.id,
      marker,
    });
  });
}

function updateMapFocus() {
  const station = stations.find(
    (item) => item.id === state.selectedStationId
  );

  state.map.flyTo(
    [station.latitude, station.longitude],
    14
  );
}

function selectStation(id) {
  state.selectedStationId = id;

  renderCards();
  renderStationOptions();
  renderDates();
  renderChart();
  updateMapFocus();
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

$("#dateSelect").addEventListener("change", () => {
  renderChart();
});

$("#refreshButton").addEventListener("click", () => {
  refresh();
});

refresh();
