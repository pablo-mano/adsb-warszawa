import { NextResponse } from 'next/server';

export const revalidate = 45;

const USER_AGENT = 'adsb-warsaw-mvp/0.1 (personal; +https://datamano.com)';

let lastRequestTime = 0;

async function fetchWithRateLimit(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
    next: { revalidate: 45 }
  });
}

export async function GET() {
  try {
    const response = await fetchWithRateLimit('https://opendata.adsb.fi/api/v2/mil');

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch military data', hexes: [] },
        { status: 503 }
      );
    }

    const data = await response.json();
    
    // Extract hex codes and normalize to lowercase
    const hexes: string[] = [];
    if (data.ac && Array.isArray(data.ac)) {
      for (const aircraft of data.ac) {
        if (aircraft.hex && typeof aircraft.hex === 'string') {
          hexes.push(aircraft.hex.toLowerCase());
        }
      }
    }

    // Remove duplicates
    const uniqueHexes = Array.from(new Set(hexes));

    return NextResponse.json(
      { hexes: uniqueHexes },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=15',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching military data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch military data', hexes: [] },
      { status: 503 }
    );
  }
}
