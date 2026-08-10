window.WATER_APP_CONFIG = {
  stations: [
    {
      id: "river",
      name: "ระดับน้ำในแม่น้ำ",
      shortName: "สถานีแม่น้ำ",

      deployed: true,

      latitude: 18.362776,
      longitude: 99.582243,

      googleSheetCsv:
        "https://docs.google.com/spreadsheets/d/1TZGZodxs95my8uxbm0w5J6fpPDmIZUAQpwRSKdxPQh4/gviz/tq?tqx=out:csv&gid=994352728",

      unit: "เมตร",

      warningLevel: 2.5,

      color: "#0B84F3",
      softColor: "#E4F2FF",
    },

    {
      id: "flood-point-1",
      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 1",
      shortName: "จุดน้ำท่วม 1",

      deployed: true,

      latitude: 18.290000,
      longitude: 99.495000,

      googleSheetCsv:
        "https://docs.google.com/spreadsheets/d/1TZGZodxs95my8uxbm0w5J6fpPDmIZUAQpwRSKdxPQh4/gviz/tq?tqx=out:csv&gid=615401149",

      unit: "เมตร",

      warningLevel: 0.8,

      color: "#F97316",
      softColor: "#FFF0E3",
    },

    {
      id: "flood-point-2",
      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 2",
      shortName: "จุดน้ำท่วม 2",

      deployed: true,

      latitude: 18.295000,
      longitude: 99.497000,

      googleSheetCsv:
        "https://docs.google.com/spreadsheets/d/1TZGZodxs95my8uxbm0w5J6fpPDmIZUAQpwRSKdxPQh4/gviz/tq?tqx=out:csv&gid=1870805308",

      unit: "เมตร",

      warningLevel: 0.8,

      color: "#8B5CF6",
      softColor: "#F2ECFF",
    },
  ],
};
