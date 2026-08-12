// app.js

const stations = window.WATER_APP_CONFIG.stations;

const state = {
  selectedStationId: stations[0].id,
  selectedDate: "",
  chartMode: "station",
  data: {},
  chart: null,
  map: null,
  markers: [],
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

  const red =
    (number >> 16) & 255;

  const green =
    (number >> 8) & 255;

  const blue =
    number & 255;

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}


// ============================================================
// DATE
// ============================================================

function formatDate(value, options) {

  if (!value) return "—";

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
          timeStyle: "short",
        }),

        timeZone:
          "Asia/Bangkok",
      }
    ).format(date);

  }

  catch {
    return "—";
  }
}


function dateKey(value) {

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Bangkok",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(date);

  const year =
    parts.find(
      (p) =>
        p.type === "year"
    )?.value;

  const month =
    parts.find(
      (p) =>
        p.type === "month"
    )?.value;

  const day =
    parts.find(
      (p) =>
        p.type === "day"
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

  const hour =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Bangkok",

        hour:
          "2-digit",

        hour12:
          false,
      }
    ).format(date);

  return Number(
    hour === "24"
      ? "0"
      : hour
  );
}


function normalizeTimeText(value) {

  const time =
    String(value || "")
      .replace(/"/g, "")
      .trim();

  const match =
    time.match(
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );

  if (!match) {
    return "00:00:00";
  }

  return (
    String(match[1]).padStart(2, "0") +
    ":" +
    String(match[2]).padStart(2, "0") +
    ":" +
    String(match[3] || "00").padStart(2, "0")
  );
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


  let match =
    date.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (match) {

    const timestamp =
      `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}T${time}+07:00`;

    return Number.isNaN(
      new Date(
        timestamp
      ).getTime()
    )
      ? null
      : timestamp;
  }


  match =
    date.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (match) {

    const timestamp =
      `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}T${time}+07:00`;

    return Number.isNaN(
      new Date(
        timestamp
      ).getTime()
    )
      ? null
      : timestamp;
  }

  return null;
}


// ============================================================
// CSV
// ============================================================

function splitCsvLine(line) {

  const cells = [];

  let current = "";

  let insideQuotes =
    false;

  for (
    let i = 0;
    i < line.length;
    i++
  ) {

    const char =
      line[i];

    if (
      char === '"'
    ) {

      insideQuotes =
        !insideQuotes;

      continue;
    }

    if (
      char === "," &&
      !insideQuotes
    ) {

      cells.push(
        current.trim()
      );

      current =
        "";

      continue;
    }

    current +=
      char;
  }

  cells.push(
    current.trim()
  );

  return cells;
}


function normalizeHeader(value) {

  return String(
    value || ""
  )
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}


function parseNumberCell(value) {

  const raw =
    String(
      value ?? ""
    )
      .replace(/"/g, "")
      .replace(/\s+/g, "")
      .replace(",", ".")
      .trim();

  if (
    raw === "" ||
    raw === "—" ||
    raw === "-"
  ) {
    return null;
  }

  const number =
    Number(raw);

  return Number.isFinite(number)
    ? number
    : null;
}


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
        (line) =>
          line.trim() !== ""
      )
      .map(
        splitCsvLine
      );

  let headerRowIndex =
    -1;

  for (
    let i = 0;
    i < rows.length;
    i++
  ) {

    const headers =
      rows[i].map(
        normalizeHeader
      );

    const text =
      headers.join(" ");

    if (
      (
        text.includes(
          "วันที่"
        ) ||
        text.includes(
          "date"
        )
      ) &&
      text.includes(
        "latitude"
      ) &&
      text.includes(
        "longitude"
      )
    ) {

      headerRowIndex =
        i;

      break;
    }
  }


  if (
    headerRowIndex ===
    -1
  ) {
    return [];
  }


  const headers =
    rows[
      headerRowIndex
    ].map(
      normalizeHeader
    );


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


  let distanceIndex =
    headers.findIndex(
      (h) =>
        h.includes("ระดับน้ำ") ||
        h.includes("ระยะน้ำ") ||
        h.includes("ระยะทาง") ||
        h.includes("distance") ||
        h.includes("water level") ||
        h.includes("water_level") ||
        h === "level"
    );


  let latitudeIndex =
    headers.findIndex(
      (h) =>
        h.includes("latitude")
    );


  let longitudeIndex =
    headers.findIndex(
      (h) =>
        h.includes("longitude")
    );


  if (
    dateIndex === -1
  ) {
    dateIndex = 0;
  }

  if (
    timeIndex === -1
  ) {
    timeIndex = 1;
  }

  if (
    distanceIndex === -1
  ) {
    distanceIndex = 2;
  }

  if (
    latitudeIndex === -1
  ) {
    latitudeIndex = 3;
  }

  if (
    longitudeIndex === -1
  ) {
    longitudeIndex = 4;
  }


  const results = [];


  for (
    let i =
      headerRowIndex + 1;

    i < rows.length;

    i++
  ) {

    const row =
      rows[i];


    let dateText =
      String(
        row[
          dateIndex
        ] || ""
      )
        .replace(/"/g, "")
        .trim();


    let timeText =
      String(
        row[
          timeIndex
        ] || ""
      )
        .replace(/"/g, "")
        .trim();


    let distanceRaw =
      row[
        distanceIndex
      ];


    let latitudeRaw =
      row[
        latitudeIndex
      ];


    let longitudeRaw =
      row[
        longitudeIndex
      ];


    const old =
      dateText.match(
        /^(\d{1,2}\/\d{1,2}\/\d{4})\s*,\s*(\d{1,2}:\d{2}(?::\d{2})?)$/
      );


    if (old) {

      dateText =
        old[1];

      timeText =
        old[2];

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
        ),

    });
  }


  results.sort(
    (a, b) =>
      new Date(
        a.timestamp
      ) -
      new Date(
        b.timestamp
      )
  );


  return results;
}


