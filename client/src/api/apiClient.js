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
    
    // Parse tenant ID from the URL path, fallback to localStorage
    const path = window.location.pathname;
    const pathParts = path.split('/');
    let tenantId = 'gordian';
    const instaPaths = ['/design', '/projects', '/stages', '/board', '/project-officer', '/timeline'];
    const isInstaPath = instaPaths.some(p => path.startsWith(p)) || pathParts.includes('insta');
    
    if (isInstaPath) {
        tenantId = 'insta';
        localStorage.setItem('tenant_id', 'insta');
    } else if (path.startsWith('/dashboard') || path.startsWith('/storage')) {
        tenantId = 'gordian';
        localStorage.setItem('tenant_id', 'gordian');
    } else {
        const storedTenant = localStorage.getItem('tenant_id');
        if (storedTenant) {
            tenantId = storedTenant;
        }
    }
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
        const path = window.location.pathname;
        const pathParts = path.split('/');
        const instaPaths = ['/design', '/projects', '/stages', '/board', '/project-officer', '/timeline'];
        const isInsta = instaPaths.some(p => path.startsWith(p)) || pathParts.includes('insta') || localStorage.getItem('tenant_id') === 'insta';
        
        const loginPath = isInsta ? '/insta/login' : '/login';
        if (path !== loginPath) {
            window.location.href = loginPath;
        }
    }
    return Promise.reject(error);
});

export default apiClient;
