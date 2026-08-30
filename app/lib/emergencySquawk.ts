/**
 * Emergency squawk detection and descriptions
 */

export type EmergencySquawk = '7500' | '7600' | '7700';

export interface EmergencyInfo {
  code: EmergencySquawk;
  description: string;
}

const EMERGENCY_DESCRIPTIONS: Record<EmergencySquawk, string> = {
  '7700': 'Niebezpieczeństwo',
  '7600': 'Awaria radia',
  '7500': 'Bezprawne zawładnięcie',
};

/**
 * Check if a squawk code is an emergency code (7500, 7600, 7700)
 * Normalizes input to string, trims whitespace, and performs exact match
 */
export function isEmergencySquawk(squawk: string | undefined): squawk is EmergencySquawk {
  if (!squawk) return false;
  const normalized = String(squawk).trim();
  return normalized === '7500' || normalized === '7600' || normalized === '7700';
}

/**
 * Get emergency info for a squawk code
 * Returns null if not an emergency squawk
 */
export function getEmergencyInfo(squawk: string | undefined): EmergencyInfo | null {
  if (!isEmergencySquawk(squawk)) return null;
  return {
    code: squawk,
    description: EMERGENCY_DESCRIPTIONS[squawk],
  };
}
