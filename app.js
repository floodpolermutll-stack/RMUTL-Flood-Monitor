const stations =
  window.WATER_APP_CONFIG.stations;


const state = {

  selectedStationId:
    stations[0].id,

  selectedDate:
    "",

  chartMode:
    "station",

  data:
    {},

  chart:
    null,

  map:
    null,

  markers:
    []

};


const $ =
  (selector) =>
    document.querySelector(selector);


// ============================================================
// COLOR
// ============================================================

function hexToRgba(
  hex,
  opacity
) {

  const color =
    String(
      hex || "#000000"
    ).replace("#", "");


  const number =
    parseInt(
      color,
      16
    );


  const r =
    (number >> 16) & 255;

  const g =
    (number >> 8) & 255;

  const b =
    number & 255;


  return (
    `rgba(${r},${g},${b},${opacity})`
  );

}


// ============================================================
// DATE
// ============================================================

function formatDate(
  value,
  options
) {

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

          dateStyle:
            "medium",

          timeStyle:
            "short"

        }),

        timeZone:
          "Asia/Bangkok"

      }
    ).format(date);

  }

  catch {

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
          "2-digit"

      }
    ).formatToParts(date);


  const year =
    parts.find(
      p =>
        p.type === "year"
    )?.value;


  const month =
    parts.find(
      p =>
        p.type === "month"
    )?.value;


  const day =
    parts.find(
      p =>
        p.type === "day"
    )?.value;


  if (
    !year ||
    !month ||
    !day
  ) {

    return "";

  }


  return (
    `${year}-${month}-${day}`
  );

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
          false

      }
    ).format(date);


  return Number(
    hour === "24"
      ? 0
      : hour
  );

}



function normalizeTimeText(value) {

  const text =
    String(
      value || ""
    )
      .replace(/"/g, "")
      .trim();


  const match =
    text.match(
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );


  if (!match) {

    return "00:00:00";

  }


  return (
    String(
      match[1]
    ).padStart(
      2,
      "0"
    )

    +

    ":"

    +

    String(
      match[2]
    ).padStart(
      2,
      "0"
    )

    +

    ":"

    +

    String(
      match[3] || "00"
    ).padStart(
      2,
      "0"
    )
  );

}



function buildThaiTimestamp(
  dateText,
  timeText
) {

  let date =
    String(
      dateText || ""
    )
      .replace(/"/g, "")
      .trim();


  let time =
    String(
      timeText || ""
    )
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
    normalizeTimeText(
      time
    );


  let match =
    date.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );


  if (match) {

    const day =
      String(
        match[1]
      ).padStart(
        2,
        "0"
      );


    const month =
      String(
        match[2]
      ).padStart(
        2,
        "0"
      );


    const year =
      match[3];


    const timestamp =
      `${year}-${month}-${day}T${time}+07:00`;


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

    const year =
      match[1];


    const month =
      String(
        match[2]
      ).padStart(
        2,
        "0"
      );


    const day =
      String(
        match[3]
      ).padStart(
        2,
        "0"
      );


    const timestamp =
      `${year}-${month}-${day}T${time}+07:00`;


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

  const cells =
    [];


  let current =
    "";


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

      current =
        "";

    }

    else {

      current +=
        char;

    }

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

    .replace(
      /\u00a0/g,
      " "
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim()

    .toLowerCase();

}



function parseNumberCell(value) {

  let raw =
    String(
      value ?? ""
    )

      .replace(/"/g, "")

      .replace(
        /\s+/g,
        ""
      )

      .trim();


  if (
    raw === "" ||
    raw === "—" ||
    raw === "-"
  ) {

    return null;

  }


  raw =
    raw.replace(
      ",",
      "."
    );


  const number =
    Number(raw);


  return Number.isFinite(
    number
  )
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
        row =>
          row.trim() !== ""
      )

      .map(
        splitCsvLine
      );


  let headerRow =
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
        text.includes("วันที่") ||
        text.includes("date")
      )

      &&

      (
        text.includes("latitude") ||
        headers.includes("lat")
      )

      &&

      (
        text.includes("longitude") ||
        headers.includes("lng")
      )

    ) {

      headerRow =
        i;

      break;

    }

  }


  if (
    headerRow === -1
  ) {

    console.error(
      "ไม่พบ Header"
    );

    return [];

  }


  const headers =
    rows[
      headerRow
    ].map(
      normalizeHeader
    );


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
      h =>
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


  console.log(
    "COLUMN INDEX",
    {
      dateIndex,
      timeIndex,
      distanceIndex,
      latitudeIndex,
      longitudeIndex
    }
  );


  const results =
    [];


  for (
    let i =
      headerRow + 1;
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
        )

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
      station.googleSheetCsv +
      separator +
      "_=" +
      Date.now();


    const response =
      await fetch(
        url,
        {
          cache:
            "no-store"
        }
      );


    if (!response.ok) {

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



function getStatus(station) {

  const reading =
    latestLevelReading(
      station
    );


  if (
    !station.deployed
  ) {

    return {
      className:
        "pending",
      text:
        "รอติดตั้ง"
    };

  }


  if (!reading) {

    return {
      className:
        "offline",
      text:
        "ไม่มีข้อมูล"
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
      className:
        "warning",
      text:
        "เฝ้าระวัง"
    };

  }


  return {
    className:
      "normal",
    text:
      "ปกติ"
  };

}



function getRange(station) {

  const values =
    (
      state.data[
        station.id
      ] || []
    )
      .map(
        r =>
          r.level
      )
      .filter(
        Number.isFinite
      );


  if (!values.length) {

    return null;

  }


  return {

    min:
      Math.min(
        ...values
      ),

    max:
      Math.max(
        ...values
      )

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
    stations.map(
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

              ${
                reading
                  ? reading.level.toFixed(3)
                  : "—"
              }

              <small>
                ${station.unit}
              </small>

            </div>


            <div class="station-label">

              ระดับน้ำล่าสุด

            </div>


            <div class="station-stat-row">

              <div>

                <span>
                  ต่ำสุด
                </span>

                <strong>

                  ${
                    range
                      ? range.min.toFixed(3)
                      : "—"
                  }

                </strong>

              </div>


              <div>

                <span>
                  สูงสุด
                </span>

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
    ).join("");


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

            renderEverything();

          }
        );

      }
    );

}


