// Raven's Coloured Progressive Matrices (CPM)
// 36 questions across 3 sets: A, Ab, B (12 each)
// Images are ordered sequentially: img_01..img_12 = Set A,
// img_13..img_24 = Set Ab, img_25..img_36 = Set B.

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
import img36 from "@/assets/raven/img_36.jpg";

export type RavenSet = "A" | "Ab" | "B";

export interface RavenQuestion {
  id: string; // e.g. "A1", "Ab3", "B12"
  set: RavenSet;
  index: number; // 1..12 within the set
  image: string;
  correct: number; // 1..6
}

// Standard published Raven's CPM scoring key
const KEY_A: number[] = [4, 5, 1, 2, 6, 3, 6, 2, 1, 3, 4, 5];
const KEY_AB: number[] = [4, 5, 1, 6, 2, 1, 3, 4, 6, 3, 5, 2];
const KEY_B: number[] = [2, 6, 1, 2, 1, 3, 5, 6, 4, 3, 4, 5];

const ALL_IMAGES: string[] = [
  img01, img02, img03, img04, img05, img06, img07, img08, img09, img10,
  img11, img12, img13, img14, img15, img16, img17, img18, img19, img20,
  img21, img22, img23, img24, img25, img26, img27, img28, img29, img30,
  img31, img32, img33, img34, img35, img36,
];

function buildSet(set: RavenSet, key: number[], offset: number): RavenQuestion[] {
  return key.map((correct, i) => {
    const idx = i + 1;
    return {
      id: `${set}${idx}`,
      set,
      index: idx,
      image: ALL_IMAGES[offset + i],
      correct,
    };
  });
}

export const RAVEN_QUESTIONS: RavenQuestion[] = [
  ...buildSet("A", KEY_A, 0),
  ...buildSet("Ab", KEY_AB, 12),
  ...buildSet("B", KEY_B, 24),
];

export const TOTAL_QUESTIONS = RAVEN_QUESTIONS.length; // 36

export const SET_LABELS: Record<RavenSet, string> = {
  A: "المجموعة أ",
  Ab: "المجموعة أ ب",
  B: "المجموعة ب",
};
