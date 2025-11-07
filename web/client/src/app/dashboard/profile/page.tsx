'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'

import { userApi } from '@/lib/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const profileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
    },
  })

  useEffect(() => {
    if (!user) return
    form.reset({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
    })
  }, [user, form])

  useEffect(() => {
    if (!user?.id) return
    const load = async () => {
      try {
        const response = await userApi.get(user.id)
        if (response.data) {
          form.reset({
            firstName: response.data.firstName ?? '',
            lastName: response.data.lastName ?? '',
          })
        }
      } catch (error) {
        handleApiError({ error })
      }
    }
    load()
  }, [user?.id, form])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await userApi.updateProfile(values)
      if (response.data) {
        updateUser(response.data)
      }
      toast.success('Profile updated')
    } catch (error) {
      handleApiError({ error, setError: form.setError })
    }
  })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-16">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500">
          Manage your account details and personal information.
        </p>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Personal information
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            This information is visible to teammates across your organizations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-5">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                First name
              </label>
              <Input {...form.register('firstName')} placeholder="Jane" />
              {form.formState.errors.firstName && (
                <p className="text-xs text-rose-500">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Last name
              </label>
              <Input {...form.register('lastName')} placeholder="Doe" />
              {form.formState.errors.lastName && (
                <p className="text-xs text-rose-500">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>
              <Input value={user?.email ?? ''} disabled />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                className="min-w-[120px]"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
