'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
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
import { auth } from '@/lib/api'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)
  
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginSchema) => {
    try {
      const response = await auth.login(data.email, data.password)
      setAuth(response.data)
      toast.success('Successfully logged in!')
      router.push('/dashboard')
    } catch (error: any) {
      if (error instanceof ApiError) {
        if (error.code === 'VALIDATION_ERROR' && error.validationErrors) {
          // Handle validation errors by setting form errors
          error.validationErrors.forEach((validationError) => {
            setError(validationError.field as keyof LoginSchema, {
              type: 'server',
              message: validationError.message,
            })
          })
        } else {
          // Show other API errors in toast
          toast.error(error.message, {
            description: error.code === 'INVALID_CREDENTIALS' 
              ? 'Please check your email and password'
              : undefined,
          })
        }
      } else {
        // Handle unexpected errors
        toast.error('An unexpected error occurred', {
          description: 'Please try again later',
        })
      }
    }
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <Card className="grid gap-6 p-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center font-semibold tracking-tight">
              Welcome back
            </CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to sign in to your account
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isSubmitting}
                  placeholder="name@example.com"
                  {...register('email')}
                />
                {errors?.email && (
                  <p className="text-sm font-medium text-red-500">{errors.email.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  placeholder="Enter your password"
                  {...register('password')}
                />
                {errors?.password && (
                  <p className="text-sm font-medium text-red-500">{errors.password.message}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full mt-4"
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
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
              <p className="px-8 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link 
                  href="/auth/register" 
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}