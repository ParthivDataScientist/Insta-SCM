import React from 'react';

export const AristroLogo = () => (
    <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Left Leg: Navy Blue */}
        <line x1="32" y1="75" x2="46" y2="25" stroke="#1b3c95" strokeWidth="13" strokeLinecap="round" />
        {/* Right Leg: Forest Green */}
        <line x1="54" y1="25" x2="68" y2="75" stroke="#076447" strokeWidth="13" strokeLinecap="round" />
        {/* Crossbar: Sky Blue */}
        <line x1="34" y1="57" x2="66" y2="57" stroke="#0da2e4" strokeWidth="13" strokeLinecap="round" />
    </svg>
);

export default function AppLogo({ className, style }) {
    const activeTenant = localStorage.getItem('tenant_id') || 'gordian';
    const isInsta = activeTenant === 'insta';

    if (isInsta) {
        return (
            <img 
                src="/logo.jpg" 
                alt="Insta SCM" 
                className={className} 
                style={style} 
            />
        );
    }

    const isSidebar = className && className.includes('premium-sidebar');
    const size = isSidebar ? '42px' : '28px';

    return (
        <div 
            className={className} 
            style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: 'transparent', 
                padding: '0', 
                border: 'none', 
                width: size, 
                height: size,
                boxSizing: 'border-box',
                ...style 
            }}
        >
            <AristroLogo />
        </div>
    );
}
