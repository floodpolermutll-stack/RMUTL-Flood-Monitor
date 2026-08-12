// ============================================================
// RMUTL FLOOD MONITOR
// Modern Dashboard
// Google Sheets + Hourly Chart + Map + Download + Theme
// ============================================================

const stations =
  window.WATER_APP_CONFIG.stations;

const state = {
  selectedStationId: stations[0].id,
  selectedDate: "",
  chartMode: "station",
  data: {},
  chart: null,
  map: null,
  markers: []
};

const $ = (selector) =>
  document.querySelector(selector);


// ============================================================
// COLOR
// ============================================================

function hexToRgba(hex, opacity) {

  const color =
    String(hex || "#000000")
      .replace("#", "");

  const number =
    parseInt(color, 16);

  const r =
    (number >> 16) & 255;

  const g =
    (number >> 8) & 255;

  const b =
    number & 255;

  return `rgba(${r},${g},${b},${opacity})`;
}


// ============================================================
// DATE
// ============================================================

function formatDate(value, options) {

  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  try {

    return new Intl.DateTimeFormat(
      "th-TH",
      {
        ...(options || {
          dateStyle: "medium",
          timeStyle: "short"
        }),
        timeZone: "Asia/Bangkok"
      }
    ).format(date);

  }

  catch (error) {

    return "—";

  }
}


function dateKey(value) {

  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  try {

    const parts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      ).formatToParts(date);

    const year =
      parts.find(
        p => p.type === "year"
      )?.value;

    const month =
      parts.find(
        p => p.type === "month"
      )?.value;

    const day =
      parts.find(
        p => p.type === "day"
      )?.value;

    if (
      !year ||
      !month ||
      !day
    ) {
      return "";
    }

    return `${year}-${month}-${day}`;

  }

  catch (error) {

    return "";

  }
}


function getThaiHour(value) {

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  try {

    const hour =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone: "Asia/Bangkok",
          hour: "2-digit",
          hour12: false
        }
      ).format(date);

    const number =
      Number(
        hour === "24"
          ? "0"
          : hour
      );

    return (
      Number.isInteger(number) &&
      number >= 0 &&
      number <= 23
    )
      ? number
      : null;

  }

  catch (error) {

    return null;

  }
}


