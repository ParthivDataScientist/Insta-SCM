// API client for Insta-Track — all shipment data from real backend
// API base URL is read from Vite environment variable for dev/prod portability.
const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1/shipments`
    : "/api/v1/shipments";

/**
 * Returns common headers. Adds X-API-Key if VITE_API_KEY env var is set.
 */
function authHeaders() {
    const key = import.meta.env.VITE_API_KEY;
    const token = localStorage.getItem('access_token');
    const headers = {};
    if (key) headers["X-API-Key"] = key;
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

// --- Shipment API ---

export async function fetchShipments() {
    const response = await fetch(API_BASE);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
}

export async function fetchStats() {
    const response = await fetch(`${API_BASE}/stats`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
}

export async function fetchShipment(id) {
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
}

export async function trackShipment(trackingNumber, shipmentName = null, showDate = null, exhibitionName = null) {
    const body = {};
    if (shipmentName) body.shipment_name = shipmentName;
    if (showDate) body.show_date = showDate;
    if (exhibitionName) body.exhibition_name = exhibitionName;

    const response = await fetch(`${API_BASE}/track/${trackingNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        let detail = `API error: ${response.status}`;
        try {
            const err = await response.json();
            detail = err.detail || detail;
        } catch (_) {
            const txt = await response.text().catch(() => '');
            if (txt) detail = txt.slice(0, 200);
        }
        throw new Error(detail);
    }
    return await response.json();
}

export async function deleteShipment(id) {
    const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
}

export async function importExcel(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/import-excel`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
    });

    if (!response.ok) {
        let detail = `API error: ${response.status}`;
        try {
            const err = await response.json();
            detail = err.detail || detail;
        } catch (_) {
            const txt = await response.text().catch(() => '');
            if (txt) detail = txt.slice(0, 200);
        }
        throw new Error(detail);
    }
    return await response.json();
}
