/**
 * MasterPanel.tsx — мастер-панель владельца (чек-лист, интеграции, ключи)
 */

import { useStore } from '../../store';

export default function MasterPanel() {
  const { real, set } = useStore();

  const handleToggleIntegration = (name: string) => {
    const updated = real.integrations.map((int) =>
      int.name === name ? { ...int, on: !int.on } : int
    );
    set({ integrations: updated });
  };

  const handleToggleChecklist = (id: string) => {
    const updated = real.checklist.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    );
    set({ checklist: updated });
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">⚙️ Мастер-панель</h1>

      {/* Интеграции */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4">Интеграции</h2>
        <div className="space-y-3">
          {real.integrations.map((int) => (
            <div key={int.name} className="flex items-start justify-between p-4 bg-slate-700/50 rounded-lg">
              <div>
                <div className="font-medium text-white">{int.name}</div>
                <div className="text-sm text-slate-400">{int.desc}</div>
              </div>
              <button
                onClick={() => handleToggleIntegration(int.name)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  int.on
                    ? 'bg-green-900/30 text-green-300 hover:bg-green-900/50'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                {int.on ? 'Включена' : 'Отключена'}
              </button>
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
                onChange={() => handleToggleChecklist(item.id)}
                className="mt-1 cursor-pointer"
              />
              <div className="flex-1">
                <div className={item.done ? 'text-slate-400 line-through' : 'text-white font-medium'}>
                  {item.title}
                </div>
                <div className="text-xs text-slate-400">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Бюджет и метрики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-slate-400 text-sm font-medium mb-2">Бюджет</div>
          <input
            type="number"
            value={real.budget}
            onChange={(e) => set({ budget: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg font-bold"
          />
          <div className="text-xs text-slate-500 mt-2">₽</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-slate-400 text-sm font-medium mb-2">Трафик</div>
          <input
            type="number"
            value={real.traffic}
            onChange={(e) => set({ traffic: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg font-bold"
          />
          <div className="text-xs text-slate-500 mt-2">посещений</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-slate-400 text-sm font-medium mb-2">Средняя цена</div>
          <input
            type="number"
            value={real.price}
            onChange={(e) => set({ price: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg font-bold"
          />
          <div className="text-xs text-slate-500 mt-2">₽</div>
        </div>
      </div>
    </div>
  );
}
