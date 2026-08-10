// ============================================================
// RMUTL WATER FLOOD MONITORING
// app.js
// รองรับ Google Sheet:
// วันที่ | เวลา | ระยะทาง (m) | Latitude | Longitude
// ============================================================


// ============================================================
// CONFIG
// ============================================================

const stations = window.WATER_APP_CONFIG.stations;


// ============================================================
// STATE
// ============================================================

const state = {
  selectedStationId: stations[0].id,
  selectedDate: "",

  data: {},

  chart: null,

  map: null,

  // แก้ Error: Cannot read properties of undefined (reading 'push')
  markers: [],
};


// ============================================================
// DOM HELPER
// ============================================================

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

// บังคับแสดงเวลาไทย
function formatDate(value, options) {

  const dateOptions = options || {
    dateStyle: "medium",
    timeStyle: "short",
  };

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      ...dateOptions,

      timeZone: "Asia/Bangkok",
    }
  ).format(new Date(value));
}


// ------------------------------------------------------------
// วันที่สำหรับกราฟ
// คืนค่า YYYY-MM-DD ตามเวลาไทย
// ------------------------------------------------------------

function dateKey(value) {

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Bangkok",

      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(date);

  const year =
    parts.find((part) => part.type === "year")?.value || "";

  const month =
    parts.find((part) => part.type === "month")?.value || "";

  const day =
    parts.find((part) => part.type === "day")?.value || "";

  return `${year}-${month}-${day}`;
}


// ============================================================
// แปลงวันที่จาก Google Sheet
//
// ตัวอย่าง:
// 10/08/2026 + 21:30:10
//
// =>
//
// 2026-08-10T21:30:10+07:00
// ============================================================

function buildThaiTimestamp(dateText, timeText) {

  if (!dateText) {
    return null;
  }

  const text = String(dateText).trim();

  const time = String(timeText || "00:00:00").trim();

  // รองรับ dd/MM/yyyy
  // และ d/M/yyyy
  const match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (match) {

    const day =
      String(match[1]).padStart(2, "0");

    const month =
      String(match[2]).padStart(2, "0");

    const year =
      match[3];

    let fixedTime = time;

    if (/^\d{1,2}:\d{2}$/.test(fixedTime)) {

      fixedTime += ":00";
    }

    return (
      `${year}-${month}-${day}` +
      `T${fixedTime}+07:00`
    );
  }


  // เผื่อ Google Sheet ส่งมาเป็นวันที่รูปแบบอื่น
  const fallback = new Date(
    `${text} ${time}`
  );

  if (!Number.isNaN(fallback.getTime())) {

    return fallback.toISOString();
  }

  return null;
}


// ============================================================
// CSV PARSER
// ============================================================

// รองรับเครื่องหมาย " " ใน CSV
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


// ------------------------------------------------------------
// หาตำแหน่งหัวตาราง
// รองรับทั้งภาษาไทยและอังกฤษ
// ------------------------------------------------------------

function findHeaderIndex(headers, names) {

  return headers.findIndex((header) => {

    const normalized = String(header)
      .trim()
      .toLowerCase();

    return names.some(
      (name) =>
        normalized ===
        String(name).toLowerCase()
    );
  });
}


// ============================================================
// PARSE GOOGLE SHEET CSV
// ============================================================

