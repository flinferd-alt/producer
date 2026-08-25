/**
 * Dashboard.tsx — обзор: KPI, события, интеграции
 */

import { useStore } from '../../store';

export default function Dashboard() {
  const { real, loaded } = useStore();

  if (!loaded) {
    return <div className="text-slate-400">Загрузка...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Обзор</h1>

      {/* KPI блоки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Трафик" value={real.traffic} unit="посещений" />
        <KpiCard label="Бюджет" value={real.budget} unit="₽" />
        <KpiCard label="Цена" value={real.price} unit="₽" />
        <KpiCard label="Сделок" value={real.txs.length} unit="шт" />
      </div>

      {/* Интеграции */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4">Интеграции</h2>
        <div className="space-y-2">
          {real.integrations.map((int) => (
            <div key={int.name} className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
              <span className="text-slate-300">{int.name}</span>
              <div className={`px-3 py-1 rounded text-sm font-medium ${
                int.on ? 'bg-green-900/30 text-green-300' : 'bg-slate-700 text-slate-400'
              }`}>
                {int.on ? 'Включена' : 'Отключена'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Чек-лист */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4">Чек-лист подготовки</h2>
        <div className="space-y-2">
          {real.checklist.map((item) => (
            <div key={item.id} className="flex items-start gap-3 p-3 bg-slate-700/50 rounded">
              <input
                type="checkbox"
                checked={item.done}
                readOnly
                className="mt-1"
              />
              <div>
                <div className={item.done ? 'text-slate-400 line-through' : 'text-white font-medium'}>
                  {item.title}
                </div>
                <div className="text-xs text-slate-400">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="text-slate-400 text-sm font-medium">{label}</div>
      <div className="text-2xl font-bold text-white mt-2">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-xs text-slate-500 mt-1">{unit}</div>
    </div>
  );
}
