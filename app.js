// ============================================================
// RMUTL FLOOD MONITOR
// Modern Dashboard Version
//
// สำคัญ:
// - ใช้ config.js เดิม
// - ใช้ Google Sheet เดิม
// - ไม่เปลี่ยน station ID
// - ไม่เปลี่ยนรูปแบบข้อมูล
// ============================================================


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
    ).replace(
      "#",
      ""
    );


  const number =
    parseInt(
      color,
      16
    );


  const red =
    (number >> 16) & 255;


  const green =
    (number >> 8) & 255;


  const blue =
    number & 255;


  return (
    `rgba(` +
    `${red},` +
    `${green},` +
    `${blue},` +
    `${opacity})`
  );
}



// ============================================================
// DATE / TIME
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

  catch (error) {

    return "—";

  }

}



// ============================================================
// DATE KEY
// ============================================================

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


    return (
      `${year}-` +
      `${month}-` +
      `${day}`
    );

  }

  catch (error) {

    return "";

  }

}



// ============================================================
// GET THAI HOUR
// ============================================================

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


  const number =
    Number(
      hour === "24"
        ? 0
        : hour
    );


  if (
    !Number.isInteger(
      number
    )
  ) {

    return null;

  }


  return number;

}



// ============================================================
// TIME FORMAT
// ============================================================

