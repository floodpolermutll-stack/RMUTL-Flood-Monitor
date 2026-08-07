const stations = window.WATER_APP_CONFIG.stations;

const state = {
  selectedStationId: stations[0].id,
  selectedDate: "",
  data: {},
  chart: null,
  map: null,
};

const $ = (selector) => document.querySelector(selector);

function hexToRgba(hex, opacity) {
  const color = hex.replace("#", "");
  const number = parseInt(color, 16);

  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function formatDate(value, options) {
  const dateOptions = options || {
    dateStyle: "medium",
    timeStyle: "short",
  };

  return new Intl.DateTimeFormat("th-TH", dateOptions).format(
    new Date(value)
  );
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function parseCsv(csvText) {
  const rows = csvText
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(",")
        .map((cell) => cell.trim().replace(/^"|"$/g, ""))
    );

  const headers = rows.shift().map((header) => header.toLowerCase());

  const timestampIndex = headers.findIndex((header) =>
    ["timestamp", "datetime", "date"].includes(header)
  );

  const levelIndex = headers.findIndex((header) =>
    ["level", "water_level"].includes(header)
  );

  if (timestampIndex === -1 || levelIndex === -1) {
    throw new Error("Google Sheet ต้องมีคอลัมน์ timestamp และ level");
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
    throw new Error("ไม่สามารถโหลดข้อมูลได้");
  }

  const csvText = await response.text();

  return parseCsv(csvText);
}

function latestReading(station) {
  const readings = state.data[station.id] || [];
  return readings[readings.length - 1];
}

function getRange(station) {
  const readings = state.data[station.id] || [];
  const levels = readings.map((reading) => reading.level);

  if (!levels.length) {
    return null;
  }

  return {
    min: Math.min(...levels),
    max: Math.max(...levels),
  };
}

function getStatus(station, reading) {
  if (!station.deployed) {
    return {
      className: "pending",
      text: "รอติดตั้ง",
    };
  }

  if (!reading) {
    return {
      className: "offline",
      text: "ยังไม่มีข้อมูล",
    };
  }

  if (reading.level >= station.warningLevel) {
    return {
      className: "warning",
      text: "เฝ้าระวัง",
    };
  }

  return {
    className: "normal",
    text: "ปกติ",
  };
}

function renderCards() {
  const container = $("#stationCards");

  container.innerHTML = stations
    .map((station) => {
      const reading = latestReading(station);
      const range = getRange(station);
      const status = getStatus(station, reading);

      const levelText = reading
        ? `${reading.level.toFixed(2)} <small>${station.unit}</small>`
        : "—";

      const updateText = reading
        ? `อัปเดต ${formatDate(reading.timestamp)}`
        : station.deployed
          ? "กรุณาตรวจสอบการเชื่อมต่อข้อมูล"
          : "พร้อมรองรับเมื่อเริ่มติดตั้งสถานี";

      return `
        <button
          class="station-card ${
            station.id === state.selectedStationId ? "selected" : ""
          }"
          data-station-id="${station.id}"
          style="
            --station-color: ${station.color};
            --station-soft: ${station.softColor};
          "
        >
          <span class="status ${status.className}">
            ${status.text}
          </span>

          <h2>${station.name}</h2>

          <strong>${levelText}</strong>

          <div class="range-values">
            <span>
              ต่ำสุด
              <b>${range ? range.min.toFixed(2) : "—"}</b>
              ${station.unit}
            </span>

            <span>
              สูงสุด
              <b>${range ? range.max.toFixed(2) : "—"}</b>
              ${station.unit}
            </span>
          </div>

          <p>${updateText}</p>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-station-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectStation(button.dataset.stationId);
    });
  });
}

function renderStationSelect() {
  const select = $("#stationSelect");

  select.innerHTML = stations
    .map(
      (station) =>
        `<option value="${station.id}">${station.name}</option>`
    )
    .join("");

  select.value = state.selectedStationId;
}

function renderDateInput() {
  const stationReadings =
    state.data[state.selectedStationId] || [];

  const availableDates = [
    ...new Set(
      stationReadings.map((reading) => dateKey(reading.timestamp))
    ),
  ].sort();

  const input = $("#dateInput");

  if (!availableDates.length) {
    input.value = "";
    input.min = "";
    input.max = "";
    return;
  }

  if (
    !state.selectedDate ||
    !availableDates.includes(state.selectedDate)
  ) {
    state.selectedDate = availableDates[availableDates.length - 1];
  }

  input.min = availableDates[0];
  input.max = availableDates[availableDates.length - 1];
  input.value = state.selectedDate;
}

function renderChart() {
  const station = stations.find(
    (item) => item.id === state.selectedStationId
  );

  const readings = (state.data[station.id] || []).filter(
    (reading) => dateKey(reading.timestamp) === state.selectedDate
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
      "สถานีนี้ยังไม่ได้ติดตั้ง";
  } else if (!readings.length) {
    $("#chartNotice").textContent =
      "ยังไม่มีข้อมูลสำหรับวันที่เลือก";
  } else {
    $("#chartNotice").textContent =
      "ชี้หรือแตะจุดบนกราฟเพื่อดูรายละเอียด";
  }

  if (state.chart) {
    state.chart.destroy();
  }

  const levels = readings.map((reading) => reading.level);
  const canvas = $("#waterChart");

  const gradient = canvas
    .getContext("2d")
    .createLinearGradient(0, 0, 0, 340);

  gradient.addColorStop(0, hexToRgba(station.color, 0.35));
  gradient.addColorStop(1, hexToRgba(station.color, 0.02));

  state.chart = new Chart(canvas, {
    type: "line",

    data: {
      labels: readings.map((reading) =>
        formatDate(reading.timestamp, {
          timeStyle: "short",
        })
      ),

      datasets: [
        {
          label: `ระดับน้ำ - ${station.shortName}`,
          data: levels,
          borderColor: station.color,
          backgroundColor: gradient,
          fill: true,
          borderWidth: 3,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: station.color,
          pointBorderWidth: 3,
        },
        {
          label: "ระดับเฝ้าระวัง",
          data: readings.map(() => station.warningLevel),
          borderColor: "#ef8354",
          borderDash: [6, 5],
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "index",
        intersect: false,
      },

      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            boxWidth: 9,
            padding: 18,
          },
        },

        tooltip: {
          backgroundColor: "#163044",
          padding: 12,
          displayColors: false,

          callbacks: {
            title: (items) => {
              const index = items[0].dataIndex;

              return formatDate(readings[index].timestamp);
            },

            label: (context) =>
              `${context.dataset.label}: ${Number(
                context.raw
              ).toFixed(2)} ${station.unit}`,

            afterBody: () => {
              if (!levels.length) {
                return "";
              }

              return [
                `สูงสุด: ${Math.max(...levels).toFixed(2)} ${station.unit}`,
                `ต่ำสุด: ${Math.min(...levels).toFixed(2)} ${station.unit}`,
              ];
            },
          },
        },
      },

      scales: {
        y: {
          beginAtZero: true,

          title: {
            display: true,
            text: station.unit,
          },

          grid: {
            color: "#e7eff1",
          },
        },

        x: {
          grid: {
            display: false,
          },

          ticks: {
            maxRotation: 0,
          },
        },
      },
    },
  });
}

function createMarkerIcon(station) {
  return L.divIcon({
    className: "station-marker-wrap",

    html: `
      <span
        class="station-marker"
        style="--station-color: ${station.color};"
      ></span>
    `,

    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -17],
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
    const reading = latestReading(station);
    const status = getStatus(station, reading);

    const popupText = reading
      ? `ระดับน้ำ: ${reading.level.toFixed(2)} ${station.unit}`
      : "ยังไม่มีข้อมูล";

    const marker = L.marker(
      [station.latitude, station.longitude],
      {
        icon: createMarkerIcon(station),
      }
    )
      .addTo(state.map)
      .bindPopup(`
        <strong>${station.name}</strong><br>
        สถานะ: ${status.text}<br>
        ${popupText}
      `);

    marker.on("click", () => {
      selectStation(station.id);
    });

    state.markers.push(marker);
  });
}

function selectStation(stationId) {
  state.selectedStationId = stationId;
  state.selectedDate = "";

  renderCards();
  renderStationSelect();
  renderDateInput();
  renderChart();

  const station = stations.find(
    (item) => item.id === stationId
  );

  if (state.map) {
    state.map.flyTo(
      [station.latitude, station.longitude],
      14
    );
  }
}

function changeDate(direction) {
  const readings =
    state.data[state.selectedStationId] || [];

  const dates = [
    ...new Set(
      readings.map((reading) => dateKey(reading.timestamp))
    ),
  ].sort();

  const currentIndex = dates.indexOf(state.selectedDate);

  if (currentIndex === -1) {
    return;
  }

  const nextIndex = Math.max(
    0,
    Math.min(dates.length - 1, currentIndex + direction)
  );

  state.selectedDate = dates[nextIndex];

  renderDateInput();
  renderChart();
}

function updateClock() {
  $("#liveClock").textContent =
    `เวลาปัจจุบัน ${new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date())}`;
}

async function refreshData() {
  $("#globalUpdated").textContent = "กำลังโหลดข้อมูล…";

  await Promise.all(
    stations.map(async (station) => {
      try {
        state.data[station.id] = await loadStation(station);
      } catch (error) {
        console.error(error);
        state.data[station.id] = [];
      }
    })
  );

  renderCards();
  renderStationSelect();
  renderDateInput();
  renderChart();

  if (!state.map) {
    setupMap();
  }

  const newest = stations
    .map((station) => latestReading(station))
    .filter(Boolean)
    .sort(
      (first, second) =>
        new Date(second.timestamp) - new Date(first.timestamp)
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
  refreshData();
});

updateClock();

setInterval(updateClock, 1000);

setInterval(refreshData, 300000);

refreshData();
