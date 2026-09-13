'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth';
import { RegisterData } from '@/types/auth';
import ThemeToggle from '@/components/theme/ThemeToggle';
import LanguageToggle from '@/components/i18n/LanguageToggle';
import { useI18n } from '@/components/i18n/I18nProvider';

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, user, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useI18n();
  const registerSchema = useMemo(() => z.object({
    name: z.string().min(2, t('validation.nameMin')),
    email: z.string().email(t('validation.invalidEmail')),
    password: z.string().min(6, t('validation.passwordMin')),
  }), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (data: RegisterData) => {
    try {
      await registerUser(data);
      router.push('/dashboard');
    } catch (error) {
      // Error is handled by the store
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="max-w-md w-full space-y-8 rounded-xl border border-border bg-card p-8 shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('auth.register.title')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('common.or')}{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary/80"
            >
              {t('auth.register.existingAccount')}
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error === 'Registration failed' ? t('auth.register.error') : error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                {t('auth.register.name')}
              </label>
              <input
                {...register('name')}
                type="text"
                autoComplete="name"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder={t('auth.register.namePlaceholder')}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('auth.register.email')}
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder={t('auth.register.emailPlaceholder')}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('auth.register.password')}
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder={t('auth.register.passwordPlaceholder')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('common.hide') : t('common.show')}
                >
                  {showPassword ? t('common.hide') : t('common.show')}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  {t('auth.register.submitting')}
                </>
              ) : (
                t('auth.register.submit')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