function normalizeTimeText(value) {

  const text =
    String(value || "")
      .replace(/"/g, "")
      .trim();

  const match =
    text.match(
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );

  if (!match) {
    return "00:00:00";
  }

  const hour =
    String(match[1])
      .padStart(2, "0");

  const minute =
    String(match[2])
      .padStart(2, "0");

  const second =
    String(match[3] || "00")
      .padStart(2, "0");

  return `${hour}:${minute}:${second}`;
}


function buildThaiTimestamp(
  dateText,
  timeText
) {

  let date =
    String(dateText || "")
      .replace(/"/g, "")
      .trim();

  let time =
    String(timeText || "")
      .replace(/"/g, "")
      .trim();

  if (!date) {
    return null;
  }

  // รูปแบบเก่า
  // 10/8/2026, 14:23:16

  const combined =
    date.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s*,\s*(\d{1,2}:\d{2}(?::\d{2})?)$/
    );

  if (combined) {

    date =
      combined[1];

    time =
      combined[2];

  }

  time =
    normalizeTimeText(time);


  // DD/MM/YYYY

  let match =
    date.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (match) {

    const day =
      String(match[1])
        .padStart(2, "0");

    const month =
      String(match[2])
        .padStart(2, "0");

    const year =
      match[3];

    const timestamp =
      `${year}-${month}-${day}T${time}+07:00`;

    return Number.isNaN(
      new Date(timestamp).getTime()
    )
      ? null
      : timestamp;
  }


  // YYYY-MM-DD

  match =
    date.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (match) {

    const year =
      match[1];

    const month =
      String(match[2])
        .padStart(2, "0");

    const day =
      String(match[3])
        .padStart(2, "0");

    const timestamp =
      `${year}-${month}-${day}T${time}+07:00`;

    return Number.isNaN(
      new Date(timestamp).getTime()
    )
      ? null
      : timestamp;
  }

  return null;
}


// ============================================================
// CSV PARSER
// ============================================================

function splitCsvLine(line) {

  const cells = [];

  let current = "";
  let insideQuotes = false;

  for (
    let i = 0;
    i < line.length;
    i++
  ) {

    const char =
      line[i];

    if (char === '"') {

      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {

        current += '"';
        i++;

      }

      else {

        insideQuotes =
          !insideQuotes;

      }

    }

    else if (
      char === "," &&
      !insideQuotes
    ) {

      cells.push(
        current.trim()
      );

      current = "";

    }

    else {

      current += char;

    }
  }

  cells.push(
    current.trim()
  );

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


function parseNumberCell(value) {

  let raw =
    String(value ?? "")
      .replace(/"/g, "")
      .replace(/\s+/g, "")
      .trim();

  if (
    raw === "" ||
    raw === "—" ||
    raw === "-"
  ) {
    return null;
  }

  raw =
    raw.replace(",", ".");

  const number =
    Number(raw);

  return Number.isFinite(number)
    ? number
    : null;
}


// ============================================================
// PARSE GOOGLE SHEET CSV
// ============================================================

function parseCsv(csvText) {

  if (
    !csvText ||
    !csvText.trim()
  ) {
    return [];
  }

  const rows =
    csvText
      .split(/\r?\n/)
      .filter(
        line =>
          line.trim() !== ""
      )
      .map(splitCsvLine);

  let headerRowIndex = -1;

  for (
    let i = 0;
    i < rows.length;
    i++
  ) {

    const headers =
      rows[i]
        .map(normalizeHeader);

    const text =
      headers.join(" ");

    const hasDate =
      text.includes("วันที่") ||
      text.includes("date");

    const hasLatitude =
      text.includes("latitude") ||
      headers.includes("lat");

    const hasLongitude =
      text.includes("longitude") ||
      headers.includes("lng") ||
      headers.includes("lon");

    if (
      hasDate &&
      hasLatitude &&
      hasLongitude
    ) {

      headerRowIndex = i;
      break;

    }
  }


  if (
    headerRowIndex === -1
  ) {

    console.error(
      "ไม่พบหัวตาราง"
    );

    return [];
  }


  const headers =
    rows[
      headerRowIndex
    ].map(normalizeHeader);


  let dateIndex =
    headers.findIndex(
      h =>
        h.includes("วันที่") ||
        h === "date"
    );


  let timeIndex =
    headers.findIndex(
      h =>
        h.includes("เวลา") ||
        h === "time"
    );


  let distanceIndex =
    headers.findIndex(
      h => {

        const value =
          String(h || "");

        return (
          value.includes("ระดับน้ำ") ||
          value.includes("ระยะน้ำ") ||
          value.includes("ระยะทาง") ||
          value.includes("distance") ||
          value.includes("water level") ||
          value.includes("water_level") ||
          value === "level"
        );

      }
    );


  let latitudeIndex =
    headers.findIndex(
      h =>
        h.includes("latitude") ||
        h === "lat"
    );


  let longitudeIndex =
    headers.findIndex(
      h =>
        h.includes("longitude") ||
        h === "lng" ||
        h === "lon"
    );


  // A = วันที่
  // B = เวลา
  // C = ระดับน้ำ
  // D = Latitude
  // E = Longitude

  if (dateIndex === -1) {
    dateIndex = 0;
  }

  if (timeIndex === -1) {
    timeIndex = 1;
  }

  if (distanceIndex === -1) {
    distanceIndex = 2;
  }

  if (latitudeIndex === -1) {
    latitudeIndex = 3;
  }

  if (longitudeIndex === -1) {
    longitudeIndex = 4;
  }


  console.log(
    "COLUMN INDEX:",
    {
      dateIndex,
      timeIndex,
      distanceIndex,
      latitudeIndex,
      longitudeIndex
    }
  );


  const results = [];


  for (
    let i =
      headerRowIndex + 1;

    i < rows.length;

    i++
  ) {

    const row =
      rows[i];

    if (
      !row ||
      row.length === 0
    ) {
      continue;
    }


    let dateText =
      String(
        row[dateIndex] || ""
      )
        .replace(/"/g, "")
        .trim();


    let timeText =
      String(
        row[timeIndex] || ""
      )
        .replace(/"/g, "")
        .trim();


    let distanceRaw =
      row[distanceIndex];

    let latitudeRaw =
      row[latitudeIndex];

    let longitudeRaw =
      row[longitudeIndex];


    // รองรับข้อมูลเก่า

    const oldDateTime =
      dateText.match(
        /^(\d{1,2}\/\d{1,2}\/\d{4})\s*,\s*(\d{1,2}:\d{2}(?::\d{2})?)$/
      );


    if (oldDateTime) {

      dateText =
        oldDateTime[1];

      timeText =
        oldDateTime[2];

      distanceRaw =
        row[1];

      latitudeRaw =
        row[2];

      longitudeRaw =
        row[3];

    }


    const timestamp =
      buildThaiTimestamp(
        dateText,
        timeText
      );


    if (!timestamp) {
      continue;
    }


    results.push({

      timestamp,

      level:
        parseNumberCell(
          distanceRaw
        ),

      latitude:
        parseNumberCell(
          latitudeRaw
        ),

      longitude:
        parseNumberCell(
          longitudeRaw
        )

    });
  }


  results.sort(
    (a, b) =>
      new Date(a.timestamp) -
      new Date(b.timestamp)
  );


  return results;
}


// ============================================================
// LOAD GOOGLE SHEET
// ============================================================

async function loadStation(station) {

  if (
    !station.deployed ||
    !station.googleSheetCsv
  ) {
    return [];
  }

  try {

    const separator =
      station.googleSheetCsv.includes("?")
        ? "&"
        : "?";


    const url =
      `${station.googleSheetCsv}${separator}_=${Date.now()}`;


    const response =
      await fetch(
        url,
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    const csvText =
      await response.text();


    return parseCsv(
      csvText
    );

  }

  catch (error) {

    console.error(
      station.id,
      error
    );

    return [];

  }
}


// ============================================================
// DATA HELPERS
// ============================================================

function latestReading(station) {

  const readings =
    state.data[
      station.id
    ] || [];

  return readings.length
    ? readings[
        readings.length - 1
      ]
    : null;
}


function latestLevelReading(station) {

  const readings =
    state.data[
      station.id
    ] || [];

  for (
    let i =
      readings.length - 1;

    i >= 0;

    i--
  ) {

    if (
      Number.isFinite(
        readings[i].level
      )
    ) {

      return readings[i];

    }
  }

  return null;
}


function getRange(station) {

  const levels =
    (
      state.data[
        station.id
      ] || []
    )
      .map(
        reading =>
          reading.level
      )
      .filter(
        Number.isFinite
      );

  if (!levels.length) {
    return null;
  }

  return {
    min:
      Math.min(...levels),

    max:
      Math.max(...levels)
  };
}


function getStatus(station) {

  if (!station.deployed) {

    return {
      className: "pending",
      text: "รอติดตั้ง"
    };

  }

  const reading =
    latestLevelReading(
      station
    );


  if (!reading) {

    return {
      className: "offline",
      text: "ไม่มีข้อมูล"
    };

  }


  if (
    Number.isFinite(
      station.warningLevel
    ) &&
    reading.level >=
      station.warningLevel
  ) {

    return {
      className: "warning",
      text: "เฝ้าระวัง"
    };

  }


  return {
    className: "normal",
    text: "ปกติ"
  };
}


// ============================================================
// CARDS
// ============================================================

function renderCards() {

  const container =
    $("#stationCards");

  if (!container) {
    return;
  }


  container.innerHTML =
    stations
      .map(
        (station, index) => {

          const reading =
            latestLevelReading(
              station
            );

          const range =
            getRange(
              station
            );

          const status =
            getStatus(
              station
            );


          const value =
            reading &&
            Number.isFinite(
              reading.level
            )
              ? reading.level.toFixed(3)
              : "—";


          return `

            <button
              class="
                station-card
                ${
                  station.id ===
                  state.selectedStationId
                    ? "selected"
                    : ""
                }
              "
              data-station-id="${station.id}"
              style="
                --station-color:${station.color};
                --station-soft:${station.softColor};
              "
            >

              <div class="station-card-top">

                <div
                  class="
                    station-status
                    ${status.className}
                  "
                >
                  <span></span>
                  ${status.text}
                </div>

                <div class="station-number">
                  ${index + 1}
                </div>

              </div>


              <div class="station-name">
                ${station.name}
              </div>


              <div class="station-main-value">

                ${value}

                <small>
                  ${station.unit}
                </small>

              </div>


              <div class="station-label">
                ระดับน้ำล่าสุด
              </div>


              <div class="station-stat-row">

                <div>
                  <span>ต่ำสุดทั้งหมด</span>

                  <strong>
                    ${
                      range
                        ? range.min.toFixed(3)
                        : "—"
                    }
                  </strong>
                </div>


                <div>
                  <span>สูงสุดทั้งหมด</span>

                  <strong>
                    ${
                      range
                        ? range.max.toFixed(3)
                        : "—"
                    }
                  </strong>
                </div>

              </div>


              <div class="station-update">

                ${
                  reading
                    ? "อัปเดต " +
                      formatDate(
                        reading.timestamp
                      )
                    : "ยังไม่มีข้อมูล"
                }

              </div>

            </button>

          `;

        }
      )
      .join("");


  document
    .querySelectorAll(
      "[data-station-id]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            state.selectedStationId =
              button.dataset.stationId;

            state.chartMode =
              "station";

            state.selectedDate =
              "";

            renderEverything(true);

          }
        );

      }
    );
}


// ============================================================
// STATION SELECT
// ============================================================

function renderStationSelect() {

  const select =
    $("#stationSelect");

  if (!select) {
    return;
  }

  select.innerHTML =
    stations
      .map(
        station =>
          `
            <option value="${station.id}">
              ${station.name}
            </option>
          `
      )
      .join("");

  select.value =
    state.selectedStationId;
}


// ============================================================
// DATES
// ============================================================

function getAvailableDates() {

  let readings = [];


  if (
    state.chartMode ===
    "all"
  ) {

    stations.forEach(
      station => {

        readings =
          readings.concat(
            state.data[
              station.id
            ] || []
          );

      }
    );

  }

  else {

    readings =
      state.data[
        state.selectedStationId
      ] || [];

  }


  return [
    ...new Set(
      readings
        .map(
          reading =>
            dateKey(
              reading.timestamp
            )
        )
        .filter(Boolean)
    )
  ].sort();
}


function renderDateInput() {

  const input =
    $("#dateInput");

  if (!input) {
    return;
  }


  const dates =
    getAvailableDates();


  if (!dates.length) {

    state.selectedDate = "";

    input.value = "";
    input.min = "";
    input.max = "";

    return;
  }


  if (
    !state.selectedDate ||
    !dates.includes(
      state.selectedDate
    )
  ) {

    state.selectedDate =
      dates[
        dates.length - 1
      ];

  }


  input.min =
    dates[0];

  input.max =
    dates[
      dates.length - 1
    ];

  input.value =
    state.selectedDate;
}


function changeDate(direction) {

  const dates =
    getAvailableDates();

  if (!dates.length) {
    return;
  }

  const index =
    dates.indexOf(
      state.selectedDate
    );

  if (index === -1) {
    return;
  }

  const nextIndex =
    Math.max(
      0,
      Math.min(
        dates.length - 1,
        index + direction
      )
    );

  state.selectedDate =
    dates[nextIndex];

  renderDateInput();
  renderSummary();
  renderChart();
  updateDownloadMenuInfo();
}


// ============================================================
// DATE FILTER
// ============================================================

function getReadingsForDate(
  stationId,
  selectedDate
) {

  return (
    state.data[
      stationId
    ] || []
  )
    .filter(
      reading =>
        dateKey(
          reading.timestamp
        ) === selectedDate &&
        Number.isFinite(
          reading.level
        )
    );
}


// ============================================================
// HOURLY AVERAGE
// ============================================================

function aggregateHourly(readings) {

  const buckets =
    Array.from(
      {
        length: 24
      },
      (_, hour) => ({
        hour,
        values: []
      })
    );


  readings.forEach(
    reading => {

      if (
        !Number.isFinite(
          reading.level
        )
      ) {
        return;
      }

      const hour =
        getThaiHour(
          reading.timestamp
        );

      if (hour === null) {
        return;
      }

      buckets[
        hour
      ].values.push(
        reading.level
      );

    }
  );


  return buckets.map(
    bucket => {

      if (!bucket.values.length) {

        return {
          hour: bucket.hour,
          average: null,
          min: null,
          max: null,
          count: 0
        };

      }


      const sum =
        bucket.values.reduce(
          (total, value) =>
            total + value,
          0
        );


      return {

        hour:
          bucket.hour,

        average:
          sum /
          bucket.values.length,

        min:
          Math.min(
            ...bucket.values
          ),

        max:
          Math.max(
            ...bucket.values
          ),

        count:
          bucket.values.length

      };

    }
  );
}


// ============================================================
// DAILY STATS
// ============================================================

function getDailyStats(
  stationId,
  selectedDate
) {

  const readings =
    getReadingsForDate(
      stationId,
      selectedDate
    );


  if (!readings.length) {
    return null;
  }


  const values =
    readings.map(
      reading =>
        reading.level
    );


  const latest =
    readings[
      readings.length - 1
    ];


  return {

    latest:
      latest.level,

    latestTime:
      latest.timestamp,

    min:
      Math.min(
        ...values
      ),

    max:
      Math.max(
        ...values
      ),

    average:
      values.reduce(
        (sum, value) =>
          sum + value,
        0
      ) /
      values.length,

    count:
      values.length

  };
}


// ============================================================
// SUMMARY
// ============================================================

function renderSummary() {

  const container =
    $("#chartSummary");

  if (!container) {
    return;
  }


  if (!state.selectedDate) {

    container.innerHTML = "";
    return;

  }


  // ALL STATIONS

  if (
    state.chartMode ===
    "all"
  ) {

    container.innerHTML =
      stations
        .map(
          station => {

            const stats =
              getDailyStats(
                station.id,
                state.selectedDate
              );


            return `

              <div
                class="summary-card summary-station"
                style="
                  --summary-color:${station.color};
                "
              >

                <div class="summary-color-line">
                </div>

                <div>

                  <span class="summary-title">
                    ${station.shortName}
                  </span>

                  <strong class="summary-big">

                    ${
                      stats
                        ? stats.latest.toFixed(3)
                        : "—"
                    }

                    <small>
                      ${station.unit}
                    </small>

                  </strong>

                  <span class="summary-description">

                    ${
                      stats
                        ? `เฉลี่ย ${stats.average.toFixed(3)} เมตร · ${stats.count} จุด`
                        : "ไม่มีข้อมูลในวันที่เลือก"
                    }

                  </span>

                </div>

              </div>

            `;

          }
        )
        .join("");

    return;
  }


  // SINGLE STATION

  const station =
    stations.find(
      station =>
        station.id ===
        state.selectedStationId
    );


  if (!station) {
    return;
  }


  const stats =
    getDailyStats(
      station.id,
      state.selectedDate
    );


  if (!stats) {

    container.innerHTML =
      `
        <div class="summary-empty">
          ยังไม่มีข้อมูลสำหรับวันที่เลือก
        </div>
      `;

    return;
  }


  const cards = [

    {
      icon: "◉",
      title: "ค่าล่าสุด",
      value: stats.latest,
      description:
        formatDate(
          stats.latestTime,
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )
    },

    {
      icon: "≈",
      title: "ค่าเฉลี่ย",
      value: stats.average,
      description:
        `${stats.count} จุดวัด`
    },

    {
      icon: "↓",
      title: "ต่ำสุด",
      value: stats.min,
      description:
        "ของวันที่เลือก"
    },

    {
      icon: "↑",
      title: "สูงสุด",
      value: stats.max,
      description:
        "ของวันที่เลือก"
    }

  ];


  container.innerHTML =
    cards
      .map(
        card =>
          `

            <div class="summary-card">

              <div class="summary-icon">
                ${card.icon}
              </div>

              <div>

                <span class="summary-title">
                  ${card.title}
                </span>

                <strong class="summary-big">

                  ${card.value.toFixed(3)}

                  <small>
                    ${station.unit}
                  </small>

                </strong>

                <span class="summary-description">
                  ${card.description}
                </span>

              </div>

            </div>

          `
      )
      .join("");
}


// ============================================================
// MODE BUTTONS
// ============================================================

function renderModeButtons() {

  $("#chartModeStation")
    ?.classList.toggle(
      "active",
      state.chartMode ===
        "station"
    );


  $("#chartModeAll")
    ?.classList.toggle(
      "active",
      state.chartMode ===
        "all"
    );
}


// ============================================================
// CHART
// ============================================================

function makeHourlyLabels() {

  return Array.from(
    {
      length: 24
    },
    (_, hour) =>
      `${String(hour).padStart(2, "0")}:00`
  );
}


function renderChart() {

  const canvas =
    $("#waterChart");

  if (!canvas) {
    return;
  }


  if (state.chart) {

    state.chart.destroy();
    state.chart = null;

  }


  const labels =
    makeHourlyLabels();


  const dark =
    document.documentElement
      .getAttribute(
        "data-theme"
      ) === "dark";


  const chartText =
    dark
      ? "#9fb5be"
      : "#8197a1";


  const chartGrid =
    dark
      ? "rgba(160,190,200,.09)"
      : "rgba(120,150,160,.12)";


  let datasets = [];


  // ==========================================================
  // ALL 3 STATIONS
  // ==========================================================

  if (
    state.chartMode ===
    "all"
  ) {

    $("#chartTitle").textContent =
      "เปรียบเทียบระดับน้ำทั้ง 3 สถานี";


    stations.forEach(
      station => {

        const readings =
          getReadingsForDate(
            station.id,
            state.selectedDate
          );


        const hourly =
          aggregateHourly(
            readings
          );


        datasets.push({

          label:
            station.shortName,

          data:
            hourly.map(
              item =>
                item.average
            ),

          borderColor:
            station.color,

          backgroundColor:
            station.color,

          borderWidth:
            3,

          tension:
            0.38,

          pointRadius:
            4,

          pointHoverRadius:
            8,

          pointBackgroundColor:
            dark
              ? "#10222c"
              : "#ffffff",

          pointBorderColor:
            station.color,

          pointBorderWidth:
            2,

          spanGaps:
            false

        });

      }
    );


    $("#chartNotice").textContent =
      "แต่ละจุดแสดงค่าเฉลี่ยของข้อมูลภายในชั่วโมงนั้น สามารถเปรียบเทียบทั้ง 3 สถานีได้ในกราฟเดียว";

  }


  // ==========================================================
  // SINGLE STATION
  // ==========================================================

  else {

    const station =
      stations.find(
        station =>
          station.id ===
          state.selectedStationId
      );


    if (!station) {
      return;
    }


    const readings =
      getReadingsForDate(
        station.id,
        state.selectedDate
      );


    const hourly =
      aggregateHourly(
        readings
      );


    $("#chartTitle").textContent =
      `ระดับน้ำ · ${station.shortName}`;


    const context =
      canvas.getContext("2d");


    const gradient =
      context.createLinearGradient(
        0,
        0,
        0,
        500
      );


    gradient.addColorStop(
      0,
      hexToRgba(
        station.color,
        dark
          ? 0.18
          : 0.27
      )
    );


    gradient.addColorStop(
      1,
      hexToRgba(
        station.color,
        0
      )
    );


    datasets = [

      {

        label:
          `${station.shortName} · เฉลี่ยรายชั่วโมง`,

        data:
          hourly.map(
            item =>
              item.average
          ),

        borderColor:
          station.color,

        backgroundColor:
          gradient,

        fill:
          true,

        borderWidth:
          3,

        tension:
          0.4,

        pointRadius:
          4,

        pointHoverRadius:
          9,

        pointBackgroundColor:
          dark
            ? "#10222c"
            : "#ffffff",

        pointBorderColor:
          station.color,

        pointBorderWidth:
          3,

        spanGaps:
          false

      },


      {

        label:
          "ระดับเฝ้าระวัง",

        data:
          labels.map(
            () =>
              station.warningLevel
          ),

        borderColor:
          "#f08a45",

        backgroundColor:
          "#f08a45",

        borderWidth:
          2,

        borderDash:
          [7, 7],

        pointRadius:
          0,

        tension:
          0

      }

    ];


    $("#chartNotice").textContent =
      readings.length
        ? `ข้อมูล ${readings.length} จุดวัด ถูกคำนวณเป็นค่าเฉลี่ยรายชั่วโมง · เส้นประสีส้มคือระดับเฝ้าระวัง`
        : "ยังไม่มีข้อมูลระดับน้ำสำหรับวันที่เลือก";

  }


  // DATE LABEL

  $("#chartDateLabel").textContent =
    state.selectedDate
      ? formatDate(
          `${state.selectedDate}T12:00:00+07:00`,
          {
            dateStyle: "full"
          }
        )
      : "ยังไม่มีข้อมูล";


  // CHART

  state.chart =
    new Chart(
      canvas,
      {

        type:
          "line",

        data: {
          labels,
          datasets
        },

        options: {

          responsive:
            true,

          maintainAspectRatio:
            false,

          interaction: {
            mode: "index",
            intersect: false
          },

          animation: {
            duration: 450,
            easing: "easeOutQuart"
          },

          plugins: {

            legend: {

              position: "top",
              align: "start",

              labels: {

                color:
                  chartText,

                usePointStyle:
                  true,

                pointStyle:
                  "circle",

                boxWidth:
                  8,

                boxHeight:
                  8,

                padding:
                  20,

                font: {
                  family:
                    "'Noto Sans Thai', sans-serif",
                  size: 11,
                  weight: "600"
                }

              }

            },


            tooltip: {

              backgroundColor:
                "rgba(8,30,42,.96)",

              titleColor:
                "#ffffff",

              bodyColor:
                "#e4eef2",

              borderColor:
                "rgba(255,255,255,.08)",

              borderWidth:
                1,

              padding:
                14,

              cornerRadius:
                12,

              displayColors:
                true,

              callbacks: {

                title:
                  items =>
                    items.length
                      ? `เวลา ${items[0].label} น.`
                      : "",


                label:
                  context => {

                    if (
                      context.raw === null ||
                      context.raw === undefined
                    ) {

                      return (
                        `${context.dataset.label}: ไม่มีข้อมูล`
                      );

                    }


                    return (
                      `${context.dataset.label}: ` +
                      `${Number(context.raw).toFixed(3)} เมตร`
                    );

                  }

              }

            }

          },


          scales: {

            y: {

              beginAtZero:
                true,

              border: {
                display: false
              },

              grid: {
                color: chartGrid
              },

              ticks: {

                color:
                  chartText,

                padding:
                  10,

                callback:
                  value =>
                    Number(value).toFixed(1)

              },

              title: {

                display:
                  true,

                text:
                  "ระดับน้ำ (เมตร)",

                color:
                  chartText

              }

            },


            x: {

              border: {
                display: false
              },

              grid: {
                display: false
              },

              ticks: {

                color:
                  chartText,

                autoSkip:
                  false,

                maxRotation:
                  0,

                padding:
                  10,

                callback:
                  function (
                    value,
                    index
                  ) {

                    return (
                      index % 2 === 0
                        ? labels[index]
                        : ""
                    );

                  }

              },

              title: {

                display:
                  true,

                text:
                  "เวลา (รายชั่วโมง)",

                color:
                  chartText

              }

            }

          }

        }

      }
    );
}


// ============================================================
// MAP MARKER
// ============================================================

function createMarkerIcon(
  station,
  selected
) {

  return L.divIcon({

    className:
      "custom-station-marker",

    html:
      `

        <div
          class="
            modern-map-marker
            ${
              selected
                ? "selected"
                : ""
            }
          "
          style="
            --marker-color:${station.color};
            --marker-soft:${hexToRgba(station.color, 0.22)};
          "
        >

          <div class="marker-radar">
          </div>

          <div class="marker-center">

            <div class="marker-center-dot">
            </div>

          </div>

        </div>

      `,

    iconSize:
      [54, 54],

    iconAnchor:
      [27, 27],

    popupAnchor:
      [0, -25]

  });
}


// ============================================================
// COORDINATES
// ============================================================

function getStationCoordinates(station) {

  const readings =
    state.data[
      station.id
    ] || [];


  for (
    let i =
      readings.length - 1;

    i >= 0;

    i--
  ) {

    const lat =
      Number(
        readings[i].latitude
      );

    const lng =
      Number(
        readings[i].longitude
      );


    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat !== 0 &&
      lng !== 0
    ) {

      return [
        lat,
        lng
      ];

    }

  }


  return [
    Number(station.latitude),
    Number(station.longitude)
  ];
}


// ============================================================
// MAP
// ============================================================

function setupMap() {

  if (state.map) {
    return;
  }


  const station =
    stations.find(
      station =>
        station.id ===
        state.selectedStationId
    ) || stations[0];


  const coords =
    getStationCoordinates(
      station
    );


  state.map =
    L.map(
      "map",
      {
        center: coords,
        zoom: 16,
        zoomControl: true
      }
    );


  // Satellite

  const satellite =
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles © Esri"
      }
    );


  // Street

  const street =
    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          "© OpenStreetMap contributors"
      }
    );


  satellite.addTo(
    state.map
  );


  L.control.layers(
    {
      "ดาวเทียม":
        satellite,

      "แผนที่":
        street
    },
    null,
    {
      collapsed: true,
      position: "topright"
    }
  ).addTo(
    state.map
  );


  renderMapMarkers();
}


