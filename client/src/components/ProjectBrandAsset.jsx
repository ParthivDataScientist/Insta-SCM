import React from 'react';
import { getProjectBranding } from '../utils/projectBranding';

export default function ProjectBrandAsset({ project, variant = 'hero', style = {}, showLabel = true }) {
    const branding = React.useMemo(
        () => getProjectBranding(project, { includeSceneFallback: variant === 'hero' }),
        [project, variant]
    );
    const [sourceIndex, setSourceIndex] = React.useState(0);

    React.useEffect(() => {
        setSourceIndex(0);
    }, [project?.id, project?.updated_at, project?.project_name, project?.client, project?.event_name, project?.photos?.[0]?.url, variant]);

    const imageSource = branding.sources[sourceIndex] || branding.sources[branding.sources.length - 1];
    const isHero = variant === 'hero';

    return (
        <div
            style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: isHero ? '22px' : '18px',
                background: `linear-gradient(135deg, ${branding.accent}22, rgba(17, 24, 39, 0.08))`,
                border: '1px solid var(--bd)',
                ...style,
            }}
        >
            <img
                src={imageSource}
                alt={branding.label}
                onError={() => {
                    setSourceIndex((current) =>
                        current < branding.sources.length - 1 ? current + 1 : current
                    );
                }}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                }}
            />

            {isHero ? (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, rgba(11, 13, 17, 0.08) 0%, rgba(11, 13, 17, 0.72) 100%)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        padding: '20px',
                    }}
                >
                    {showLabel ? (
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}>
                                Auto branding
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 800, color: '#FFFFFF' }}>
                                {branding.label}
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.82)' }}>
                                Logo-first project visual with automatic fallback coverage.
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
