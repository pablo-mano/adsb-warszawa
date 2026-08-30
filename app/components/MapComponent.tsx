'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { colorByAlt, getAltitudeLegendGradient } from '../lib/colorByAlt';
import { typeDisplayName } from '../lib/aircraftTypes';

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
  alt: number | null;
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
    
    // Responsive icon sizes
    // Mobile <768: 24px default, 32px selected
    // Desktop ≥768: 32px default, 40px selected
    const size = isMobile 
      ? (isSelected ? 32 : 24) 
      : (isSelected ? 40 : 32);
    const anchor = size / 2; // Center anchor
    
    // Twemoji airplane glyph (U+2708) - faces upper-right / NE at 0°
    const html = `<img src="/twemoji-2708.svg" width="${size}" height="${size}" style="transform: rotate(${rotation}deg); transform-origin: center center;" alt="✈" />`;
    
    return L.divIcon({
      html: html,
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

// Removed auto-panning: map stays where user left it

// Desktop altitude legend component
function AltitudeLegend() {
  const map = useMap();
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    try {
      // Dynamic Leaflet Control import
      const L = require('leaflet');
      
      const LegendControl = L.Control.extend({
        onAdd: function() {
          const div = L.DomUtil.create('div', 'altitude-legend');
          legendRef.current = div;
          
          div.style.background = 'white';
          div.style.padding = '6px 8px';
          div.style.borderRadius = '4px';
          div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
          div.style.fontSize = '11px';
          div.style.fontFamily = 'system-ui, -apple-system, sans-serif';
          
          const gradient = getAltitudeLegendGradient();
          div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: #666; font-weight: 500;">0</span>
              <div style="width: 100px; height: 8px; background: ${gradient}; border-radius: 2px;"></div>
              <span style="color: #666; font-weight: 500;">40k</span>
            </div>
          `;
          
          return div;
        }
      });

      const legendControl = new LegendControl({ position: 'bottomleft' });
      legendControl.addTo(map);

      return () => {
        legendControl.remove();
      };
    } catch (error) {
      console.error('Error creating altitude legend:', error);
    }
  }, [map]);

  return null;
}

// User location types
type LocationStatus = 'idle' | 'pending' | 'granted' | 'error';

interface UserLocation {
  lat: number;
  lon: number;
  accuracy: number;
}

// Locate control component
interface LocateControlProps {
  onLocationUpdate: (location: UserLocation) => void;
  onStatusChange: (status: LocationStatus) => void;
  isMobile: boolean;
}

function LocateControl({ onLocationUpdate, onStatusChange, isMobile }: LocateControlProps) {
  const map = useMap();
  const [status, setStatus] = useState<LocationStatus>('idle');
  const controlRef = useRef<any>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const updateStatus = useCallback((newStatus: LocationStatus) => {
    setStatus(newStatus);
    onStatusChange(newStatus);
  }, [onStatusChange]);

  const handleLocate = useCallback(() => {
    if (status === 'pending') return;
    
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      updateStatus('error');
      return;
    }

    updateStatus('pending');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: UserLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        onLocationUpdate(location);
        updateStatus('granted');
        
        // Pan to user location once
        map.setView([location.lat, location.lon], map.getZoom());
      },
      (error) => {
        console.error('Geolocation error:', error);
        updateStatus('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [status, updateStatus, onLocationUpdate, map]);

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    try {
      const L = require('leaflet');
      
      const LocateControlClass = L.Control.extend({
        onAdd: function() {
          const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
          const button = L.DomUtil.create('button', 'locate-control-button', container);
          buttonRef.current = button;
          
          // 44px on mobile (390px viewport), 34px on desktop
          const size = isMobile ? 44 : 34;
          button.style.width = `${size}px`;
          button.style.height = `${size}px`;
          button.style.background = 'white';
          button.style.border = 'none';
          button.style.borderRadius = '4px';
          button.style.cursor = 'pointer';
          button.style.display = 'flex';
          button.style.alignItems = 'center';
          button.style.justifyContent = 'center';
          button.style.padding = '0';
          button.style.transition = 'background-color 0.2s';
          
          // Prevent map interactions when clicking the button
          L.DomEvent.disableClickPropagation(button);
          L.DomEvent.on(button, 'click', handleLocate);
          
          return container;
        },
        onRemove: function() {
          if (buttonRef.current) {
            L.DomEvent.off(buttonRef.current, 'click', handleLocate);
          }
        }
      });

      controlRef.current = new LocateControlClass({ position: 'topright' });
      controlRef.current.addTo(map);

      return () => {
        if (controlRef.current) {
          controlRef.current.remove();
        }
      };
    } catch (error) {
      console.error('Error creating locate control:', error);
    }
  }, [map, isMobile, handleLocate]);

  // Update button appearance based on status
  useEffect(() => {
    if (!buttonRef.current) return;

    const button = buttonRef.current;
    const size = isMobile ? 44 : 34;
    const iconSize = isMobile ? 22 : 18;
    
    // Clear previous content
    button.innerHTML = '';
    
    if (status === 'error') {
      button.style.backgroundColor = '#fee2e2';
      button.style.color = '#dc2626';
      button.title = 'Brak zgody na lokalizację';
      button.innerHTML = `<img src="/locate-icon.svg" width="${iconSize}" height="${iconSize}" style="filter: invert(15%) sepia(89%) saturate(5074%) hue-rotate(356deg) brightness(87%) contrast(93%);" alt="locate" />`;
    } else if (status === 'pending') {
      button.style.backgroundColor = '#e5e7eb';
      button.style.color = '#6b7280';
      button.disabled = true;
      button.title = 'Pobieranie lokalizacji...';
      button.innerHTML = `<img src="/locate-icon.svg" width="${iconSize}" height="${iconSize}" style="filter: grayscale(100%);" alt="locate" />`;
    } else if (status === 'granted') {
      button.style.backgroundColor = 'white';
      button.style.color = '#3b82f6';
      button.disabled = false;
      button.title = 'Odśwież lokalizację';
      button.innerHTML = `<img src="/locate-icon.svg" width="${iconSize}" height="${iconSize}" style="filter: invert(45%) sepia(88%) saturate(1945%) hue-rotate(202deg) brightness(101%) contrast(93%);" alt="locate" />`;
    } else {
      button.style.backgroundColor = 'white';
      button.style.color = '#374151';
      button.disabled = false;
      button.title = 'Pokaż moją lokalizację';
      button.innerHTML = `<img src="/locate-icon.svg" width="${iconSize}" height="${iconSize}" alt="locate" />`;
    }
  }, [status, isMobile]);

  return null;
}

// Create user location marker icon (blue dot with white stroke)
const createUserLocationIcon = () => {
  try {
    const L = require('leaflet');
    
    const html = `
      <div style="
        width: 16px;
        height: 16px;
        background-color: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `;
    
    return L.divIcon({
      html: html,
      className: 'user-location-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  } catch (error) {
    console.error('Error creating user location icon:', error);
    return undefined;
  }
};

export default function MapComponent({ aircraft, selectedAircraft, onSelectAircraft, selectedTrail, trailHistory }: MapComponentProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const lastKnownHeadingRef = useRef<Map<string, number>>(new Map());
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');

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
        <LocateControl 
          onLocationUpdate={setUserLocation} 
          onStatusChange={setLocationStatus}
          isMobile={isMobile}
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
            
            // Apply rotation: Twemoji glyph faces upper-right / NE at 0°, so subtract 45°
            const rotation = heading - 45;
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
                    {typeDisplayName(ac.typeCode) && <div>{typeDisplayName(ac.typeCode)}</div>}
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
        {userLocation && locationStatus === 'granted' && (() => {
          try {
            const icon = createUserLocationIcon();
            return (
              <>
                <Circle
                  center={[userLocation.lat, userLocation.lon]}
                  radius={userLocation.accuracy}
                  pathOptions={{
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.1,
                    weight: 1,
                    opacity: 0.3,
                  }}
                />
                <Marker
                  position={[userLocation.lat, userLocation.lon]}
                  icon={icon}
                />
              </>
            );
          } catch (error) {
            console.error('Error rendering user location:', error);
            return null;
          }
        })()}
        {selectedAircraft && selectedTrail.length >= 2 && !isMobile && <AltitudeLegend />}
        {selectedTrail.length >= 2 && (() => {
          try {
            const positions: [number, number][] = selectedTrail.map(p => [p.lat, p.lon]);
            const lineWeight = isMobile ? 1.5 : 2;
            
            const segments = [];
            for (let i = 0; i < positions.length - 1; i++) {
              const point = selectedTrail[i];
              // Color by altitude of the segment's starting point
              const color = colorByAlt(point.alt);
              
              segments.push(
                <Polyline
                  key={`trail-${i}`}
                  positions={[positions[i], positions[i + 1]]}
                  pathOptions={{
                    color: color,
                    weight: lineWeight,
                    opacity: 1,
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
