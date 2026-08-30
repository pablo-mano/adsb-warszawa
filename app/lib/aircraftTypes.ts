// Static ICAO aircraft type code to full display name mapping
// Keys are uppercase ICAO Doc 8643 type designators
const AIRCRAFT_TYPES: Record<string, string> = {
  // Boeing
  B737: 'Boeing 737',
  B738: 'Boeing 737-800',
  B739: 'Boeing 737-900',
  B38M: 'Boeing 737 MAX 8',
  B39M: 'Boeing 737 MAX 9',
  B744: 'Boeing 747-400',
  B748: 'Boeing 747-8',
  B752: 'Boeing 757-200',
  B763: 'Boeing 767-300',
  B772: 'Boeing 777-200',
  B77W: 'Boeing 777-300ER',
  B788: 'Boeing 787-8',
  B789: 'Boeing 787-9',
  
  // Airbus
  A319: 'Airbus A319',
  A320: 'Airbus A320',
  A20N: 'Airbus A320neo',
  A321: 'Airbus A321',
  A21N: 'Airbus A321neo',
  A332: 'Airbus A330-200',
  A333: 'Airbus A330-300',
  A339: 'Airbus A330-900',
  A343: 'Airbus A340-300',
  A359: 'Airbus A350-900',
  A35K: 'Airbus A350-1000',
  A388: 'Airbus A380-800',
  
  // Embraer
  E170: 'Embraer 170',
  E175: 'Embraer 175',
  E190: 'Embraer 190',
  E195: 'Embraer 195',
  E290: 'Embraer E190-E2',
  
  // Other manufacturers
  CRJ9: 'Canadair CRJ-900',
  DH8D: 'De Havilland Dash 8-400',
  AT72: 'ATR 72',
  AT76: 'ATR 72-600',
  C56X: 'Cessna Citation Excel',
  GLF5: 'Gulfstream G500',
  PC12: 'Pilatus PC-12',
};

/**
 * Get the full display name for an aircraft type code.
 * 
 * @param typeCode - ICAO aircraft type designator (case-insensitive)
 * @returns Full aircraft name if found in table, the typeCode itself if not found, or undefined if typeCode is missing/empty
 */
export function typeDisplayName(typeCode?: string): string | undefined {
  if (!typeCode || typeCode.trim() === '') {
    return undefined;
  }
  
  const normalized = typeCode.toUpperCase().trim();
  return AIRCRAFT_TYPES[normalized] ?? typeCode;
}
