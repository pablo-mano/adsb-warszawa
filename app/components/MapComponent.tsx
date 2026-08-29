'use client';

import { useEffect, useState } from 'react';
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

export default function MapComponent({ aircraft, selectedAircraft, onSelectAircraft, selectedTrail }: MapComponentProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

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
            const icon = createAircraftIcon(ac.track || 0, selectedAircraft?.hex === ac.hex, isMobile);
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
