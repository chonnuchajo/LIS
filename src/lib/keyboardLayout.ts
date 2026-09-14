const THAI_DIGIT_TO_ARABIC: Record<string, string> = {
  "๐": "0",
  "๑": "1",
  "๒": "2",
  "๓": "3",
  "๔": "4",
  "๕": "5",
  "๖": "6",
  "๗": "7",
  "๘": "8",
  "๙": "9",
};

const THAI_KEDMANEE_TO_ENGLISH: Record<string, string> = {
  "ๆ": "q",
  "ไ": "w",
  "ำ": "e",
  "พ": "r",
  "ะ": "t",
  "ั": "y",
  "ี": "u",
  "ร": "i",
  "น": "o",
  "ย": "p",
  "บ": "[",
  "ล": "]",
  "ฟ": "a",
  "ห": "s",
  "ก": "d",
  "ด": "f",
  "เ": "g",
  "้": "h",
  "่": "j",
  "า": "k",
  "ส": "l",
  "ว": ";",
  "ง": "'",
  "ผ": "z",
  "ป": "x",
  "ฉ": "C",
  "แ": "c",
  "ฮ": "V",
  "อ": "v",
  "ฺ": "B",
  "ิ": "b",
  "์": "N",
  "ื": "n",
  "ท": "m",
  "ม": ",",
  "ใ": ".",
  "ฝ": "/",
  "ๅ": "1",
  "ภ": "4",
  "ถ": "5",
  "ุ": "6",
  "ึ": "7",
  "ค": "8",
  "ต": "9",
  "จ": "0",
  "ข": "-",
  "ช": "=",
  "ฦ": "?",
  "ฤ": "A",
  "ฆ": "S",
  "ฏ": "D",
  "โ": "F",
  "ฌ": "G",
  "็": "H",
  "๋": "J",
  "ษ": "K",
  "ศ": "L",
  "ซ": ":",
  "ฬ": "<",
  "ฒ": ">",
  "๐": "Q",
  "ฎ": "E",
  "ฑ": "R",
  "ธ": "T",
  "ํ": "Y",
  "๊": "U",
  "ณ": "I",
  "ฯ": "O",
  "ญ": "P",
  "ฐ": "{",
  "ฅ": "|",
  "ฃ": "\\",
};

const URL_PUNCTUATION = new Set(["/", "-"]);

function looksUrlLike(value: string): boolean {
  const lower = value.toLocaleLowerCase("th-TH");
  return lower.includes("://") || lower.includes("้ะะยห") || lower.includes("้ะะย") || lower.includes("?");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function thaiDigitsToArabic(value: string): string {
  return Array.from(value, (char) => THAI_DIGIT_TO_ARABIC[char] ?? char).join("");
}

function convertThaiKedmanee(value: string, preserveUrlPunctuation: boolean): string {
  return Array.from(value, (char) => {
    if (preserveUrlPunctuation && URL_PUNCTUATION.has(char)) return char;
    if (char === "/") return "2";
    if (char === "-") return "3";
    if (char === "๘") return "_";
    return THAI_DIGIT_TO_ARABIC[char] ?? THAI_KEDMANEE_TO_ENGLISH[char] ?? char;
  }).join("");
}

export function thaiKedmaneeToEnglish(value: string): string {
  return convertThaiKedmanee(value, looksUrlLike(value));
}

export function withThaiKedmaneeFallbacks(value: string): string[] {
  const text = String(value ?? "");
  const keyboardFallback = thaiKedmaneeToEnglish(text);
  const digitFallback = thaiDigitsToArabic(text);
  const keyboardDigitFallback = thaiDigitsToArabic(keyboardFallback);

  return unique([text, keyboardFallback, digitFallback, keyboardDigitFallback]);
}
