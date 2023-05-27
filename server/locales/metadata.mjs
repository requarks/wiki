const localazyMetadata = {
  projectUrl: "https://localazy.com/p/wiki",
  baseLocale: "en",
  languages: [
    {
      language: "de",
      region: "",
      script: "",
      isRtl: false,
      name: "German",
      localizedName: "Deutsch",
      pluralType: (n) => { return (n===1) ? "one" : "other"; }
    },
    {
      language: "en",
      region: "",
      script: "",
      isRtl: false,
      name: "English",
      localizedName: "English",
      pluralType: (n) => { return (n===1) ? "one" : "other"; }
    },
    {
      language: "fr",
      region: "",
      script: "",
      isRtl: false,
      name: "French",
      localizedName: "Français",
      pluralType: (n) => { return (n===0 || n===1) ? "one" : "other"; }
    },
    {
      language: "pt",
      region: "BR",
      script: "",
      isRtl: false,
      name: "Brazilian Portuguese",
      localizedName: "Português (Brasil)",
      pluralType: (n) => { return (n>=0 && n<=1) ? "one" : "other"; }
    },
    {
      language: "ru",
      region: "",
      script: "",
      isRtl: false,
      name: "Russian",
      localizedName: "Русский",
      pluralType: (n) => { return ((n%10===1) && (n%100!==11)) ? "one" : ((n%10>=2 && n%10<=4) && ((n%100<12 || n%100>14))) ? "few" : "many"; }
    },
    {
      language: "zh",
      region: "",
      script: "Hans",
      isRtl: false,
      name: "Simplified Chinese",
      localizedName: "简体中文",
      pluralType: (n) => { return "other"; }
    }
  ],
  files: [
    {
      cdnHash: "54b977214afbffe2ffeb07d0ccb03558e75e4408",
      file: "file.json",
      path: "",
      library: "",
      module: "",
      buildType: "",
      productFlavors: [],
      cdnFiles: {
        "de#": "https://delivery.localazy.com/_a7797965569058078203416ae5aa/_e0/54b977214afbffe2ffeb07d0ccb03558e75e4408/de/file.json",
        "en#": "https://delivery.localazy.com/_a7797965569058078203416ae5aa/_e0/54b977214afbffe2ffeb07d0ccb03558e75e4408/en/file.json",
        "fr#": "https://delivery.localazy.com/_a7797965569058078203416ae5aa/_e0/54b977214afbffe2ffeb07d0ccb03558e75e4408/fr/file.json",
        "pt_BR#": "https://delivery.localazy.com/_a7797965569058078203416ae5aa/_e0/54b977214afbffe2ffeb07d0ccb03558e75e4408/pt-BR/file.json",
        "ru#": "https://delivery.localazy.com/_a7797965569058078203416ae5aa/_e0/54b977214afbffe2ffeb07d0ccb03558e75e4408/ru/file.json",
        "zh#Hans": "https://delivery.localazy.com/_a7797965569058078203416ae5aa/_e0/54b977214afbffe2ffeb07d0ccb03558e75e4408/zh-Hans/file.json"
      }
    }
  ]
};

export default localazyMetadata;