// ============================================================
// SELECT
// ============================================================

function renderStationSelect() {

  const select =
    $("#stationSelect");


  if (!select) {

    return;

  }


  select.innerHTML =
    stations.map(
      station =>
        `
        <option value="${station.id}">
          ${station.name}
        </option>
        `
    ).join("");


  select.value =
    state.selectedStationId;

}



// ============================================================
// DATES
// ============================================================

function getAvailableDates() {

  let readings =
    [];


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


  const dates =
    getAvailableDates();


  if (
    !input ||
    !dates.length
  ) {

    if (input) {

      input.value =
        "";

    }


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



function getReadingsForDate(
  stationId,
  selectedDate
) {

  return (
    state.data[
      stationId
    ] || []
  ).filter(
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
// HOURLY
// ============================================================

function aggregateHourly(readings) {

  const buckets =
    Array.from(
      {
        length:
          24
      },
      (_, hour) => ({
        hour,
        values:
          []
      })
    );


  readings.forEach(
    reading => {

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
      ].values.push(
        reading.level
      );

    }
  );


  return buckets.map(
    bucket => {

      if (
        !bucket.values.length
      ) {

        return {

          hour:
            bucket.hour,

          average:
            null,

          min:
            null,

          max:
            null,

          count:
            0

        };

      }


      const sum =
        bucket.values.reduce(
          (a, b) =>
            a + b,
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



function getDailyStats(
  stationId,
  date
) {

  const readings =
    getReadingsForDate(
      stationId,
      date
    );


  if (
    !readings.length
  ) {

    return null;

  }


  const values =
    readings.map(
      r =>
        r.level
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

    average:
      values.reduce(
        (a, b) =>
          a + b,
        0
      ) /
      values.length,

    min:
      Math.min(
        ...values
      ),

    max:
      Math.max(
        ...values
      ),

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


  if (
    !container ||
    !state.selectedDate
  ) {

    if (container) {

      container.innerHTML =
        "";

    }

    return;

  }


  if (
    state.chartMode ===
    "all"
  ) {

    container.innerHTML =
      stations.map(
        station => {

          const stats =
            getDailyStats(
              station.id,
              state.selectedDate
            );


          return `

            <div
              class="summary-card"
              style="
                --summary-color:${station.color}
              "
            >

              <div
                class="summary-color-line"
              ></div>

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
                      ? `เฉลี่ย ${stats.average.toFixed(3)} เมตร`
                      : "ไม่มีข้อมูล"
                  }

                </span>

              </div>

            </div>

          `;

        }
      ).join("");


    return;

  }


  const station =
    stations.find(
      station =>
        station.id ===
        state.selectedStationId
    );


  const stats =
    getDailyStats(
      station.id,
      state.selectedDate
    );


  if (!stats) {

    container.innerHTML =
      `
      <div class="summary-empty">
        ไม่มีข้อมูลในวันที่เลือก
      </div>
      `;

    return;

  }


  const values =
    [

      [
        "ค่าล่าสุด",
        stats.latest,
        "◉"
      ],

      [
        "ค่าเฉลี่ย",
        stats.average,
        "≈"
      ],

      [
        "ต่ำสุด",
        stats.min,
        "↓"
      ],

      [
        "สูงสุด",
        stats.max,
        "↑"
      ]

    ];


  container.innerHTML =
    values.map(
      item =>
        `

        <div class="summary-card">

          <div class="summary-icon">

            ${item[2]}

          </div>

          <div>

            <span class="summary-title">

              ${item[0]}

            </span>

            <strong class="summary-big">

              ${item[1].toFixed(3)}

              <small>
                ${station.unit}
              </small>

            </strong>

          </div>

        </div>

        `
    ).join("");

}


// ============================================================
// MODE
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

function renderChart() {

  const canvas =
    $("#waterChart");


  if (!canvas) {

    return;

  }


  if (state.chart) {

    state.chart.destroy();

  }


  const labels =
    Array.from(
      {
        length:
          24
      },
      (_, h) =>
        `${String(h).padStart(2, "0")}:00`
    );


  const dark =
    document.documentElement
      .getAttribute(
        "data-theme"
      ) ===
      "dark";


  const textColor =
    dark
      ? "#9fb4bd"
      : "#8297a1";


  const gridColor =
    dark
      ? "rgba(160,190,200,.09)"
      : "rgba(120,150,160,.12)";


  let datasets =
    [];


  if (
    state.chartMode ===
    "all"
  ) {

    $("#chartTitle").textContent =
      "เปรียบเทียบระดับน้ำทั้ง 3 สถานี";


    stations.forEach(
      station => {

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
              x =>
                x.average
            ),

          borderColor:
            station.color,

          backgroundColor:
            station.color,

          borderWidth:
            3,

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

          tension:
            .38,

          spanGaps:
            false

        });

      }
    );


    $("#chartNotice").textContent =
      "แต่ละจุดคือค่าเฉลี่ยภายในชั่วโมงนั้น สามารถเปรียบเทียบทั้ง 3 สถานีได้ในกราฟเดียว";

  }

  else {

    const station =
      stations.find(
        station =>
          station.id ===
          state.selectedStationId
      );


    const readings =
      getReadingsForDate(
        station.id,
        state.selectedDate
      );


    const hourly =
      aggregateHourly(
        readings
      );


    const context =
      canvas.getContext(
        "2d"
      );


    const gradient =
      context.createLinearGradient(
        0,
        0,
        0,
        470
      );


    gradient.addColorStop(
      0,
      hexToRgba(
        station.color,
        dark
          ? .18
          : .25
      )
    );


    gradient.addColorStop(
      1,
      hexToRgba(
        station.color,
        0
      )
    );


    $("#chartTitle").textContent =
      `ระดับน้ำ · ${station.shortName}`;


    datasets = [

      {

        label:
          station.shortName,

        data:
          hourly.map(
            x =>
              x.average
          ),

        borderColor:
          station.color,

        backgroundColor:
          gradient,

        fill:
          true,

        borderWidth:
          3,

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

        tension:
          .4,

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

        borderDash:
          [7, 7],

        borderWidth:
          2,

        pointRadius:
          0

      }

    ];


    $("#chartNotice").textContent =
      readings.length
        ? `ข้อมูล ${readings.length} จุดวัด ถูกสรุปเป็นค่าเฉลี่ยรายชั่วโมง`
        : "ไม่มีข้อมูลสำหรับวันที่เลือก";

  }


  $("#chartDateLabel").textContent =
    state.selectedDate
      ? formatDate(
          state.selectedDate +
          "T12:00:00+07:00",
          {
            dateStyle:
              "full"
          }
        )
      : "ไม่มีข้อมูล";


  state.chart =
    new Chart(
      canvas,
      {

        type:
          "line",

        data:
          {
            labels,
            datasets
          },

        options:
          {

            responsive:
              true,

            maintainAspectRatio:
              false,

            interaction:
              {
                mode:
                  "index",
                intersect:
                  false
              },

            animation:
              {
                duration:
                  450
              },

            plugins:
              {

                legend:
                  {

                    position:
                      "top",

                    align:
                      "start",

                    labels:
                      {

                        color:
                          textColor,

                        usePointStyle:
                          true,

                        pointStyle:
                          "circle",

                        boxWidth:
                          8,

                        padding:
                          20

                      }

                  },


                tooltip:
                  {

                    backgroundColor:
                      "rgba(8,30,42,.96)",

                    padding:
                      13,

                    cornerRadius:
                      12,

                    callbacks:
                      {

                        title:
                          items =>
                            items.length
                              ? `เวลา ${items[0].label} น.`
                              : "",

                        label:
                          context => {

                            if (
                              context.raw === null
                            ) {

                              return (
                                context.dataset.label +
                                ": ไม่มีข้อมูล"
                              );

                            }


                            return (
                              context.dataset.label +
                              ": " +
                              Number(
                                context.raw
                              ).toFixed(
                                3
                              ) +
                              " เมตร"
                            );

                          }

                      }

                  }

              },


            scales:
              {

                y:
                  {

                    beginAtZero:
                      true,

                    border:
                      {
                        display:
                          false
                      },

                    grid:
                      {
                        color:
                          gridColor
                      },

                    ticks:
                      {
                        color:
                          textColor
                      },

                    title:
                      {
                        display:
                          true,

                        text:
                          "ระดับน้ำ (เมตร)",

                        color:
                          textColor
                      }

                  },


                x:
                  {

                    border:
                      {
                        display:
                          false
                      },

                    grid:
                      {
                        display:
                          false
                      },

                    ticks:
                      {

                        color:
                          textColor,

                        autoSkip:
                          false,

                        maxRotation:
                          0,

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

                      }

                  }

              }

          }

      }
    );

}


// ============================================================
// MAP
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
          --marker-soft:${hexToRgba(station.color,.22)};
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
      [54,54],

    iconAnchor:
      [27,27],

    popupAnchor:
      [0,-25]

  });

}



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

    Number(
      station.latitude
    ),

    Number(
      station.longitude
    )

  ];

}



