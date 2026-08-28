'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
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

interface MapComponentProps {
  aircraft: Aircraft[];
  selectedAircraft: Aircraft | null;
  onSelectAircraft: (aircraft: Aircraft) => void;
}

const createAircraftIcon = (rotation: number = 0, isSelected: boolean = false) => {
  const color = isSelected ? '#ef4444' : '#3b82f6';
  return L.divIcon({
    html: `<div style="transform: rotate(${rotation}deg); color: ${color}; font-size: 24px;">✈</div>`,
    className: 'aircraft-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function SelectedAircraftView({ aircraft }: { aircraft: Aircraft }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView([aircraft.lat, aircraft.lon], map.getZoom(), { animate: true });
  }, [aircraft, map]);
  
  return null;
}

export default function MapComponent({ aircraft, selectedAircraft, onSelectAircraft }: MapComponentProps) {
  return (
    <MapContainer
      center={[52.1657, 20.9671]}
      zoom={9}
      style={{ height: '70vh', minHeight: '480px', width: '100%' }}
      className="adsb-map"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Data: <a href="https://adsb.fi/">adsb.fi</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {aircraft.map((ac) => (
        <Marker
          key={ac.hex}
          position={[ac.lat, ac.lon]}
          icon={createAircraftIcon(ac.track || 0, selectedAircraft?.hex === ac.hex)}
          eventHandlers={{
            click: () => onSelectAircraft(ac),
          }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-bold">{ac.callsign || ac.hex}</div>
              {ac.reg && <div>Rej: {ac.reg}</div>}
              {ac.alt !== undefined && <div>Wys: {ac.alt} ft</div>}
              {ac.gs !== undefined && <div>Prędkość: {ac.gs} kt</div>}
            </div>
          </Popup>
        </Marker>
      ))}
      {selectedAircraft && <SelectedAircraftView aircraft={selectedAircraft} />}
    </MapContainer>
  );
}
