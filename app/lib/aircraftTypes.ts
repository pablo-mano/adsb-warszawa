import icaoTypesDb from './icao_aircraft_types2.json';

// ICAO aircraft type database from tar1090-db
// Each entry is [full_name, wtc, engine_class]
const ICAO_TYPES: Record<string, string[]> = icaoTypesDb as Record<string, string[]>;

/**
 * Convert UPPERCASE text to Title Case
 */
function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get the full display name for an aircraft type code.
 * 
 * @param typeCode - ICAO aircraft type designator (case-insensitive)
 * @returns Full aircraft name if found in database, the typeCode itself if not found, or undefined if typeCode is missing/empty
 */
export function typeDisplayName(typeCode?: string): string | undefined {
  if (!typeCode || typeCode.trim() === '') {
    return undefined;
  }
  
  const normalized = typeCode.toUpperCase().trim();
  const entry = ICAO_TYPES[normalized];
  
  if (entry) {
    // Return the full name (first element) in Title Case
    return toTitleCase(entry[0]);
  }
  
  // Return the original typeCode if not found in database
  return typeCode;
}
