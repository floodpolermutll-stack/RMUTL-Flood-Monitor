window.WATER_APP_CONFIG = {

  stations: [

    // ==================================================
    // สถานี 1 - แม่น้ำ
    // ==================================================
    {
      id: "river",

      name: "ระดับน้ำในแม่น้ำ",
      shortName: "สถานีแม่น้ำ",

      deployed: true,

      // พิกัดสำรอง
      // ถ้า Google Sheet มี GPS ล่าสุด
      // app.js จะใช้พิกัดจาก Sheet
      latitude: 18.362776,
      longitude: 99.582243,

      googleSheetCsv:
        "https://docs.google.com/spreadsheets/d/1TZGZodxs95my8uxbm0w5J6fpPDmIZUAQpwRSKdxPQh4/export?format=csv&gid=994352728",

      unit: "เมตร",

      // ระดับเฝ้าระวัง
      warningLevel: 2.5,

      color: "#0B84F3",
      softColor: "#E4F2FF"
    },


    // ==================================================
    // สถานี 2 - น้ำท่วม จุด 1
    // ==================================================
    {
      id: "flood-point-1",

      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 1",
      shortName: "จุดน้ำท่วม 1",

      // เปลี่ยนเป็น true เมื่อเริ่มใช้งานสถานี 2
      deployed: false,

      latitude: 18.290000,
      longitude: 99.495000,

      googleSheetCsv:
        "https://docs.google.com/spreadsheets/d/1TZGZodxs95my8uxbm0w5J6fpPDmIZUAQpwRSKdxPQh4/export?format=csv&gid=615401149",

      unit: "เมตร",

      warningLevel: 0.8,

      color: "#F97316",
      softColor: "#FFF0E3"
    },


    // ==================================================
    // สถานี 3 - น้ำท่วม จุด 2
    // ==================================================
    {
      id: "flood-point-2",

      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 2",
      shortName: "จุดน้ำท่วม 2",

      // เปลี่ยนเป็น true เมื่อเริ่มใช้งานสถานี 3
      deployed: false,

      latitude: 18.295000,
      longitude: 99.497000,

      googleSheetCsv:
        "https://docs.google.com/spreadsheets/d/1TZGZodxs95my8uxbm0w5J6fpPDmIZUAQpwRSKdxPQh4/export?format=csv&gid=1870805308",

      unit: "เมตร",

      warningLevel: 0.8,

      color: "#8B5CF6",
      softColor: "#F2ECFF"
    }

  ]

};
