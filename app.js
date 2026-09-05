const DEFAULT_PIPE_HEIGHT = 3.16;

const STATIONS_STORAGE_KEY =
  "rmutl-flood-monitor-stations-v3";

const LEGACY_STORAGE_KEY =
  "rmutl-flood-monitor-custom-stations";


const configuredStations =
  Array.isArray(
    window.WATER_APP_CONFIG?.stations
  )
    ? window.WATER_APP_CONFIG.stations
    : [];


const defaultStations =
  configuredStations.map(
    station => ({
      unit:
        "เมตร",

      maxPipeHeight:
        DEFAULT_PIPE_HEIGHT,

      ...station
    })
  );


function loadStations() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(
          STATIONS_STORAGE_KEY
        ) || "null"
      );


    if (
      Array.isArray(saved) &&
      saved.length
    ) {

      return saved.map(
        station => ({
          unit:
            "เมตร",

          maxPipeHeight:
            DEFAULT_PIPE_HEIGHT,

          ...station
        })
      );

    }


    const legacy =
      JSON.parse(
        localStorage.getItem(
          LEGACY_STORAGE_KEY
        ) || "[]"
      );


    return [

      ...defaultStations.map(
        station => ({
          ...station
        })
      ),

      ...(
        Array.isArray(legacy)
          ? legacy
          : []
      ).map(
        station => ({
          unit:
            "เมตร",

          maxPipeHeight:
            DEFAULT_PIPE_HEIGHT,

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
  loadStations();


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


function saveStations() {

  try {

    localStorage.setItem(
      STATIONS_STORAGE_KEY,
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


function hexToRgba(
  hex,
  opacity
) {

  let value =
    String(
      hex || "#000000"
    )
      .replace(
        "#",
        ""
      )
      .trim();


  if (
    value.length === 3
  ) {

    value =
      value
        .split("")
        .map(
          character =>
            character + character
        )
        .join("");

  }


  const number =
    parseInt(
      value,
      16
    );


  if (
    Number.isNaN(number)
  ) {

    return (
      `rgba(0,0,0,${opacity})`
    );

  }


  return (
    `rgba(${
      (number >> 16) & 255
    },${
      (number >> 8) & 255
    },${
      number & 255
    },${opacity})`
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


  return (
    year &&
    month &&
    day
  )
    ? `${year}-${month}-${day}`
    : "";

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


function normalizeTime(value) {

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
    String(match[1]).padStart(2, "0") +
    ":" +
    String(match[2]).padStart(2, "0") +
    ":" +
    String(match[3] || "00").padStart(2, "0")
  );

}


function buildTimestamp(
  dateValue,
  timeValue
) {

  let dateText =
    String(
      dateValue || ""
    )

      .replace(
        /"/g,
        ""
      )

      .trim();


  let timeText =
    String(
      timeValue || ""
    )

      .replace(
        /"/g,
        ""
      )

      .trim();


  if (!dateText) {

    return null;

  }


  const combined =
    dateText.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s*,\s*(\d{1,2}:\d{2}(?::\d{2})?)$/
    );


  if (combined) {

    dateText =
      combined[1];


    timeText =
      combined[2];

  }


  timeText =
    normalizeTime(
      timeText
    );


  let match =
    dateText.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );


  let timestamp;


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


    timestamp =
      `${match[3]}-${month}-${day}T${timeText}+07:00`;

  }

  else {

    match =
      dateText.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/
      );


    if (!match) {

      return null;

    }


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


    timestamp =
      `${match[1]}-${month}-${day}T${timeText}+07:00`;

  }


  return Number.isNaN(
    new Date(
      timestamp
    ).getTime()
  )
    ? null
    : timestamp;

}


// ============================================================
// CSV
// ============================================================

function splitCsvLine(line) {

  const cells =
    [];


  let current =
    "";


  let quoted =
    false;


  for (
    let index = 0;
    index < line.length;
    index++
  ) {

    const character =
      line[index];


    if (
      character === '"'
    ) {

      if (
        quoted &&
        line[index + 1] === '"'
      ) {

        current +=
          '"';


        index++;

      }

      else {

        quoted =
          !quoted;

      }

    }

    else if (
      character === "," &&
      !quoted
    ) {

      cells.push(
        current.trim()
      );


      current =
        "";

    }

    else {

      current +=
        character;

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

  const text =
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

      .replace(
        ",",
        "."
      )

      .trim();


  if (
    !text ||
    text === "-" ||
    text === "—"
  ) {

    return null;

  }


  const number =
    Number(text);


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
          line.trim()
      )

      .map(
        splitCsvLine
      );


  const headerRowIndex =
    rows.findIndex(
      row => {

        const headers =
          row.map(
            normalizeHeader
          );


        const text =
          headers.join(
            " "
          );


        return (
          (
            text.includes("วันที่") ||
            text.includes("date")
          ) &&
          (
            text.includes("latitude") ||
            headers.includes("lat")
          ) &&
          (
            text.includes("longitude") ||
            headers.includes("lng") ||
            headers.includes("lon")
          )
        );

      }
    );


  if (
    headerRowIndex < 0
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


  function findColumn(
    tests,
    fallback
  ) {

    const index =
      headers.findIndex(
        header =>
          tests.some(
            test =>
              typeof test === "string"
                ? header === test
                : test.test(header)
          )
      );


    return index >= 0
      ? index
      : fallback;

  }


  const dateIndex =
    findColumn(
      [
        /วันที่/,
        "date"
      ],
      0
    );


  const timeIndex =
    findColumn(
      [
        /เวลา/,
        "time"
      ],
      1
    );


  const levelIndex =
    findColumn(
      [
        /ระดับน้ำ/,
        /ระยะน้ำ/,
        /ระยะทาง/,
        /distance/,
        /water level/,
        /water_level/,
        "level"
      ],
      2
    );


  const latitudeIndex =
    findColumn(
      [
        /latitude/,
        "lat"
      ],
      3
    );


  const longitudeIndex =
    findColumn(
      [
        /longitude/,
        "lng",
        "lon"
      ],
      4
    );


  const results =
    [];


  for (
    let index =
      headerRowIndex + 1;

    index < rows.length;

    index++
  ) {

    const row =
      rows[index];


    let dateText =
      row[
        dateIndex
      ];


    let timeText =
      row[
        timeIndex
      ];


    let levelValue =
      row[
        levelIndex
      ];


    let latitudeValue =
      row[
        latitudeIndex
      ];


    let longitudeValue =
      row[
        longitudeIndex
      ];


    const oldFormat =
      String(
        dateText || ""
      ).match(
        /^(\d{1,2}\/\d{1,2}\/\d{4})\s*,\s*(\d{1,2}:\d{2}(?::\d{2})?)$/
      );


    if (oldFormat) {

      dateText =
        oldFormat[1];


      timeText =
        oldFormat[2];


      levelValue =
        row[1];


      latitudeValue =
        row[2];


      longitudeValue =
        row[3];

    }


    const timestamp =
      buildTimestamp(
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
          levelValue
        ),

      latitude:
        parseNumberCell(
          latitudeValue
        ),

      longitude:
        parseNumberCell(
          longitudeValue
        )

    });

  }


  results.sort(
    (first, second) =>
      new Date(
        first.timestamp
      )
      -
      new Date(
        second.timestamp
      )
  );


  return results;

}


// ============================================================
// LOAD AND DATA
// ============================================================

async function loadStation(station) {

  if (
    !station?.deployed ||
    !station.googleSheetCsv
  ) {

    return [];

  }


  try {

    const separator =
      station.googleSheetCsv.includes("?")
        ? "&"
        : "?";


    const response =
      await fetch(
        station.googleSheetCsv +
        separator +
        "_=" +
        Date.now(),
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
      `โหลดสถานี ${station.name} ไม่สำเร็จ`,
      error
    );


    return [];

  }

}


function latestReading(station) {

  const readings =
    state.data[
      station?.id
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
      station?.id
    ] || [];


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
        station?.id
      ] || []
    )

      .map(
        reading =>
          reading.level
      )

      .filter(
        Number.isFinite
      );


  return values.length
    ? {
        min:
          Math.min(
            ...values
          ),

        max:
          Math.max(
            ...values
          )
      }
    : null;

}


function getStatus(station) {

  if (!station?.deployed) {

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
// PIPE AND STATION CARDS
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
      : DEFAULT_PIPE_HEIGHT;


  const currentLevel =
    reading &&
    Number.isFinite(
      reading.level
    )
      ? reading.level
      : null;


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


  return `

    <div class="pipe-gauge">

      <div class="pipe-visual">

        <div class="pipe-shell">

          <span
            class="pipe-water"
            style="height:${percentage}%"
          ></span>

        </div>

        <div class="pipe-scale">
          <span>${maximum.toFixed(3)}</span>
          <span>${(maximum / 2).toFixed(3)}</span>
          <span>0</span>
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
            data-pipe-max="${escapeHtml(station.id)}"
          >

          ${escapeHtml(station.unit || "เมตร")}
        </span>

      </label>

    </div>

  `;

}


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


        const id =
          escapeHtml(
            station.id
          );


        return `

          <article
            class="station-card ${
              station.id ===
              state.selectedStationId
                ? "selected"
                : ""
            }"
            data-station-id="${id}"
            tabindex="0"
            role="button"
            style="
              --station-color:${station.color};
              --station-soft:${station.softColor};
            "
          >

            <div class="station-card-top">

              <div class="station-status ${status.className}">
                <span></span>
                ${status.text}
              </div>

              <div class="station-card-actions">

                <button
                  class="station-menu-button"
                  type="button"
                  data-station-menu="${id}"
                  aria-expanded="false"
                >
                  ⋮
                </button>

                <div
                  class="station-action-menu"
                  data-station-menu-panel="${id}"
                >
                  <button
                    type="button"
                    data-edit-station="${id}"
                  >
                    ✎ แก้ไขสถานี
                  </button>

                  <button
                    type="button"
                    class="danger"
                    data-delete-station="${id}"
                    ${
                      stations.length === 1
                        ? "disabled"
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
              ${escapeHtml(station.name)}
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
                    ${escapeHtml(station.unit || "เมตร")}
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


            if (
              event.target.closest(
                "button,input"
              )
            ) {

              return;

            }


            event.preventDefault();


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


  setupCardActions();

}


function closeStationMenus() {

  document
    .querySelectorAll(
      ".station-action-menu.show"
    )
    .forEach(
      menu =>
        menu.classList.remove(
          "show"
        )
    );


  document
    .querySelectorAll(
      "[data-station-menu]"
    )
    .forEach(
      button =>
        button.setAttribute(
          "aria-expanded",
          "false"
        )
    );

}


function setupCardActions() {

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


            const panel =
              document.querySelector(
                `[data-station-menu-panel="${button.dataset.stationMenu}"]`
              );


            const open =
              !panel?.classList.contains(
                "show"
              );


            closeStationMenus();


            panel?.classList.toggle(
              "show",
              open
            );


            button.setAttribute(
              "aria-expanded",
              String(open)
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-edit-station]"
    )
    .forEach(
      button =>
        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            openStationDialog(
              button.dataset.editStation
            );

          }
        )
    );


  document
    .querySelectorAll(
      "[data-delete-station]"
    )
    .forEach(
      button =>
        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            if (!button.disabled) {

              openDeleteDialog(
                button.dataset.deleteStation
              );

            }

          }
        )
    );


  document
    .querySelectorAll(
      "[data-pipe-max]"
    )
    .forEach(
      input => {

        input.addEventListener(
          "click",
          event =>
            event.stopPropagation()
        );


        input.addEventListener(
          "keydown",
          event =>
            event.stopPropagation()
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
                  DEFAULT_PIPE_HEIGHT
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
// SELECT, DATE AND SUMMARY
// ============================================================

function renderStationSelect() {

  const select =
    $("#stationSelect");


  if (!select) {

    return;

  }


  select.disabled =
    !stations.length;


  select.innerHTML =
    stations.length
      ? stations.map(
          station => `
            <option value="${escapeHtml(station.id)}">
              ${escapeHtml(station.name)}
            </option>
          `
        ).join("")
      : `<option value="">ไม่มีสถานี</option>`;


  select.value =
    state.selectedStationId;

}


function getAvailableDates() {

  let readings =
    [];


  if (
    state.chartMode === "all"
  ) {

    stations.forEach(
      station => {

        readings.push(
          ...(
            state.data[
              station.id
            ] || []
          )
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


function aggregateHourly(readings) {

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
        hour !== null &&
        Number.isFinite(
          reading.level
        )
      ) {

        buckets[
          hour
        ].push(
          reading.level
        );

      }

    }
  );


  return buckets.map(
    (values, hour) => {

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


      return {
        hour,

        average:
          values.reduce(
            (sum, value) =>
              sum + value,
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


  return {
    latest:
      values[
        values.length - 1
      ],

    average:
      values.reduce(
        (sum, value) =>
          sum + value,
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


          return `

            <div
              class="summary-card"
              style="--summary-color:${station.color}"
            >

              <div class="summary-color-line"></div>

              <div>

                <span class="summary-title">
                  ${escapeHtml(station.shortName || station.name)}
                </span>

                <strong class="summary-big">

                  ${
                    stats
                      ? stats.latest.toFixed(3)
                      : "—"
                  }

                  <small>
                    ${escapeHtml(station.unit || "เมตร")}
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
      item =>
        item.id ===
        state.selectedStationId
    );


  const stats =
    station
      ? getDailyStats(
          station.id,
          state.selectedDate
        )
      : null;


  if (
    !station ||
    !stats
  ) {

    container.innerHTML = `
      <div class="summary-empty">
        ไม่มีข้อมูลสำหรับวันที่เลือก
      </div>
    `;


    return;

  }


  const cards = [
    [
      "◉",
      "ค่าล่าสุด",
      stats.latest
    ],
    [
      "≈",
      "ค่าเฉลี่ย",
      stats.average
    ],
    [
      "↓",
      "ต่ำสุด",
      stats.min
    ],
    [
      "↑",
      "สูงสุด",
      stats.max
    ]
  ];


  container.innerHTML =
    cards.map(
      card => `

        <div class="summary-card">

          <div class="summary-icon">
            ${card[0]}
          </div>

          <div>

            <span class="summary-title">
              ${card[1]}
            </span>

            <strong class="summary-big">

              ${card[2].toFixed(3)}

              <small>
                ${escapeHtml(station.unit || "เมตร")}
              </small>

            </strong>

          </div>

        </div>

      `
    ).join("");

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


  if (
    state.chartMode === "all"
  ) {

    if ($("#chartTitle")) {

      $("#chartTitle").textContent =
        `เปรียบเทียบระดับน้ำทั้ง ${stations.length} สถานี`;

    }


    datasets =
      stations.map(
        station => {

          const hourly =
            aggregateHourly(
              getReadingsForDate(
                station.id,
                state.selectedDate
              )
            );


          return {
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
          };

        }
      );


    if ($("#chartNotice")) {

      $("#chartNotice").textContent =
        `เปรียบเทียบค่าเฉลี่ยรายชั่วโมงของทั้ง ${stations.length} สถานี`;

    }

  }

  else {

    const station =
      stations.find(
        item =>
          item.id ===
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


    if ($("#chartTitle")) {

      $("#chartTitle").textContent =
        `ระดับน้ำ · ${station.shortName || station.name}`;

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
          0
      }
    ];


    if ($("#chartNotice")) {

      $("#chartNotice").textContent =
        readings.length
          ? `ข้อมูล ${readings.length} จุดวัด ถูกคำนวณเป็นค่าเฉลี่ยรายชั่วโมง`
          : "ไม่มีข้อมูลสำหรับวันที่เลือก";

    }

  }


  if ($("#chartDateLabel")) {

    $("#chartDateLabel").textContent =
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
                                `${context.dataset.label}: ไม่มีข้อมูล`
                              );

                            }


                            return (
                              `${context.dataset.label}: ${Number(context.raw).toFixed(3)} เมตร`
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

                        callback(
                          value,
                          index
                        ) {

                          return index % 2 === 0
                            ? labels[index]
                            : "";

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

function getStationCoordinates(station) {

  if (!station) {

    return null;

  }


  const readings =
    state.data[
      station.id
    ] || [];


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


  const latitude =
    Number(
      station.latitude
    );


  const longitude =
    Number(
      station.longitude
    );


  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  )
    ? [
        latitude,
        longitude
      ]
    : null;

}


function createMarkerIcon(
  station,
  selected
) {

  return L.divIcon({
    className:
      "custom-station-marker",

    html: `

      <div
        class="modern-map-marker ${
          selected
            ? "selected"
            : ""
        }"
        style="
          --marker-color:${station.color};
          --marker-soft:${hexToRgba(station.color, 0.22)};
        "
      >
        <div class="marker-radar"></div>

        <div class="marker-center">
          <div class="marker-center-dot"></div>
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


function setupMap() {

  if (
    state.map ||
    typeof L === "undefined"
  ) {

    return;

  }


  const mapContainer =
    document.getElementById(
      "map"
    );


  /*
   * ป้องกัน Error: Map container not found
   */
  if (!mapContainer) {

    console.warn(
      "ไม่พบ <div id=\"map\"></div>"
    );


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
      mapContainer
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

      const coordinates =
        getStationCoordinates(
          station
        );


      if (!coordinates) {

        return;

      }


      const [
        latitude,
        longitude
      ] =
        coordinates;


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
          coordinates,
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


      marker.bindPopup(`

        <div
          class="station-popup"
          style="--popup-color:${station.color}"
        >

          <div class="popup-header">

            <div class="popup-station-icon">
              <span></span>
            </div>

            <div>
              <strong>
                ${escapeHtml(station.name)}
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
                ${escapeHtml(station.unit || "เมตร")}
              </small>

            </strong>

          </div>

          <div class="popup-grid">

            <div>
              <span>LATITUDE</span>
              <strong>${latitude.toFixed(6)}</strong>
            </div>

            <div>
              <span>LONGITUDE</span>
              <strong>${longitude.toFixed(6)}</strong>
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


      marker.addTo(
        state.map
      );


      state.markers.push(
        marker
      );

    }
  );


  setTimeout(
    () =>
      state.map?.invalidateSize(),
    100
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


  return window.matchMedia?.(
    "(prefers-color-scheme: dark)"
  ).matches
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
    "water-dashboard-theme",
    theme
  );


  if ($("#themeIcon")) {

    $("#themeIcon").textContent =
      theme === "dark"
        ? "☀"
        : "☾";

  }


  if ($("#themeText")) {

    $("#themeText").textContent =
      theme === "dark"
        ? "สว่าง"
        : "มืด";

  }


  if (
    Object.keys(
      state.data
    ).length
  ) {

    renderChart();

  }

}


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


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


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


function getExportReadings(station) {

  let readings =
    state.data[
      station?.id
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
          .map(
            csvCell
          )
          .join(",")
    )
    .join("\r\n");

}


function closeDownloadMenu() {

  $("#downloadMenu")
    ?.classList.remove(
      "show"
    );


  $("#downloadMenuButton")
    ?.setAttribute(
      "aria-expanded",
      "false"
    );

}


function updateDownloadMenuInfo() {

  const station =
    stations.find(
      item =>
        item.id ===
        state.selectedStationId
    );


  if ($("#downloadCurrentDate")) {

    $("#downloadCurrentDate").textContent =
      state.selectedDate ||
      "ข้อมูลทั้งหมด";

  }


  if ($("#downloadCurrentStation")) {

    $("#downloadCurrentStation").textContent =
      station?.name ||
      "—";

  }

}


// ============================================================
// STATION DIALOGS
// ============================================================

function closeStationDialog() {

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


  form.elements.stationId.value =
    stationId;


  const station =
    stations.find(
      item =>
        item.id ===
        stationId
    );


  $("#stationDialogTitle").textContent =
    station
      ? "แก้ไขสถานี"
      : "เพิ่มสถานีใหม่";


  $("#stationSubmitButton").textContent =
    station
      ? "บันทึกการแก้ไข"
      : "บันทึกสถานี";


  if (station) {

    [
      "name",
      "shortName",
      "latitude",
      "longitude",
      "googleSheetCsv",
      "warningLevel",
      "maxPipeHeight",
      "color"
    ].forEach(
      name => {

        if (
          form.elements[
            name
          ]
        ) {

          form.elements[
            name
          ].value =
            station[
              name
            ] ?? "";

        }

      }
    );

  }


  dialog.showModal();

}


function openDeleteDialog(stationId) {

  if (
    stations.length <= 1
  ) {

    alert(
      "ต้องมีอย่างน้อย 1 สถานี"
    );


    return;

  }


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


  dialog.dataset.stationId =
    stationId;


  $("#deleteStationName").textContent =
    station.name;


  dialog.showModal();

}


// ============================================================
// RENDER AND REFRESH
// ============================================================

function renderEverything(
  moveMap = false
) {

  if (
    stations.length &&
    !stations.some(
      station =>
        station.id ===
        state.selectedStationId
    )
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


async function refreshData() {

  const updated =
    $("#globalUpdated");


  if (updated) {

    updated.textContent =
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
        latestReading
      )

      .filter(Boolean)

      .sort(
        (first, second) =>
          new Date(
            second.timestamp
          )
          -
          new Date(
            first.timestamp
          )
      )[0];


  if (updated) {

    updated.textContent =
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


$("#addStationButton")
  ?.addEventListener(
    "click",
    () =>
      openStationDialog()
  );


$("#closeStationDialog")
  ?.addEventListener(
    "click",
    closeStationDialog
  );


$("#cancelStationDialog")
  ?.addEventListener(
    "click",
    closeStationDialog
  );


$("#addStationForm")
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const form =
        event.currentTarget;


      if (!form.reportValidity()) {

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


      if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {

        alert(
          "กรุณาตรวจสอบ Latitude และ Longitude"
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


      const color =
        String(
          values.get(
            "color"
          ) ||
          "#14B8A6"
        );


      const existing =
        stations.find(
          station =>
            station.id ===
            stationId
        );


      const station = {
        id:
          existing?.id ||
          `station-${Date.now()}`,

        name:
          String(
            values.get(
              "name"
            )
          ).trim(),

        shortName:
          String(
            values.get(
              "shortName"
            )
          ).trim(),

        deployed:
          true,

        latitude,

        longitude,

        googleSheetCsv:
          String(
            values.get(
              "googleSheetCsv"
            )
          ).trim(),

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


      closeStationDialog();


      await refreshData();

    }
  );


$("#cancelDeleteStation")
  ?.addEventListener(
    "click",
    () =>
      $("#deleteStationDialog")
        ?.close()
  );


$("#confirmDeleteStation")
  ?.addEventListener(
    "click",
    () => {

      if (
        stations.length <= 1
      ) {

        return;

      }


      const dialog =
        $("#deleteStationDialog");


      const index =
        stations.findIndex(
          station =>
            station.id ===
            dialog?.dataset.stationId
        );


      if (
        index < 0
      ) {

        return;

      }


      const [
        removed
      ] =
        stations.splice(
          index,
          1
        );


      delete state.data[
        removed.id
      ];


      if (
        state.selectedStationId ===
        removed.id
      ) {

        state.selectedStationId =
          stations[
            Math.min(
              index,
              stations.length - 1
            )
          ]?.id || "";

      }


      state.selectedDate =
        "";


      saveStations();


      dialog.close();


      renderEverything(
        true
      );

    }
  );


$("#downloadMenuButton")
  ?.addEventListener(
    "click",
    event => {

      event.stopPropagation();


      const menu =
        $("#downloadMenu");


      const opening =
        !menu?.classList.contains(
          "show"
        );


      menu?.classList.toggle(
        "show",
        opening
      );


      event.currentTarget
        .setAttribute(
          "aria-expanded",
          String(opening)
        );


      updateDownloadMenuInfo();

    }
  );


$("#closeDownloadMenu")
  ?.addEventListener(
    "click",
    closeDownloadMenu
  );


$("#downloadMenu")
  ?.addEventListener(
    "click",
    event =>
      event.stopPropagation()
  );


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


      const readings =
        getExportReadings(
          station
        );


      if (
        !station ||
        !readings.length
      ) {

        alert(
          "ไม่มีข้อมูลสำหรับดาวน์โหลด"
        );


        return;

      }


      downloadBlob(
        "\uFEFF" +
        createStationCsv(
          station,
          readings
        ),

        `station-${station.id}-${state.selectedDate || "all"}.csv`,

        "text/csv;charset=utf-8"
      );


      closeDownloadMenu();

    }
  );


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


      stations.forEach(
        station => {

          getExportReadings(
            station
          ).forEach(
            reading => {

              rows.push([
                station.name,
                exportDate(reading.timestamp),
                exportTime(reading.timestamp),
                Number.isFinite(reading.level)
                  ? reading.level.toFixed(3)
                  : "",
                Number.isFinite(reading.latitude)
                  ? reading.latitude.toFixed(6)
                  : "",
                Number.isFinite(reading.longitude)
                  ? reading.longitude.toFixed(6)
                  : ""
              ]);

            }
          );

        }
      );


      if (
        rows.length === 1
      ) {

        alert(
          "ไม่มีข้อมูลสำหรับดาวน์โหลด"
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
        "\uFEFF" + csv,
        `water-all-${state.selectedDate || "all"}.csv`,
        "text/csv;charset=utf-8"
      );


      closeDownloadMenu();

    }
  );


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


          rows.push([
            station.name,
            state.selectedDate,
            stats?.latest.toFixed(3) || "",
            stats?.average.toFixed(3) || "",
            stats?.min.toFixed(3) || "",
            stats?.max.toFixed(3) || "",
            stats?.count || 0
          ]);

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
        "\uFEFF" + csv,
        `water-summary-${state.selectedDate}.csv`,
        "text/csv;charset=utf-8"
      );


      closeDownloadMenu();

    }
  );


$("#downloadJson")
  ?.addEventListener(
    "click",
    () => {

      const backup = {
        exportedAt:
          new Date()
            .toISOString(),

        selectedDate:
          state.selectedDate,

        stations:
          stations.map(
            station => ({
              ...station,

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

        "water-monitoring-backup.json",

        "application/json;charset=utf-8"
      );


      closeDownloadMenu();

    }
  );


document.addEventListener(
  "click",
  () => {

    closeDownloadMenu();

    closeStationMenus();

  }
);


document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape"
    ) {

      closeDownloadMenu();

      closeStationMenus();

    }

  }
);


// ============================================================
// CLOCK AND START
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


applyTheme(
  getPreferredTheme()
);


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
