// src/components/RideMap.jsx
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- FIX FOR MISSING MARKER ICONS ---
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapController({ coords }) {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        const attemptFit = (attempt = 0) => {
            try { map.invalidateSize(); } catch(e) { console.debug('invalidateSize failed', e); }
            const size = map.getSize && map.getSize();
            if (!size || size.x === 0 || size.y === 0) {
                if (attempt < 6) return setTimeout(() => attemptFit(attempt + 1), 200);
                return; // give up
            }

            if (coords && coords.length > 0) {
                const validCoords = coords.filter(c => Array.isArray(c) && c.length === 2 && !isNaN(c[0]) && !isNaN(c[1]));
                if (validCoords.length > 0) {
                    const bounds = L.latLngBounds(validCoords);
                    if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
                }
            }
        };
        attemptFit(0);

        const onResize = () => { try { map.invalidateSize(); } catch(e){ } };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [coords, map]);
    return null;
}

function MapEvents() {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        try {
            console.debug('RideMap: MapEvents attached, center=', map.getCenter && map.getCenter(), 'size=', map.getSize && map.getSize && map.getSize());
        } catch (e) { console.debug('RideMap: MapEvents debug failed', e); }

        const onTileError = (err) => { console.error('RideMap: tileerror', err); };
        const onTileLoad = (ev) => { console.debug('RideMap: tileload', ev); };
        map.on && map.on('tileerror', onTileError);
        map.on && map.on('tileload', onTileLoad);

        return () => {
            try { map.off && map.off('tileerror', onTileError); map.off && map.off('tileload', onTileLoad); } catch (e) {}
        };
    }, [map]);
    return null;
}

export default function RideMap({ pickup, drop, stops = [], routeGeometry }) {
    const [polyPositions, setPolyPositions] = useState([]);

    // Helpers
    const getLat = (obj) => parseFloat(obj?.lat);
    const getLng = (obj) => parseFloat(obj?.lng || obj?.lon);
    const isValid = (val) => !isNaN(val) && val !== null;
    const isPointValid = (p) => p && isValid(getLat(p)) && isValid(getLng(p));

    // Combine main points and extra stops for markers
    const allMarkers = [
        pickup ? { ...pickup, type: 'Pickup' } : null,
        ...(stops || []),
        drop ? { ...drop, type: 'Dropoff' } : null
    ].filter(isPointValid);

    // Update Route Line
    useEffect(() => {
        if (routeGeometry && routeGeometry.coordinates && Array.isArray(routeGeometry.coordinates)) {
            const positions = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);
            setPolyPositions(positions);
        } else if (allMarkers.length >= 2) {
            // Fallback straight lines between points if no route fetched yet
            setPolyPositions(allMarkers.map(m => [getLat(m), getLng(m)]));
        } else {
            setPolyPositions([]);
        }
    }, [routeGeometry, pickup, drop, stops]);

    // If NO valid coordinates, show placeholder
    if (allMarkers.length === 0) return <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', background: '#111'}}>Select locations to view map</div>;

    // Calculate center based on first available point
    const firstPoint = allMarkers[0];
    const center = [getLat(firstPoint), getLng(firstPoint)];

    // Fit bounds to all markers
    const markersToFit = allMarkers.map(m => [getLat(m), getLng(m)]);

    return (
        <div style={{ height: '100%', width: '100%', background: '#0b1220' }}>
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapEvents />
                
                {allMarkers.map((marker, i) => (
                    <Marker key={i} position={[getLat(marker), getLng(marker)]}>
                        <Popup>{marker.type ? `${marker.type}: ` : ''}{marker.name || "Location"}</Popup>
                    </Marker>
                ))}

                {polyPositions.length > 0 && <Polyline positions={polyPositions} color="blue" weight={4} opacity={0.7} />}
                
                <MapController coords={markersToFit} />
            </MapContainer>
        </div>
    );
}