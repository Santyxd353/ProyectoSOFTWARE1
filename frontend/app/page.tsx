'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from '@/components/i18n/I18nProvider';

export default function HomePage() {
  const router = useRouter();
  const { user, checkAuth } = useAuthStore();
  const { t } = useI18n();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      <span className="sr-only">{t('common.redirecting')}</span>
    </div>
  );
}
