'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface Aircraft {
  hex: string;
  callsign?: string;
  lat: number;
  lon: number;
  alt?: number;
  altGeom?: number;
  track?: number;
  gs?: number;
  ts?: number;
  onGround: boolean;
  squawk?: string;
  reg?: string;
  typeCode?: string;
  src?: string;
  seen?: number;
  dstNm?: number;
}

interface TrailPoint {
  lat: number;
  lon: number;
  ts: number;
}

interface MapComponentProps {
  aircraft: Aircraft[];
  selectedAircraft: Aircraft | null;
  onSelectAircraft: (aircraft: Aircraft) => void;
  selectedTrail: TrailPoint[];
  trailHistory: Map<string, TrailPoint[]>;
}

// Compute heading from two lat/lon points (returns degrees, 0° = north)
function computeHeading(lat1: number, lon1: number, lat2: number, lon2: number): number | null {
  // Skip if points are identical (zero distance)
  if (lat1 === lat2 && lon1 === lon2) {
    return null;
  }
  
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  
  return (θ * 180 / Math.PI + 360) % 360;
}

// Calculate heading for aircraft from trail points
// Uses last segment if 2 points, or average of last 2 segments if ≥3 points
function calculateAircraftHeading(points: TrailPoint[]): number | null {
  if (points.length < 2) {
    return null;
  }
  
  if (points.length === 2) {
    // Just use the last segment
    return computeHeading(points[0].lat, points[0].lon, points[1].lat, points[1].lon);
  }
  
  // ≥3 points: average of last TWO segments
  const len = points.length;
  const heading1 = computeHeading(
    points[len - 3].lat, points[len - 3].lon,
    points[len - 2].lat, points[len - 2].lon
  );
  const heading2 = computeHeading(
    points[len - 2].lat, points[len - 2].lon,
    points[len - 1].lat, points[len - 1].lon
  );
  
  if (heading1 === null && heading2 === null) {
    return null;
  }
  if (heading1 === null) return heading2;
  if (heading2 === null) return heading1;
  
  // Average two headings (handling wrap-around)
  let diff = heading2 - heading1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  return (heading1 + diff / 2 + 360) % 360;
}

// Guard Leaflet usage for SSR/first load
const createAircraftIcon = (rotation: number = 0, isSelected: boolean = false, isMobile: boolean = false) => {
  try {
    // Dynamic import L only on client
    const L = require('leaflet');
    const color = isSelected ? '#ef4444' : '#3b82f6';
    
    // Responsive icon sizes
    // Mobile <768: 24px default, 32px selected
    // Desktop ≥768: 32px default, 40px selected
    const size = isMobile 
      ? (isSelected ? 32 : 24) 
      : (isSelected ? 40 : 32);
    const anchor = size / 2; // Center anchor
    
    return L.divIcon({
      html: `<div style="transform: rotate(${rotation}deg); color: ${color}; font-size: ${size}px;">✈</div>`,
      className: 'aircraft-marker',
      iconSize: [size, size],
      iconAnchor: [anchor, anchor],
    });
  } catch (error) {
    console.error('Error creating aircraft icon:', error);
    // Return null will use default marker
    return undefined;
  }
};

function SelectedAircraftView({ aircraft }: { aircraft: Aircraft }) {
  const map = useMap();
  
  useEffect(() => {
    try {
      map.setView([aircraft.lat, aircraft.lon], map.getZoom(), { animate: true });
    } catch (error) {
      console.error('Error centering map:', error);
    }
  }, [aircraft, map]);
  
  return null;
}

export default function MapComponent({ aircraft, selectedAircraft, onSelectAircraft, selectedTrail, trailHistory }: MapComponentProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const lastKnownHeadingRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setMounted(true);
    
    // Guard window usage
    if (typeof window === 'undefined') return;
    
    try {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    } catch (error) {
      console.error('Error setting up resize listener:', error);
    }
  }, []);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-100">
        <div className="text-zinc-500">Ładowanie mapy...</div>
      </div>
    );
  }

  // Show error state if map fails, but don't crash the page
  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-100">
        <div className="text-center text-zinc-600 p-4">
          <div className="text-sm font-medium mb-1">Mapa niedostępna</div>
          <div className="text-xs text-zinc-500">Lista lotów działa normalnie</div>
        </div>
      </div>
    );
  }

  try {
    return (
      <MapContainer
        center={[52.1657, 20.9671]}
        zoom={9}
        style={{ 
          height: isMobile ? '55vh' : '100%',
          minHeight: isMobile ? '320px' : '100%',
          width: '100%' 
        }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Data: <a href="https://adsb.fi/">adsb.fi</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {aircraft.map((ac) => {
          try {
            // For selected aircraft: use selectedTrail (API data) when available, otherwise session buffer
            // For all other aircraft: use session buffer
            const isSelected = selectedAircraft?.hex === ac.hex;
            const points = (isSelected && selectedTrail.length >= 2) 
              ? selectedTrail 
              : (trailHistory.get(ac.hex) || []);
            
            let heading: number | null = calculateAircraftHeading(points);
            
            // Store successful heading for fallback
            if (heading !== null) {
              lastKnownHeadingRef.current.set(ac.hex, heading);
            } else {
              // Fallback to last known heading for this hex
              heading = lastKnownHeadingRef.current.get(ac.hex) ?? 0;
            }
            
            // Apply rotation: glyph ✈ points north at 0°
            const rotation = heading;
            const icon = createAircraftIcon(rotation, isSelected, isMobile);
            return (
              <Marker
                key={ac.hex}
                position={[ac.lat, ac.lon]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    try {
                      onSelectAircraft(ac);
                    } catch (error) {
                      console.error('Error selecting aircraft:', error);
                    }
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={0.9}>
                  <div className="text-xs">
                    <div className="font-bold">{ac.callsign || ac.hex}</div>
                    {ac.alt !== undefined && !ac.onGround && <div>{ac.alt} ft</div>}
                  </div>
                </Tooltip>
              </Marker>
            );
          } catch (error) {
            console.error(`Error rendering marker for ${ac.hex}:`, error);
            return null;
          }
        })}
        {selectedAircraft && <SelectedAircraftView aircraft={selectedAircraft} />}
        {selectedTrail.length >= 2 && (() => {
          try {
            const now = Math.floor(Date.now() / 1000);
            const positions: [number, number][] = selectedTrail.map(p => [p.lat, p.lon]);
            const lineWeight = isMobile ? 1.5 : 2;
            
            const segments = [];
            for (let i = 0; i < positions.length - 1; i++) {
              const point = selectedTrail[i];
              const age = now - point.ts;
              const maxAge = 3600;
              const opacity = Math.max(0.2, 1 - (age / maxAge) * 0.8);
              
              segments.push(
                <Polyline
                  key={`trail-${i}`}
                  positions={[positions[i], positions[i + 1]]}
                  pathOptions={{
                    color: '#ef4444',
                    weight: lineWeight,
                    opacity: opacity,
                  }}
                />
              );
            }
            return <>{segments}</>;
          } catch (error) {
            console.error('Error rendering trail:', error);
            return null;
          }
        })()}
      </MapContainer>
    );
  } catch (error) {
    console.error('Error rendering map:', error);
    setMapError(error instanceof Error ? error.message : 'Unknown error');
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-100">
        <div className="text-center text-zinc-600 p-4">
          <div className="text-sm font-medium mb-1">Mapa niedostępna</div>
          <div className="text-xs text-zinc-500">Lista lotów działa normalnie</div>
        </div>
      </div>
    );
  }
}
