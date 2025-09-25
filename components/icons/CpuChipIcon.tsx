import React from 'react';

export const CpuChipIcon: React.FC<{className?: string}> = ({className="w-5 h-5"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11V7a2 2 0 00-2-2H7a2 2 0 00-2 2v4m14 0a2 2 0 012 2v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4m14 0H5M19 11v2m-14-2v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11h6v2H9z" />
    </svg>
);