function parseCsv(csvText) {

  if (!csvText || !csvText.trim()) {

    return [];
  }


  const rows = csvText
    .trim()
    .split(/\r?\n/)
    .map(splitCsvLine);


  // ----------------------------------------------------------
  // หาแถวหัวตาราง
  //
  // ชีตของคุณมี:
  //
  // แถว 1 = ชื่อสถานี
  // แถว 2 = Table
  // แถว 3 = หัวตาราง
  //
  // จึงไม่ใช้ rows.shift() แบบเดิม
  // ----------------------------------------------------------

  let headerRowIndex = -1;

  for (let i = 0; i < rows.length; i++) {

    const testHeaders = rows[i].map(
      (value) =>
        String(value)
          .trim()
          .toLowerCase()
    );


    const hasDate =
      testHeaders.includes("วันที่") ||
      testHeaders.includes("date");


    const hasDistance =
      testHeaders.includes("ระยะทาง (m)") ||
      testHeaders.includes("ระยะทาง") ||
      testHeaders.includes("distance") ||
      testHeaders.includes("level");


    const hasLatitude =
      testHeaders.includes("latitude") ||
      testHeaders.includes("lat");


    if (
      hasDate &&
      (
        hasDistance ||
        hasLatitude
      )
    ) {

      headerRowIndex = i;

      break;
    }
  }


  if (headerRowIndex === -1) {

    throw new Error(
      "ไม่พบหัวตาราง วันที่ / เวลา / ระยะทาง / Latitude / Longitude"
    );
  }


  const headers =
    rows[headerRowIndex].map(
      (header) =>
        String(header)
          .trim()
          .toLowerCase()
    );


  // ----------------------------------------------------------
  // ตำแหน่งแต่ละคอลัมน์
  // ----------------------------------------------------------

  const dateIndex = findHeaderIndex(
    headers,
    [
      "วันที่",
      "date",
    ]
  );


  const timeIndex = findHeaderIndex(
    headers,
    [
      "เวลา",
      "time",
    ]
  );


  const levelIndex = findHeaderIndex(
    headers,
    [
      "ระยะทาง (m)",
      "ระยะทาง",
      "distance",
      "level",
      "water_level",
    ]
  );


  const latitudeIndex = findHeaderIndex(
    headers,
    [
      "latitude",
      "lat",
    ]
  );


  const longitudeIndex = findHeaderIndex(
    headers,
    [
      "longitude",
      "lng",
      "lon",
    ]
  );


  if (dateIndex === -1) {

    throw new Error(
      "ไม่พบคอลัมน์ วันที่"
    );
  }


  // ----------------------------------------------------------
  // อ่านข้อมูลตั้งแต่แถวถัดจากหัวตาราง
  // ----------------------------------------------------------

  const dataRows =
    rows.slice(headerRowIndex + 1);


  return dataRows
    .map((row) => {

      const dateText =
        row[dateIndex] || "";

      const timeText =
        timeIndex >= 0
          ? row[timeIndex] || ""
          : "";


      const timestamp =
        buildThaiTimestamp(
          dateText,
          timeText
        );


      // ระยะทาง
      let level = null;

      if (levelIndex >= 0) {

        const rawLevel =
          String(
            row[levelIndex] || ""
          )
            .trim()
            .replace(",", ".");


        // — หมายถึงไม่มีข้อมูลระยะทาง
        if (
          rawLevel !== "" &&
          rawLevel !== "—" &&
          rawLevel !== "-"
        ) {

          const number =
            Number(rawLevel);

          if (Number.isFinite(number)) {

            level = number;
          }
        }
      }


      // Latitude
      let latitude = null;

      if (latitudeIndex >= 0) {

        const value =
          Number(row[latitudeIndex]);

        if (Number.isFinite(value)) {

          latitude = value;
        }
      }


      // Longitude
      let longitude = null;

      if (longitudeIndex >= 0) {

        const value =
          Number(row[longitudeIndex]);

        if (Number.isFinite(value)) {

          longitude = value;
        }
      }


      return {

        timestamp,

        level,

        latitude,

        longitude,
      };
    })


    // ต้องมีวันที่/เวลา
    .filter(
      (row) => row.timestamp
    )


    // เรียงจากเก่า -> ใหม่
    .sort(
      (a, b) =>
        new Date(a.timestamp) -
        new Date(b.timestamp)
    );
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


  const response = await fetch(
    station.googleSheetCsv,
    {
      cache: "no-store",
    }
  );


  if (!response.ok) {

    throw new Error(
      `ไม่สามารถโหลดข้อมูล ${station.name}`
    );
  }


  const csvText =
    await response.text();


  return parseCsv(csvText);
}


// ============================================================
// LATEST READING
// ============================================================

function latestReading(station) {

  const readings =
    state.data[station.id] || [];


  if (!readings.length) {

    return null;
  }


  return readings[
    readings.length - 1
  ];
}


// ============================================================
// MIN / MAX
// ============================================================

function getRange(station) {

  const readings =
    state.data[station.id] || [];


  const levels = readings

    .map(
      (reading) => reading.level
    )

    .filter(
      (level) =>
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

      text: "รอติดตั้ง",
    };
  }


  if (!reading) {

    return {

      className: "offline",

      text: "ยังไม่มีข้อมูล",
    };
  }


  // ถ้ามีค่าระดับน้ำ
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
// STATION CARDS
// ============================================================

