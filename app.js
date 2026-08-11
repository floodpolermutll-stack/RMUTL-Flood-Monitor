// ============================================================
// WATER LEVEL MONITORING DASHBOARD
// app.js
// ============================================================

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
  const color = String(hex || "#000000").replace("#", "");
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
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  try {
    const dateOptions = options || {
      dateStyle: "medium",
      timeStyle: "short",
    };

    return new Intl.DateTimeFormat("th-TH", {
      ...dateOptions,
      timeZone: "Asia/Bangkok",
    }).format(date);

  } catch (error) {
    console.warn("formatDate error:", value, error);
    return "—";
  }
}


function dateKey(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year =
      parts.find((p) => p.type === "year")?.value;

    const month =
      parts.find((p) => p.type === "month")?.value;

    const day =
      parts.find((p) => p.type === "day")?.value;

    if (!year || !month || !day) {
      return "";
    }

    return `${year}-${month}-${day}`;

  } catch (error) {
    console.warn("dateKey error:", value, error);
    return "";
  }
}


function normalizeTimeText(value) {
  const time = String(value || "")
    .replace(/"/g, "")
    .trim();

  if (!time) {
    return "00:00:00";
  }

  const match = time.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return "00:00:00";
  }

  const hour =
    String(match[1]).padStart(2, "0");

  const minute =
    String(match[2]).padStart(2, "0");

  const second =
    String(match[3] || "00").padStart(2, "0");

  return `${hour}:${minute}:${second}`;
}