// ============================================================
// MAP MARKERS
// ============================================================

function renderMapMarkers() {

  if (!state.map) {
    return;
  }


  state.markers.forEach(
    marker => {

      state.map.removeLayer(
        marker
      );

    }
  );


  state.markers = [];


  stations.forEach(
    station => {

      const coords =
        getStationCoordinates(
          station
        );


      const lat =
        Number(coords[0]);

      const lng =
        Number(coords[1]);


      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return;
      }


      const reading =
        latestLevelReading(
          station
        );


      const status =
        getStatus(
          station
        );


      const marker =
        L.marker(
          [lat, lng],
          {
            icon:
              createMarkerIcon(
                station,
                station.id ===
                  state.selectedStationId
              )
          }
        );


      marker.addTo(
        state.map
      );


      marker.bindPopup(
        `

          <div
            class="station-popup"
            style="
              --popup-color:${station.color};
            "
          >

            <div class="popup-header">

              <div class="popup-station-icon">
                <span></span>
              </div>

              <div>

                <strong>
                  ${station.name}
                </strong>

                <small>
                  ${status.text}
                </small>

              </div>

            </div>


            <div class="popup-level">

              <span>
                ระดับน้ำล่าสุด
              </span>

              <strong>

                ${
                  reading
                    ? reading.level.toFixed(3)
                    : "—"
                }

                <small>
                  ${station.unit}
                </small>

              </strong>

            </div>


            <div class="popup-grid">

              <div>

                <span>
                  LATITUDE
                </span>

                <strong>
                  ${lat.toFixed(6)}
                </strong>

              </div>


              <div>

                <span>
                  LONGITUDE
                </span>

                <strong>
                  ${lng.toFixed(6)}
                </strong>

              </div>

            </div>


            <div class="popup-footer">

              ${
                reading
                  ? "อัปเดต " +
                    formatDate(
                      reading.timestamp
                    )
                  : "ยังไม่มีข้อมูลล่าสุด"
              }

            </div>

          </div>

        `
      );


      marker.on(
        "click",
        () => {

          state.selectedStationId =
            station.id;

          state.chartMode =
            "station";

          state.selectedDate =
            "";

          renderCards();
          renderStationSelect();
          renderModeButtons();
          renderDateInput();
          renderSummary();
          renderChart();
          updateDownloadMenuInfo();

        }
      );


      state.markers.push(
        marker
      );

    }
  );
}


