const defaultStations =
  window.WATER_APP_CONFIG.stations.map(
    station => ({
      maxPipeHeight: 3.16,
      ...station
    })
  );


const CUSTOM_STATIONS_KEY =
  "rmutl-flood-monitor-custom-stations";


const SAVED_STATIONS_KEY =
  "rmutl-flood-monitor-stations-v2";


function loadSavedStations() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(
          SAVED_STATIONS_KEY
        ) || "null"
      );


    if (
      Array.isArray(saved) &&
      saved.length
    ) {

      return saved.map(
        station => ({
          maxPipeHeight: 3.16,
          unit: "เมตร",
          ...station
        })
      );

    }


    const legacyCustom =
      JSON.parse(
        localStorage.getItem(
          CUSTOM_STATIONS_KEY
        ) || "[]"
      );


    return [

      ...defaultStations.map(
        station => ({
          ...station
        })
      ),

      ...(
        Array.isArray(legacyCustom)
          ? legacyCustom
          : []
      ).map(
        station => ({
          maxPipeHeight: 3.16,
          unit: "เมตร",
          ...station
        })
      )

    ];

  }

  catch (error) {

    console.error(
      "ไม่สามารถอ่านข้อมูลสถานี",
      error
    );


    return defaultStations.map(
      station => ({
        ...station
      })
    );

  }

}


const stations =
  loadSavedStations();


function saveStations() {

  try {

    localStorage.setItem(
      SAVED_STATIONS_KEY,
      JSON.stringify(stations)
    );

  }

  catch (error) {

    console.error(
      "ไม่สามารถบันทึกข้อมูลสถานี",
      error
    );

  }

}


