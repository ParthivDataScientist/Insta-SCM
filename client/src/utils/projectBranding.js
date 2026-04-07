const BRAND_CATALOG = [
    { keywords: ['wipro'], label: 'Wipro', domain: 'wipro.com', accent: '#341B92' },
    { keywords: ['infosys'], label: 'Infosys', domain: 'infosys.com', accent: '#007CC3' },
    { keywords: ['tcs', 'tata consultancy services'], label: 'TCS', domain: 'tcs.com', accent: '#0F62FE' },
    { keywords: ['accenture'], label: 'Accenture', domain: 'accenture.com', accent: '#7E2BFF' },
    { keywords: ['ibm'], label: 'IBM', domain: 'ibm.com', accent: '#0F62FE' },
    { keywords: ['microsoft'], label: 'Microsoft', domain: 'microsoft.com', accent: '#107C10' },
    { keywords: ['google'], label: 'Google', domain: 'google.com', accent: '#4285F4' },
    { keywords: ['amazon'], label: 'Amazon', domain: 'amazon.com', accent: '#FF9900' },
    { keywords: ['meta', 'facebook'], label: 'Meta', domain: 'meta.com', accent: '#0866FF' },
    { keywords: ['intel'], label: 'Intel', domain: 'intel.com', accent: '#0071C5' },
    { keywords: ['oracle'], label: 'Oracle', domain: 'oracle.com', accent: '#C74634' },
    { keywords: ['sap'], label: 'SAP', domain: 'sap.com', accent: '#0FAAFF' },
    { keywords: ['adobe'], label: 'Adobe', domain: 'adobe.com', accent: '#EB1000' },
    { keywords: ['deloitte'], label: 'Deloitte', domain: 'deloitte.com', accent: '#86BC25' },
    { keywords: ['cisco'], label: 'Cisco', domain: 'cisco.com', accent: '#049FD9' },
];

const GENERIC_EXPO_IMAGE =
    'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80';

const getProjectText = (project) => [
    project?.client,
    project?.project_name,
    project?.event_name,
    project?.venue,
]
    .filter(Boolean)
    .join(' ')
    .trim();

const getProjectLabel = (project) =>
    (project?.client || project?.project_name || project?.event_name || 'Project').trim();

const getInitials = (label) =>
    label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((token) => token[0]?.toUpperCase() || '')
        .join('') || 'PR';

const escapeSvg = (value) =>
    encodeURIComponent(value)
        .replace(/'/g, '%27')
        .replace(/"/g, '%22');

const buildPlaceholderSvg = (label, accent) => {
    const safeLabel = label.slice(0, 28);
    const initials = getInitials(label);
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${accent}" />
                    <stop offset="100%" stop-color="#12161C" />
                </linearGradient>
            </defs>
            <rect width="1200" height="520" rx="40" fill="url(#g)" />
            <circle cx="170" cy="150" r="108" fill="rgba(255,255,255,0.16)" />
            <circle cx="1035" cy="402" r="170" fill="rgba(255,255,255,0.08)" />
            <text x="170" y="178" fill="#FFFFFF" font-size="110" font-family="Inter, Arial, sans-serif" font-weight="800">${initials}</text>
            <text x="80" y="366" fill="#FFFFFF" font-size="56" font-family="Inter, Arial, sans-serif" font-weight="700">${safeLabel}</text>
            <text x="80" y="418" fill="rgba(255,255,255,0.82)" font-size="26" font-family="Inter, Arial, sans-serif">Auto-generated project identity</text>
        </svg>
    `;

    return `data:image/svg+xml;charset=utf-8,${escapeSvg(svg)}`;
};

const findBrandMatch = (project) => {
    const haystack = getProjectText(project).toLowerCase();
    return BRAND_CATALOG.find((brand) =>
        brand.keywords.some((keyword) => haystack.includes(keyword))
    ) || null;
};

export function getProjectBranding(project, options = {}) {
    const { includeSceneFallback = true } = options;
    const matchedBrand = findBrandMatch(project);
    const label = matchedBrand?.label || getProjectLabel(project);
    const accent = matchedBrand?.accent || '#2563EB';
    const sources = [];
    const manualOverride = project?.photos?.[0]?.url;

    if (manualOverride) {
        sources.push(manualOverride);
    }

    if (matchedBrand?.domain) {
        sources.push(`https://www.google.com/s2/favicons?domain=${matchedBrand.domain}&sz=256`);
    }

    if (includeSceneFallback) {
        sources.push(GENERIC_EXPO_IMAGE);
    }

    sources.push(buildPlaceholderSvg(label, accent));

    return {
        accent,
        label,
        sources,
    };
}