// ============================================================
// LOAD
// ============================================================

async function loadStation(
  station
) {

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
          cache:
            "no-store",
        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        `HTTP ${response.status}`
      );
    }


    return parseCsv(
      await response.text()
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
// DATA
// ============================================================

function latestReading(
  station
) {

  const data =
    state.data[
      station.id
    ] || [];

  return data.length
    ? data[
        data.length - 1
      ]
    : null;
}


function latestLevelReading(
  station
) {

  const data =
    state.data[
      station.id
    ] || [];

  for (
    let i =
      data.length - 1;

    i >= 0;

    i--
  ) {

    if (
      Number.isFinite(
        data[i].level
      )
    ) {

      return data[i];
    }
  }

  return null;
}


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
      (reading) =>
        dateKey(
          reading.timestamp
        ) ===
          selectedDate &&
        Number.isFinite(
          reading.level
        )
    );
}


// ============================================================
// HOURLY
// ============================================================

function aggregateHourly(
  readings
) {

  const buckets =
    Array.from(
      {
        length:
          24,
      },

      () =>
        []
    );


  readings.forEach(
    (reading) => {

      const hour =
        getThaiHour(
          reading.timestamp
        );

      if (
        hour === null ||
        !Number.isFinite(
          reading.level
        )
      ) {
        return;
      }

      buckets[
        hour
      ].push(
        reading.level
      );
    }
  );


  return buckets.map(
    (
      values,
      hour
    ) => {

      if (
        !values.length
      ) {

        return {
          hour,
          average:
            null,

          min:
            null,

          max:
            null,

          count:
            0,
        };
      }


      const average =
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        ) /
        values.length;


      return {
        hour,

        average,

        min:
          Math.min(
            ...values
          ),

        max:
          Math.max(
            ...values
          ),

        count:
          values.length,
      };
    }
  );
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
    stations.map(
      (station) => {

        const latest =
          latestLevelReading(
            station
          );


        const value =
          latest &&
          Number.isFinite(
            latest.level
          )
            ? latest.level.toFixed(3)
            : "—";


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
              --station-color:${station.color};
              --station-soft:${station.softColor};
            "
          >

            <span class="status normal">
              ปกติ
            </span>

            <h2>
              ${station.name}
            </h2>

            <div class="current-value">

              <strong>
                ${value}
                <small>
                  ${station.unit}
                </small>
              </strong>

              <span>
                ค่าล่าสุด
              </span>

            </div>

            <p>

              ${
                latest
                  ? `อัปเดต ${formatDate(latest.timestamp)}`
                  : "ยังไม่มีข้อมูล"
              }

            </p>

          </button>
        `;
      }
    ).join("");


  document
    .querySelectorAll(
      "[data-station-id]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            state.chartMode =
              "station";

            state.selectedStationId =
              button.dataset.stationId;

            state.selectedDate =
              "";

            renderAll();

          }
        );

      }
    );
}


// ============================================================
// DATE
// ============================================================

function getAvailableDates() {

  let all =
    [];


  if (
    state.chartMode ===
    "all"
  ) {

    stations.forEach(
      (station) => {

        all =
          all.concat(
            state.data[
              station.id
            ] || []
          );

      }
    );

  }

  else {

    all =
      state.data[
        state.selectedStationId
      ] || [];

  }


  return [
    ...new Set(
      all
        .map(
          (r) =>
            dateKey(
              r.timestamp
            )
        )
        .filter(Boolean)
    ),
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

    input.value =
      "";

    state.selectedDate =
      "";

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

  const canvas =
    $("#waterChart");

  if (!canvas) {
    return;
  }


  if (
    state.chart
  ) {

    state.chart.destroy();

    state.chart =
      null;
  }


  const labels =
    Array.from(
      {
        length:
          24,
      },

      (_, h) =>
        `${String(h).padStart(2, "0")}:00`
    );


  let datasets =
    [];


  if (
    state.chartMode ===
    "all"
  ) {

    $("#chartTitle").textContent =
      "กราฟเปรียบเทียบระดับน้ำ 3 สถานี";


    stations.forEach(
      (station) => {

        const hourly =
          aggregateHourly(
            getReadingsForDate(
              station.id,
              state.selectedDate
            )
          );


        datasets.push({

          label:
            station.shortName,

          data:
            hourly.map(
              (x) =>
                x.average
            ),

          borderColor:
            station.color,

          backgroundColor:
            station.color,

          borderWidth:
            3,

          tension:
            0.25,

          pointRadius:
            4,

          pointHoverRadius:
            7,

          spanGaps:
            false,

        });

      }
    );

  }

  else {

    const station =
      stations.find(
        (s) =>
          s.id ===
          state.selectedStationId
      );


    const hourly =
      aggregateHourly(
        getReadingsForDate(
          station.id,
          state.selectedDate
        )
      );


    $("#chartTitle").textContent =
      `กราฟระดับน้ำ: ${station.shortName}`;


    datasets.push({

      label:
        `${station.shortName} เฉลี่ยรายชั่วโมง`,

      data:
        hourly.map(
          (x) =>
            x.average
        ),

      borderColor:
        station.color,

      backgroundColor:
        hexToRgba(
          station.color,
          0.12
        ),

      fill:
        true,

      borderWidth:
        3,

      tension:
        0.25,

      pointRadius:
        4,

      pointHoverRadius:
        7,

      spanGaps:
        false,

    });


    datasets.push({

      label:
        "ระดับเฝ้าระวัง",

      data:
        labels.map(
          () =>
            station.warningLevel
        ),

      borderColor:
        "#ef8354",

      borderDash:
        [8, 6],

      borderWidth:
        2,

      pointRadius:
        0,

    });
  }


  $("#chartDateLabel").textContent =
    state.selectedDate
      ? formatDate(
          `${state.selectedDate}T12:00:00+07:00`,
          {
            dateStyle:
              "full",
          }
        )
      : "ยังไม่มีข้อมูล";


  state.chart =
    new Chart(
      canvas,
      {

        type:
          "line",

        data: {
          labels,
          datasets,
        },

        options: {

          responsive:
            true,

          maintainAspectRatio:
            false,

          interaction: {
            mode:
              "index",

            intersect:
              false,
          },

          plugins: {

            legend: {
              position:
                "top",
            },

            tooltip: {

              callbacks: {

                title:
                  (items) =>
                    items.length
                      ? `${items[0].label} น.`
                      : "",

                label:
                  (context) => {

                    if (
                      context.raw === null
                    ) {
                      return `${context.dataset.label}: ไม่มีข้อมูล`;
                    }

                    return (
                      `${context.dataset.label}: ` +
                      `${Number(context.raw).toFixed(3)} เมตร`
                    );
                  },

              },

            },

          },

          scales: {

            y: {

              beginAtZero:
                true,

              title: {
                display:
                  true,

                text:
                  "ระดับน้ำ (เมตร)",
              },

            },

            x: {

              title: {
                display:
                  true,

                text:
                  "เวลา",
              },

              ticks: {

                autoSkip:
                  false,

                maxRotation:
                  0,

                callback:
                  function (
                    value,
                    index
                  ) {

                    return index %
                      2 ===
                      0
                      ? labels[
                          index
                        ]
                      : "";
                  },

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

function getStationCoordinates(
  station
) {

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
        readings[
          i
        ].latitude
      );

    const lng =
      Number(
        readings[
          i
        ].longitude
      );


    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat !== 0 &&
      lng !== 0
    ) {

      return [
        lat,
        lng,
      ];
    }
  }


  return [
    Number(
      station.latitude
    ),

    Number(
      station.longitude
    ),
  ];
}


function setupMap() {

  if (
    state.map
  ) {
    return;
  }


  const first =
    stations[0];


  state.map =
    L.map(
      "map"
    ).setView(
      getStationCoordinates(
        first
      ),
      16
    );


  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom:
        19,

      attribution:
        "Tiles © Esri",
    }
  ).addTo(
    state.map
  );


  renderMapMarkers();
}


function renderMapMarkers() {

  if (
    !state.map
  ) {
    return;
  }


  state.markers.forEach(
    (marker) =>
      state.map.removeLayer(
        marker
      )
  );


  state.markers =
    [];


  stations.forEach(
    (station) => {

      const coords =
        getStationCoordinates(
          station
        );


      const latest =
        latestLevelReading(
          station
        );


      const marker =
        L.marker(
          coords
        )
          .addTo(
            state.map
          );


      marker.bindPopup(`
        <strong>
          ${station.name}
        </strong>

        <br>

        ระดับน้ำ:
        ${
          latest
            ? latest.level.toFixed(3)
            : "—"
        }
        ${station.unit}

        <br>

        Latitude:
        ${coords[0].toFixed(6)}

        <br>

        Longitude:
        ${coords[1].toFixed(6)}
      `);


      state.markers.push(
        marker
      );

    }
  );
}


// ============================================================
// UI
// ============================================================

function renderStationSelect() {

  const select =
    $("#stationSelect");


  select.innerHTML =
    stations.map(
      (station) =>
        `
        <option value="${station.id}">
          ${station.name}
        </option>
        `
    ).join("");


  select.value =
    state.selectedStationId;
}


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


function renderAll() {

  renderCards();

  renderStationSelect();

  renderModeButtons();

  renderDateInput();

  renderChart();

  if (
    !state.map
  ) {
    setupMap();
  }

  else {
    renderMapMarkers();
  }
}


// ============================================================
// REFRESH
// ============================================================

async function refreshData() {

  $("#globalUpdated").textContent =
    "กำลังโหลดข้อมูล…";


  await Promise.all(
    stations.map(
      async (
        station
      ) => {

        state.data[
          station.id
        ] =
          await loadStation(
            station
          );

      }
    )
  );


  renderAll();


  const newest =
    stations
      .map(
        latestReading
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
      ? `ข้อมูลล่าสุด ${formatDate(newest.timestamp)}`
      : "ยังไม่มีข้อมูล";

}


// ============================================================
// EVENTS
// ============================================================

$("#stationSelect")
  ?.addEventListener(
    "change",
    (event) => {

      state.chartMode =
        "station";

      state.selectedStationId =
        event.target.value;

      state.selectedDate =
        "";

      renderAll();

    }
  );


$("#dateInput")
  ?.addEventListener(
    "change",
    (event) => {

      state.selectedDate =
        event.target.value;

      renderChart();

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

      renderAll();

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

      renderAll();

    }
  );


$("#previousDate")
  ?.addEventListener(
    "click",
    () => {

      const dates =
        getAvailableDates();

      const index =
        dates.indexOf(
          state.selectedDate
        );

      if (
        index > 0
      ) {

        state.selectedDate =
          dates[
            index - 1
          ];

        renderDateInput();

        renderChart();
      }

    }
  );


$("#nextDate")
  ?.addEventListener(
    "click",
    () => {

      const dates =
        getAvailableDates();

      const index =
        dates.indexOf(
          state.selectedDate
        );

      if (
        index >= 0 &&
        index <
          dates.length - 1
      ) {

        state.selectedDate =
          dates[
            index + 1
          ];

        renderDateInput();

        renderChart();
      }

    }
  );


$("#refreshButton")
  ?.addEventListener(
    "click",
    refreshData
  );


// ============================================================
// CLOCK
// ============================================================

function updateClock() {

  $("#liveClock").textContent =
    `เวลาปัจจุบัน ${
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
      )
    }`;
}


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
  60000
);

refreshData();
