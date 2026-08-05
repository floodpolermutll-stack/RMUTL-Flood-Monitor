/*
 * ตั้งค่าสถานีที่นี่เมื่อเพิ่มจุดวัดใหม่
 *
 * googleSheetCsv:
 * วาง URL จาก Google Sheets
 * File > Share > Publish to web > CSV
 *
 * Google Sheet ต้องมีหัวคอลัมน์:
 * timestamp,level
 *
 * ตัวอย่าง:
 * 2026-08-05 08:00,1.23
 */

window.WATER_APP_CONFIG = {
  stations: [
    {
      id: "river",
      name: "ระดับน้ำในแม่น้ำ",
      shortName: "สถานีแม่น้ำ",

      // สถานีนี้ติดตั้งแล้ว
      deployed: true,

      // เปลี่ยนเป็นพิกัดจริงของสถานี
      latitude: 13.7563,
      longitude: 100.5018,

      // ใส่ลิงก์ CSV จาก Google Sheets ของสถานีนี้
      googleSheetCsv: "",

      unit: "เมตร",

      // ระดับน้ำที่ต้องเริ่มเฝ้าระวัง
      warningLevel: 3.0,
    },

    {
      id: "flood-point-1",
      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 1",
      shortName: "จุดน้ำท่วม 1",

      // ยังไม่ได้ติดตั้ง
      deployed: false,

      // เปลี่ยนเป็นพิกัดจริงเมื่อเริ่มติดตั้ง
      latitude: 13.7463,
      longitude: 100.5118,

      // ใส่ลิงก์ CSV เมื่อพร้อมใช้งาน
      googleSheetCsv: "",

      unit: "เมตร",
      warningLevel: 0.8,
    },

    {
      id: "flood-point-2",
      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 2",
      shortName: "จุดน้ำท่วม 2",

      // ยังไม่ได้ติดตั้ง
      deployed: false,

      // เปลี่ยนเป็นพิกัดจริงเมื่อเริ่มติดตั้ง
      latitude: 13.7663,
      longitude: 100.4918,

      // ใส่ลิงก์ CSV เมื่อพร้อมใช้งาน
      googleSheetCsv: "",

      unit: "เมตร",
      warningLevel: 0.8,
    },
  ],
};
