import React from 'react';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <button className={`sidebar-item ${active ? 'active' : ''}`} onClick={onClick}>
        <Icon size={18} />
        {label}
    </button>
);

export default SidebarItem;
