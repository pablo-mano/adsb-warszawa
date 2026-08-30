'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet';
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

interface LabelControlProps {
  isMobile: boolean;
  labelsEnabled: boolean;
  onToggle: () => void;
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
const createAircraftIcon = (
  rotation: number = 0, 
  isSelected: boolean = false, 
  isMobile: boolean = false,
  label: string | null = null
) => {
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
    
    // Label styling
    const labelFontSize = isMobile ? '10px' : '11px';
    const labelStyle = label 
      ? `position: absolute; left: ${size + 4}px; top: 50%; transform: translateY(-50%); 
         font-size: ${labelFontSize}; font-family: system-ui, -apple-system, sans-serif; 
         color: #18181b; font-weight: 500; white-space: nowrap; pointer-events: none;
         text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff,
                      -2px 0 0 #fff, 2px 0 0 #fff, 0 -2px 0 #fff, 0 2px 0 #fff;`
      : '';
    
    // Twemoji airplane glyph (U+2708) - faces upper-right / NE at 0°
    // Wrap in a container div with position:relative so label can be absolutely positioned
    const html = `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        <img src="/twemoji-2708.svg" width="${size}" height="${size}" 
             style="transform: rotate(${rotation}deg); transform-origin: center center; display: block;" alt="✈" />
        ${label ? `<span style="${labelStyle}">${label}</span>` : ''}
      </div>
    `;
    
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

// Label toggle control component
function LabelControl({ isMobile, labelsEnabled, onToggle }: LabelControlProps) {
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    try {
      const L = require('leaflet');
      
      const LabelToggleControl = L.Control.extend({
        onAdd: function() {
          const button = L.DomUtil.create('button', 'label-toggle-control');
          buttonRef.current = button;
          
          // Styling for 44px hit area
          button.style.background = 'white';
          button.style.border = '2px solid rgba(0,0,0,0.2)';
          button.style.borderRadius = '4px';
          button.style.width = '44px';
          button.style.height = '44px';
          button.style.display = 'flex';
          button.style.alignItems = 'center';
          button.style.justifyContent = 'center';
          button.style.cursor = 'pointer';
          button.style.fontSize = '18px';
          button.style.fontWeight = '600';
          button.style.transition = 'background-color 0.15s';
          button.title = 'Etykiety';
          button.innerHTML = '🏷️';
          
          // Prevent map interactions when clicking the button
          L.DomEvent.disableClickPropagation(button);
          L.DomEvent.disableScrollPropagation(button);
          
          button.onclick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          };
          
          return button;
        }
      });

      const labelControl = new LabelToggleControl({ position: 'topright' });
      labelControl.addTo(map);

      return () => {
        labelControl.remove();
      };
    } catch (error) {
      console.error('Error creating label control:', error);
    }
  }, [map, onToggle, isMobile]);

  // Update button appearance when labelsEnabled changes
  useEffect(() => {
    if (buttonRef.current) {
      if (labelsEnabled) {
        buttonRef.current.style.backgroundColor = '#2563eb';
        buttonRef.current.style.color = 'white';
        buttonRef.current.style.borderColor = '#2563eb';
      } else {
        buttonRef.current.style.backgroundColor = 'white';
        buttonRef.current.style.color = '#3f3f46';
        buttonRef.current.style.borderColor = 'rgba(0,0,0,0.2)';
      }
    }
  }, [labelsEnabled]);

  return null;
}

// Component to track zoom level
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };

    // Set initial zoom
    handleZoom();

    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

// Component to follow selected aircraft
function FollowSelectedAircraft({ selectedAircraft }: { selectedAircraft: Aircraft | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !selectedAircraft || selectedAircraft.lat == null || selectedAircraft.lon == null) {
      return;
    }

    // Recenter map on selected aircraft, preserving current zoom
    const currentZoom = map.getZoom();
    map.setView([selectedAircraft.lat, selectedAircraft.lon], currentZoom, {
      animate: true,
      duration: 0.25,
    });
  }, [map, selectedAircraft?.hex, selectedAircraft?.lat, selectedAircraft?.lon]);

  return null;
}

export default function MapComponent({ aircraft, selectedAircraft, onSelectAircraft, selectedTrail, trailHistory }: MapComponentProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [labelsEnabled, setLabelsEnabled] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(9);
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
            
            // Apply rotation: Twemoji glyph faces upper-right / NE at 0°, so subtract 45°
            const rotation = heading - 45;
            
            // Label logic:
            // - Always show for selected aircraft
            // - For others: only if labelsEnabled AND zoom >= 9
            const shouldShowLabel = isSelected || (labelsEnabled && currentZoom >= 9);
            const labelText = shouldShowLabel ? (ac.callsign || ac.hex) : null;
            
            const icon = createAircraftIcon(rotation, isSelected, isMobile, labelText);
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
        {selectedAircraft && selectedTrail.length >= 2 && !isMobile && <AltitudeLegend />}
        <ZoomTracker onZoomChange={setCurrentZoom} />
        <LabelControl 
          isMobile={isMobile} 
          labelsEnabled={labelsEnabled} 
          onToggle={() => setLabelsEnabled(!labelsEnabled)} 
        />
        <FollowSelectedAircraft selectedAircraft={selectedAircraft} />
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
