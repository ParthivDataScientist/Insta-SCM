import React from 'react';

const ProgressBar = ({ percentage, status, mini }) => {
    let color = 'blue';
    if (status === 'Delivered') color = 'green';
    if (status === 'Exception') color = 'red';
    if (status === 'Out for Delivery') color = 'indigo';

    return (
        <div className={`progress-bar-track ${mini ? 'mini' : ''}`}>
            <div className={`progress-bar-fill ${color}`} style={{ width: `${percentage}%` }} />
        </div>
    );
};

export default ProgressBar;
