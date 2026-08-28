/**
 * ProductPage.tsx — план запуска (воронка, тарифы)
 */

import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { LaunchPlan, FunnelStage, Tariff } from '../../data';

interface Props {
  launchId: number;
}

export default function ProductPage({ launchId }: Props) {
  const [plan, setPlan] = useState<LaunchPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);

  useEffect(() => {
    loadPlan();
  }, [launchId]);

  async function loadPlan() {
    setLoading(true);
    try {
      const data = await api.apiFetch<LaunchPlan>(`/launches/${launchId}/plan`);
      setPlan(data);
      setFunnel(data.funnel || []);
      setTariffs(data.tariffs || []);
    } catch (e) {
      console.error('Ошибка загрузки плана:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      await api.savePlan(launchId, { funnel, tariffs });
      setPlan({ launch_id: launchId, funnel, tariffs });
      setEditing(false);
    } catch (e) {
      console.error('Ошибка сохранения плана:', e);
    }
  }

  if (loading) return <div className="text-slate-400">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">План запуска</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            ✏️ Редактировать
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-6">
          {/* Воронка */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">Воронка продаж</h3>
            <div className="space-y-3">
              {funnel.map((stage, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <input
                    type="text"
                    value={stage.label}
                    onChange={(e) => {
                      const newFunnel = [...funnel];
                      newFunnel[idx].label = e.target.value;
                      setFunnel(newFunnel);
                    }}
                    placeholder="Этап"
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                  />
                  <input
                    type="number"
                    value={stage.value}
                    onChange={(e) => {
                      const newFunnel = [...funnel];
                      newFunnel[idx].value = parseFloat(e.target.value) || 0;
                      setFunnel(newFunnel);
                    }}
                    placeholder="Значение %"
                    className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Тарифы */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">Тарифные планы</h3>
            <div className="space-y-3">
              {tariffs.map((tariff, idx) => (
                <div key={idx} className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                  <input
                    type="text"
                    value={tariff.name}
                    onChange={(e) => {
                      const newTariffs = [...tariffs];
                      newTariffs[idx].name = e.target.value;
                      setTariffs(newTariffs);
                    }}
                    placeholder="Название тарифа"
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                  />
                  <input
                    type="number"
                    value={tariff.price}
                    onChange={(e) => {
                      const newTariffs = [...tariffs];
                      newTariffs[idx].price = parseInt(e.target.value) || 0;
                      setTariffs(newTariffs);
                    }}
                    placeholder="Цена"
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              ✅ Сохранить
            </button>
            <button
              onClick={() => setEditing(false)}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Воронка */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">Воронка продаж</h3>
            <div className="space-y-3">
              {funnel.map((stage, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{stage.label}</span>
                    <span className="text-slate-400">{stage.value.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(stage.value, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Тарифы */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">Тарифные планы</h3>
            <div className="space-y-2">
              {tariffs.map((tariff, idx) => (
                <div key={idx} className="bg-slate-700/50 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-white font-medium">{tariff.name}</span>
                  <span className="text-blue-400 font-bold">{tariff.price.toLocaleString()}₽</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
