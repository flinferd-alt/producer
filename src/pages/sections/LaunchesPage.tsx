/**
 * LaunchesPage.tsx — управление запусками
 */

import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../store';
import type { Launch } from '../../data';

interface Props {
  onSelectLaunch: (id: number) => void;
}

export default function LaunchesPage({ onSelectLaunch }: Props) {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExpert, setNewExpert] = useState('');
  const { isOwner } = useAuth();

  useEffect(() => {
    loadLaunches();
  }, []);

  async function loadLaunches() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getLaunches();
      setLaunches(data);
    } catch (e) {
      setError('Ошибка загрузки запусков');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName) return;
    try {
      const launch = await api.createLaunch({ name: newName, expert: newExpert || undefined });
      setLaunches([launch, ...launches]);
      setNewName('');
      setNewExpert('');
      setShowNewForm(false);
    } catch (e) {
      setError('Ошибка создания запуска');
    }
  }

  if (loading) return <div className="text-slate-400">Загрузка...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Запуски</h1>
        {isOwner && (
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            + Создать запуск
          </button>
        )}
      </div>

      {showNewForm && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название запуска"
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={newExpert}
              onChange={(e) => setNewExpert(e.target.value)}
              placeholder="Эксперт (опционально)"
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              Создать
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {launches.map((launch) => (
          <div
            key={launch.id}
            onClick={() => onSelectLaunch(launch.id)}
            className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-blue-500 cursor-pointer transition"
          >
            <h3 className="text-lg font-bold text-white mb-2">{launch.name}</h3>
            {launch.expert && (
              <div className="text-sm text-slate-400 mb-3">👤 {launch.expert}</div>
            )}
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-2 py-1 text-xs rounded font-medium ${
                launch.stage === 'unpacking' ? 'bg-yellow-900/30 text-yellow-300' :
                launch.stage === 'brief' ? 'bg-blue-900/30 text-blue-300' :
                launch.stage === 'niche' ? 'bg-purple-900/30 text-purple-300' :
                launch.stage === 'plan' ? 'bg-green-900/30 text-green-300' :
                'bg-slate-700 text-slate-300'
              }`}>
                {launch.stage}
              </span>
              <span className={`px-2 py-1 text-xs rounded font-medium ${
                launch.status === 'active' ? 'bg-green-900/30 text-green-300' :
                launch.status === 'paused' ? 'bg-yellow-900/30 text-yellow-300' :
                'bg-slate-700 text-slate-300'
              }`}>
                {launch.status}
              </span>
            </div>
            {launch.progress !== undefined && (
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition"
                  style={{ width: `${launch.progress}%` }}
                />
              </div>
            )}
            <div className="text-xs text-slate-500 mt-3">
              {new Date(launch.created_at).toLocaleDateString('ru-RU')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