function normalizeTimeText(value) {

  const time =
    String(
      value || ""
    )
      .replace(
        /"/g,
        ""
      )
      .trim();


  const match =
    time.match(
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



// ============================================================
// BUILD TIMESTAMP
// ============================================================

function buildThaiTimestamp(
  dateText,
  timeText
) {

  let date =
    String(
      dateText || ""
    )
      .replace(
        /"/g,
        ""
      )
      .trim();


  let time =
    String(
      timeText || ""
    )
      .replace(
        /"/g,
        ""
      )
      .trim();


  if (!date) {

    return null;

  }



  // ----------------------------------------------------------
  // ข้อมูลเก่า
  // 10/8/2026, 14:22:30
  // ----------------------------------------------------------

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



  // ----------------------------------------------------------
  // DD/MM/YYYY
  // ----------------------------------------------------------

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
      (
        `${year}-` +
        `${month}-` +
        `${day}T` +
        `${time}+07:00`
      );


    return (
      Number.isNaN(
        new Date(
          timestamp
        ).getTime()
      )

        ? null

        : timestamp
    );

  }



  // ----------------------------------------------------------
  // YYYY-MM-DD
  // ----------------------------------------------------------

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
      (
        `${year}-` +
        `${month}-` +
        `${day}T` +
        `${time}+07:00`
      );


    return (
      Number.isNaN(
        new Date(
          timestamp
        ).getTime()
      )

        ? null

        : timestamp
    );

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



// ============================================================
// HEADER
// ============================================================

function normalizeHeader(value) {

  return String(
    value || ""
  )

    .replace(
      /"/g,
      ""
    )

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



// ============================================================
// NUMBER
// ============================================================

function parseNumberCell(value) {

  let raw =
    String(
      value ?? ""
    )

      .replace(
        /"/g,
        ""
      )

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


  return (
    Number.isFinite(
      number
    )

      ? number

      : null
  );

}



// ============================================================
// PARSE CSV
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

      .split(
        /\r?\n/
      )

      .filter(
        (line) =>
          line.trim() !== ""
      )

      .map(
        splitCsvLine
      );


  let headerRowIndex =
    -1;



  // ----------------------------------------------------------
  // FIND HEADER
  // ----------------------------------------------------------

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
      headers.join(
        " "
      );


    const hasDate =
      (
        text.includes(
          "วันที่"
        ) ||
        text.includes(
          "date"
        )
      );


    const hasLatitude =
      (
        text.includes(
          "latitude"
        ) ||
        headers.includes(
          "lat"
        )
      );


    const hasLongitude =
      (
        text.includes(
          "longitude"
        ) ||
        headers.includes(
          "lng"
        ) ||
        headers.includes(
          "lon"
        )
      );


    if (
      hasDate &&
      hasLatitude &&
      hasLongitude
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

    console.error(
      "ไม่พบหัวตาราง"
    );

    return [];

  }



  const headers =
    rows[
      headerRowIndex
    ].map(
      normalizeHeader
    );



  // ----------------------------------------------------------
  // COLUMN INDEX
  // ----------------------------------------------------------

  let dateIndex =
    headers.findIndex(
      (h) =>
        (
          h.includes(
            "วันที่"
          ) ||
          h === "date"
        )
    );


  let timeIndex =
    headers.findIndex(
      (h) =>
        (
          h.includes(
            "เวลา"
          ) ||
          h === "time"
        )
    );


  let distanceIndex =
    headers.findIndex(
      (h) => {

        const value =
          String(
            h || ""
          );


        return (

          value.includes(
            "ระดับน้ำ"
          )

          ||

          value.includes(
            "ระยะน้ำ"
          )

          ||

          value.includes(
            "ระยะทาง"
          )

          ||

          value.includes(
            "distance"
          )

          ||

          value.includes(
            "water level"
          )

          ||

          value.includes(
            "water_level"
          )

          ||

          value ===
            "level"

        );

      }
    );


  let latitudeIndex =
    headers.findIndex(
      (h) =>
        (
          h.includes(
            "latitude"
          ) ||
          h === "lat"
        )
    );


  let longitudeIndex =
    headers.findIndex(
      (h) =>
        (
          h.includes(
            "longitude"
          ) ||
          h === "lng" ||
          h === "lon"
        )
    );



  // ----------------------------------------------------------
  // FALLBACK
  //
  // A วันที่
  // B เวลา
  // C ระดับน้ำ
  // D Latitude
  // E Longitude
  // ----------------------------------------------------------

  if (
    dateIndex === -1
  ) {

    dateIndex =
      0;

  }


  if (
    timeIndex === -1
  ) {

    timeIndex =
      1;

  }


  if (
    distanceIndex === -1
  ) {

    distanceIndex =
      2;

  }


  if (
    latitudeIndex === -1
  ) {

    latitudeIndex =
      3;

  }


  if (
    longitudeIndex === -1
  ) {

    longitudeIndex =
      4;

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



  const results =
    [];



  // ----------------------------------------------------------
  // READ ROWS
  // ----------------------------------------------------------

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
        row[
          dateIndex
        ] || ""
      )

        .replace(
          /"/g,
          ""
        )

        .trim();



    let timeText =
      String(
        row[
          timeIndex
        ] || ""
      )

        .replace(
          /"/g,
          ""
        )

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



    // --------------------------------------------------------
    // OLD FORMAT
    // --------------------------------------------------------

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



    results.push(
      {

        timestamp:

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

      }
    );

  }



  results.sort(
    (a, b) =>
      (
        new Date(
          a.timestamp
        )

        -

        new Date(
          b.timestamp
        )
      )
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
      station.googleSheetCsv.includes(
        "?"
      )

        ? "&"

        : "?";


    const url =
      (
        station.googleSheetCsv +
        separator +
        "_=" +
        Date.now()
      );


    const response =
      await fetch(
        url,
        {

          cache:
            "no-store"

        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    const text =
      await response.text();


    return parseCsv(
      text
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


  if (
    readings.length ===
    0
  ) {

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



// ============================================================
// STATUS
// ============================================================

function getStatus(station) {

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


  const reading =
    latestLevelReading(
      station
    );


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
    )

    &&

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



// ============================================================
// RANGE
// ============================================================

function getRange(station) {

  const levels =
    (
      state.data[
        station.id
      ] || []
    )

      .map(
        (reading) =>
          reading.level
      )

      .filter(
        Number.isFinite
      );


  if (
    levels.length ===
    0
  ) {

    return null;

  }


  return {

    min:
      Math.min(
        ...levels
      ),

    max:
      Math.max(
        ...levels
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
    stations

      .map(
        (station) => {

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


          const level =
            (
              reading &&
              Number.isFinite(
                reading.level
              )
            )

              ? reading.level.toFixed(
                  3
                )

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

              data-station-id="
                ${station.id}
              "

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

                  ${
                    stations.indexOf(
                      station
                    ) + 1
                  }

                </div>


              </div>


              <div class="station-name">

                ${station.name}

              </div>


              <div class="station-main-value">

                ${level}

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
                        ? range.min.toFixed(
                            3
                          )
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
                        ? range.max.toFixed(
                            3
                          )
                        : "—"
                    }

                  </strong>

                </div>


              </div>


              <div class="station-update">

                ${
                  reading

                    ? (
                        "อัปเดต " +
                        formatDate(
                          reading.timestamp
                        )
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
      (button) => {

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
          (
            `<option value="${station.id}">` +
            `${station.name}` +
            `</option>`
          )
      )

      .join("");


  select.value =
    state.selectedStationId;

}



// ============================================================
// AVAILABLE DATES
// ============================================================

function getAvailableDates() {

  let readings =
    [];


  if (
    state.chartMode ===
    "all"
  ) {

    stations.forEach(
      (station) => {

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
          (reading) =>
            dateKey(
              reading.timestamp
            )
        )

        .filter(Boolean)

    )

  ].sort();

}



// ============================================================
// DATE INPUT
// ============================================================

function renderDateInput() {

  const input =
    $("#dateInput");


  if (!input) {

    return;

  }


  const dates =
    getAvailableDates();


  if (
    dates.length ===
    0
  ) {

    state.selectedDate =
      "";


    input.value =
      "";


    return;

  }


  if (
    !state.selectedDate

    ||

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
// GET READINGS BY DATE
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
      (reading) =>
        (
          dateKey(
            reading.timestamp
          ) === selectedDate

          &&

          Number.isFinite(
            reading.level
          )
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
    (reading) => {

      const hour =
        getThaiHour(
          reading.timestamp
        );


      if (
        hour === null

        ||

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
    (bucket) => {

      if (
        bucket.values.length ===
        0
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
          (total, value) =>
            total + value,
          0
        );


      return {

        hour:
          bucket.hour,

        average:
          (
            sum /
            bucket.values.length
          ),

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
  date
) {

  const readings =
    getReadingsForDate(
      stationId,
      date
    );


  if (
    readings.length ===
    0
  ) {

    return null;

  }


  const values =
    readings.map(
      (reading) =>
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

    average:
      (
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        )

        /

        values.length
      ),

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


  if (!container) {

    return;

  }


  if (
    !state.selectedDate
  ) {

    container.innerHTML =
      "";

    return;

  }



  // ----------------------------------------------------------
  // ALL STATIONS
  // ----------------------------------------------------------

  if (
    state.chartMode ===
    "all"
  ) {

    container.innerHTML =
      stations.map(
        (station) => {

          const stats =
            getDailyStats(
              station.id,
              state.selectedDate
            );


          return `

            <div

              class="summary-card"

              style="
                --summary-color:${station.color};
              "
            >

              <div class="summary-color-line">
              </div>

              <span class="summary-title">

                ${station.shortName}

              </span>


              <strong class="summary-big">

                ${
                  stats
                    ? stats.latest.toFixed(
                        3
                      )
                    : "—"
                }

                <small>
                  ${station.unit}
                </small>

              </strong>


              <span class="summary-description">

                ${
                  stats

                    ? (
                        `เฉลี่ย ${stats.average.toFixed(3)} เมตร`
                      )

                    : "ไม่มีข้อมูล"
                }

              </span>

            </div>

          `;

        }
      ).join("");


    return;

  }



  // ----------------------------------------------------------
  // SINGLE STATION
  // ----------------------------------------------------------

  const station =
    stations.find(
      (station) =>
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
          ยังไม่มีข้อมูลในวันที่เลือก
        </div>
      `;

    return;

  }


  const items =
    [

      {

        title:
          "ค่าล่าสุด",

        value:
          stats.latest.toFixed(
            3
          ),

        icon:
          "◉",

        description:
          formatDate(
            stats.latestTime,
            {

              hour:
                "2-digit",

              minute:
                "2-digit"

            }
          )

      },


      {

        title:
          "ค่าเฉลี่ย",

        value:
          stats.average.toFixed(
            3
          ),

        icon:
          "≈",

        description:
          `${stats.count} จุดวัด`

      },


      {

        title:
          "ต่ำสุด",

        value:
          stats.min.toFixed(
            3
          ),

        icon:
          "↓",

        description:
          "ของวันที่เลือก"

      },


      {

        title:
          "สูงสุด",

        value:
          stats.max.toFixed(
            3
          ),

        icon:
          "↑",

        description:
          "ของวันที่เลือก"

      }

    ];


  container.innerHTML =
    items.map(
      (item) =>
        `

          <div class="summary-card">

            <div class="summary-icon">

              ${item.icon}

            </div>

            <div>

              <span class="summary-title">

                ${item.title}

              </span>

              <strong class="summary-big">

                ${item.value}

                <small>
                  ${station.unit}
                </small>

              </strong>

              <span class="summary-description">

                ${item.description}

              </span>

            </div>

          </div>

        `
    ).join("");

}



// ============================================================
// MODE BUTTON
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
          24

      },

      (_, hour) =>
        (
          String(
            hour
          ).padStart(
            2,
            "0"
          )

          +

          ":00"
        )
    );


  let datasets =
    [];


  let hourlyInformation =
    {};



  // ----------------------------------------------------------
  // ALL STATIONS
  // ----------------------------------------------------------

  if (
    state.chartMode ===
    "all"
  ) {

    $("#chartTitle").textContent =
      "เปรียบเทียบระดับน้ำทั้ง 3 สถานี";


    stations.forEach(
      (station) => {

        const readings =
          getReadingsForDate(
            station.id,
            state.selectedDate
          );


        const hourly =
          aggregateHourly(
            readings
          );


        hourlyInformation[
          station.id
        ] =
          hourly;


        datasets.push(
          {

            label:
              station.shortName,

            data:
              hourly.map(
                (item) =>
                  item.average
              ),

            borderColor:
              station.color,

            backgroundColor:
              station.color,

            borderWidth:
              3,

            pointRadius:
              3,

            pointHoverRadius:
              8,

            pointBackgroundColor:
              "#ffffff",

            pointBorderColor:
              station.color,

            pointBorderWidth:
              2,

            tension:
              0.38,

            spanGaps:
              false

          }
        );

      }
    );


    $("#chartNotice").textContent =
      (
        "แต่ละจุดแสดงค่าเฉลี่ยของข้อมูลภายในชั่วโมงนั้น " +
        "สามารถชี้เมาส์ที่จุดเพื่อดูค่าของทั้ง 3 สถานีพร้อมกัน"
      );

  }



  // ----------------------------------------------------------
  // SINGLE STATION
  // ----------------------------------------------------------

  else {

    const station =
      stations.find(
        (station) =>
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


    hourlyInformation[
      station.id
    ] =
      hourly;



    $("#chartTitle").textContent =
      (
        "ระดับน้ำ · " +
        station.shortName
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
        450
      );


    gradient.addColorStop(
      0,
      hexToRgba(
        station.color,
        0.24
      )
    );


    gradient.addColorStop(
      1,
      hexToRgba(
        station.color,
        0.01
      )
    );



    datasets =
      [

        {

          label:
            station.shortName,

          data:
            hourly.map(
              (item) =>
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

          pointRadius:
            4,

          pointHoverRadius:
            9,

          pointBackgroundColor:
            "#ffffff",

          pointBorderColor:
            station.color,

          pointBorderWidth:
            3,

          tension:
            0.4,

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
            "#f08c46",

          backgroundColor:
            "#f08c46",

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
      (
        readings.length

          ? (
              `ข้อมูล ${readings.length} จุดวัด ` +
              "ถูกคำนวณเป็นค่าเฉลี่ยรายชั่วโมง · " +
              "เส้นประสีส้มคือระดับเฝ้าระวัง"
            )

          : "ยังไม่มีข้อมูลระดับน้ำสำหรับวันที่เลือก"
      );

  }



  // ----------------------------------------------------------
  // DATE
  // ----------------------------------------------------------

  $("#chartDateLabel").textContent =
    state.selectedDate

      ? formatDate(
          (
            state.selectedDate +
            "T12:00:00+07:00"
          ),
          {

            dateStyle:
              "full"

          }
        )

      : "ยังไม่มีข้อมูล";



  // ----------------------------------------------------------
  // CHART
  // ----------------------------------------------------------

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
                  450,

                easing:
                  "easeOutQuart"

              },


            layout:
              {

                padding:
                  {

                    top:
                      10,

                    left:
                      5,

                    right:
                      15,

                    bottom:
                      5

                  }

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

                        usePointStyle:
                          true,

                        pointStyle:
                          "circle",

                        boxWidth:
                          8,

                        boxHeight:
                          8,

                        padding:
                          22,

                        color:
                          "#526c79",

                        font:
                          {

                            family:
                              "'Noto Sans Thai', sans-serif",

                            size:
                              11,

                            weight:
                              "600"

                          }

                      }

                  },


                tooltip:
                  {

                    backgroundColor:
                      "rgba(10, 34, 47, 0.96)",

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

                    boxPadding:
                      6,

                    titleFont:
                      {

                        family:
                          "'Noto Sans Thai', sans-serif",

                        weight:
                          "700",

                        size:
                          12

                      },

                    bodyFont:
                      {

                        family:
                          "'Noto Sans Thai', sans-serif",

                        size:
                          12

                      },


                    callbacks:
                      {

                        title:
                          (items) => {

                            if (
                              !items.length
                            ) {

                              return "";

                            }


                            return (
                              "เวลา " +
                              items[0].label +
                              " น."
                            );

                          },


                        label:
                          (context) => {

                            if (
                              context.raw === null

                              ||

                              !Number.isFinite(
                                Number(
                                  context.raw
                                )
                              )
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
                          "rgba(124, 148, 159, 0.12)",

                        drawTicks:
                          false

                      },

                    ticks:
                      {

                        color:
                          "#8a9da6",

                        padding:
                          12,

                        font:
                          {

                            size:
                              10

                          },

                        callback:
                          (value) =>
                            Number(
                              value
                            ).toFixed(
                              1
                            )

                      },

                    title:
                      {

                        display:
                          true,

                        text:
                          "ระดับน้ำ (เมตร)",

                        color:
                          "#7a909b",

                        font:
                          {

                            family:
                              "'Noto Sans Thai', sans-serif",

                            size:
                              10,

                            weight:
                              "600"

                          }

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
                          "#899ca6",

                        padding:
                          12,

                        maxRotation:
                          0,

                        autoSkip:
                          false,

                        font:
                          {

                            size:
                              10

                          },

                        callback:
                          function (
                            value,
                            index
                          ) {

                            return (
                              index % 2 === 0

                                ? labels[
                                    index
                                  ]

                                : ""
                            );

                          }

                      },

                    title:
                      {

                        display:
                          true,

                        text:
                          "เวลา (รายชั่วโมง)",

                        color:
                          "#7a909b",

                        font:
                          {

                            family:
                              "'Noto Sans Thai', sans-serif",

                            size:
                              10,

                            weight:
                              "600"

                          }

                      }

                  }

              }

          }

      }
    );

}



// ============================================================
// MARKER ICON
// ============================================================

function createMarkerIcon(
  station,
  selected
) {

  return L.divIcon(
    {

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
        [0, -24]

    }
  );

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
      Number.isFinite(
        lat
      )

      &&

      Number.isFinite(
        lng
      )

      &&

      lat !== 0

      &&

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



// ============================================================
// MAP SETUP
// ============================================================

function setupMap() {

  if (
    state.map
  ) {

    return;

  }


  const station =
    stations.find(
      (station) =>
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

        center:
          coords,

        zoom:
          16,

        zoomControl:
          true

      }
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

    },

    null,

    {

      position:
        "topright",

      collapsed:
        true

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

      const coordinates =
        getStationCoordinates(
          station
        );


      const lat =
        Number(
          coordinates[0]
        );


      const lng =
        Number(
          coordinates[1]
        );


      if (
        !Number.isFinite(
          lat
        )

        ||

        !Number.isFinite(
          lng
        )
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
          [

            lat,

            lng

          ],
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

                    ? reading.level.toFixed(
                        3
                      )

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

                  ${lat.toFixed(
                    6
                  )}

                </strong>

              </div>


              <div>

                <span>
                  LONGITUDE
                </span>

                <strong>

                  ${lng.toFixed(
                    6
                  )}

                </strong>

              </div>


            </div>



            <div class="popup-footer">

              ${
                reading

                  ? (
                      "อัปเดต " +
                      formatDate(
                        reading.timestamp
                      )
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


          renderCards();

          renderStationSelect();

          renderModeButtons();

          renderDateInput();

          renderSummary();

          renderChart();

        }
      );



      state.markers.push(
        marker
      );

    }
  );

}



// ============================================================
// RENDER EVERYTHING
// ============================================================

function renderEverything() {

  renderCards();

  renderStationSelect();

  renderModeButtons();

  renderDateInput();

  renderSummary();

  renderChart();


  if (
    !state.map
  ) {

    setupMap();

  }

  else {

    renderMapMarkers();

  }


  const station =
    stations.find(
      (station) =>
        station.id ===
        state.selectedStationId
    );


  if (
    station &&
    state.map
  ) {

    const coordinates =
      getStationCoordinates(
        station
      );


    if (
      Number.isFinite(
        coordinates[0]
      )

      &&

      Number.isFinite(
        coordinates[1]
      )
    ) {

      state.map.flyTo(
        coordinates,
        16,
        {

          duration:
            0.7

        }
      );

    }

  }

}



// ============================================================
// REFRESH DATA
// ============================================================

async function refreshData() {

  const globalUpdated =
    $("#globalUpdated");


  if (
    globalUpdated
  ) {

    globalUpdated.textContent =
      "กำลังโหลดข้อมูล...";

  }



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



  renderEverything();



  const newest =
    stations

      .map(
        (station) =>
          latestReading(
            station
          )
      )

      .filter(
        (reading) =>
          (
            reading &&
            reading.timestamp &&
            !Number.isNaN(
              new Date(
                reading.timestamp
              ).getTime()
            )
          )
      )

      .sort(
        (a, b) =>
          (
            new Date(
              b.timestamp
            )

            -

            new Date(
              a.timestamp
            )
          )
      )[0];



  if (
    globalUpdated
  ) {

    globalUpdated.textContent =
      newest

        ? (
            "ข้อมูลล่าสุด · " +
            formatDate(
              newest.timestamp
            )
          )

        : "ยังไม่มีข้อมูลจากสถานี";

  }

}



// ============================================================
// EVENTS
// ============================================================

$("#stationSelect")
  ?.addEventListener(
    "change",
    (event) => {

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
    (event) => {

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


      renderModeButtons();

      renderDateInput();

      renderSummary();

      renderChart();

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

        renderSummary();

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
        index >= 0

        &&

        index <
          dates.length - 1
      ) {

        state.selectedDate =
          dates[
            index + 1
          ];


        renderDateInput();

        renderSummary();

        renderChart();

      }

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