// ============================================================
// THEME
// ============================================================

function getPreferredTheme() {

  const saved =
    localStorage.getItem(
      "water-dashboard-theme"
    );


  if (
    saved === "dark" ||
    saved === "light"
  ) {

    return saved;

  }


  if (
    window.matchMedia &&
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches
  ) {

    return "dark";

  }


  return "light";
}


function applyTheme(theme) {

  document.documentElement
    .setAttribute(
      "data-theme",
      theme
    );


  localStorage.setItem(
    "water-dashboard-theme",
    theme
  );


  const icon =
    $("#themeIcon");

  const text =
    $("#themeText");


  if (theme === "dark") {

    if (icon) {
      icon.textContent = "☀";
    }

    if (text) {
      text.textContent = "สว่าง";
    }

  }

  else {

    if (icon) {
      icon.textContent = "☾";
    }

    if (text) {
      text.textContent = "มืด";
    }

  }


  if (
    Object.keys(
      state.data
    ).length > 0
  ) {

    renderChart();

  }
}


function toggleTheme() {

  const current =
    document.documentElement
      .getAttribute(
        "data-theme"
      ) || "light";


  applyTheme(
    current === "dark"
      ? "light"
      : "dark"
  );
}


$("#themeToggle")
  ?.addEventListener(
    "click",
    toggleTheme
  );


