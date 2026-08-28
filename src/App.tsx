/**
 * App.tsx — главный компонент приложения
 */

import { useAuth } from './store';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/DashboardLayout';

export default function App() {
  const { session, live } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {live ? <DashboardLayout /> : <LoginPage />}
    </div>
  );
}
