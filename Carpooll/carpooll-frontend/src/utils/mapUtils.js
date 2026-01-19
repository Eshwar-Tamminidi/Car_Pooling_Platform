// src/utils/mapUtils.js
export async function searchLocation(query) {
    if (!query || query.length < 3) return [];
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        return data.map(item => ({
            display_name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon)
        }));
    } catch (e) {
        console.error("Geocoding error", e);
        return [];
    }
}

/**
 * Resolves a list of location names to coordinates.
 * Useful for displaying intermediate stops that were saved as strings.
 */
export async function geocodeMany(names) {
    if (!names || names.length === 0) return [];
    try {
        const results = await Promise.all(
            names.map(async (name) => {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1`);
                const data = await res.json();
                if (data && data.length > 0) {
                    return {
                        name,
                        lat: parseFloat(data[0].lat),
                        lng: parseFloat(data[0].lon)
                    };
                }
                return null;
            })
        );
        return results.filter(r => r !== null);
    } catch (e) {
        console.error("Batch geocoding error", e);
        return [];
    }
}

export async function getRoute(points) {
    if (!points || points.length < 2) return null;
    try {
        const coordinates = points
            .map(p => {
                const lng = p.lng !== undefined ? p.lng : p.lon;
                return `${lng},${p.lat}`;
            })
            .join(';');

        const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                distance: route.distance,
                duration: route.duration,
                geometry: route.geometry
            };
        }
        return null;
    } catch (e) {
        console.error("Routing error", e);
        return null;
    }
}

export function calculateFare(distanceMeters) {
    if (!distanceMeters) return 0;
    const BASE_FARE = 250;
    const RATE_PER_KM = 12;
    const distanceKm = distanceMeters / 1000;
    const fare = (BASE_FARE + (RATE_PER_KM * distanceKm))/6;
    return Math.round(fare);
}