// ============================================================
// DOWNLOAD MENU
// ============================================================

const downloadMenuButton =
  $("#downloadMenuButton");

const downloadMenu =
  $("#downloadMenu");


function updateDownloadMenuInfo() {

  const station =
    stations.find(
      station =>
        station.id ===
        state.selectedStationId
    );


  const dateElement =
    $("#downloadCurrentDate");

  const stationElement =
    $("#downloadCurrentStation");


  if (dateElement) {

    if (state.selectedDate) {

      dateElement.textContent =
        formatDate(
          `${state.selectedDate}T12:00:00+07:00`,
          {
            day: "2-digit",
            month: "short",
            year: "numeric"
          }
        );

    }

    else {

      dateElement.textContent =
        "ข้อมูลทั้งหมด";

    }

  }


  if (stationElement) {

    stationElement.textContent =
      station
        ? station.name
        : "—";

  }
}


function openDownloadMenu() {

  if (!downloadMenu) {
    return;
  }


  updateDownloadMenuInfo();


  downloadMenu.classList.add(
    "show"
  );


  downloadMenuButton
    ?.setAttribute(
      "aria-expanded",
      "true"
    );
}


function closeDownloadMenu() {

  if (!downloadMenu) {
    return;
  }


  downloadMenu.classList.remove(
    "show"
  );


  downloadMenuButton
    ?.setAttribute(
      "aria-expanded",
      "false"
    );
}


