/**
 * BriefPage.tsx — работа с брифом распаковки
 */

import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Brief } from '../../data';

interface Props {
  launchId: number;
}

export default function BriefPage({ launchId }: Props) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [answers, setAnswers] = useState<Array<{ key: string; label: string; value: string }>>([]);
  const [generating, setGenerating] = useState(false);

  const defaultQuestions = [
    { key: 'exp', label: 'Опыт эксперта', value: '' },
    { key: 'aud', label: 'Целевая аудитория', value: '' },
    { key: 'pain', label: 'Главная боль аудитории', value: '' },
    { key: 'promise', label: 'Обещание продукта', value: '' },
  ];

  useEffect(() => {
    loadBrief();
  }, [launchId]);

  async function loadBrief() {
    setLoading(true);
    try {
      const data = await api.apiFetch<Brief>(`/launches/${launchId}/brief`);
      setBrief(data);
      setAnswers(data.answers || defaultQuestions);
    } catch (e) {
      setAnswers(defaultQuestions);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setGenerating(true);
    try {
      const data = await api.saveBrief(launchId, answers);
      setBrief(prev => prev ? { ...prev, summary: data.summary, status: 'generated' } : null);
      setEditing(false);
    } catch (e) {
      console.error('Ошибка сохранения брифа:', e);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="text-slate-400">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Бриф распаковки</h2>
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
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
          {answers.map((ans, idx) => (
            <div key={idx}>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {ans.label}
              </label>
              <textarea
                value={ans.value}
                onChange={(e) => {
                  const newAnswers = [...answers];
                  newAnswers[idx].value = e.target.value;
                  setAnswers(newAnswers);
                }}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
          ))}

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSave}
              disabled={generating}
              className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              {generating ? '🤖 Генерирую бриф...' : '✨ Сохранить и сгенерировать'}
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
        brief?.summary ? (
          <div className="bg-slate-800 rounded-lg p-6 border border-blue-700/50">
            <h3 className="text-lg font-bold text-white mb-4">📄 Сгенерированный бриф</h3>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{brief.summary}</p>
          </div>
        ) : (
          <div className="text-slate-400 text-center py-8">
            Бриф ещё не сгенерирован. Заполните ответы и нажмите кнопку сохранения.
          </div>
        )
      )}
    </div>
  );
}
