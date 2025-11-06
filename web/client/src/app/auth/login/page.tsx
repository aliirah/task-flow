'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoginSchema, loginSchema } from '@/lib/validations/auth'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/lib/api'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils/error-handler'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)
  
  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginSchema) => {
    try {
      const response = await authApi.login(data.email, data.password)
      setAuth(response.data)
      toast.success('Successfully logged in!')
      router.push('/dashboard')
    } catch (error) {
      handleApiError({
        error,
        setError,
        clearErrors,
        fields: ['email', 'password'],
      })
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-100 px-4 py-12 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.35),_transparent_60%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 text-center">
          <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-widest text-slate-600 shadow-sm backdrop-blur">
            Task Flow
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to continue orchestrating your organisation.
          </p>
        </div>

        <Card className="border border-white/40 bg-white/90 shadow-xl shadow-slate-200 backdrop-blur">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold text-slate-900">Sign in</CardTitle>
            <CardDescription className="text-slate-600">
              Let’s pick up where you left off.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isSubmitting}
                  placeholder="name@company.com"
                  className="bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-300"
                  {...register('email')}
                />
                {errors?.email && (
                  <p className="text-sm font-medium text-rose-500">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
                  >
                    Forgot?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  placeholder="••••••••"
                  className="bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-300"
                  {...register('password')}
                />
                {errors?.password && (
                  <p className="text-sm font-medium text-rose-500">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-5">
              <Button
                type="submit"
                className="mt-4 w-full bg-slate-900 text-white shadow-lg shadow-slate-500/20 transition hover:bg-slate-800"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="mr-2 h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>

              <p className="text-center text-sm text-slate-600">
                Need an account?{' '}
                <Link
                  href="/auth/register"
                  className="font-medium text-slate-900 underline-offset-4 transition hover:text-slate-700"
                >
                  Create one
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
