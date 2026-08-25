/**
 * DashboardLayout.tsx — основнойLayout кабинета с меню
 */

import { useState } from 'react';
import { useAuth } from '../store';
import Dashboard from './sections/Dashboard';
import LaunchesPage from './sections/LaunchesPage';
import BriefPage from './sections/BriefPage';
import NichePage from './sections/NichePage';
import ProductPage from './sections/ProductPage';
import MasterPanel from './sections/MasterPanel';

type Section = 'dashboard' | 'launches' | 'master';

export default function DashboardLayout() {
  const [section, setSection] = useState<Section>('dashboard');
  const [selectedLaunchId, setSelectedLaunchId] = useState<number | null>(null);
  const { session, logout, isOwner } = useAuth();

  // Навигация между разделами распаковки (для выбранного запуска)
  const handleSelectLaunch = (id: number) => {
    setSelectedLaunchId(id);
    setSection('dashboard');
  };

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Сайдбар */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-8">ПРОДЮСЕР.AI</h2>

        <nav className="space-y-2 mb-8">
          <NavButton
            active={section === 'dashboard'}
            onClick={() => setSection('dashboard')}
          >
            📊 Обзор
          </NavButton>
          <NavButton
            active={section === 'launches'}
            onClick={() => setSection('launches')}
          >
            🚀 Запуски
          </NavButton>
          {isOwner && (
            <NavButton
              active={section === 'master'}
              onClick={() => setSection('master')}
            >
              ⚙️ Мастер-панель
            </NavButton>
          )}
        </nav>

        <div className="border-t border-slate-700 pt-4">
          <div className="text-sm text-slate-400 mb-4">
            <div className="font-medium text-slate-300">{session.login}</div>
            <div className="text-xs text-slate-500">Роль: {session.role}</div>
          </div>
          <button
            onClick={logout}
            className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-300 px-3 py-2 rounded-lg transition text-sm font-medium"
          >
            Выход
          </button>
        </div>
      </aside>

      {/* Главное содержимое */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {section === 'dashboard' && (
            selectedLaunchId ? (
              <LaunchDetail launchId={selectedLaunchId} />
            ) : (
              <Dashboard />
            )
          )}
          {section === 'launches' && <LaunchesPage onSelectLaunch={handleSelectLaunch} />}
          {section === 'master' && isOwner && <MasterPanel />}
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function LaunchDetail({ launchId }: { launchId: number }) {
  const [tab, setTab] = useState<'brief' | 'niche' | 'product'>('brief');

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-slate-700 pb-4">
        <TabButton active={tab === 'brief'} onClick={() => setTab('brief')}>📄 Бриф</TabButton>
        <TabButton active={tab === 'niche'} onClick={() => setTab('niche')}>🎯 Ниша</TabButton>
        <TabButton active={tab === 'product'} onClick={() => setTab('product')}>📦 Продукт</TabButton>
      </div>
      
      {tab === 'brief' && <BriefPage launchId={launchId} />}
      {tab === 'niche' && <NichePage launchId={launchId} />}
      {tab === 'product' && <ProductPage launchId={launchId} />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium transition ${
        active
          ? 'text-blue-400 border-b-2 border-blue-400'
          : 'text-slate-400 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}