function renderCards() {

  const container =
    $("#stationCards");


  container.innerHTML =
    stations

      .map((station) => {

        const reading =
          latestReading(station);


        const range =
          getRange(station);


        const status =
          getStatus(
            station,
            reading
          );


        // ----------------------------------------------------
        // ระดับน้ำ
        // ----------------------------------------------------

        const levelText =
          reading &&
          Number.isFinite(reading.level)

            ? `${reading.level.toFixed(3)}
               <small>${station.unit}</small>`

            : "—";


        // ----------------------------------------------------
        // เวลาล่าสุด
        // ----------------------------------------------------

        const updateText =
          reading

            ? `อัปเดต ${formatDate(
                reading.timestamp
              )}`

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

            <span
              class="status ${status.className}"
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
      })

      .join("");


  // ----------------------------------------------------------
  // Click Station
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      "[data-station-id]"
    )
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
// STATION SELECT
// ============================================================

function renderStationSelect() {

  const select =
    $("#stationSelect");


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

  const stationReadings =
    state.data[
      state.selectedStationId
    ] || [];


  const availableDates = [

    ...new Set(

      stationReadings

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

  const station =
    stations.find(
      (item) =>
        item.id ===
        state.selectedStationId
    );


  if (!station) {
    return;
  }


  // ----------------------------------------------------------
  // เฉพาะวันที่เลือก + ต้องมีระยะทาง
  // ----------------------------------------------------------

  const readings =
    (
      state.data[station.id] || []
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


  // ----------------------------------------------------------
  // Notice
  // ----------------------------------------------------------

  if (!station.deployed) {

    $("#chartNotice").textContent =
      "สถานีนี้ยังไม่ได้ติดตั้ง";
  }

  else if (!readings.length) {

    $("#chartNotice").textContent =
      "ยังไม่มีข้อมูลระดับน้ำสำหรับวันที่เลือก";
  }

  else {

    $("#chartNotice").textContent =
      "ชี้หรือแตะจุดบนกราฟเพื่อดูรายละเอียด";
  }


  // ----------------------------------------------------------
  // Destroy old chart
  // ----------------------------------------------------------

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


  if (!canvas) {
    return;
  }


  const context =
    canvas.getContext("2d");


  const gradient =
    context.createLinearGradient(
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


  // ----------------------------------------------------------
  // Dataset
  // ----------------------------------------------------------

  const datasets = [

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
  ];


  // ----------------------------------------------------------
  // Warning line
  // ----------------------------------------------------------

  if (
    Number.isFinite(
      station.warningLevel
    )
  ) {

    datasets.push({

      label: "ระดับเฝ้าระวัง",

      data:
        readings.map(
          () =>
            station.warningLevel
        ),

      borderColor: "#ef8354",

      borderDash: [6, 5],

      borderWidth: 2,

      pointRadius: 0,
    });
  }


  // ----------------------------------------------------------
  // CREATE CHART
  // ----------------------------------------------------------

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


          datasets,
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

              displayColors: false,


              callbacks: {

                title: (items) => {

                  if (!items.length) {

                    return "";
                  }

                  const index =
                    items[0]
                      .dataIndex;


                  return formatDate(
                    readings[index]
                      .timestamp
                  );
                },


                label: (context) =>

                  `${context.dataset.label}: ` +

                  `${Number(
                    context.raw
                  ).toFixed(3)} ` +

                  `${station.unit}`,


                afterBody: () => {

                  if (!levels.length) {

                    return "";
                  }


                  return [

                    `สูงสุด: ${
                      Math.max(
                        ...levels
                      ).toFixed(3)
                    } ${station.unit}`,

                    `ต่ำสุด: ${
                      Math.min(
                        ...levels
                      ).toFixed(3)
                    } ${station.unit}`,
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
// MAP ICON
// ============================================================

function createMarkerIcon(
  station
) {

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


// ============================================================
// GET GPS COORDINATES
// ============================================================

function getStationCoordinates(
  station
) {

  const reading =
    latestReading(station);


  // ----------------------------------------------------------
  // ใช้ GPS ล่าสุดจาก Google Sheet ก่อน
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // ถ้าไม่มี GPS จาก Sheet
  // ใช้ค่าจาก config.js
  // ----------------------------------------------------------

  if (
    Number.isFinite(
      Number(station.latitude)
    ) &&
    Number.isFinite(
      Number(station.longitude)
    )
  ) {

    return [

      Number(
        station.latitude
      ),

      Number(
        station.longitude
      ),
    ];
  }


  return null;
}


// ============================================================
// SETUP MAP
// ============================================================

function setupMap() {

  if (state.map) {
    return;
  }


  // ----------------------------------------------------------
  // หาพิกัดเริ่มต้น
  // ----------------------------------------------------------

  let startCoordinates = null;


  for (
    const station of stations
  ) {

    const coordinates =
      getStationCoordinates(
        station
      );


    if (coordinates) {

      startCoordinates =
        coordinates;

      break;
    }
  }


  // พิกัดสำรองประเทศไทย
  if (!startCoordinates) {

    startCoordinates = [
      18.28,
      99.49,
    ];
  }


  state.map =
    L.map("map")
      .setView(
        startCoordinates,
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


// ============================================================
// RENDER MAP MARKERS
// ============================================================

function renderMapMarkers() {

  if (!state.map) {
    return;
  }


  // ----------------------------------------------------------
  // ลบ Marker เก่า
  // ----------------------------------------------------------

  state.markers.forEach(
    (marker) => {

      marker.remove();
    }
  );


  state.markers = [];


  // ----------------------------------------------------------
  // สร้าง Marker ใหม่
  // ----------------------------------------------------------

  stations.forEach(
    (station) => {

      const coordinates =
        getStationCoordinates(
          station
        );


      if (!coordinates) {

        return;
      }


      const reading =
        latestReading(
          station
        );


      const status =
        getStatus(
          station,
          reading
        );


      // ------------------------------------------------------
      // ระดับน้ำใน popup
      // ------------------------------------------------------

      let popupText =
        "ยังไม่มีข้อมูลระดับน้ำ";


      if (
        reading &&
        Number.isFinite(
          reading.level
        )
      ) {

        popupText =
          `ระดับน้ำ: ` +

          `${reading.level.toFixed(3)} ` +

          `${station.unit}`;
      }


      // ------------------------------------------------------
      // GPS
      // ------------------------------------------------------

      const gpsText =
        `Latitude: ${coordinates[0].toFixed(6)}` +

        `<br>` +

        `Longitude: ${coordinates[1].toFixed(6)}`;


      const marker =
        L.marker(

          coordinates,

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

            ${gpsText}

          `);


      marker.on(
        "click",
        () => {

          selectStation(
            station.id
          );
        }
      );


      // ตัวนี้จะไม่ Error แล้ว
      state.markers.push(
        marker
      );
    }
  );
}


// ============================================================
// SELECT STATION
// ============================================================

function selectStation(
  stationId
) {

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


  const coordinates =
    getStationCoordinates(
      station
    );


  if (
    state.map &&
    coordinates
  ) {

    state.map.flyTo(

      coordinates,

      14
    );
  }
}


// ============================================================
// CHANGE DATE
// ============================================================

function changeDate(
  direction
) {

  const readings =
    state.data[
      state.selectedStationId
    ] || [];


  const dates = [

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
// LIVE CLOCK
// ============================================================

function updateClock() {

  const clock =
    $("#liveClock");


  if (!clock) {
    return;
  }


  clock.textContent =
    `เวลาปัจจุบัน ` +

    new Intl.DateTimeFormat(
      "th-TH",
      {

        timeZone:
          "Asia/Bangkok",

        dateStyle:
          "medium",

        timeStyle:
          "medium",
      }
    ).format(
      new Date()
    );
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


  // ----------------------------------------------------------
  // โหลดทั้ง 3 Station
  // ----------------------------------------------------------

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

        }
        catch (error) {

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


  // ----------------------------------------------------------
  // Render UI
  // ----------------------------------------------------------

  renderCards();

  renderStationSelect();

  renderDateInput();

  renderChart();


  // ----------------------------------------------------------
  // Map
  // ----------------------------------------------------------

  if (!state.map) {

    setupMap();
  }
  else {

    renderMapMarkers();
  }


  // ----------------------------------------------------------
  // ข้อมูลล่าสุดของทุกสถานี
  // ----------------------------------------------------------

  const newest = stations

    .map(
      (station) =>
        latestReading(
          station
        )
    )

    .filter(Boolean)

    .sort(
      (first, second) =>

        new Date(
          second.timestamp
        ) -

        new Date(
          first.timestamp
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
// EVENT: SELECT STATION
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


// ============================================================
// EVENT: DATE
// ============================================================

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


// ============================================================
// EVENT: PREVIOUS DATE
// ============================================================

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


// ============================================================
// EVENT: NEXT DATE
// ============================================================

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


// ============================================================
// EVENT: REFRESH
// ============================================================

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
// START APPLICATION
// ============================================================

// แสดงเวลาไทยทันที
updateClock();


// อัปเดตนาฬิกาทุก 1 วินาที
setInterval(
  updateClock,
  1000
);


// โหลด Google Sheet ใหม่ทุก 5 นาที
setInterval(
  refreshData,
  300000
);


// โหลดข้อมูลครั้งแรก
refreshData();
