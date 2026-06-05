import axios from 'axios';

const API_ROOT = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : "";

const apiClient = axios.create({
    baseURL: API_ROOT,
    timeout: 10000,
    withCredentials: true, // Crucial for HTTP-only cookies
});

// Request Interceptor: Add Auth Header if token exists in localStorage (legacy/hybrid support)
// and inject API Key if configured.
apiClient.interceptors.request.use((config) => {
    const key = import.meta.env.VITE_API_KEY;
    const token = localStorage.getItem('access_token');
    
    if (key) {
        config.headers['X-API-Key'] = key;
    }
    
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    
    let tenantId = 'gordian';
    if (hostname.includes('insta')) {
        tenantId = 'insta';
    } else if (pathname.startsWith('/storage')) {
        tenantId = 'gordian';
    } else {
        const instaPaths = ['/design', '/projects', '/stages', '/board', '/project-officer', '/timeline'];
        if (instaPaths.some(p => pathname.startsWith(p))) {
            tenantId = 'insta';
        } else if (pathname.startsWith('/dashboard') || pathname.startsWith('/shipments')) {
            const stored = localStorage.getItem('tenant_id');
            tenantId = (stored === 'insta') ? 'insta' : 'gordian';
        } else if (pathname.includes('insta') || search.includes('insta')) {
            tenantId = 'insta';
        } else {
            const stored = localStorage.getItem('tenant_id');
            if (stored) {
                tenantId = stored;
            }
        }
    }
    
    localStorage.setItem('tenant_id', tenantId);
    config.headers['X-Tenant-ID'] = tenantId;
    
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response Interceptor: Handle global errors like 401 Unauthorized
apiClient.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.response && error.response.status === 401) {
        // Auto-logout: Clear local session and redirect dynamically based on tenant
        localStorage.removeItem('access_token');
        const hostname = window.location.hostname.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        const search = window.location.search.toLowerCase();
        
        let isInsta = false;
        if (hostname.includes('insta')) {
            isInsta = true;
        } else if (pathname.startsWith('/storage')) {
            isInsta = false;
        } else {
            const instaPaths = ['/design', '/projects', '/stages', '/board', '/project-officer', '/timeline'];
            if (instaPaths.some(p => pathname.startsWith(p))) {
                isInsta = true;
            } else if (pathname.startsWith('/dashboard') || pathname.startsWith('/shipments')) {
                isInsta = localStorage.getItem('tenant_id') === 'insta';
            } else {
                isInsta = hostname.includes('insta') || pathname.includes('insta') || search.includes('insta') || localStorage.getItem('tenant_id') === 'insta';
            }
        }
        
        const loginPath = isInsta ? '/insta/login' : '/login';
        if (window.location.pathname !== loginPath) {
            window.location.href = loginPath;
        }
    }
    return Promise.reject(error);
});

export default apiClient;
