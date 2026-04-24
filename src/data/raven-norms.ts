// Raven's CPM percentile norms by age group (years).
// Based on the standard published norms tables (Raven, J.C., Court & Raven).
// Values are raw scores at each percentile for each age group.
// This is a widely-used reference table; figures here are the commonly cited norms.

export interface AgeNormRow {
  ageMin: number; // inclusive (years)
  ageMax: number; // inclusive (years)
  // raw score required to reach each percentile
  p95: number;
  p90: number;
  p75: number;
  p50: number;
  p25: number;
  p10: number;
  p5: number;
}

export const CPM_NORMS: AgeNormRow[] = [
  { ageMin: 5, ageMax: 5, p95: 17, p90: 16, p75: 14, p50: 11, p25: 9,  p10: 7,  p5: 6 },
  { ageMin: 6, ageMax: 6, p95: 22, p90: 20, p75: 17, p50: 14, p25: 11, p10: 9,  p5: 8 },
  { ageMin: 7, ageMax: 7, p95: 27, p90: 25, p75: 21, p50: 17, p25: 14, p10: 11, p5: 10 },
  { ageMin: 8, ageMax: 8, p95: 30, p90: 28, p75: 24, p50: 20, p25: 16, p10: 13, p5: 12 },
  { ageMin: 9, ageMax: 9, p95: 32, p90: 30, p75: 26, p50: 22, p25: 18, p10: 15, p5: 13 },
  { ageMin: 10, ageMax: 10, p95: 33, p90: 31, p75: 28, p50: 24, p25: 20, p10: 16, p5: 14 },
  { ageMin: 11, ageMax: 11, p95: 34, p90: 32, p75: 29, p50: 25, p25: 21, p10: 17, p5: 15 },
];

// IQ classification ranges (used in many Arabic CPM manuals)
export interface IQClassification {
  min: number;
  max: number;
  label: string;
  short: string;
  color: string; // semantic token suffix
}

export const IQ_CLASSIFICATIONS: IQClassification[] = [
  { min: 140, max: 200, label: "عبقري", short: "Genius", color: "level-genius" },
  { min: 130, max: 139, label: "ذكي جداً (متفوق)", short: "Very Superior", color: "level-superior" },
  { min: 120, max: 129, label: "ذكي", short: "Intelligent", color: "level-intelligent" },
  { min: 110, max: 119, label: "فوق المتوسط", short: "Above Average", color: "level-above" },
  { min: 90,  max: 109, label: "متوسط الذكاء", short: "Average", color: "level-average" },
  { min: 80,  max: 89,  label: "دون المتوسط (غبي)", short: "Dull", color: "level-below" },
  { min: 70,  max: 79,  label: "بليد الذكاء", short: "Borderline", color: "level-borderline" },
  { min: 50,  max: 69,  label: "تخلف عقلي خفيف", short: "Mild MR", color: "level-mr1" },
  { min: 35,  max: 49,  label: "تخلف عقلي متوسط", short: "Moderate MR", color: "level-mr2" },
  { min: 20,  max: 34,  label: "تخلف عقلي شديد", short: "Severe MR", color: "level-mr3" },
  { min: 0,   max: 19,  label: "تخلف عقلي عميق", short: "Profound MR", color: "level-mr4" },
];

export function classifyIQ(iq: number): IQClassification {
  return (
    IQ_CLASSIFICATIONS.find((c) => iq >= c.min && iq <= c.max) ??
    IQ_CLASSIFICATIONS[IQ_CLASSIFICATIONS.length - 1]
  );
}

function findNormRow(ageYears: number): AgeNormRow {
  const clamped = Math.max(5, Math.min(11, ageYears));
  return CPM_NORMS.find((r) => clamped >= r.ageMin && clamped <= r.ageMax) ?? CPM_NORMS[CPM_NORMS.length - 1];
}

/**
 * Estimate percentile from raw score using age norms (linear interpolation).
 */
export function estimatePercentile(rawScore: number, ageYears: number): number {
  const row = findNormRow(ageYears);
  const points: Array<[number, number]> = [
    [row.p5, 5],
    [row.p10, 10],
    [row.p25, 25],
    [row.p50, 50],
    [row.p75, 75],
    [row.p90, 90],
    [row.p95, 95],
  ];

  if (rawScore <= points[0][0]) return Math.max(1, Math.round((rawScore / Math.max(1, points[0][0])) * 5));
  if (rawScore >= points[points.length - 1][0]) return 99;

  for (let i = 0; i < points.length - 1; i++) {
    const [s1, p1] = points[i];
    const [s2, p2] = points[i + 1];
    if (rawScore >= s1 && rawScore <= s2) {
      if (s2 === s1) return p2;
      const t = (rawScore - s1) / (s2 - s1);
      return Math.round(p1 + t * (p2 - p1));
    }
  }
  return 50;
}

/**
 * Convert percentile to an approximate IQ using the normal distribution
 * (mean=100, SD=15). This is the standard approach used in CPM manuals.
 */
export function percentileToIQ(percentile: number): number {
  const p = Math.max(0.5, Math.min(99.5, percentile)) / 100;
  // Inverse normal (Beasley-Springer-Moro approximation)
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
             138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
             66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184,
             -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143,
             3.75440866190742];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number, z: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    z = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
        ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q*q;
    z = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
        (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
         ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  return Math.round(100 + 15 * z);
}
