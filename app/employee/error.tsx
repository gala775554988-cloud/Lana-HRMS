'use client';

import { useEffect } from 'react';

export default function EmployeeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Employee Portal Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8 bg-slate-50">
      <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">حدث خطأ</h2>
        <p className="text-slate-600 mb-6">
          حدث خطأ أثناء تحميل بوابة الموظف. يرجى المحاولة مرة أخرى.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
          >
            إعادة المحاولة
          </button>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-6 py-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
          >
            تسجيل الدخول
          </button>
        </div>
        {error.digest && (
          <p className="text-xs text-slate-400 mt-4">Digest: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
