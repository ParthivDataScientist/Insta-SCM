import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Menu, Check } from 'lucide-react';
import './GoogleSheetsTabBar.css'; // Sibling stylesheet or custom rules in design-premium.css

export default function GoogleSheetsTabBar({
    activeTab,
    setActiveTab,
    allCount = 0,
    usaCount = 0,
    europeCount = 0,
    indiaCount = 0
}) {
    const [showMenu, setShowMenu] = useState(false);
    const tabsContainerRef = useRef(null);

    const tabs = [
        { id: 'all', name: 'All Shipments', count: allCount, color: '#10b981' }, // Green
        { id: 'usa', name: 'USA Shipments', count: usaCount, color: '#2563eb' }, // Blue
        { id: 'europe', name: 'Europe Shipments', count: europeCount, color: '#f59e0b' }, // Amber/Gold
        { id: 'india', name: 'India Shipments', count: indiaCount, color: '#ef4444' } // Crimson/Red
    ];

    const scrollLeft = () => {
        if (tabsContainerRef.current) {
            tabsContainerRef.current.scrollBy({ left: -150, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (tabsContainerRef.current) {
            tabsContainerRef.current.scrollBy({ left: 150, behavior: 'smooth' });
        }
    };

    const activeTabObj = tabs.find(t => t.id === activeTab) || tabs[0];

    return (
        <div className="sheets-bar-container">
            {/* Sheets Controls (Google Sheets Bottom Left Style) */}
            <div className="sheets-bar-controls">
                {/* Scroll Navigation */}
                <button 
                    type="button" 
                    className="sheets-ctrl-btn" 
                    onClick={scrollLeft}
                    title="Scroll left"
                >
                    <ChevronLeft size={16} />
                </button>
                <button 
                    type="button" 
                    className="sheets-ctrl-btn" 
                    onClick={scrollRight}
                    title="Scroll right"
                >
                    <ChevronRight size={16} />
                </button>

                {/* All Sheets Selector Menu */}
                <div className="sheets-menu-dropdown-wrapper">
                    <button 
                        type="button" 
                        className={`sheets-ctrl-btn sheets-menu-trigger ${showMenu ? 'is-active' : ''}`}
                        onClick={() => setShowMenu(!showMenu)}
                        title="All sheets"
                    >
                        <Menu size={16} />
                    </button>
                    {showMenu && (
                        <>
                            <div className="sheets-menu-backdrop" onClick={() => setShowMenu(false)} />
                            <div className="sheets-dropdown-menu">
                                <div className="sheets-menu-header">Select Sheet</div>
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        className={`sheets-dropdown-item ${activeTab === tab.id ? 'is-selected' : ''}`}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setShowMenu(false);
                                        }}
                                    >
                                        <div 
                                            className="sheets-menu-color-dot" 
                                            style={{ backgroundColor: tab.color }} 
                                        />
                                        <span className="sheets-menu-name">{tab.name}</span>
                                        <span className="sheets-menu-count">({tab.count})</span>
                                        {activeTab === tab.id && <Check size={14} className="sheets-menu-check" />}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Scrollable Tabs Wrapper */}
            <div className="sheets-tabs-container" ref={tabsContainerRef}>
                <div className="sheets-tabs-list">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                className={`sheets-tab-item ${isActive ? 'is-active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    borderBottom: isActive ? `3px solid ${tab.color}` : 'none'
                                }}
                            >
                                <span className="sheets-tab-dot" style={{ backgroundColor: tab.color }} />
                                <span className="sheets-tab-label">{tab.name}</span>
                                <span className="sheets-tab-badge">{tab.count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sheets Footer Info (Google Sheets Bottom Right Style) */}
            <div className="sheets-bar-info">
                <span className="sheets-info-label">Active Sheet:</span>
                <span className="sheets-info-value" style={{ color: activeTabObj.color }}>
                    {activeTabObj.name}
                </span>
                <span className="sheets-info-divider">•</span>
                <span className="sheets-info-rows">
                    {activeTabObj.count} rows loaded
                </span>
            </div>
        </div>
    );
}
