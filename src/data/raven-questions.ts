// Raven's Coloured Progressive Matrices (CPM)
// 36 questions across 3 sets: A, Ab, B (12 each)
// Image-to-question mapping based on Arabic titles in source images

import img01 from "@/assets/raven/img_01.jpg";
import img02 from "@/assets/raven/img_02.jpg";
import img03 from "@/assets/raven/img_03.jpg";
import img04 from "@/assets/raven/img_04.jpg";
import img05 from "@/assets/raven/img_05.jpg";
import img06 from "@/assets/raven/img_06.jpg";
import img07 from "@/assets/raven/img_07.jpg";
import img08 from "@/assets/raven/img_08.jpg";
import img09 from "@/assets/raven/img_09.jpg";
import img10 from "@/assets/raven/img_10.jpg";
import img11 from "@/assets/raven/img_11.jpg";
import img12 from "@/assets/raven/img_12.jpg";
import img13 from "@/assets/raven/img_13.jpg";
import img14 from "@/assets/raven/img_14.jpg";
import img15 from "@/assets/raven/img_15.jpg";
import img16 from "@/assets/raven/img_16.jpg";
import img17 from "@/assets/raven/img_17.jpg";
import img18 from "@/assets/raven/img_18.jpg";
import img19 from "@/assets/raven/img_19.jpg";
import img20 from "@/assets/raven/img_20.jpg";
import img21 from "@/assets/raven/img_21.jpg";
import img22 from "@/assets/raven/img_22.jpg";
import img23 from "@/assets/raven/img_23.jpg";
import img24 from "@/assets/raven/img_24.jpg";
import img25 from "@/assets/raven/img_25.jpg";
import img26 from "@/assets/raven/img_26.jpg";
import img27 from "@/assets/raven/img_27.jpg";
import img28 from "@/assets/raven/img_28.jpg";
import img29 from "@/assets/raven/img_29.jpg";
import img30 from "@/assets/raven/img_30.jpg";
import img31 from "@/assets/raven/img_31.jpg";
import img32 from "@/assets/raven/img_32.jpg";
import img33 from "@/assets/raven/img_33.jpg";
import img34 from "@/assets/raven/img_34.jpg";
import img35 from "@/assets/raven/img_35.jpg";
import img40 from "@/assets/raven/img_40.jpg";

export type RavenSet = "A" | "Ab" | "B";

export interface RavenQuestion {
  id: string; // e.g. "A1", "Ab3", "B12"
  set: RavenSet;
  index: number; // 1..12 within the set
  image: string;
  correct: number; // 1..6
}

// Standard published Raven's CPM scoring key (Raven, J.C. - Coloured Progressive Matrices)
// Order: items 1..12 for each set
const KEY_A: number[] = [4, 5, 1, 2, 6, 3, 6, 2, 1, 3, 4, 5];
const KEY_AB: number[] = [4, 5, 1, 6, 2, 1, 3, 4, 6, 3, 5, 2];
const KEY_B: number[] = [2, 6, 1, 2, 1, 3, 5, 6, 4, 3, 4, 5];

// Mapping from downloaded image number to (set, item)
// Determined by reading Arabic titles in each source image
const MAPPING: Record<string, string> = {
  // Set A (img_01 .. img_12 in order)
  A1: "01", A2: "02", A3: "03", A4: "04", A5: "05", A6: "06",
  A7: "07", A8: "08", A9: "09", A10: "10", A11: "11", A12: "12",
  // Set Ab (mixed order in source)
  Ab1: "13", Ab2: "14", Ab3: "15", Ab4: "16", Ab5: "17", Ab6: "18",
  Ab7: "23", Ab8: "22", Ab9: "21", Ab10: "20", Ab11: "19", Ab12: "25",
  // Set B
  B1: "30", B2: "24", B3: "28", B4: "29", B5: "31", B6: "32",
  B7: "26", B8: "27", B9: "40", B10: "35", B11: "34", B12: "33",
};

const IMAGES: Record<string, string> = {
  "01": img01, "02": img02, "03": img03, "04": img04, "05": img05,
  "06": img06, "07": img07, "08": img08, "09": img09, "10": img10,
  "11": img11, "12": img12, "13": img13, "14": img14, "15": img15,
  "16": img16, "17": img17, "18": img18, "19": img19, "20": img20,
  "21": img21, "22": img22, "23": img23, "24": img24, "25": img25,
  "26": img26, "27": img27, "28": img28, "29": img29, "30": img30,
  "31": img31, "32": img32, "33": img33, "34": img34, "35": img35,
  "40": img40,
};

function buildSet(set: RavenSet, key: number[]): RavenQuestion[] {
  return key.map((correct, i) => {
    const idx = i + 1;
    const id = `${set}${idx}`;
    return {
      id,
      set,
      index: idx,
      image: IMAGES[MAPPING[id]],
      correct,
    };
  });
}

export const RAVEN_QUESTIONS: RavenQuestion[] = [
  ...buildSet("A", KEY_A),
  ...buildSet("Ab", KEY_AB),
  ...buildSet("B", KEY_B),
];

export const TOTAL_QUESTIONS = RAVEN_QUESTIONS.length; // 36

export const SET_LABELS: Record<RavenSet, string> = {
  A: "المجموعة أ",
  Ab: "المجموعة أ ب",
  B: "المجموعة ب",
};