downloadMenuButton
  ?.addEventListener(
    "click",
    event => {

      event.stopPropagation();


      if (
        downloadMenu
          ?.classList.contains(
            "show"
          )
      ) {

        closeDownloadMenu();

      }

      else {

        openDownloadMenu();

      }

    }
  );


$("#closeDownloadMenu")
  ?.addEventListener(
    "click",
    event => {

      event.stopPropagation();
      closeDownloadMenu();

    }
  );


downloadMenu
  ?.addEventListener(
    "click",
    event => {

      event.stopPropagation();

    }
  );


document.addEventListener(
  "click",
  closeDownloadMenu
);


document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape"
    ) {

      closeDownloadMenu();

    }

  }
);


// ============================================================
// DOWNLOAD HELPERS
// ============================================================

function csvCell(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return '""';

  }


  return (
    '"' +
    String(value)
      .replace(
        /"/g,
        '""'
      ) +
    '"'
  );
}


function downloadBlob(
  content,
  filename,
  mimeType
) {

  const blob =
    new Blob(
      [content],
      {
        type: mimeType
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;

  link.download =
    filename;

  link.style.display =
    "none";


  document.body.appendChild(
    link
  );


  link.click();
  link.remove();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        url
      );

    },
    1000
  );
}


function exportDate(timestamp) {

  const date =
    new Date(timestamp);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return new Intl.DateTimeFormat(
    "th-TH",
    {
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(date);
}


function exportTime(timestamp) {

  const date =
    new Date(timestamp);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return new Intl.DateTimeFormat(
    "th-TH",
    {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }
  ).format(date);
}


function safeFileName(text) {

  return String(
    text || "data"
  )
    .replace(
      /[\\/:*?"<>|]/g,
      "-"
    )
    .replace(
      /\s+/g,
      "-"
    );
}


function getExportReadings(station) {

  let readings =
    state.data[
      station.id
    ] || [];


  if (state.selectedDate) {

    readings =
      readings.filter(
        reading =>
          dateKey(
            reading.timestamp
          ) ===
          state.selectedDate
      );

  }


  return readings;
}


function createStationCsv(
  station,
  readings
) {

  const rows = [

    [
      "สถานี",
      "วันที่",
      "เวลา",
      "ระดับน้ำ (m)",
      "Latitude",
      "Longitude"
    ]

  ];


  readings.forEach(
    reading => {

      rows.push([

        station.name,

        exportDate(
          reading.timestamp
        ),

        exportTime(
          reading.timestamp
        ),

        Number.isFinite(
          reading.level
        )
          ? reading.level.toFixed(3)
          : "",

        Number.isFinite(
          reading.latitude
        )
          ? reading.latitude.toFixed(6)
          : "",

        Number.isFinite(
          reading.longitude
        )
          ? reading.longitude.toFixed(6)
          : ""

      ]);

    }
  );


  return rows
    .map(
      row =>
        row
          .map(csvCell)
          .join(",")
    )
    .join("\r\n");
}


// ============================================================
// DOWNLOAD SELECTED
// ============================================================

$("#downloadSelectedCsv")
  ?.addEventListener(
    "click",
    () => {

      const station =
        stations.find(
          station =>
            station.id ===
            state.selectedStationId
        );


      if (!station) {

        alert(
          "ไม่พบข้อมูลสถานี"
        );

        return;

      }


      const readings =
        getExportReadings(
          station
        );


      if (!readings.length) {

        alert(
          "ไม่มีข้อมูลของสถานีนี้ในวันที่เลือก"
        );

        return;

      }


      const csv =
        createStationCsv(
          station,
          readings
        );


      const filename =
        safeFileName(
          `${
            station.shortName ||
            station.name
          }-${
            state.selectedDate ||
            "all"
          }`
        ) +
        ".csv";


      downloadBlob(
        "\uFEFF" + csv,
        filename,
        "text/csv;charset=utf-8"
      );


      closeDownloadMenu();

    }
  );


// ============================================================
// DOWNLOAD ALL STATIONS
// ============================================================

$("#downloadAllCsv")
  ?.addEventListener(
    "click",
    () => {

      const rows = [

        [
          "สถานี",
          "วันที่",
          "เวลา",
          "ระดับน้ำ (m)",
          "Latitude",
          "Longitude"
        ]

      ];


      let totalRecords = 0;


      stations.forEach(
        station => {

          const readings =
            getExportReadings(
              station
            );


          readings.forEach(
            reading => {

              totalRecords++;


              rows.push([

                station.name,

                exportDate(
                  reading.timestamp
                ),

                exportTime(
                  reading.timestamp
                ),

                Number.isFinite(
                  reading.level
                )
                  ? reading.level.toFixed(3)
                  : "",

                Number.isFinite(
                  reading.latitude
                )
                  ? reading.latitude.toFixed(6)
                  : "",

                Number.isFinite(
                  reading.longitude
                )
                  ? reading.longitude.toFixed(6)
                  : ""

              ]);

            }
          );

        }
      );


      if (
        totalRecords === 0
      ) {

        alert(
          "ไม่มีข้อมูลสำหรับวันที่เลือก"
        );

        return;

      }


      const csv =
        rows
          .map(
            row =>
              row
                .map(csvCell)
                .join(",")
          )
          .join("\r\n");


      downloadBlob(
        "\uFEFF" + csv,
        `water-monitoring-${state.selectedDate || "all"}.csv`,
        "text/csv;charset=utf-8"
      );


      closeDownloadMenu();

    }
  );


// ============================================================
// DOWNLOAD SUMMARY
// ============================================================

$("#downloadSummaryCsv")
  ?.addEventListener(
    "click",
    () => {

      if (!state.selectedDate) {

        alert(
          "กรุณาเลือกวันที่ก่อนดาวน์โหลดสรุปรายวัน"
        );

        return;

      }


      const rows = [

        [
          "สถานี",
          "วันที่",
          "ค่าล่าสุด (m)",
          "ค่าเฉลี่ย (m)",
          "ต่ำสุด (m)",
          "สูงสุด (m)",
          "จำนวนข้อมูล"
        ]

      ];


      let hasData = false;


      stations.forEach(
        station => {

          const stats =
            getDailyStats(
              station.id,
              state.selectedDate
            );


          if (stats) {
            hasData = true;
          }


          rows.push([

            station.name,

            state.selectedDate,

            stats
              ? stats.latest.toFixed(3)
              : "",

            stats
              ? stats.average.toFixed(3)
              : "",

            stats
              ? stats.min.toFixed(3)
              : "",

            stats
              ? stats.max.toFixed(3)
              : "",

            stats
              ? stats.count
              : 0

          ]);

        }
      );


      if (!hasData) {

        alert(
          "ไม่มีข้อมูลสำหรับวันที่เลือก"
        );

        return;

      }


      const csv =
        rows
          .map(
            row =>
              row
                .map(csvCell)
                .join(",")
          )
          .join("\r\n");


      downloadBlob(
        "\uFEFF" + csv,
        `water-summary-${state.selectedDate}.csv`,
        "text/csv;charset=utf-8"
      );


      closeDownloadMenu();

    }
  );


// ============================================================
// JSON BACKUP
// ============================================================

$("#downloadJson")
  ?.addEventListener(
    "click",
    () => {

      const backupData = {

        system:
          "RMUTL Flood Monitoring",

        exportedAt:
          new Date()
            .toISOString(),

        timezone:
          "Asia/Bangkok",

        selectedDate:
          state.selectedDate || null,

        selectedStation:
          state.selectedStationId,

        stations:
          stations.map(
            station => ({

              id:
                station.id,

              name:
                station.name,

              shortName:
                station.shortName,

              unit:
                station.unit,

              warningLevel:
                station.warningLevel,

              readings:
                state.data[
                  station.id
                ] || []

            })
          )

      };


      const json =
        JSON.stringify(
          backupData,
          null,
          2
        );


      const today =
        dateKey(
          new Date()
        ) || "backup";


      downloadBlob(
        json,
        `water-monitoring-backup-${today}.json`,
        "application/json;charset=utf-8"
      );


      closeDownloadMenu();

    }
  );


// ============================================================
// RENDER EVERYTHING
// ============================================================

function renderEverything(
  moveMap = false
) {

  renderCards();
  renderStationSelect();
  renderModeButtons();
  renderDateInput();
  renderSummary();
  renderChart();
  updateDownloadMenuInfo();


  if (!state.map) {

    setupMap();

  }

  else {

    renderMapMarkers();

  }


  if (
    moveMap &&
    state.map
  ) {

    const station =
      stations.find(
        station =>
          station.id ===
          state.selectedStationId
      );


    if (station) {

      const coords =
        getStationCoordinates(
          station
        );


      if (
        Number.isFinite(
          coords[0]
        ) &&
        Number.isFinite(
          coords[1]
        )
      ) {

        state.map.flyTo(
          coords,
          16,
          {
            duration: 0.7
          }
        );

      }

    }

  }
}


// ============================================================
// REFRESH GOOGLE SHEETS
// ============================================================

async function refreshData() {

  const globalUpdated =
    $("#globalUpdated");


  if (globalUpdated) {

    globalUpdated.textContent =
      "กำลังโหลดข้อมูล...";

  }


  await Promise.all(
    stations.map(
      async station => {

        state.data[
          station.id
        ] =
          await loadStation(
            station
          );

      }
    )
  );


  renderEverything();


  const newest =
    stations
      .map(
        station =>
          latestReading(
            station
          )
      )
      .filter(
        reading =>
          reading &&
          reading.timestamp &&
          !Number.isNaN(
            new Date(
              reading.timestamp
            ).getTime()
          )
      )
      .sort(
        (a, b) =>
          new Date(
            b.timestamp
          ) -
          new Date(
            a.timestamp
          )
      )[0];


  if (globalUpdated) {

    globalUpdated.textContent =
      newest
        ? `ข้อมูลล่าสุด · ${formatDate(newest.timestamp)}`
        : "ยังไม่มีข้อมูลจากสถานี";

  }
}


// ============================================================
// EVENTS
// ============================================================

$("#stationSelect")
  ?.addEventListener(
    "change",
    event => {

      state.selectedStationId =
        event.target.value;

      state.chartMode =
        "station";

      state.selectedDate =
        "";

      renderEverything(true);

    }
  );


$("#dateInput")
  ?.addEventListener(
    "change",
    event => {

      state.selectedDate =
        event.target.value;

      renderSummary();
      renderChart();
      updateDownloadMenuInfo();

    }
  );


$("#chartModeStation")
  ?.addEventListener(
    "click",
    () => {

      state.chartMode =
        "station";

      state.selectedDate =
        "";

      renderModeButtons();
      renderDateInput();
      renderSummary();
      renderChart();
      updateDownloadMenuInfo();

    }
  );


$("#chartModeAll")
  ?.addEventListener(
    "click",
    () => {

      state.chartMode =
        "all";

      state.selectedDate =
        "";

      renderModeButtons();
      renderDateInput();
      renderSummary();
      renderChart();
      updateDownloadMenuInfo();

    }
  );


$("#previousDate")
  ?.addEventListener(
    "click",
    () => {

      changeDate(-1);

    }
  );


$("#nextDate")
  ?.addEventListener(
    "click",
    () => {

      changeDate(1);

    }
  );


$("#refreshButton")
  ?.addEventListener(
    "click",
    () => {

      refreshData();

    }
  );


// ============================================================
// CLOCK
// ============================================================

function updateClock() {

  const clock =
    $("#liveClock");

  if (!clock) {
    return;
  }


  try {

    clock.textContent =
      new Intl.DateTimeFormat(
        "th-TH",
        {
          timeZone:
            "Asia/Bangkok",

          dateStyle:
            "medium",

          timeStyle:
            "medium"
        }
      ).format(
        new Date()
      );

  }

  catch (error) {

    clock.textContent =
      "—";

  }
}


// ============================================================
// START
// ============================================================

applyTheme(
  getPreferredTheme()
);


updateClock();


setInterval(
  updateClock,
  1000
);


// เว็บดึง Google Sheet ใหม่ทุก 1 นาที

setInterval(
  refreshData,
  60000
);


refreshData();
