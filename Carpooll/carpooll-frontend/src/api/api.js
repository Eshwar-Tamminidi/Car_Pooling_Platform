// src/api/api.js
const API_BASE = "http://localhost:8080";

function getToken() {
    return localStorage.getItem("token");
}

export async function apiFetch(path, opts = {}) {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const token = getToken();

    const headers = new Headers(opts.headers || {});
    if (opts.body && !(opts.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const finalOpts = {
        method: opts.method || "GET",
        headers,
        body: opts.body && !(opts.body instanceof FormData) && typeof opts.body === "object"
                ? JSON.stringify(opts.body)
                : opts.body,
    };

    console.log(`[API] ${opts.method || 'GET'} ${path}`, { body: opts.body });

    let res;
    try {
        res = await fetch(url, finalOpts);
        console.log(`[API] Response status: ${res.status} ${res.statusText} for ${path}`);
    } catch (networkError) {
        console.error(`[API] Network error for ${path}:`, networkError);
        if (networkError.message === 'Failed to fetch' || networkError.message === 'Load failed') {
            throw new Error("Unable to connect to the server. Please ensure the backend is running and CORS is configured.");
        }
        throw networkError;
    }
    
    // Handle 204 No Content or 205 Reset Content
    if (res.status === 204 || res.status === 205) {
        console.log(`[API] Success (${res.status}) for ${path} - No content`);
        return null;
    }

    const isOk = res.ok;
    console.log(`[API] Response OK: ${isOk} for ${path}`);
    
    let text = "";
    let data = null;
    
    try {
        text = await res.text();
        console.log(`[API] Response text length: ${text.length} for ${path}`, text.substring(0, 200));
    } catch (readError) {
        console.error(`[API] Error reading response for ${path}:`, readError);
        if (isOk) {
            console.warn(`[API] Could not read response body, but status is OK. Assuming success for ${path}`);
            return null;
        }
        const err = new Error(res.statusText || "Request failed");
        err.status = res.status;
        throw err;
    }

    if (text && text.trim()) {
        try {
            data = JSON.parse(text);
            console.log(`[API] Parsed JSON successfully for ${path}`, data);
        } catch (parseError) {
            console.warn(`[API] JSON parse error for ${path}:`, parseError, "Raw text:", text);
            data = text;
        }
    } else {
        console.log(`[API] Empty response body for ${path}`);
    }

    if (!isOk) {
        const errorMsg = (data && data.message) || (typeof data === "string" ? data : res.statusText) || "Request failed";
        console.error(`[API] Error response for ${path}:`, { status: res.status, message: errorMsg, body: data });
        const err = new Error(errorMsg);
        err.status = res.status;
        err.body = data;
        throw err;
    }

    console.log(`[API] Success for ${path}, returning:`, data);
    return data;
}

export const apiGet = (path, opts = {}) => apiFetch(path, { ...opts, method: "GET" });
export const apiPost = (path, body, opts = {}) => apiFetch(path, { ...opts, method: "POST", body });
export const apiPut = (path, body, opts = {}) => apiFetch(path, { ...opts, method: "PUT", body });
export const apiDelete = (path, opts = {}) => apiFetch(path, { ...opts, method: "DELETE" });

export default apiFetch;