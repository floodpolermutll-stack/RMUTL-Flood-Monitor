const stations = window.WATER_APP_CONFIG.stations;

const state = {
  selectedStationId: stations[0].id,
  selectedDate: "",
  data: {},
  chart: null,
  map: null,
  markers: [],
};

const $ = (selector) => document.querySelector(selector);


// ============================================================
// COLOR
// ============================================================

function hexToRgba(hex, opacity) {
  const color = hex.replace("#", "");
  const number = parseInt(color, 16);

  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}


// ============================================================
// DATE / TIME
// ============================================================

function formatDate(value, options) {
  const dateOptions = options || {
    dateStyle: "medium",
    timeStyle: "short",
  };

  return new Intl.DateTimeFormat("th-TH", {
    ...dateOptions,
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}


function dateKey(value) {
  const date = new Date(value);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}


function buildThaiTimestamp(dateText, timeText) {
  const date = String(dateText || "").trim();
  const time = String(timeText || "00:00:00").trim();

  if (!date) {
    return null;
  }

  const slash = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    const year = slash[3];

    let fixedTime = time;

    if (/^\d{1,2}:\d{2}$/.test(fixedTime)) {
      fixedTime += ":00";
    }

    return `${year}-${month}-${day}T${fixedTime}+07:00`;
  }

  const fallback = new Date(`${date} ${time}`);

  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }

  return null;
}


// ============================================================
// CSV
// ============================================================

function splitCsvLine(line) {
  const cells = [];

  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());

  return cells;
}


