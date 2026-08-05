window.WATER_APP_CONFIG = {
  stations: [
    {
      id: "river",
      name: "ระดับน้ำในแม่น้ำ",
      shortName: "สถานีแม่น้ำ",

      // สถานีที่ติดตั้งแล้ว
      deployed: true,

      // เปลี่ยนเป็นพิกัดจริงของสถานี
      latitude: 13.7563,
      longitude: 100.5018,

      // ใส่ URL CSV จาก Google Sheets
      googleSheetCsv: "",

      unit: "เมตร",

      // ระดับที่ต้องเริ่มเฝ้าระวัง
      warningLevel: 3.0,
    },

    {
      id: "flood-point-1",
      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 1",
      shortName: "จุดน้ำท่วม 1",

      // เปลี่ยนเป็น true เมื่อเริ่มติดตั้งสถานี
      deployed: false,

      // เปลี่ยนเป็นพิกัดจริงเมื่อเริ่มติดตั้ง
      latitude: 13.7463,
      longitude: 100.5118,

      // ใส่ URL CSV จาก Google Sheets เมื่อมีข้อมูล
      googleSheetCsv: "",

      unit: "เมตร",

      warningLevel: 0.8,
    },

    {
      id: "flood-point-2",
      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 2",
      shortName: "จุดน้ำท่วม 2",

      // เปลี่ยนเป็น true เมื่อเริ่มติดตั้งสถานี
      deployed: false,

      // เปลี่ยนเป็นพิกัดจริงเมื่อเริ่มติดตั้ง
      latitude: 13.7663,
      longitude: 100.4918,

      // ใส่ URL CSV จาก Google Sheets เมื่อมีข้อมูล
      googleSheetCsv: "",

      unit: "เมตร",

      warningLevel: 0.8,
    },
  ],
};
