import React from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { UserCircleIcon } from '../icons/UserCircleIcon';
import { useAuth } from '../../contexts/AuthContext';

const UserProfile: React.FC<{ isCollapsed: boolean }> = ({ isCollapsed }) => {
    const { profile, setIsSettingsOpen } = useAppContext();
    const { user } = useAuth();

    const displayName = user?.email || profile.name || 'Guest';

    return (
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className={`flex items-center w-full p-2 rounded-lg text-left transition-colors hover:bg-slate-800 ${isCollapsed ? 'justify-center' : ''}`}
          title="View Profile & Settings"
        >
            <div className="w-10 h-10 rounded-full bg-[rgb(var(--color-input))] flex items-center justify-center border-2 border-[rgb(var(--color-border))] flex-shrink-0">
                <UserCircleIcon className="w-6 h-6 text-[rgb(var(--color-text-secondary))]"/>
            </div>
            <div className={`ml-3 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                <p className="font-semibold text-sm text-white truncate">{displayName}</p>
                <p className="text-xs text-[rgb(var(--color-text-secondary))]">View Settings</p>
            </div>
        </button>
    );
};

export default UserProfile;