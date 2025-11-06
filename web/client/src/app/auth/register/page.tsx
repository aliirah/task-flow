'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RegisterSchema, registerSchema } from '@/lib/validations/auth'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils/error-handler'

export default function RegisterPage() {
  const router = useRouter()
  
  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterSchema) => {
    try {
      await authApi.register(data)
      toast.success('Registration successful!', {
        description: 'You can now log in with your credentials',
      })
      router.push('/auth/login')
    } catch (error) {
      handleApiError({
        error,
        setError,
        clearErrors,
        fields: ['email', 'firstName', 'lastName', 'password'],
      })
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-100 px-4 py-12 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(148,163,184,0.3),_transparent_60%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 text-center">
          <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-widest text-slate-600 shadow-sm backdrop-blur">
            Task Flow
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Join the workspace and collaborate with your team.
          </p>
        </div>

        <Card className="border border-white/40 bg-white/90 shadow-xl shadow-slate-200 backdrop-blur">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold text-slate-900">Sign up</CardTitle>
            <CardDescription className="text-slate-600">
              Tell us a little about yourself to get started.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <label
                  htmlFor="firstName"
                  className="text-sm font-medium text-slate-700"
                >
                  First name
                </label>
                <Input
                  id="firstName"
                  disabled={isSubmitting}
                  placeholder="Ada"
                  className="bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-300"
                  {...register('firstName')}
                />
                {errors?.firstName && (
                  <p className="text-sm font-medium text-rose-500">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="lastName"
                  className="text-sm font-medium text-slate-700"
                >
                  Last name
                </label>
                <Input
                  id="lastName"
                  disabled={isSubmitting}
                  placeholder="Lovelace"
                  className="bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-300"
                  {...register('lastName')}
                />
                {errors?.lastName && (
                  <p className="text-sm font-medium text-rose-500">
                    {errors.lastName.message}
                  </p>
                )}
              </div>

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
                  placeholder="you@company.com"
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
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  placeholder="Create a strong password"
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
                    Creating account…
                  </>
                ) : (
                  'Create account'
                )}
              </Button>

              <p className="text-center text-sm text-slate-600">
                Already have an account?{' '}
                <Link
                  href="/auth/login"
                  className="font-medium text-slate-900 underline-offset-4 transition hover:text-slate-700"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
