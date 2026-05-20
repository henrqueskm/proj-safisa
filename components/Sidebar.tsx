import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  tabs: { 
    id: string; 
    label: string; 
    icon: React.ReactNode;
    subTabs?: { id: string; label: string }[];
  }[];
  activeTab: string;
  activeSubTab?: string;
  onTabChange: (id: string, subTabId?: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  tabs, 
  activeTab, 
  activeSubTab,
  onTabChange 
}) => {
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          x: isOpen ? 0 : -280,
          width: 280
        }}
        className={`fixed top-0 left-0 bottom-0 bg-slate-900 border-r border-slate-800 z-50 flex flex-col shadow-2xl lg:shadow-none transition-all duration-300 ease-in-out`}
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">{title}</h2>
          <button onClick={onClose} className="lg:hidden text-slate-500 hover:text-white transition-colors" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {tabs.map((tab) => (
            <div key={tab.id} className="space-y-1">
              <button
                onClick={() => {
                  onTabChange(tab.id);
                  if (!tab.subTabs && window.innerWidth < 1024) onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all group ${
                  activeTab === tab.id
                    ? 'bg-slate-700 text-white shadow-lg'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
               aria-label="Botão">
                <div className={`${activeTab === tab.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-200'} transition-colors`}>
                  {tab.icon}
                </div>
                <span className="flex-1 text-left">{tab.label}</span>
                {activeTab === tab.id && !tab.subTabs && <ChevronRight size={14} className="opacity-50" />}
              </button>

              {tab.subTabs && activeTab === tab.id && (
                <div className="ml-12 space-y-1 py-1">
                  {tab.subTabs.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        onTabChange(tab.id, sub.id);
                        if (window.innerWidth < 1024) onClose();
                      }}
                      className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all relative ${
                        activeSubTab === sub.id
                          ? 'text-white bg-slate-800'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                      }`}
                     aria-label="Botão">
                      {activeSubTab === sub.id && (
                        <motion.div 
                          layoutId="activeSubTab"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-orange-500 rounded-full"
                        />
                      )}
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </motion.aside>
    </>
  );
};