function setupMap() {

  if (state.map) {

    return;

  }


  const station =
    stations[0];


  state.map =
    L.map(
      "map"
    ).setView(
      getStationCoordinates(
        station
      ),
      16
    );


  const satellite =
    L.tileLayer(

      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

      {
        maxZoom:
          19,

        attribution:
          "Tiles © Esri"
      }

    );


  const street =
    L.tileLayer(

      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

      {
        maxZoom:
          19,

        attribution:
          "© OpenStreetMap"
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
    }
  ).addTo(
    state.map
  );


  renderMapMarkers();

}



function renderMapMarkers() {

  if (!state.map) {

    return;

  }


  state.markers.forEach(
    marker =>
      state.map.removeLayer(
        marker
      )
  );


  state.markers =
    [];


  stations.forEach(
    station => {

      const coords =
        getStationCoordinates(
          station
        );


      const lat =
        coords[0];


      const lng =
        coords[1];


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
          coords,
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
            --popup-color:${station.color}
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
                : "ไม่มีข้อมูล"
            }

          </div>

        </div>

        `
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
      "water-theme"
    );


  if (
    saved === "dark" ||
    saved === "light"
  ) {

    return saved;

  }


  return (
    window.matchMedia &&
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches
  )
    ? "dark"
    : "light";

}



function applyTheme(theme) {

  document.documentElement
    .setAttribute(
      "data-theme",
      theme
    );


  localStorage.setItem(
    "water-theme",
    theme
  );


  $("#themeIcon").textContent =
    theme === "dark"
      ? "☀"
      : "☾";


  $("#themeText").textContent =
    theme === "dark"
      ? "สว่าง"
      : "มืด";


  if (
    Object.keys(
      state.data
    ).length
  ) {

    renderChart();

  }

}



$("#themeToggle")
  ?.addEventListener(
    "click",
    () => {

      const current =
        document.documentElement
          .getAttribute(
            "data-theme"
          );


      applyTheme(
        current === "dark"
          ? "light"
          : "dark"
      );

    }
  );


// ============================================================
// DOWNLOAD
// ============================================================

function csvCell(value) {

  return (
    '"' +
    String(
      value ?? ""
    ).replace(
      /"/g,
      '""'
    ) +
    '"'
  );

}



function downloadBlob(
  content,
  filename,
  type
) {

  const blob =
    new Blob(
      [content],
      {
        type
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


  link.click();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );

}



function exportDate(timestamp) {

  return formatDate(
    timestamp,
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric"
    }
  );

}



function exportTime(timestamp) {

  return formatDate(
    timestamp,
    {
      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit"
    }
  );

}



function makeCsv(
  station,
  readings
) {

  const rows =
    [

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

      rows.push(
        [

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

        ]
      );

    }
  );


  return rows
    .map(
      row =>
        row
          .map(
            csvCell
          )
          .join(",")
    )
    .join("\r\n");

}



$("#downloadSelectedCsv")
  ?.addEventListener(
    "click",
    () => {

      const station =
        stations.find(
          s =>
            s.id ===
            state.selectedStationId
        );


      const readings =
        (
          state.data[
            station.id
          ] || []
        ).filter(
          r =>
            !state.selectedDate ||
            dateKey(
              r.timestamp
            ) ===
            state.selectedDate
        );


      downloadBlob(

        "\uFEFF" +
        makeCsv(
          station,
          readings
        ),

        `station-${station.id}-${state.selectedDate || "all"}.csv`,

        "text/csv;charset=utf-8"

      );


      $("#downloadMenu")
        .classList.remove(
          "show"
        );

    }
  );



$("#downloadAllCsv")
  ?.addEventListener(
    "click",
    () => {

      const rows =
        [

          [
            "สถานี",
            "วันที่",
            "เวลา",
            "ระดับน้ำ (m)",
            "Latitude",
            "Longitude"
          ]

        ];


      stations.forEach(
        station => {

          (
            state.data[
              station.id
            ] || []
          )

            .filter(
              r =>
                !state.selectedDate ||
                dateKey(
                  r.timestamp
                ) ===
                state.selectedDate
            )

            .forEach(
              reading => {

                rows.push(
                  [

                    station.name,

                    exportDate(
                      reading.timestamp
                    ),

                    exportTime(
                      reading.timestamp
                    ),

                    reading.level ?? "",

                    reading.latitude ?? "",

                    reading.longitude ?? ""

                  ]
                );

              }
            );

        }
      );


      const csv =
        rows
          .map(
            row =>
              row
                .map(
                  csvCell
                )
                .join(",")
          )
          .join("\r\n");


      downloadBlob(

        "\uFEFF" +
        csv,

        `water-all-${state.selectedDate || "all"}.csv`,

        "text/csv;charset=utf-8"

      );


      $("#downloadMenu")
        .classList.remove(
          "show"
        );

    }
  );



$("#downloadSummaryCsv")
  ?.addEventListener(
    "click",
    () => {

      const rows =
        [

          [
            "สถานี",
            "วันที่",
            "ล่าสุด",
            "เฉลี่ย",
            "ต่ำสุด",
            "สูงสุด",
            "จำนวนข้อมูล"
          ]

        ];


      stations.forEach(
        station => {

          const stats =
            getDailyStats(
              station.id,
              state.selectedDate
            );


          rows.push(
            [

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

            ]
          );

        }
      );


      const csv =
        rows
          .map(
            row =>
              row
                .map(
                  csvCell
                )
                .join(",")
          )
          .join("\r\n");


      downloadBlob(

        "\uFEFF" +
        csv,

        `summary-${state.selectedDate}.csv`,

        "text/csv;charset=utf-8"

      );

    }
  );



$("#downloadJson")
  ?.addEventListener(
    "click",
    () => {

      const backup =
        {

          exportedAt:
            new Date()
              .toISOString(),

          stations:
            stations.map(
              station => ({
                id:
                  station.id,

                name:
                  station.name,

                readings:
                  state.data[
                    station.id
                  ] || []
              })
            )

        };


      downloadBlob(

        JSON.stringify(
          backup,
          null,
          2
        ),

        "water-backup.json",

        "application/json"

      );

    }
  );



$("#downloadMenuButton")
  ?.addEventListener(
    "click",
    event => {

      event.stopPropagation();


      $("#downloadMenu")
        .classList.toggle(
          "show"
        );

    }
  );


document.addEventListener(
  "click",
  () => {

    $("#downloadMenu")
      ?.classList.remove(
        "show"
      );

  }
);


// ============================================================
// RENDER
// ============================================================

function renderEverything() {

  renderCards();

  renderStationSelect();

  renderDateInput();

  renderModeButtons();

  renderSummary();

  renderChart();


  if (!state.map) {

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
    "กำลังโหลดข้อมูล...";


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

      .filter(Boolean)

      .sort(
        (a,b) =>
          new Date(
            b.timestamp
          ) -
          new Date(
            a.timestamp
          )
      )[0];


  $("#globalUpdated").textContent =
    newest
      ? "ข้อมูลล่าสุด · " +
        formatDate(
          newest.timestamp
        )
      : "ไม่มีข้อมูล";

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

      renderEverything();

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

      renderEverything();

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

      renderEverything();

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

        renderEverything();

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

        renderEverything();

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


// หน้าเว็บดึง Google Sheet ใหม่ทุก 1 นาที

setInterval(
  refreshData,
  60000
);


refreshData();