function escapeHtml(value) {

  return String(
    value ?? ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


const state = {

  selectedStationId:
    stations[0]?.id || "",

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
  selector =>
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
      ).formatToParts(
        date
      );


    const year =
      parts.find(
        part =>
          part.type === "year"
      )?.value;


    const month =
      parts.find(
        part =>
          part.type === "month"
      )?.value;


    const day =
      parts.find(
        part =>
          part.type === "day"
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

  catch {

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
          ? "0"
          : hour
      );


    return Number.isInteger(number)
      ? number
      : null;

  }

  catch {

    return null;

  }

}


function normalizeTimeText(value) {

  const text =
    String(
      value || ""
    )

      .replace(
        /"/g,
        ""
      )

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


  /*
   * รองรับค่าทศนิยมที่ใช้เครื่องหมาย comma
   */
  raw =
    raw.replace(
      ",",
      "."
    );


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

      .split(
        /\r?\n/
      )

      .filter(
        line =>
          line.trim() !== ""
      )

      .map(
        splitCsvLine
      );


  let headerRowIndex =
    -1;


  /*
   * ค้นหาแถวหัวตาราง
   */
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
      text.includes(
        "วันที่"
      ) ||
      text.includes(
        "date"
      );


    const hasLatitude =
      text.includes(
        "latitude"
      ) ||
      headers.includes(
        "lat"
      );


    const hasLongitude =
      text.includes(
        "longitude"
      ) ||
      headers.includes(
        "lng"
      ) ||
      headers.includes(
        "lon"
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
    headerRowIndex === -1
  ) {

    console.error(
      "ไม่พบหัวตารางใน Google Sheets"
    );


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
      header =>
        header.includes(
          "วันที่"
        ) ||
        header === "date"
    );


  let timeIndex =
    headers.findIndex(
      header =>
        header.includes(
          "เวลา"
        ) ||
        header === "time"
    );


  let distanceIndex =
    headers.findIndex(
      header =>
        header.includes(
          "ระดับน้ำ"
        ) ||
        header.includes(
          "ระยะน้ำ"
        ) ||
        header.includes(
          "ระยะทาง"
        ) ||
        header.includes(
          "distance"
        ) ||
        header.includes(
          "water level"
        ) ||
        header.includes(
          "water_level"
        ) ||
        header === "level"
    );


  let latitudeIndex =
    headers.findIndex(
      header =>
        header.includes(
          "latitude"
        ) ||
        header === "lat"
    );


  let longitudeIndex =
    headers.findIndex(
      header =>
        header.includes(
          "longitude"
        ) ||
        header === "lng" ||
        header === "lon"
    );


  /*
   * ใช้ลำดับคอลัมน์มาตรฐาน
   * หากไม่พบชื่อหัวตาราง
   */
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


  const results =
    [];


  /*
   * อ่านข้อมูลทีละแถว
   */
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


    /*
     * รองรับข้อมูลรูปแบบเก่า
     * ที่วันที่และเวลาอยู่ในเซลล์เดียวกัน
     */
    const oldFormat =
      dateText.match(
        /^(\d{1,2}\/\d{1,2}\/\d{4})\s*,\s*(\d{1,2}:\d{2}(?::\d{2})?)$/
      );


    if (oldFormat) {

      dateText =
        oldFormat[1];


      timeText =
        oldFormat[2];


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


    /*
     * ข้ามแถวที่ไม่มีวันเวลาถูกต้อง
     */
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


  /*
   * เรียงข้อมูลจากเก่าไปใหม่
   */
  results.sort(
    (a, b) =>
      new Date(
        a.timestamp
      )
      -
      new Date(
        b.timestamp
      )
  );


  return results;

}
// ============================================================
// LOAD STATION DATA
// ============================================================

async function loadStation(station) {

  /*
   * ไม่โหลดข้อมูลหากสถานียังไม่ติดตั้ง
   * หรือไม่มีลิงก์ Google Sheets
   */
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


    /*
     * เพิ่ม timestamp ป้องกัน browser cache
     */
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


    const csvText =
      await response.text();


    return parseCsv(
      csvText
    );

  }

  catch (error) {

    console.error(
      `โหลดข้อมูลสถานี ${station.id} ไม่สำเร็จ`,
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


  /*
   * วนจากข้อมูลใหม่ที่สุดไปหาเก่าที่สุด
   * เพื่อหารายการล่าสุดที่มีค่าระดับน้ำ
   */
  for (
    let index =
      readings.length - 1;

    index >= 0;

    index--
  ) {

    if (
      Number.isFinite(
        readings[index].level
      )
    ) {

      return readings[index];

    }

  }


  return null;

}


function getRange(station) {

  const values =
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


function getStatus(station) {

  /*
   * สถานียังไม่ติดตั้ง
   */
  if (!station.deployed) {

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


  /*
   * สถานีไม่มีข้อมูลระดับน้ำ
   */
  if (!reading) {

    return {

      className:
        "offline",

      text:
        "ไม่มีข้อมูล"

    };

  }


  /*
   * ระดับน้ำถึงหรือสูงกว่าระดับเฝ้าระวัง
   */
  if (
    Number.isFinite(
      Number(
        station.warningLevel
      )
    ) &&
    reading.level >=
      Number(
        station.warningLevel
      )
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
// CARDS
// ============================================================

function renderCards() {

  const container =
    $("#stationCards");


  if (!container) {

    return;

  }


  if (!stations.length) {

    container.innerHTML = `
      <div class="station-empty">
        <strong>ยังไม่มีสถานี</strong>
        <span>กดปุ่ม “+ เพิ่มสถานี” เพื่อสร้างสถานีใหม่</span>
      </div>
    `;


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


        const stationId =
          escapeHtml(
            station.id
          );


        const stationName =
          escapeHtml(
            station.name
          );


        const stationUnit =
          escapeHtml(
            station.unit || "เมตร"
          );


        return `

          <article

            class="
              station-card
              ${
                station.id ===
                state.selectedStationId
                  ? "selected"
                  : ""
              }
            "

            data-station-id="${stationId}"

            tabindex="0"

            role="button"

            aria-label="เลือกสถานี ${stationName}"

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


              <div class="station-card-actions">

                <button
                  class="station-menu-button"
                  type="button"
                  data-station-menu="${stationId}"
                  aria-label="จัดการ ${stationName}"
                  aria-expanded="false"
                >
                  ⋮
                </button>


                <div
                  class="station-action-menu"
                  data-station-menu-panel="${stationId}"
                >

                  <button
                    type="button"
                    data-edit-station="${stationId}"
                  >
                    ✎ แก้ไขสถานี
                  </button>


                  <button
                    type="button"
                    class="danger"
                    data-delete-station="${stationId}"

                    ${
                      stations.length === 1
                        ? `
                          disabled
                          title="ต้องมีอย่างน้อย 1 สถานี"
                        `
                        : ""
                    }
                  >
                    ⌫ ลบสถานี
                  </button>

                </div>


                <div class="station-number">

                  ${index + 1}

                </div>

              </div>

            </div>


            <div class="station-name">

              ${stationName}

            </div>


            <div class="station-reading-layout">

              <div class="station-reading-info">

                <div class="station-main-value">

                  ${
                    reading
                      ? reading.level.toFixed(3)
                      : "—"
                  }

                  <small>
                    ${stationUnit}
                  </small>

                </div>


                <div class="station-label">

                  ระดับน้ำล่าสุด

                </div>


                <div class="station-stat-row">

                  <div>

                    <span>
                      ต่ำสุดทั้งหมด
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
                      สูงสุดทั้งหมด
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

              </div>


              ${
                renderPipeGauge(
                  station,
                  reading
                )
              }

            </div>

          </article>

        `;

      }
    ).join("");


  /*
   * เลือกสถานีโดยกดที่การ์ด
   */
  document
    .querySelectorAll(
      "[data-station-id]"
    )
    .forEach(
      card => {

        const selectCard =
          event => {

            if (
              event.type === "keydown" &&
              ![
                "Enter",
                " "
              ].includes(
                event.key
              )
            ) {

              return;

            }


            /*
             * ไม่เปลี่ยนสถานีเมื่อกดเมนู
             * หรือกรอกค่าความสูงท่อ
             */
            if (
              event.target.closest(
                "button, input"
              )
            ) {

              return;

            }


            if (
              event.type === "keydown"
            ) {

              event.preventDefault();

            }


            state.selectedStationId =
              card.dataset.stationId;


            state.chartMode =
              "station";


            state.selectedDate =
              "";


            renderEverything(
              true
            );

          };


        card.addEventListener(
          "click",
          selectCard
        );


        card.addEventListener(
          "keydown",
          selectCard
        );

      }
    );


  setupStationCardActions();

}


// ============================================================
// PIPE GAUGE
// ============================================================

function renderPipeGauge(
  station,
  reading
) {

  const configuredMaximum =
    Number(
      station.maxPipeHeight
    );


  const maximum =
    Number.isFinite(
      configuredMaximum
    ) &&
    configuredMaximum > 0
      ? configuredMaximum
      : 3.16;


  const currentLevel =
    reading &&
    Number.isFinite(
      reading.level
    )
      ? reading.level
      : null;


  /*
   * ระดับน้ำในรูปท่อเป็นเปอร์เซ็นต์
   * จำกัดไว้ระหว่าง 0–100
   */
  const percentage =
    currentLevel === null
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            (
              currentLevel /
              maximum
            ) * 100
          )
        );


  const middleScale =
    maximum / 2;


  const stationId =
    escapeHtml(
      station.id
    );


  const stationName =
    escapeHtml(
      station.name
    );


  const stationUnit =
    escapeHtml(
      station.unit || "เมตร"
    );


  const levelText =
    currentLevel === null
      ? "ไม่มีข้อมูล"
      : currentLevel.toFixed(3);


  return `

    <div
      class="pipe-gauge"
      aria-label="
        ระดับน้ำ ${levelText}
        จาก ${maximum.toFixed(3)}
        ${stationUnit}
      "
    >

      <div class="pipe-visual">

        <div class="pipe-shell">

          <span
            class="pipe-water"
            style="height:${percentage}%"
          ></span>

        </div>


        <div class="pipe-scale">

          <span>
            ${maximum.toFixed(3)}
          </span>

          <span>
            ${middleScale.toFixed(3)}
          </span>

          <span>
            0
          </span>

        </div>

      </div>


      <label class="pipe-max-label">

        ระดับสูงสุดท่อ

        <span>

          <input
            type="number"
            min="0.001"
            step="0.001"
            value="${maximum.toFixed(3)}"
            data-pipe-max="${stationId}"
            aria-label="ระดับสูงสุดท่อ ${stationName}"
          >

          ${stationUnit}

        </span>

      </label>

    </div>

  `;

}


// ============================================================
// STATION CARD ACTIONS
// ============================================================

function setupStationCardActions() {

  /*
   * เปิดเมนูสามจุด
   */
  document
    .querySelectorAll(
      "[data-station-menu]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            const stationId =
              button.dataset.stationMenu;


            const panel =
              document.querySelector(
                `[data-station-menu-panel="${stationId}"]`
              );


            const willOpen =
              !panel?.classList.contains(
                "show"
              );


            document
              .querySelectorAll(
                ".station-action-menu.show"
              )
              .forEach(
                menu => {

                  menu.classList.remove(
                    "show"
                  );

                }
              );


            document
              .querySelectorAll(
                "[data-station-menu]"
              )
              .forEach(
                item => {

                  item.setAttribute(
                    "aria-expanded",
                    "false"
                  );

                }
              );


            panel?.classList.toggle(
              "show",
              willOpen
            );


            button.setAttribute(
              "aria-expanded",
              String(willOpen)
            );

          }
        );

      }
    );


  /*
   * แก้ไขสถานี
   */
  document
    .querySelectorAll(
      "[data-edit-station]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            openStationDialog(
              button.dataset.editStation
            );

          }
        );

      }
    );


  /*
   * ลบสถานี
   */
  document
    .querySelectorAll(
      "[data-delete-station]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            if (
              button.disabled
            ) {

              return;

            }


            openDeleteStationDialog(
              button.dataset.deleteStation
            );

          }
        );

      }
    );


  /*
   * เปลี่ยนระดับสูงสุดของท่อ
   */
  document
    .querySelectorAll(
      "[data-pipe-max]"
    )
    .forEach(
      input => {

        input.addEventListener(
          "click",
          event => {

            event.stopPropagation();

          }
        );


        input.addEventListener(
          "keydown",
          event => {

            event.stopPropagation();

          }
        );


        input.addEventListener(
          "change",
          () => {

            const station =
              stations.find(
                item =>
                  item.id ===
                  input.dataset.pipeMax
              );


            const value =
              Number(
                input.value
              );


            if (
              !station ||
              !Number.isFinite(value) ||
              value <= 0
            ) {

              input.value =
                Number(
                  station?.maxPipeHeight ||
                  3.16
                ).toFixed(3);


              return;

            }


            station.maxPipeHeight =
              value;


            saveStations();


            renderCards();

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


  if (!stations.length) {

    select.innerHTML =
      `<option value="">ไม่มีสถานี</option>`;


    select.value =
      "";


    select.disabled =
      true;


    return;

  }


  select.disabled =
    false;


  select.innerHTML =
    stations.map(
      station => {

        const stationId =
          escapeHtml(
            station.id
          );


        const stationName =
          escapeHtml(
            station.name
          );


        return `
          <option value="${stationId}">
            ${stationName}
          </option>
        `;

      }
    ).join("");


  /*
   * หากสถานีที่เลือกถูกลบ
   * ให้เลือกสถานีแรกแทน
   */
  const selectedExists =
    stations.some(
      station =>
        station.id ===
        state.selectedStationId
    );


  if (!selectedExists) {

    state.selectedStationId =
      stations[0].id;

  }


  select.value =
    state.selectedStationId;

}


// ============================================================
// DATE
// ============================================================

function getAvailableDates() {

  let readings =
    [];


  if (
    state.chartMode === "all"
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

    state.selectedDate =
      "";


    input.value =
      "";


    input.removeAttribute(
      "min"
    );


    input.removeAttribute(
      "max"
    );


    return;

  }


  /*
   * เลือกวันที่ล่าสุดอัตโนมัติ
   * หากยังไม่ได้เลือกวันที่
   */
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

  if (
    !stationId ||
    !selectedDate
  ) {

    return [];

  }


  return (
    state.data[
      stationId
    ] || []
  )

    .filter(
      reading =>

        dateKey(
          reading.timestamp
        ) === selectedDate

        &&

        Number.isFinite(
          reading.level
        )
    );

}


// ============================================================
// HOURLY
// ============================================================

function aggregateHourly(readings) {

  /*
   * สร้างช่องเก็บข้อมูล 24 ชั่วโมง
   */
  const buckets =
    Array.from(
      {
        length:
          24
      },

      () =>
        []
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

      if (!values.length) {

        return {

          hour,

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


      const total =
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        );


      return {

        hour,

        average:
          total /
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
  );

}


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

    average:
      values.reduce(
        (sum, value) =>
          sum + value,
        0
      )
      /
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


  if (!container) {

    return;

  }


  if (
    !state.selectedDate ||
    !stations.length
  ) {

    container.innerHTML =
      "";


    return;

  }


  /*
   * แสดงสรุปทุกสถานี
   */
  if (
    state.chartMode === "all"
  ) {

    container.innerHTML =
      stations.map(
        station => {

          const stats =
            getDailyStats(
              station.id,
              state.selectedDate
            );


          const shortName =
            escapeHtml(
              station.shortName ||
              station.name
            );


          const unit =
            escapeHtml(
              station.unit ||
              "เมตร"
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


              <div>

                <span class="summary-title">

                  ${shortName}

                </span>


                <strong class="summary-big">

                  ${
                    stats
                      ? stats.latest.toFixed(3)
                      : "—"
                  }

                  <small>
                    ${unit}
                  </small>

                </strong>


                <span class="summary-description">

                  ${
                    stats
                      ? `เฉลี่ย ${stats.average.toFixed(3)} ${unit}`
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


  /*
   * แสดงสรุปเฉพาะสถานีที่เลือก
   */
  const station =
    stations.find(
      item =>
        item.id ===
        state.selectedStationId
    );


  if (!station) {

    container.innerHTML =
      "";


    return;

  }


  const stats =
    getDailyStats(
      station.id,
      state.selectedDate
    );


  if (!stats) {

    container.innerHTML = `
      <div class="summary-empty">
        ไม่มีข้อมูลสำหรับวันที่เลือก
      </div>
    `;


    return;

  }


  const cards = [

    {
      icon:
        "◉",

      title:
        "ค่าล่าสุด",

      value:
        stats.latest
    },

    {
      icon:
        "≈",

      title:
        "ค่าเฉลี่ย",

      value:
        stats.average
    },

    {
      icon:
        "↓",

      title:
        "ต่ำสุด",

      value:
        stats.min
    },

    {
      icon:
        "↑",

      title:
        "สูงสุด",

      value:
        stats.max
    }

  ];


  const unit =
    escapeHtml(
      station.unit ||
      "เมตร"
    );


  container.innerHTML =
    cards.map(
      card => `

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
                ${unit}
              </small>

            </strong>

          </div>

        </div>

      `
    ).join("");

}


// ============================================================
// MODES
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


  if (
    !canvas ||
    typeof Chart === "undefined"
  ) {

    return;

  }


  /*
   * ทำลายกราฟเก่าก่อนสร้างกราฟใหม่
   */
  if (state.chart) {

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
        `${String(hour).padStart(2, "0")}:00`
    );


  const dark =
    document.documentElement
      .getAttribute(
        "data-theme"
      ) === "dark";


  const textColor =
    dark
      ? "#9fb4bd"
      : "#8397a1";


  const gridColor =
    dark
      ? "rgba(160,190,200,.09)"
      : "rgba(120,150,160,.12)";


  let datasets =
    [];


  /*
   * กราฟเปรียบเทียบทุกสถานี
   */
  if (
    state.chartMode === "all"
  ) {

    const chartTitle =
      $("#chartTitle");


    if (chartTitle) {

      chartTitle.textContent =
        `เปรียบเทียบระดับน้ำทั้ง ${stations.length} สถานี`;

    }


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
            station.shortName ||
            station.name,

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
            0.38,

          spanGaps:
            false

        });

      }
    );


    const chartNotice =
      $("#chartNotice");


    if (chartNotice) {

      chartNotice.textContent =
        `เปรียบเทียบค่าเฉลี่ยรายชั่วโมงของทั้ง ${stations.length} สถานี`;

    }

  }

  /*
   * กราฟเฉพาะสถานีที่เลือก
   */
  else {

    const station =
      stations.find(
        item =>
          item.id ===
          state.selectedStationId
      );


    if (!station) {

      const chartTitle =
        $("#chartTitle");


      if (chartTitle) {

        chartTitle.textContent =
          "ไม่มีสถานี";

      }


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


    const chartTitle =
      $("#chartTitle");


    if (chartTitle) {

      chartTitle.textContent =
        `ระดับน้ำ · ${
          station.shortName ||
          station.name
        }`;

    }


    const context =
      canvas.getContext(
        "2d"
      );


    const gradient =
      context.createLinearGradient(
        0,
        0,
        0,
        490
      );


    gradient.addColorStop(
      0,
      hexToRgba(
        station.color,
        dark
          ? 0.18
          : 0.26
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
          station.shortName ||
          station.name,

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
              Number(
                station.warningLevel
              )
          ),

        borderColor:
          "#f08a45",

        borderDash:
          [
            7,
            7
          ],

        borderWidth:
          2,

        pointRadius:
          0,

        fill:
          false
      }

    ];


    const chartNotice =
      $("#chartNotice");


    if (chartNotice) {

      chartNotice.textContent =
        readings.length
          ? `ข้อมูล ${readings.length} จุดวัด ถูกคำนวณเป็นค่าเฉลี่ยรายชั่วโมง`
          : "ไม่มีข้อมูลสำหรับวันที่เลือก";

    }

  }


  const chartDateLabel =
    $("#chartDateLabel");


  if (chartDateLabel) {

    chartDateLabel.textContent =
      state.selectedDate
        ? formatDate(
            `${state.selectedDate}T12:00:00+07:00`,
            {
              dateStyle:
                "full"
            }
          )
        : "ไม่มีข้อมูล";

  }


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
                              context.raw === null ||
                              context.raw === undefined
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

    html: `

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
      [
        54,
        54
      ],

    iconAnchor:
      [
        27,
        27
      ],

    popupAnchor:
      [
        0,
        -25
      ]

  });

}


function getStationCoordinates(station) {

  if (!station) {

    return null;

  }


  const readings =
    state.data[
      station.id
    ] || [];


  /*
   * ใช้พิกัดล่าสุดจาก Google Sheets ก่อน
   */
  for (
    let index =
      readings.length - 1;

    index >= 0;

    index--
  ) {

    const latitude =
      Number(
        readings[index].latitude
      );


    const longitude =
      Number(
        readings[index].longitude
      );


    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude !== 0 &&
      longitude !== 0
    ) {

      return [
        latitude,
        longitude
      ];

    }

  }


  /*
   * หากใน Google Sheets ไม่มีพิกัด
   * ให้ใช้พิกัดที่ตั้งค่าในสถานี
   */
  const fallbackLatitude =
    Number(
      station.latitude
    );


  const fallbackLongitude =
    Number(
      station.longitude
    );


  if (
    !Number.isFinite(fallbackLatitude) ||
    !Number.isFinite(fallbackLongitude)
  ) {

    return null;

  }


  return [
    fallbackLatitude,
    fallbackLongitude
  ];

}


function setupMap() {

  if (
    state.map ||
    typeof L === "undefined"
  ) {

    return;

  }


  const mapElement =
    $("#map");


  if (!mapElement) {

    return;

  }


  const station =
    stations.find(
      item =>
        item.id ===
        state.selectedStationId
    )
    ||
    stations[0];


  /*
   * ใช้พิกัดกลางประเทศไทย
   * หากยังไม่มีสถานี
   */
  const coordinates =
    getStationCoordinates(
      station
    )
    ||
    [
      15.87,
      100.9925
    ];


  state.map =
    L.map(
      "map"
    ).setView(
      coordinates,
      station
        ? 16
        : 6
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


  /*
   * ลบหมุดเดิมออกก่อน
   */
  state.markers.forEach(
    marker =>
      state.map.removeLayer(
        marker
      )
  );


  state.markers =
    [];


  const validCoordinates =
    [];


  stations.forEach(
    station => {

      const coordinates =
        getStationCoordinates(
          station
        );


      if (!coordinates) {

        return;

      }


      const latitude =
        Number(
          coordinates[0]
        );


      const longitude =
        Number(
          coordinates[1]
        );


      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {

        return;

      }


      validCoordinates.push(
        [
          latitude,
          longitude
        ]
      );


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
            latitude,
            longitude
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


      const stationName =
        escapeHtml(
          station.name
        );


      const stationUnit =
        escapeHtml(
          station.unit ||
          "เมตร"
        );


      marker.bindPopup(`

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
                ${stationName}
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
                ${stationUnit}
              </small>

            </strong>

          </div>


          <div class="popup-grid">

            <div>

              <span>
                LATITUDE
              </span>

              <strong>
                ${latitude.toFixed(6)}
              </strong>

            </div>


            <div>

              <span>
                LONGITUDE
              </span>

              <strong>
                ${longitude.toFixed(6)}
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
                : "ไม่มีข้อมูลล่าสุด"
            }

          </div>

        </div>

      `);


      /*
       * กดหมุดแล้วเปลี่ยนสถานีที่เลือก
       */
      marker.on(
        "click",
        () => {

          state.selectedStationId =
            station.id;


          state.chartMode =
            "station";


          state.selectedDate =
            "";


          renderEverything(
            true
          );

        }
      );


      state.markers.push(
        marker
      );

    }
  );


  /*
   * หากมีสถานีที่เลือก
   * ให้เลื่อนแผนที่ไปยังสถานีนั้น
   */
  const selectedStation =
    stations.find(
      station =>
        station.id ===
        state.selectedStationId
    );


  const selectedCoordinates =
    getStationCoordinates(
      selectedStation
    );


  if (selectedCoordinates) {

    state.map.panTo(
      selectedCoordinates,
      {
        animate:
          true
      }
    );

  }


  /*
   * แจ้ง Leaflet ให้คำนวณขนาดแผนที่ใหม่
   */
  setTimeout(
    () => {

      state.map?.invalidateSize();

    },
    50
  );

}
// ============================================================
// THEME
// ============================================================

function getPreferredTheme() {

  const savedTheme =
    localStorage.getItem(
      "water-dashboard-theme"
    );


  if (
    savedTheme === "dark" ||
    savedTheme === "light"
  ) {

    return savedTheme;

  }


  const prefersDark =
    window.matchMedia &&
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;


  return prefersDark
    ? "dark"
    : "light";

}


function applyTheme(theme) {

  const validTheme =
    theme === "dark"
      ? "dark"
      : "light";


  document.documentElement
    .setAttribute(
      "data-theme",
      validTheme
    );


  try {

    localStorage.setItem(
      "water-dashboard-theme",
      validTheme
    );

  }

  catch (error) {

    console.error(
      "ไม่สามารถบันทึกธีม",
      error
    );

  }


  const themeIcon =
    $("#themeIcon");


  if (themeIcon) {

    themeIcon.textContent =
      validTheme === "dark"
        ? "☀"
        : "☾";

  }


  const themeText =
    $("#themeText");


  if (themeText) {

    themeText.textContent =
      validTheme === "dark"
        ? "สว่าง"
        : "มืด";

  }


  /*
   * สร้างกราฟใหม่เพื่อปรับสีให้ตรงกับธีม
   */
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

      const currentTheme =
        document.documentElement
          .getAttribute(
            "data-theme"
          );


      applyTheme(
        currentTheme === "dark"
          ? "light"
          : "dark"
      );

    }
  );


// ============================================================
// DOWNLOAD MENU
// ============================================================

const downloadMenu =
  $("#downloadMenu");


const downloadMenuButton =
  $("#downloadMenuButton");


function updateDownloadMenuInfo() {

  const station =
    stations.find(
      item =>
        item.id ===
        state.selectedStationId
    );


  const dateElement =
    $("#downloadCurrentDate");


  if (dateElement) {

    dateElement.textContent =
      state.selectedDate
        ? formatDate(
            state.selectedDate +
            "T12:00:00+07:00",
            {
              day:
                "2-digit",

              month:
                "short",

              year:
                "numeric"
            }
          )
        : "ข้อมูลทั้งหมด";

  }


  const stationElement =
    $("#downloadCurrentStation");


  if (stationElement) {

    stationElement.textContent =
      station
        ? station.name
        : "—";

  }

}


function openDownloadMenu() {

  updateDownloadMenuInfo();


  downloadMenu
    ?.classList.add(
      "show"
    );


  downloadMenuButton
    ?.setAttribute(
      "aria-expanded",
      "true"
    );

}


function closeDownloadMenu() {

  downloadMenu
    ?.classList.remove(
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

      /*
       * ป้องกัน document click
       * ปิดเมนูขณะกดอยู่ภายในเมนู
       */
      event.stopPropagation();

    }
  );


document.addEventListener(
  "click",
  () => {

    closeDownloadMenu();


    /*
     * ปิดเมนูจัดการสถานีทั้งหมด
     */
    document
      .querySelectorAll(
        ".station-action-menu.show"
      )
      .forEach(
        menu => {

          menu.classList.remove(
            "show"
          );

        }
      );


    document
      .querySelectorAll(
        "[data-station-menu]"
      )
      .forEach(
        button => {

          button.setAttribute(
            "aria-expanded",
            "false"
          );

        }
      );

  }
);


document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape"
    ) {

      closeDownloadMenu();


      document
        .querySelectorAll(
          ".station-action-menu.show"
        )
        .forEach(
          menu => {

            menu.classList.remove(
              "show"
            );

          }
        );

    }

  }
);
// ============================================================
// DOWNLOAD FILE
// ============================================================

function csvCell(value) {

  /*
   * ครอบข้อมูลด้วย double quote
   * และ escape double quote ภายในข้อมูล
   */
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
      [
        content
      ],
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


  document.body
    .appendChild(
      link
    );


  link.click();


  link.remove();


  /*
   * คืนหน่วยความจำหลังดาวน์โหลด
   */
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


function getExportReadings(station) {

  if (!station) {

    return [];

  }


  let readings =
    state.data[
      station.id
    ] || [];


  /*
   * ถ้ามีวันที่เลือก
   * ดาวน์โหลดเฉพาะข้อมูลของวันนั้น
   */
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


/*
 * ทำชื่อไฟล์ให้ปลอดภัย
 */
function safeFilename(value) {

  return String(
    value || "station"
  )

    .trim()

    .replace(
      /[<>:"/\\|?*\u0000-\u001F]/g,
      "-"
    )

    .replace(
      /\s+/g,
      "-"
    )

    .replace(
      /-+/g,
      "-"
    );

}


/*
 * เพิ่ม UTF-8 BOM เพื่อให้ Excel
 * เปิดภาษาไทยได้ถูกต้อง
 */
function withUtf8Bom(content) {

  return (
    "\uFEFF" +
    content
  );

}
// ============================================================
// DOWNLOAD SELECTED STATION CSV
// ============================================================

$("#downloadSelectedCsv")
  ?.addEventListener(
    "click",
    () => {

      const station =
        stations.find(
          item =>
            item.id ===
            state.selectedStationId
        );


      if (!station) {

        alert(
          "ไม่พบสถานีที่เลือก"
        );


        return;

      }


      const readings =
        getExportReadings(
          station
        );


      if (!readings.length) {

        alert(
          "ไม่มีข้อมูลสำหรับวันที่เลือก"
        );


        return;

      }


      const filename =
        safeFilename(
          station.id ||
          station.name
        );


      downloadBlob(

        withUtf8Bom(
          createStationCsv(
            station,
            readings
          )
        ),

        `station-${filename}-${state.selectedDate || "all"}.csv`,

        "text/csv;charset=utf-8"

      );


      closeDownloadMenu();

    }
  );


// ============================================================
// DOWNLOAD ALL STATIONS CSV
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


      let total =
        0;


      stations.forEach(
        station => {

          const readings =
            getExportReadings(
              station
            );


          readings.forEach(
            reading => {

              total++;


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

        }
      );


      if (total === 0) {

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

                .map(
                  csvCell
                )

                .join(",")
          )

          .join("\r\n");


      downloadBlob(

        withUtf8Bom(
          csv
        ),

        `water-all-${state.selectedDate || "all"}.csv`,

        "text/csv;charset=utf-8"

      );


      closeDownloadMenu();

    }
  );


// ============================================================
// DOWNLOAD DAILY SUMMARY CSV
// ============================================================

$("#downloadSummaryCsv")
  ?.addEventListener(
    "click",
    () => {

      if (!state.selectedDate) {

        alert(
          "กรุณาเลือกวันที่"
        );


        return;

      }


      const rows = [

        [
          "สถานี",
          "วันที่",
          "ค่าล่าสุด",
          "ค่าเฉลี่ย",
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

        withUtf8Bom(
          csv
        ),

        `water-summary-${state.selectedDate}.csv`,

        "text/csv;charset=utf-8"

      );


      closeDownloadMenu();

    }
  );


// ============================================================
// DOWNLOAD JSON BACKUP
// ============================================================

$("#downloadJson")
  ?.addEventListener(
    "click",
    () => {

      const backup = {

        system:
          "RMUTL Flood Monitoring",

        version:
          2,

        exportedAt:
          new Date()
            .toISOString(),

        selectedStationId:
          state.selectedStationId,

        selectedDate:
          state.selectedDate,

        stations:
          stations.map(
            station => ({

              id:
                station.id,

              name:
                station.name,

              shortName:
                station.shortName,

              deployed:
                station.deployed,

              latitude:
                station.latitude,

              longitude:
                station.longitude,

              googleSheetCsv:
                station.googleSheetCsv,

              unit:
                station.unit,

              warningLevel:
                station.warningLevel,

              maxPipeHeight:
                station.maxPipeHeight,

              color:
                station.color,

              softColor:
                station.softColor,

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

        `water-monitoring-backup-${state.selectedDate || "all"}.json`,

        "application/json;charset=utf-8"

      );


      closeDownloadMenu();

    }
  );
// ============================================================
// RENDER
// ============================================================

function renderEverything(
  moveMap = false
) {

  /*
   * ตรวจสอบว่าสถานีที่เลือกยังมีอยู่
   */
  const selectedStationExists =
    stations.some(
      station =>
        station.id ===
        state.selectedStationId
    );


  if (
    !selectedStationExists &&
    stations.length
  ) {

    state.selectedStationId =
      stations[0].id;

  }


  renderCards();

  renderStationSelect();

  renderDateInput();

  renderModeButtons();

  renderSummary();

  renderChart();

  updateDownloadMenuInfo();


  if (!state.map) {

    setupMap();

  }

  else {

    renderMapMarkers();

  }


  /*
   * เลื่อนแผนที่ไปยังสถานีที่เลือก
   */
  if (
    moveMap &&
    state.map
  ) {

    const station =
      stations.find(
        item =>
          item.id ===
          state.selectedStationId
      );


    const coordinates =
      getStationCoordinates(
        station
      );


    if (coordinates) {

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


  if (globalUpdated) {

    globalUpdated.textContent =
      "กำลังโหลดข้อมูล...";

  }


  /*
   * โหลดทุกสถานีพร้อมกัน
   */
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


  /*
   * หาเวลาของข้อมูลล่าสุดจากทุกสถานี
   */
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
        (a, b) =>
          new Date(
            b.timestamp
          )
          -
          new Date(
            a.timestamp
          )
      )[0];


  if (globalUpdated) {

    globalUpdated.textContent =
      newest
        ? "ข้อมูลล่าสุด · " +
          formatDate(
            newest.timestamp
          )
        : "ไม่มีข้อมูล";

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


      renderEverything(
        true
      );

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


      const currentIndex =
        dates.indexOf(
          state.selectedDate
        );


      if (
        currentIndex > 0
      ) {

        state.selectedDate =
          dates[
            currentIndex - 1
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


      const currentIndex =
        dates.indexOf(
          state.selectedDate
        );


      if (
        currentIndex >= 0 &&
        currentIndex <
          dates.length - 1
      ) {

        state.selectedDate =
          dates[
            currentIndex + 1
          ];


        renderEverything();

      }

    }
  );


$("#refreshButton")
  ?.addEventListener(
    "click",
    async event => {

      const button =
        event.currentTarget;


      if (button.disabled) {

        return;

      }


      button.disabled =
        true;


      try {

        await refreshData();

      }

      finally {

        button.disabled =
          false;

      }

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
// STATION DIALOG
// ============================================================

function closeAddStationDialog() {

  const dialog =
    $("#addStationDialog");


  if (dialog?.open) {

    dialog.close();

  }

}


function openStationDialog(
  stationId = ""
) {

  const dialog =
    $("#addStationDialog");


  const form =
    $("#addStationForm");


  if (
    !dialog ||
    !form
  ) {

    return;

  }


  form.reset();


  if (
    form.elements.stationId
  ) {

    form.elements.stationId.value =
      stationId;

  }


  const station =
    stations.find(
      item =>
        item.id ===
        stationId
    );


  const title =
    $("#stationDialogTitle");


  const submitButton =
    $("#stationSubmitButton");


  if (title) {

    title.textContent =
      station
        ? "แก้ไขสถานี"
        : "เพิ่มสถานีใหม่";

  }


  if (submitButton) {

    submitButton.textContent =
      station
        ? "บันทึกการแก้ไข"
        : "บันทึกสถานี";

  }


  /*
   * เติมข้อมูลเดิมลงในแบบฟอร์ม
   * เมื่อผู้ใช้กดแก้ไข
   */
  if (station) {

    const fieldNames = [
      "name",
      "shortName",
      "latitude",
      "longitude",
      "googleSheetCsv",
      "warningLevel",
      "color",
      "maxPipeHeight"
    ];


    fieldNames.forEach(
      fieldName => {

        const field =
          form.elements[
            fieldName
          ];


        if (field) {

          field.value =
            station[
              fieldName
            ] ?? "";

        }

      }
    );

  }


  if (!dialog.open) {

    dialog.showModal();

  }

}


// ============================================================
// DELETE STATION DIALOG
// ============================================================

function openDeleteStationDialog(
  stationId
) {

  const station =
    stations.find(
      item =>
        item.id ===
        stationId
    );


  const dialog =
    $("#deleteStationDialog");


  if (
    !station ||
    !dialog
  ) {

    return;

  }


  /*
   * ป้องกันการลบสถานีสุดท้าย
   */
  if (
    stations.length <= 1
  ) {

    alert(
      "ต้องมีอย่างน้อย 1 สถานี"
    );


    return;

  }


  dialog.dataset.stationId =
    stationId;


  const stationName =
    $("#deleteStationName");


  if (stationName) {

    stationName.textContent =
      station.name;

  }


  if (!dialog.open) {

    dialog.showModal();

  }

}


// ============================================================
// SETUP STATION MANAGEMENT
// ============================================================

function setupAddStationMenu() {

  const dialog =
    $("#addStationDialog");


  const deleteDialog =
    $("#deleteStationDialog");


  const form =
    $("#addStationForm");


  $("#addStationButton")
    ?.addEventListener(
      "click",
      () => {

        openStationDialog();

      }
    );


  $("#closeStationDialog")
    ?.addEventListener(
      "click",
      () => {

        closeAddStationDialog();

      }
    );


  $("#cancelStationDialog")
    ?.addEventListener(
      "click",
      () => {

        closeAddStationDialog();

      }
    );


  /*
   * ปิด dialog เมื่อกดพื้นที่ backdrop
   */
  dialog?.addEventListener(
    "click",
    event => {

      if (
        event.target === dialog
      ) {

        closeAddStationDialog();

      }

    }
  );


  /*
   * บันทึกการเพิ่มหรือแก้ไขสถานี
   */
  form?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (
        !form.reportValidity()
      ) {

        return;

      }


      const values =
        new FormData(
          form
        );


      const stationId =
        String(
          values.get(
            "stationId"
          ) || ""
        );


      const name =
        String(
          values.get(
            "name"
          ) || ""
        ).trim();


      const shortName =
        String(
          values.get(
            "shortName"
          ) || ""
        ).trim();


      const latitude =
        Number(
          values.get(
            "latitude"
          )
        );


      const longitude =
        Number(
          values.get(
            "longitude"
          )
        );


      const googleSheetCsv =
        String(
          values.get(
            "googleSheetCsv"
          ) || ""
        ).trim();


      const warningLevel =
        Number(
          values.get(
            "warningLevel"
          )
        );


      const maxPipeHeight =
        Number(
          values.get(
            "maxPipeHeight"
          )
        );


      const color =
        String(
          values.get(
            "color"
          ) || "#14B8A6"
        );


      /*
       * ตรวจสอบข้อมูลก่อนบันทึก
       */
      if (
        !name ||
        !shortName
      ) {

        alert(
          "กรุณากรอกชื่อสถานีและชื่อย่อ"
        );


        return;

      }


      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {

        alert(
          "Latitude ต้องอยู่ระหว่าง -90 ถึง 90"
        );


        return;

      }


      if (
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {

        alert(
          "Longitude ต้องอยู่ระหว่าง -180 ถึง 180"
        );


        return;

      }


      if (
        !googleSheetCsv
      ) {

        alert(
          "กรุณากรอกลิงก์ Google Sheets CSV"
        );


        return;

      }


      if (
        !Number.isFinite(warningLevel) ||
        warningLevel < 0
      ) {

        alert(
          "ระดับเฝ้าระวังต้องเป็นเลขตั้งแต่ 0 ขึ้นไป"
        );


        return;

      }


      if (
        !Number.isFinite(maxPipeHeight) ||
        maxPipeHeight <= 0
      ) {

        alert(
          "ระดับสูงสุดท่อต้องมากกว่า 0"
        );


        return;

      }


      if (
        warningLevel >
        maxPipeHeight
      ) {

        alert(
          "ระดับเฝ้าระวังต้องไม่สูงกว่าระดับสูงสุดท่อ"
        );


        return;

      }


      const existing =
        stations.find(
          item =>
            item.id ===
            stationId
        );


      const station = {

        id:
          existing?.id ||
          `station-${Date.now()}`,

        name,

        shortName,

        deployed:
          true,

        latitude,

        longitude,

        googleSheetCsv,

        unit:
          "เมตร",

        warningLevel,

        maxPipeHeight,

        color,

        softColor:
          hexToRgba(
            color,
            0.12
          )

      };


      /*
       * แก้ไขข้อมูลเดิมหรือเพิ่มรายการใหม่
       */
      if (existing) {

        Object.assign(
          existing,
          station
        );

      }

      else {

        stations.push(
          station
        );

      }


      saveStations();


      state.selectedStationId =
        station.id;


      state.selectedDate =
        "";


      state.chartMode =
        "station";


      form.reset();


      closeAddStationDialog();


      await refreshData();

    }
  );


  /*
   * ยกเลิกการลบ
   */
  $("#cancelDeleteStation")
    ?.addEventListener(
      "click",
      () => {

        if (
          deleteDialog?.open
        ) {

          deleteDialog.close();

        }

      }
    );


  /*
   * ปิดหน้าต่างลบเมื่อกด backdrop
   */
  deleteDialog?.addEventListener(
    "click",
    event => {

      if (
        event.target === deleteDialog
      ) {

        deleteDialog.close();

      }

    }
  );


  /*
   * ยืนยันการลบสถานี
   */
  $("#confirmDeleteStation")
    ?.addEventListener(
      "click",
      () => {

        if (
          stations.length <= 1
        ) {

          alert(
            "ต้องมีอย่างน้อย 1 สถานี"
          );


          return;

        }


        const stationId =
          deleteDialog
            ?.dataset
            .stationId;


        const stationIndex =
          stations.findIndex(
            item =>
              item.id ===
              stationId
          );


        if (
          stationIndex < 0
        ) {

          return;

        }


        const removedStations =
          stations.splice(
            stationIndex,
            1
          );


        const removedStation =
          removedStations[0];


        if (removedStation) {

          delete state.data[
            removedStation.id
          ];

        }


        /*
         * หากลบสถานีที่กำลังเลือก
         * ให้เลือกสถานีข้างเคียง
         */
        if (
          state.selectedStationId ===
          removedStation?.id
        ) {

          const nextIndex =
            Math.min(
              stationIndex,
              stations.length - 1
            );


          state.selectedStationId =
            stations[
              nextIndex
            ]?.id || "";

        }


        state.selectedDate =
          "";


        saveStations();


        if (
          deleteDialog?.open
        ) {

          deleteDialog.close();

        }


        renderEverything(
          true
        );

      }
    );

}


// ============================================================
// START
// ============================================================

applyTheme(
  getPreferredTheme()
);


setupAddStationMenu();


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
