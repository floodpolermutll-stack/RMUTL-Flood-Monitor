window.WATER_APP_CONFIG = {
  stations: [
    {
      id: "river",
      name: "ระดับน้ำในแม่น้ำ",
      shortName: "สถานีแม่น้ำ",

      deployed: true,

      latitude: 13.7563,
      longitude: 100.5018,

      // ใส่ URL Google Apps Script ที่ลงท้ายด้วย /exec
      googleSheetCsv: "",

      unit: "เมตร",
      warningLevel: 3.0,

      // สีน้ำเงิน
      color: "#0B84F3",
      softColor: "#E4F2FF",
    },

    {
      id: "flood-point-1",
      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 1",
      shortName: "จุดน้ำท่วม 1",

      // เปลี่ยนเป็น true เมื่อติดตั้งสถานีแล้ว
      deployed: false,

      latitude: 13.7463,
      longitude: 100.5118,

      googleSheetCsv: "",

      unit: "เมตร",
      warning
