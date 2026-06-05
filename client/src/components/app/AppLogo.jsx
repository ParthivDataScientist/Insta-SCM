import React from 'react';

export default function AppLogo({ className, style }) {
    return (
        <img 
            src="/logo.jpg" 
            alt="Insta SCM" 
            className={className} 
            style={style} 
        />
    );
}
