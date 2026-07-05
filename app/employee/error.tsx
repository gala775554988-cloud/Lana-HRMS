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
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">حدث خطأ</h2>
        <p className="text-slate-600 mb-6">
          حدث خطأ غير متوقع أثناء تحميل بوابة الموظف.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