function buildThaiTimestamp(dateText, timeText) {

  let date = String(dateText || "")
    .replace(/"/g, "")
    .trim();

  let time = String(timeText || "")
    .replace(/"/g, "")
    .trim();


  if (!date) {
    return null;
  }


  // ----------------------------------------------------------
  // กรณีวันที่และเวลาอยู่รวมกัน
  // เช่น 10/8/2026, 14:23:16
  // ----------------------------------------------------------

  const combined = date.match(
    /^(\d{1,2}\/\d{1,2}\/\d{4})\s*,\s*(\d{1,2}:\d{2}(?::\d{2})?)$/
  );

  if (combined) {
    date = combined[1];
    time = combined[2];
  }


  time = normalizeTimeText(time);


  // ----------------------------------------------------------
  // DD/MM/YYYY
  // ----------------------------------------------------------

  let match = date.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (match) {

    const day =
      String(match[1]).padStart(2, "0");

    const month =
      String(match[2]).padStart(2, "0");

    const year =
      String(match[3]);

    const timestamp =
      `${year}-${month}-${day}T${time}+07:00`;

    const test =
      new Date(timestamp);

    if (Number.isNaN(test.getTime())) {
      return null;
    }

    return timestamp;
  }


  // ----------------------------------------------------------
  // YYYY-MM-DD
  // ----------------------------------------------------------

  match = date.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  );

  if (match) {

    const year =
      String(match[1]);

    const month =
      String(match[2]).padStart(2, "0");

    const day =
      String(match[3]).padStart(2, "0");

    const timestamp =
      `${year}-${month}-${day}T${time}+07:00`;

    const test =
      new Date(timestamp);

    if (Number.isNaN(test.getTime())) {
      return null;
    }

    return timestamp;
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

      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i++;
      }

      else {
        insideQuotes = !insideQuotes;
      }
    }

    else if (
      char === "," &&
      !insideQuotes
    ) {

      cells.push(current.trim());
      current = "";
    }

    else {
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


function parseNumberCell(value) {

  let raw = String(value ?? "")
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


  raw = raw.replace(",", ".");


  const number = Number(raw);


  if (!Number.isFinite(number)) {
    return null;
  }


  return number;
}


// ============================================================
// PARSE GOOGLE SHEET CSV
// ============================================================

function parseCsv(csvText) {

  if (!csvText || !csvText.trim()) {
    return [];
  }


  const rows = csvText
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map(splitCsvLine);


  let headerRowIndex = -1;


  // ==========================================================
  // หาแถว Header
  // ==========================================================

  for (let i = 0; i < rows.length; i++) {

    const headers =
      rows[i].map(normalizeHeader);

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


  if (headerRowIndex === -1) {

    console.error(
      "ไม่พบหัวตาราง Google Sheet",
      rows
    );

    return [];
  }


  const headers =
    rows[headerRowIndex]
      .map(normalizeHeader);


  // ==========================================================
  // หา Column
  // ==========================================================

  let dateIndex =
    headers.findIndex(
      (h) =>
        h.includes("วันที่") ||
        h === "date"
    );


  let timeIndex =
    headers.findIndex(
      (h) =>
        h.includes("เวลา") ||
        h === "time"
    );


  // ==========================================================
  // สำคัญ:
  // รองรับ "ระยะน้ำ (m)"
  // ==========================================================

  let distanceIndex =
    headers.findIndex(
      (h) =>
        h.includes("ระยะน้ำ") ||
        h.includes("ระยะทาง") ||
        h.includes("ระดับน้ำ") ||
        h.includes("distance") ||
        h.includes("water_level") ||
        h.includes("water level") ||
        h === "level"
    );


  let latitudeIndex =
    headers.findIndex(
      (h) =>
        h.includes("latitude") ||
        h === "lat"
    );


  let longitudeIndex =
    headers.findIndex(
      (h) =>
        h.includes("longitude") ||
        h === "lng" ||
        h === "lon"
    );


  // ==========================================================
  // FALLBACK
  //
  // โครงสร้าง Sheet:
  //
  // A = วันที่
  // B = เวลา
  // C = ระยะน้ำ (m)
  // D = Latitude
  // E = Longitude
  // ==========================================================

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
    "HEADERS:",
    headers
  );


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


  // ==========================================================
  // อ่านแต่ละแถว
  // ==========================================================

  for (
    let i = headerRowIndex + 1;
    i < rows.length;
    i++
  ) {

    const row = rows[i];


    if (!row || row.length === 0) {
      continue;
    }


    let dateText =
      String(row[dateIndex] || "")
        .replace(/"/g, "")
        .trim();


    let timeText =
      String(row[timeIndex] || "")
        .replace(/"/g, "")
        .trim();


    let distanceRaw =
      row[distanceIndex];


    let latitudeRaw =
      row[latitudeIndex];


    let longitudeRaw =
      row[longitudeIndex];


    // ========================================================
    // รองรับข้อมูลเก่า
    //
    // A = 10/8/2026, 14:23:16
    // B = 5.513
    // C = 18.362801
    // D = 99.582278
    // ========================================================

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


    if (!dateText) {
      continue;
    }


    // ========================================================
    // Timestamp
    // ========================================================

    const timestamp =
      buildThaiTimestamp(
        dateText,
        timeText
      );


    if (!timestamp) {

      console.warn(
        "ข้ามแถว วันที่/เวลาไม่ถูกต้อง:",
        row
      );

      continue;
    }


    // ========================================================
    // ระยะน้ำ
    // ========================================================

    const level =
      parseNumberCell(
        distanceRaw
      );


    // ========================================================
    // GPS
    // ========================================================

    const latitude =
      parseNumberCell(
        latitudeRaw
      );


    const longitude =
      parseNumberCell(
        longitudeRaw
      );


    results.push({
      timestamp,
      level,
      latitude,
      longitude
    });
  }


  // ==========================================================
  // เรียงเก่า -> ใหม่
  // ==========================================================

  results.sort(
    (a, b) =>
      new Date(a.timestamp) -
      new Date(b.timestamp)
  );


  console.log(
    "PARSED DATA:",
    results
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

    const url =
      `${station.googleSheetCsv}${
        station.googleSheetCsv.includes("?")
          ? "&"
          : "?"
      }_=${Date.now()}`;


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


    console.log(
      `โหลด ${station.id} สำเร็จ`
    );


    return parseCsv(
      csvText
    );

  }

  catch (error) {

    console.error(
      `โหลด ${station.name} ไม่สำเร็จ:`,
      error
    );


    return [];
  }
}


// ============================================================
// LATEST DATA
// ============================================================

function latestReading(station) {

  const readings =
    state.data[
      station.id
    ] || [];


  if (readings.length === 0) {
    return null;
  }


  return readings[
    readings.length - 1
  ];
}


function latestLevelReading(station) {

  const readings =
    state.data[
      station.id
    ] || [];


  for (
    let i = readings.length - 1;
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


// ============================================================
// MIN / MAX
// ============================================================

function getRange(station) {

  const readings =
    state.data[
      station.id
    ] || [];


  const levels =
    readings
      .map(
        (reading) =>
          reading.level
      )
      .filter(
        (level) =>
          Number.isFinite(level)
      );


  if (levels.length === 0) {
    return null;
  }


  return {

    min:
      Math.min(...levels),

    max:
      Math.max(...levels)

  };
}


// ============================================================
// STATUS
// ============================================================

function getStatus(
  station,
  reading
) {

  if (!station.deployed) {

    return {
      className: "pending",
      text: "รอติดตั้ง"
    };
  }


  if (!reading) {

    return {
      className: "offline",
      text: "ยังไม่มีข้อมูล"
    };
  }


  if (
    Number.isFinite(
      reading.level
    ) &&
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
// STATION CARDS
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
        (station) => {

          const latest =
            latestReading(
              station
            );


          const levelReading =
            latestLevelReading(
              station
            );


          const range =
            getRange(
              station
            );


          const status =
            getStatus(
              station,
              latest
            );


          // ==================================================
          // ค่า Level ล่าสุด
          // ==================================================

          const levelText =
            levelReading &&
            Number.isFinite(
              levelReading.level
            )

              ? `${levelReading.level.toFixed(3)}
                 <small>${station.unit}</small>`

              : `—
                 <small>${station.unit}</small>`;


          const updateText =
            latest &&
            latest.timestamp

              ? `อัปเดต ${formatDate(
                  latest.timestamp
                )}`

              : "ยังไม่มีข้อมูล";


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

              <span
                class="
                  status
                  ${status.className}
                "
              >
                ${status.text}
              </span>


              <h2>
                ${station.name}
              </h2>


              <strong>
                ${levelText}
              </strong>


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


              <p>
                ${updateText}
              </p>

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
      (button) => {

        button.addEventListener(
          "click",
          () => {

            selectStation(
              button.dataset.stationId
            );

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
// DATE INPUT
// ============================================================

function renderDateInput() {

  const readings =
    state.data[
      state.selectedStationId
    ] || [];


  const dates =
    [
      ...new Set(

        readings
          .map(
            (reading) =>
              dateKey(
                reading.timestamp
              )
          )
          .filter(Boolean)

      ),
    ].sort();


  const input =
    $("#dateInput");


  if (!input) {
    return;
  }


  if (dates.length === 0) {

    input.value = "";
    input.min = "";
    input.max = "";

    state.selectedDate = "";

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


// ============================================================
// CHART
// ============================================================

function renderChart() {

  const station =
    stations.find(
      (item) =>
        item.id ===
        state.selectedStationId
    );


  if (!station) {
    return;
  }


  const readings =
    (
      state.data[
        station.id
      ] || []
    )

      .filter(
        (reading) =>
          dateKey(
            reading.timestamp
          ) ===
          state.selectedDate
      )

      .filter(
        (reading) =>
          Number.isFinite(
            reading.level
          )
      );


  const title =
    $("#chartTitle");


  if (title) {

    title.textContent =
      `กราฟระดับน้ำ: ${station.shortName}`;
  }


  const dateLabel =
    $("#chartDateLabel");


  if (dateLabel) {

    dateLabel.textContent =
      state.selectedDate

        ? formatDate(
            `${state.selectedDate}T12:00:00+07:00`,
            {
              dateStyle: "full"
            }
          )

        : "ยังไม่มีข้อมูล";
  }


  const unitLabel =
    $("#unitLabel");


  if (unitLabel) {

    unitLabel.textContent =
      station.unit;
  }


  const notice =
    $("#chartNotice");


  if (notice) {

    notice.textContent =
      readings.length > 0

        ? "ชี้หรือแตะจุดบนกราฟเพื่อดูรายละเอียด"

        : "ยังไม่มีข้อมูลระดับน้ำสำหรับวันที่เลือก";
  }


  if (state.chart) {

    state.chart.destroy();

    state.chart = null;
  }


  const canvas =
    $("#waterChart");


  if (!canvas) {
    return;
  }


  const levels =
    readings.map(
      (reading) =>
        reading.level
    );


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
                    second: "2-digit"
                  }
                )
            ),


          datasets: [

            {

              label:
                `ระดับน้ำ - ${station.shortName}`,

              data:
                levels,

              borderColor:
                station.color,

              backgroundColor:
                gradient,

              fill:
                true,

              borderWidth:
                3,

              tension:
                0.35,

              pointRadius:
                4,

              pointHoverRadius:
                7
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

              borderWidth:
                2,

              pointRadius:
                0
            }

          ]
        },


        options: {

          responsive: true,

          maintainAspectRatio: false,


          interaction: {

            mode: "index",

            intersect: false

          },


          plugins: {

            legend: {

              position: "top"

            }

          },


          scales: {

            y: {

              beginAtZero: true,

              title: {

                display: true,

                text:
                  station.unit

              }

            },


            x: {

              grid: {

                display: false

              }

            }

          }

        }

      }
    );
}


// ============================================================
// MAP MARKER ICON
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
      [0, -17]

  });
}


// ============================================================
// GPS ล่าสุดจาก GOOGLE SHEET
// ============================================================

function getStationCoordinates(station) {

  const readings =
    state.data[
      station.id
    ] || [];


  for (
    let i = readings.length - 1;
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


  // ถ้ายังไม่มี GPS จาก Sheet
  // ใช้ค่าจาก config.js

  return [

    Number(
      station.latitude
    ),

    Number(
      station.longitude
    )

  ];
}


// ============================================================
// SETUP MAP
// ============================================================

function setupMap() {

  if (state.map) {
    return;
  }


  const station =
    stations.find(
      (item) =>
        item.id ===
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

        center:
          coords,

        zoom:
          16,

        zoomControl:
          true

      }
    );


  // ==========================================================
  // SATELLITE
  // ==========================================================

  const satellite =
    L.tileLayer(

      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

      {

        maxZoom:
          19,

        attribution:
          "Tiles © Esri, Maxar, Earthstar Geographics"

      }

    );


  // ==========================================================
  // STREET MAP
  // ==========================================================

  const street =
    L.tileLayer(

      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

      {

        maxZoom:
          19,

        attribution:
          "© OpenStreetMap contributors"

      }

    );


  // ดาวเทียมเป็นค่าเริ่มต้น
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

      position:
        "topright",

      collapsed:
        false

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


  // ลบ Marker เก่า

  state.markers.forEach(
    (marker) => {

      state.map.removeLayer(
        marker
      );

    }
  );


  state.markers = [];


  stations.forEach(
    (station) => {

      const latest =
        latestReading(
          station
        );


      const levelReading =
        latestLevelReading(
          station
        );


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


      const status =
        getStatus(
          station,
          latest
        );


      const levelText =
        levelReading &&
        Number.isFinite(
          levelReading.level
        )

          ? `ระดับน้ำ:
             ${levelReading.level.toFixed(3)}
             ${station.unit}`

          : "ยังไม่มีข้อมูลระดับน้ำ";


      const updateText =
        latest &&
        latest.timestamp

          ? `อัปเดต:
             ${formatDate(
               latest.timestamp
             )}`

          : "ยังไม่มีข้อมูลเวลา";


      const marker =
        L.marker(

          [
            lat,
            lng
          ],

          {

            icon:
              createMarkerIcon(
                station
              )

          }

        );


      marker.addTo(
        state.map
      );


      marker.bindPopup(`

        <div
          style="
            min-width:220px;
            line-height:1.7;
          "
        >

          <strong>
            ${station.name}
          </strong>

          <br>

          สถานะ:
          ${status.text}

          <br>

          ${levelText}

          <br>

          ${updateText}

          <hr>

          Latitude:
          ${lat.toFixed(6)}

          <br>

          Longitude:
          ${lng.toFixed(6)}

        </div>

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


  state.selectedDate =
    "";


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


  if (
    state.map &&
    Number.isFinite(
      Number(coords[0])
    ) &&
    Number.isFinite(
      Number(coords[1])
    )
  ) {

    state.map.flyTo(

      coords,

      17,

      {
        duration:
          1
      }

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


  const dates =
    [
      ...new Set(

        readings
          .map(
            (reading) =>
              dateKey(
                reading.timestamp
              )
          )
          .filter(Boolean)

      ),
    ].sort();


  if (dates.length === 0) {
    return;
  }


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

  const clock =
    $("#liveClock");


  if (!clock) {
    return;
  }


  try {

    clock.textContent =
      `เวลาปัจจุบัน ${
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
        )
      }`;

  }

  catch (error) {

    clock.textContent =
      "เวลาปัจจุบัน";

  }
}


// ============================================================
// REFRESH DATA
// ============================================================

async function refreshData() {

  const globalUpdated =
    $("#globalUpdated");


  if (globalUpdated) {

    globalUpdated.textContent =
      "กำลังโหลดข้อมูล…";
  }


  // ==========================================================
  // โหลดทั้ง 3 สถานี
  // ==========================================================

  await Promise.all(

    stations.map(

      async (station) => {

        state.data[
          station.id
        ] =
          await loadStation(
            station
          );

      }

    )

  );


  // ==========================================================
  // DEBUG
  // ==========================================================

  console.log(
    "STATE DATA:",
    state.data
  );


  // ==========================================================
  // Render
  // ==========================================================

  renderCards();

  renderStationSelect();

  renderDateInput();

  renderChart();


  if (!state.map) {

    setupMap();

  }

  else {

    renderMapMarkers();

  }


  // ==========================================================
  // หาเวลาข้อมูลล่าสุด
  // ==========================================================

  const newest =
    stations

      .map(
        (station) =>
          latestReading(
            station
          )
      )

      .filter(
        (reading) => {

          if (
            !reading ||
            !reading.timestamp
          ) {
            return false;
          }


          const date =
            new Date(
              reading.timestamp
            );


          return !Number.isNaN(
            date.getTime()
          );

        }
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

        ? `ข้อมูลล่าสุด ${
            formatDate(
              newest.timestamp
            )
          }`

        : "ยังไม่มีข้อมูลจากสถานี";
  }
}


// ============================================================
// EVENTS
// ============================================================

const stationSelect =
  $("#stationSelect");


if (stationSelect) {

  stationSelect.addEventListener(

    "change",

    (event) => {

      selectStation(
        event.target.value
      );

    }

  );
}


const dateInput =
  $("#dateInput");


if (dateInput) {

  dateInput.addEventListener(

    "change",

    (event) => {

      state.selectedDate =
        event.target.value;


      renderChart();

    }

  );
}


const previousDate =
  $("#previousDate");


if (previousDate) {

  previousDate.addEventListener(

    "click",

    () => {

      changeDate(-1);

    }

  );
}


const nextDate =
  $("#nextDate");


if (nextDate) {

  nextDate.addEventListener(

    "click",

    () => {

      changeDate(1);

    }

  );
}


const refreshButton =
  $("#refreshButton");


if (refreshButton) {

  refreshButton.addEventListener(

    "click",

    () => {

      refreshData();

    }

  );
}


// ============================================================
// START
// ============================================================

updateClock();


// นาฬิกาทุก 1 วินาที
setInterval(
  updateClock,
  1000
);


// โหลดข้อมูลใหม่ทุก 1 นาที
setInterval(
  refreshData,
  60000
);


// โหลดครั้งแรก
refreshData();
