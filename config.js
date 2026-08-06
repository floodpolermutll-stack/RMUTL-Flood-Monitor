window.WATER_APP_CONFIG = {
  stations: [
    {
      id: "river",
      name: "ระดับน้ำในแม่น้ำ",
      shortName: "สถานีแม่น้ำ",
      deployed: true,

      latitude: 13.7563,
      longitude: 100.5018,

      googleSheetCsv: "",

      unit: "เมตร",
      warningLevel: 3.0,

      color: "#0B84F3",
      softColor: "#E4F2FF",
    },

    {
      id: "flood-point-1",
      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 1",
      shortName: "จุดน้ำท่วม 1",
      deployed: false,

      latitude: 13.7463,
      longitude: 100.5118,

      googleSheetCsv: "",

      unit: "เมตร",
      warningLevel: 0.8,

      color: "#F97316",
      softColor: "#FFF0E3",
    },

    {
      id: "flood-point-2",
      name: "ระดับน้ำพื้นที่น้ำท่วม จุดที่ 2",
      shortName: "จุดน้ำท่วม 2",
      deployed: false,

      latitude: 13.7663,
      longitude: 100.4918,

      googleSheetCsv: "",

      unit: "เมตร",
      warningLevel: 0.8,

      color: "#8B5CF6",
      softColor: "#F2ECFF",
    },
  ],
};
