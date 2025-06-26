'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is no longer in use as the authentication system has been removed.
// It redirects to the home page.
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950">
      <p>Redirecting...</p>
    </div>
  );
}
