import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Button } from 'react-bootstrap';
import { FaCrosshairs } from 'react-icons/fa';

interface LocationMapPickerProps {
  latitude: string;
  longitude: string;
  onLocationChange: (lat: string, lng: string) => void;
}

const LocationMapPicker: React.FC<LocationMapPickerProps> = ({ latitude, longitude, onLocationChange }) => {
  const [position, setPosition] = useState<L.LatLngExpression | null>(null);
  const markerRef = useRef<L.Marker>(null);
  const mapRef = useRef<any>(null); // Use any for map instance

  useEffect(() => {
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        setPosition([lat, lng]);
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], mapRef.current.getZoom());
        }
      }
    } else {
      setPosition(null); // Clear position if no coordinates
    }
  }, [latitude, longitude]);

  const MapEvents = () => {
    const map = useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
        setPosition([lat, lng]);
        onLocationChange(lat.toFixed(6), lng.toFixed(6));
      },
      locationfound: (e) => {
        const { lat, lng } = e.latlng;
        setPosition([lat, lng]);
        onLocationChange(lat.toFixed(6), lng.toFixed(6));
        map.flyTo(e.latlng, map.getZoom());
      },
      load: () => {
        mapRef.current = map;
      }
    });
    return null;
  };

  const onMarkerDragEnd = useCallback(() => {
    const marker = markerRef.current
    if (marker != null) {
      const { lat, lng } = marker.getLatLng();
      onLocationChange(lat.toFixed(6), lng.toFixed(6));
    }
  }, [onLocationChange]);

  const handleLocateMe = () => {
    if (mapRef.current) {
      mapRef.current.locate({ setView: true, maxZoom: 16 });
    }
  };

  const defaultCenter: L.LatLngExpression = [-6.917464, 107.619125]; // Default center (Bandung, Indonesia)

  return (
    <div className="map-container rounded-4 overflow-hidden shadow-sm" style={{ height: '400px', width: '100%', position: 'relative' }}>
      <MapContainer 
        center={position || defaultCenter}
        zoom={position ? 15 : 10}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        whenCreated={(mapInstance) => { mapRef.current = mapInstance; }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents />
        {position && (
          <Marker 
            position={position}
            draggable={true}
            eventHandlers={{
              dragend: onMarkerDragEnd,
            }}
            ref={markerRef}
          />
        )}
      </MapContainer>
      <Button 
        variant="success" 
        size="sm" 
        className="rounded-pill position-absolute bottom-0 start-50 translate-middle mb-3 shadow-sm fw-bold z-101" 
        onClick={handleLocateMe}
        style={{ zIndex: 1000 }}
      >
        <FaCrosshairs className="me-1" /> Lokasi Saya
      </Button>
    </div>
  );
};

export default LocationMapPicker;

// Ensure Leaflet's default icons are correctly configured
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});