function normalizeHeader(value) {
  return String(value || "")
    .replace(/"/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}


function parseCsv(csvText) {
  if (!csvText || !csvText.trim()) {
    return [];
  }

  console.log("CSV RAW:");
  console.log(csvText);

  const rows = csvText
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map(splitCsvLine);

  let headerRowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const text = rows[i]
      .map(normalizeHeader)
      .join(" ");

    const hasDate =
      text.includes("วันที่") ||
      text.includes("date");

    const hasTime =
      text.includes("เวลา") ||
      text.includes("time");

    const hasDistance =
      text.includes("ระยะทาง") ||
      text.includes("distance") ||
      text.includes("level");

    const hasLat =
      text.includes("latitude") ||
      text.includes("lat");

    const hasLng =
      text.includes("longitude") ||
      text.includes("lng");

    if (
      hasDate &&
      hasTime &&
      hasDistance &&
      hasLat &&
      hasLng
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.table(rows);

    throw new Error(
      "ไม่พบหัวตาราง วันที่ / เวลา / ระยะทาง / Latitude / Longitude"
    );
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);

  console.log("HEADERS =", headers);

  const dateIndex = headers.findIndex(
    (h) => h.includes("วันที่") || h === "date"
  );

  const timeIndex = headers.findIndex(
    (h) => h.includes("เวลา") || h === "time"
  );

  const distanceIndex = headers.findIndex(
    (h) =>
      h.includes("ระยะทาง") ||
      h.includes("distance") ||
      h.includes("level")
  );

  const latitudeIndex = headers.findIndex(
    (h) =>
      h.includes("latitude") ||
      h === "lat"
  );

  const longitudeIndex = headers.findIndex(
    (h) =>
      h.includes("longitude") ||
      h === "lng"
  );

  if (dateIndex === -1) {
    throw new Error("ไม่พบคอลัมน์ วันที่");
  }

  if (timeIndex === -1) {
    throw new Error("ไม่พบคอลัมน์ เวลา");
  }

  if (latitudeIndex === -1) {
    throw new Error("ไม่พบคอลัมน์ Latitude");
  }

  if (longitudeIndex === -1) {
    throw new Error("ไม่พบคอลัมน์ Longitude");
  }

  const results = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];

    const dateText = String(row[dateIndex] || "")
      .replace(/"/g, "")
      .trim();

    const timeText = String(row[timeIndex] || "")
      .replace(/"/g, "")
      .trim();

    if (!dateText) {
      continue;
    }

    const timestamp = buildThaiTimestamp(
      dateText,
      timeText
    );

    if (!timestamp) {
      continue;
    }

    let level = null;

    if (distanceIndex !== -1) {
      const rawDistance = String(
        row[distanceIndex] || ""
      )
        .replace(/"/g, "")
        .trim();

      if (
        rawDistance !== "" &&
        rawDistance !== "—" &&
        rawDistance !== "-"
      ) {
        const number = parseFloat(rawDistance);

        if (Number.isFinite(number)) {
          level = number;
        }
      }
    }

    const latitude = parseFloat(
      String(row[latitudeIndex] || "")
        .replace(/"/g, "")
        .trim()
    );

    const longitude = parseFloat(
      String(row[longitudeIndex] || "")
        .replace(/"/g, "")
        .trim()
    );

    results.push({
      timestamp,
      level:
        Number.isFinite(level)
          ? level
          : null,

      latitude:
        Number.isFinite(latitude)
          ? latitude
          : null,

      longitude:
        Number.isFinite(longitude)
          ? longitude
          : null,
    });
  }

  results.sort(
    (a, b) =>
      new Date(a.timestamp) -
      new Date(b.timestamp)
  );

  console.log("PARSED DATA =", results);

  return results;
}


// ============================================================
// LOAD STATION
// ============================================================

async function loadStation(station) {
  if (
    !station.deployed ||
    !station.googleSheetCsv
  ) {
    return [];
  }

  const response = await fetch(
    station.googleSheetCsv,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `โหลดข้อมูล ${station.name} ไม่สำเร็จ HTTP ${response.status}`
    );
  }

  const csvText = await response.text();

  return parseCsv(csvText);
}


// ============================================================
// DATA HELPERS
// ============================================================

function latestReading(station) {
  const readings =
    state.data[station.id] || [];

  return readings.length
    ? readings[readings.length - 1]
    : null;
}


function getRange(station) {
  const readings =
    state.data[station.id] || [];

  const levels = readings
    .map((reading) => reading.level)
    .filter((level) =>
      Number.isFinite(level)
    );

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

  if (
    Number.isFinite(reading.level) &&
    Number.isFinite(station.warningLevel) &&
    reading.level >= station.warningLevel
  ) {
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


// ============================================================
// CARDS
// ============================================================

function renderCards() {
  const container = $("#stationCards");

  container.innerHTML = stations
    .map((station) => {
      const reading =
        latestReading(station);

      const range =
        getRange(station);

      const status =
        getStatus(station, reading);

      const levelText =
        reading &&
        Number.isFinite(reading.level)
          ? `${reading.level.toFixed(3)} <small>${station.unit}</small>`
          : "—";

      const updateText = reading
        ? `อัปเดต ${formatDate(reading.timestamp)}`
        : station.deployed
          ? "กรุณาตรวจสอบการเชื่อมต่อข้อมูล"
          : "พร้อมรองรับเมื่อเริ่มติดตั้งสถานี";

      return `
        <button
          class="station-card ${
            station.id ===
            state.selectedStationId
              ? "selected"
              : ""
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
              <b>
                ${
                  range
                    ? range.min.toFixed(3)
                    : "—"
                }
              </b>
              ${station.unit}
            </span>

            <span>
              สูงสุด
              <b>
                ${
                  range
                    ? range.max.toFixed(3)
                    : "—"
                }
              </b>
              ${station.unit}
            </span>
          </div>

          <p>${updateText}</p>
        </button>
      `;
    })
    .join("");

  document
    .querySelectorAll("[data-station-id]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          selectStation(
            button.dataset.stationId
          );
        }
      );
    });
}


// ============================================================
// SELECT
// ============================================================

function renderStationSelect() {
  const select = $("#stationSelect");

  select.innerHTML = stations
    .map(
      (station) =>
        `<option value="${station.id}">
          ${station.name}
        </option>`
    )
    .join("");

  select.value =
    state.selectedStationId;
}


// ============================================================
// DATE
// ============================================================

function renderDateInput() {
  const stationReadings =
    state.data[
      state.selectedStationId
    ] || [];

  const availableDates = [
    ...new Set(
      stationReadings
        .map((reading) =>
          dateKey(reading.timestamp)
        )
        .filter(Boolean)
    ),
  ].sort();

  const input = $("#dateInput");

  if (!availableDates.length) {
    input.value = "";
    input.min = "";
    input.max = "";
    state.selectedDate = "";
    return;
  }

  if (
    !state.selectedDate ||
    !availableDates.includes(
      state.selectedDate
    )
  ) {
    state.selectedDate =
      availableDates[
        availableDates.length - 1
      ];
  }

  input.min =
    availableDates[0];

  input.max =
    availableDates[
      availableDates.length - 1
    ];

  input.value =
    state.selectedDate;
}


// ============================================================
// CHART
// ============================================================

function renderChart() {
  const station = stations.find(
    (item) =>
      item.id ===
      state.selectedStationId
  );

  if (!station) {
    return;
  }

  const readings =
    (
      state.data[station.id] || []
    )
      .filter(
        (reading) =>
          dateKey(reading.timestamp) ===
          state.selectedDate
      )
      .filter(
        (reading) =>
          Number.isFinite(
            reading.level
          )
      );

  $("#chartTitle").textContent =
    `กราฟระดับน้ำ: ${station.shortName}`;

  $("#chartDateLabel").textContent =
    state.selectedDate
      ? formatDate(
          `${state.selectedDate}T12:00:00+07:00`,
          {
            dateStyle: "full",
          }
        )
      : "ยังไม่มีข้อมูล";

  $("#unitLabel").textContent =
    station.unit;

  if (!station.deployed) {
    $("#chartNotice").textContent =
      "สถานีนี้ยังไม่ได้ติดตั้ง";
  } else if (!readings.length) {
    $("#chartNotice").textContent =
      "ยังไม่มีข้อมูลระดับน้ำสำหรับวันที่เลือก";
  } else {
    $("#chartNotice").textContent =
      "ชี้หรือแตะจุดบนกราฟเพื่อดูรายละเอียด";
  }

  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }

  const levels =
    readings.map(
      (reading) =>
        reading.level
    );

  const canvas =
    $("#waterChart");

  const gradient =
    canvas
      .getContext("2d")
      .createLinearGradient(
        0,
        0,
        0,
        340
      );

  gradient.addColorStop(
    0,
    hexToRgba(
      station.color,
      0.35
    )
  );

  gradient.addColorStop(
    1,
    hexToRgba(
      station.color,
      0.02
    )
  );

  state.chart =
    new Chart(
      canvas,
      {
        type: "line",

        data: {
          labels:
            readings.map(
              (reading) =>
                formatDate(
                  reading.timestamp,
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }
                )
            ),

          datasets: [
            {
              label:
                `ระดับน้ำ - ${station.shortName}`,

              data: levels,

              borderColor:
                station.color,

              backgroundColor:
                gradient,

              fill: true,

              borderWidth: 3,

              tension: 0.35,

              pointRadius: 4,

              pointHoverRadius: 7,

              pointBackgroundColor:
                "#ffffff",

              pointBorderColor:
                station.color,

              pointBorderWidth: 3,
            },

            {
              label:
                "ระดับเฝ้าระวัง",

              data:
                readings.map(
                  () =>
                    station.warningLevel
                ),

              borderColor:
                "#ef8354",

              borderDash:
                [6, 5],

              borderWidth: 2,

              pointRadius: 0,
            },
          ],
        },

        options: {
          responsive: true,

          maintainAspectRatio:
            false,

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
              backgroundColor:
                "#163044",

              padding: 12,

              displayColors:
                false,

              callbacks: {
                title: (items) => {
                  const index =
                    items[0]
                      .dataIndex;

                  return formatDate(
                    readings[index]
                      .timestamp
                  );
                },

                label:
                  (context) =>
                    `${context.dataset.label}: ${Number(
                      context.raw
                    ).toFixed(3)} ${station.unit}`,

                afterBody: () => {
                  if (!levels.length) {
                    return "";
                  }

                  return [
                    `สูงสุด: ${Math.max(
                      ...levels
                    ).toFixed(3)} ${station.unit}`,

                    `ต่ำสุด: ${Math.min(
                      ...levels
                    ).toFixed(3)} ${station.unit}`,
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
                text:
                  station.unit,
              },

              grid: {
                color:
                  "#e7eff1",
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
      }
    );
}


// ============================================================
// MAP
// ============================================================

function createMarkerIcon(station) {
  return L.divIcon({
    className:
      "station-marker-wrap",

    html: `
      <span
        class="station-marker"
        style="
          --station-color:
          ${station.color};
        "
      ></span>
    `,

    iconSize:
      [32, 32],

    iconAnchor:
      [16, 16],

    popupAnchor:
      [0, -17],
  });
}


function getStationCoordinates(station) {
  const reading =
    latestReading(station);

  if (
    reading &&
    Number.isFinite(
      reading.latitude
    ) &&
    Number.isFinite(
      reading.longitude
    ) &&
    reading.latitude !== 0 &&
    reading.longitude !== 0
  ) {
    return [
      reading.latitude,
      reading.longitude,
    ];
  }

  return [
    Number(station.latitude),
    Number(station.longitude),
  ];
}


function setupMap() {
  if (state.map) {
    return;
  }

  const firstCoords =
    getStationCoordinates(
      stations[0]
    );

  state.map =
    L.map("map")
      .setView(
        firstCoords,
        12
      );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        "© OpenStreetMap contributors",

      maxZoom: 19,
    }
  ).addTo(state.map);

  renderMapMarkers();
}


function renderMapMarkers() {
  if (!state.map) {
    return;
  }

  state.markers.forEach(
    (marker) =>
      marker.remove()
  );

  state.markers = [];

  stations.forEach(
    (station) => {
      const coords =
        getStationCoordinates(
          station
        );

      const reading =
        latestReading(
          station
        );

      const status =
        getStatus(
          station,
          reading
        );

      let popupText =
        "ยังไม่มีข้อมูลระดับน้ำ";

      if (
        reading &&
        Number.isFinite(
          reading.level
        )
      ) {
        popupText =
          `ระดับน้ำ: ${reading.level.toFixed(3)} ${station.unit}`;
      }

      const marker =
        L.marker(
          coords,
          {
            icon:
              createMarkerIcon(
                station
              ),
          }
        )
          .addTo(
            state.map
          )
          .bindPopup(`
            <strong>
              ${station.name}
            </strong>

            <br>

            สถานะ:
            ${status.text}

            <br>

            ${popupText}

            <br>

            Latitude:
            ${coords[0].toFixed(6)}

            <br>

            Longitude:
            ${coords[1].toFixed(6)}
          `);

      marker.on(
        "click",
        () => {
          selectStation(
            station.id
          );
        }
      );

      state.markers.push(
        marker
      );
    }
  );
}


// ============================================================
// SELECT STATION
// ============================================================

function selectStation(stationId) {
  state.selectedStationId =
    stationId;

  state.selectedDate = "";

  renderCards();
  renderStationSelect();
  renderDateInput();
  renderChart();

  const station =
    stations.find(
      (item) =>
        item.id ===
        stationId
    );

  if (!station) {
    return;
  }

  const coords =
    getStationCoordinates(
      station
    );

  if (state.map) {
    state.map.flyTo(
      coords,
      14
    );
  }
}


// ============================================================
// CHANGE DATE
// ============================================================

function changeDate(direction) {
  const readings =
    state.data[
      state.selectedStationId
    ] || [];

  const dates = [
    ...new Set(
      readings
        .map((reading) =>
          dateKey(
            reading.timestamp
          )
        )
        .filter(Boolean)
    ),
  ].sort();

  const currentIndex =
    dates.indexOf(
      state.selectedDate
    );

  if (currentIndex === -1) {
    return;
  }

  const nextIndex =
    Math.max(
      0,
      Math.min(
        dates.length - 1,
        currentIndex +
          direction
      )
    );

  state.selectedDate =
    dates[nextIndex];

  renderDateInput();
  renderChart();
}


// ============================================================
// CLOCK
// ============================================================

function updateClock() {
  $("#liveClock").textContent =
    `เวลาปัจจุบัน ${new Intl.DateTimeFormat(
      "th-TH",
      {
        timeZone:
          "Asia/Bangkok",

        dateStyle:
          "medium",

        timeStyle:
          "medium",
      }
    ).format(new Date())}`;
}


// ============================================================
// REFRESH
// ============================================================

async function refreshData() {
  $("#globalUpdated").textContent =
    "กำลังโหลดข้อมูล…";

  await Promise.all(
    stations.map(
      async (station) => {
        try {
          state.data[
            station.id
          ] =
            await loadStation(
              station
            );
        } catch (error) {
          console.error(
            `Station ${station.id}:`,
            error
          );

          state.data[
            station.id
          ] = [];
        }
      }
    )
  );

  renderCards();
  renderStationSelect();
  renderDateInput();
  renderChart();

  if (!state.map) {
    setupMap();
  } else {
    renderMapMarkers();
  }

  const newest =
    stations
      .map(
        (station) =>
          latestReading(
            station
          )
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(
            b.timestamp
          ) -
          new Date(
            a.timestamp
          )
      )[0];

  $("#globalUpdated").textContent =
    newest
      ? `ข้อมูลล่าสุด ${formatDate(
          newest.timestamp
        )}`
      : "ยังไม่มีข้อมูลจากสถานี";
}


// ============================================================
// EVENTS
// ============================================================

$("#stationSelect")
  .addEventListener(
    "change",
    (event) => {
      selectStation(
        event.target.value
      );
    }
  );


$("#dateInput")
  .addEventListener(
    "change",
    (event) => {
      state.selectedDate =
        event.target.value;

      renderChart();
    }
  );


$("#previousDate")
  .addEventListener(
    "click",
    () => {
      changeDate(-1);
    }
  );


$("#nextDate")
  .addEventListener(
    "click",
    () => {
      changeDate(1);
    }
  );


$("#refreshButton")
  .addEventListener(
    "click",
    () => {
      refreshData();
    }
  );


// ============================================================
// START
// ============================================================

updateClock();

setInterval(
  updateClock,
  1000
);

setInterval(
  refreshData,
  300000
);

refreshData();
