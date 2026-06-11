import React from 'react';
import AppShell from '../components/app/AppShell';

export default function HtmlPageViewer({ title, src, navKey }) {
    return (
        <AppShell
            activeNav={navKey}
            title={title}
            showGlobalDate={false}
        >
            <div 
                className="premium-panel" 
                style={{ 
                    height: 'calc(100vh - 220px)', 
                    minHeight: '550px', 
                    overflow: 'hidden', 
                    border: '1px solid var(--bd)', 
                    borderRadius: '24px',
                    position: 'relative',
                    background: '#ffffff'
                }}
            >
                <iframe
                    src={src}
                    title={title}
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        border: 'none', 
                        background: '#ffffff',
                        display: 'block'
                    }}
                />
            </div>
        </AppShell>
    );
}
