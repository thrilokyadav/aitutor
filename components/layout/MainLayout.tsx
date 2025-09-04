import React from 'react';
import Header from './Header';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div className="flex-1 flex flex-col h-full">
            <Header />
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
};

export default MainLayout;