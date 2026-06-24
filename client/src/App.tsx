import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './pages/Dashboard.js';
import { Tasks } from './pages/Tasks.js';
import { Settings } from './pages/Settings.js';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Nav() {
  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition';
  const active = `${base} bg-indigo-600 text-white`;
  const inactive = `${base} text-gray-600 hover:bg-gray-100`;

  return (
    <nav className="bg-white border-b px-6 py-3 flex items-center gap-6">
      <span className="font-bold text-indigo-700 text-lg tracking-tight mr-4">JARVIS</span>
      <NavLink to="/" end className={({ isActive }) => (isActive ? active : inactive)}>Dashboard</NavLink>
      <NavLink to="/tasks" className={({ isActive }) => (isActive ? active : inactive)}>Tasks</NavLink>
      <NavLink to="/settings" className={({ isActive }) => (isActive ? active : inactive)}>Settings</NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Nav />
          <main className="max-w-5xl mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
