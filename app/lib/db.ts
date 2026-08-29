import { neon } from '@neondatabase/serverless';

let dbInitialized = false;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  return neon(connectionString);
}

export async function initializeDb() {
  if (dbInitialized) return;
  
  const sql = getDb();
  if (!sql) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS positions (
        hex text NOT NULL,
        ts integer NOT NULL,
        lat double precision NOT NULL,
        lon double precision NOT NULL,
        alt integer,
        track double precision,
        gs double precision,
        callsign text,
        PRIMARY KEY (hex, ts)
      )
    `;
    
    await sql`CREATE INDEX IF NOT EXISTS idx_positions_ts ON positions (ts)`;
    
    dbInitialized = true;
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

export interface PositionRow {
  hex: string;
  ts: number;
  lat: number;
  lon: number;
  alt?: number;
  track?: number;
  gs?: number;
  callsign?: string;
}

export async function upsertPositions(positions: PositionRow[]) {
  const sql = getDb();
  if (!sql || positions.length === 0) return;

  try {
    await initializeDb();
    
    for (const pos of positions) {
      await sql`
        INSERT INTO positions (hex, ts, lat, lon, alt, track, gs, callsign)
        VALUES (${pos.hex}, ${pos.ts}, ${pos.lat}, ${pos.lon}, ${pos.alt ?? null}, ${pos.track ?? null}, ${pos.gs ?? null}, ${pos.callsign ?? null})
        ON CONFLICT (hex, ts) DO NOTHING
      `;
    }
  } catch (error) {
    console.error('Error upserting positions:', error);
  }
}

export async function purgeOldPositions() {
  const sql = getDb();
  if (!sql) return;

  try {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - 86400;
    await sql`DELETE FROM positions WHERE ts < ${cutoff}`;
  } catch (error) {
    console.error('Error purging old positions:', error);
  }
}

export async function getTrail(hex: string, fromTs?: number): Promise<{ lat: number; lon: number; ts: number; alt: number | null }[]> {
  const sql = getDb();
  if (!sql) {
    return [];
  }

  try {
    await initializeDb();
    
    const now = Math.floor(Date.now() / 1000);
    const defaultFrom = now - 3600;
    const from = fromTs && fromTs > 0 ? fromTs : defaultFrom;
    const oneHourAgo = now - 3600;
    const effectiveFrom = Math.max(from, oneHourAgo);

    const rows = await sql`
      SELECT lat, lon, ts, alt
      FROM positions
      WHERE hex = ${hex}
        AND ts >= ${effectiveFrom}
      ORDER BY ts ASC
    `;

    return rows.map(row => ({
      lat: row.lat,
      lon: row.lon,
      ts: row.ts,
      alt: row.alt,
    }));
  } catch (error) {
    console.error('Error fetching trail:', error);
    return [];
  }
}
