/**
 * NichePage.tsx — анализ ниши и конкуренты
 */

import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { NicheAnalysis } from '../../data';

interface Props {
  launchId: number;
}

export default function NichePage({ launchId }: Props) {
  const [niche, setNiche] = useState<NicheAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [nicheName, setNicheName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadNiche();
  }, [launchId]);

  async function loadNiche() {
    setLoading(true);
    try {
      const data = await api.apiFetch<NicheAnalysis>(`/launches/${launchId}/niche`);
      setNiche(data);
      setNicheName(data.niche_name || '');
    } catch (e) {
      console.error('Ошибка загрузки ниши:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!nicheName) return;
    setAnalyzing(true);
    try {
      const data = await api.saveNiche(launchId, { niche_name: nicheName });
      await loadNiche();
    } catch (e) {
      console.error('Ошибка анализа ниши:', e);
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <div className="text-slate-400">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Анализ ниши</h2>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Название ниши
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nicheName}
              onChange={(e) => setNicheName(e.target.value)}
              placeholder="Например: Фотография для маркетплейсов"
              className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !nicheName}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              {analyzing ? '🤖 Анализирую...' : '🔍 Анализировать'}
            </button>
          </div>
        </div>
      </div>

      {niche && niche.score > 0 && (
        <div className="space-y-4">
          {/* Скор и вердикт */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="text-slate-400 text-sm font-medium mb-2">Привлекательность ниши</div>
              <div className="flex items-end gap-3">
                <div className="text-4xl font-bold text-white">{niche.score}</div>
                <div className="text-sm text-slate-400 mb-2">/10</div>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${(niche.score / 10) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="text-slate-400 text-sm font-medium mb-2">Вердикт</div>
              <div className="text-lg font-bold text-white">{niche.verdict}</div>
              <div className="text-xs text-slate-500 mt-2">YandexGPT анализ</div>
            </div>
          </div>

          {/* Конкуренты */}
          {niche.competitors && niche.competitors.length > 0 && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">Конкуренты</h3>
              <div className="space-y-3">
                {niche.competitors.map((comp, idx) => (
                  <div key={idx} className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white">{comp.name}</div>
                      <div className="flex gap-2">
                        <span className="text-sm bg-yellow-900/30 text-yellow-300 px-2 py-1 rounded">
                          ⭐ {comp.rating.toFixed(1)}
                        </span>
                        <span className="text-sm bg-blue-900/30 text-blue-300 px-2 py-1 rounded">
                          💪 {comp.power}/10
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                      <div>👥 Студентов: {comp.students}</div>
                      <div>💰 Средний чек: {comp.check.toLocaleString()}₽</div>
                    </div>
                    <div className="text-sm text-slate-400 mt-2">📌 Слабость: {comp.weak}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
