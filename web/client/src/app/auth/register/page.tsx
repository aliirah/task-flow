'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { ApiError, ValidationError, authApi } from '@/lib/api'
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

export default function RegisterPage() {
  const router = useRouter()
  
  const {
    register,
    handleSubmit,
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
    } catch (error: any) {
      if (error instanceof ApiError) {
        if (error.code === 'VALIDATION_ERROR' && error.validationErrors) {
          error.validationErrors.forEach((validationError: ValidationError) => {
            setError(validationError.field as keyof RegisterSchema, {
              type: 'server',
              message: validationError.message,
            })
          })
        } else if (error.code === 'EMAIL_ALREADY_EXISTS') {
          setError('email', {
            type: 'server',
            message: 'This email is already registered',
          })
        } else {
          toast.error(error.message, {
            description: 'Please try again or contact support if the problem persists',
          })
        }
      } else {
        toast.error('Failed to create account', {
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
              Create an account
            </CardTitle>
            <CardDescription className="text-center">
              Enter your information to create your account
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="firstName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  First Name
                </label>
                <Input
                  id="firstName"
                  disabled={isSubmitting}
                  placeholder="Enter your first name"
                  {...register('firstName')}
                />
                {errors?.firstName && (
                  <p className="text-sm font-medium text-red-500">{errors.firstName.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <label htmlFor="lastName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  disabled={isSubmitting}
                  placeholder="Enter your last name"
                  {...register('lastName')}
                />
                {errors?.lastName && (
                  <p className="text-sm font-medium text-red-500">{errors.lastName.message}</p>
                )}
              </div>
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
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  placeholder="Create a password"
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
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </Button>
              <p className="px-8 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link 
                  href="/auth/login" 
                  className="underline underline-offset-4 hover:text-primary"
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