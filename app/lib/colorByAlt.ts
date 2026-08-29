// tar1090 ColorByAlt palette
// Source: https://github.com/wiedehopf/tar1090/blob/master/html/defaults.js

// Hue stops for altitude interpolation (feet → hue)
const hueStops: Array<{ alt: number; hue: number }> = [
  { alt: 0, hue: 20 },
  { alt: 2000, hue: 32.5 },
  { alt: 4000, hue: 43 },
  { alt: 6000, hue: 54 },
  { alt: 8000, hue: 72 },
  { alt: 9000, hue: 85 },
  { alt: 11000, hue: 140 },
  { alt: 40000, hue: 300 },
  { alt: 51000, hue: 360 },
];

// Lightness table for hue interpolation (hue → lightness)
const lightnessTable: Array<{ h: number; val: number }> = [
  { h: 0, val: 53 },
  { h: 20, val: 50 },
  { h: 32, val: 54 },
  { h: 40, val: 52 },
  { h: 46, val: 51 },
  { h: 50, val: 46 },
  { h: 60, val: 43 },
  { h: 80, val: 41 },
  { h: 100, val: 41 },
  { h: 120, val: 41 },
  { h: 140, val: 41 },
  { h: 160, val: 40 },
  { h: 180, val: 40 },
  { h: 190, val: 44 },
  { h: 198, val: 50 },
  { h: 200, val: 58 },
  { h: 220, val: 58 },
  { h: 240, val: 58 },
  { h: 255, val: 55 },
  { h: 266, val: 55 },
  { h: 270, val: 58 },
  { h: 280, val: 58 },
  { h: 290, val: 47 },
  { h: 300, val: 43 },
  { h: 310, val: 48 },
  { h: 320, val: 48 },
  { h: 340, val: 52 },
  { h: 360, val: 53 },
];

// Linear interpolation
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Get hue for a given altitude
function getHueForAltitude(alt: number): number {
  // Below 0 ft: hue 20
  if (alt < 0) return 20;
  
  // Above 51000 ft: hue 360
  if (alt >= 51000) return 360;
  
  // Find the two stops to interpolate between
  for (let i = 0; i < hueStops.length - 1; i++) {
    const curr = hueStops[i];
    const next = hueStops[i + 1];
    
    if (alt >= curr.alt && alt <= next.alt) {
      const t = (alt - curr.alt) / (next.alt - curr.alt);
      return lerp(curr.hue, next.hue, t);
    }
  }
  
  // Fallback (shouldn't reach here)
  return 20;
}

// Get lightness for a given hue
function getLightnessForHue(hue: number): number {
  // Find the two lightness points to interpolate between
  for (let i = 0; i < lightnessTable.length - 1; i++) {
    const curr = lightnessTable[i];
    const next = lightnessTable[i + 1];
    
    if (hue >= curr.h && hue <= next.h) {
      const t = (hue - curr.h) / (next.h - curr.h);
      return lerp(curr.val, next.val, t);
    }
  }
  
  // If hue is outside range, use closest endpoint
  if (hue < lightnessTable[0].h) {
    return lightnessTable[0].val;
  }
  return lightnessTable[lightnessTable.length - 1].val;
}

/**
 * Get air color for a given altitude (internal helper for legend)
 * Always returns air color, never ground or unknown colors
 * @param alt Altitude in feet
 * @returns HSL color string
 */
function getAirColor(alt: number): string {
  const hue = getHueForAltitude(alt);
  const lightness = getLightnessForHue(hue);
  const saturation = 88;
  return `hsl(${hue.toFixed(1)},${saturation}%,${lightness.toFixed(1)}%)`;
}

/**
 * Get HSL color string for a given altitude
 * @param alt Altitude in feet (or null/undefined for unknown)
 * @returns HSL color string, e.g. "hsl(140,88%,41%)"
 */
export function colorByAlt(alt: number | null | undefined): string {
  // Missing altitude → gray
  if (alt === null || alt === undefined) {
    return 'hsl(0,0%,75%)';
  }
  
  // On ground (alt === 0) → dark gray
  if (alt === 0) {
    return 'hsl(220,0%,30%)';
  }
  
  // Air: calculate hue and lightness
  return getAirColor(alt);
}

/**
 * Generate a CSS gradient string for the altitude legend (0 to 40k ft)
 * Uses air colors only (no ground or unknown colors)
 * @returns CSS linear-gradient string
 */
export function getAltitudeLegendGradient(): string {
  const steps: string[] = [];
  
  // Sample the AIR color ramp from 0 to 40000 ft
  const samples = 20;
  for (let i = 0; i <= samples; i++) {
    const alt = (i / samples) * 40000;
    const color = getAirColor(alt);
    steps.push(color);
  }
  
  return `linear-gradient(to right, ${steps.join(', ')})`;
}
