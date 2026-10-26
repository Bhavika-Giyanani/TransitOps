import React from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';

export const NotFoundView: React.FC = () => {
  const { currentUser, setActiveView } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <section className={`flex min-h-[70vh] items-center justify-center px-6 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
      <div className="max-w-lg text-center">
        <p className={`text-sm font-bold uppercase tracking-[0.25em] ${isDark ? 'text-[#ccff00]' : 'text-[#d97706]'}`}>
          Error 404
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">This route is off the map.</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          The page may have moved, or the address may be incorrect. Choose a destination below to continue.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => setActiveView(currentUser ? 'dashboard' : 'hero')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${isDark ? 'bg-[#ccff00] text-black' : 'bg-[#d97706] text-white'}`}
          >
            <Home className="h-4 w-4" />
            {currentUser ? 'Go to dashboard' : 'Go to home'}
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${isDark ? 'border-[#303746] bg-[#14171e]' : 'border-[#ded7ca] bg-white'}`}
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>
      </div>
    </section>
  );
};
