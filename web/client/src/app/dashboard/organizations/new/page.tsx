'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Layers } from 'lucide-react'
import * as z from 'zod'
import { toast } from 'sonner'

import { useDashboard } from '@/components/dashboard/dashboard-shell'
import { organizationApi } from '@/lib/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().max(1024).optional(),
})

type FormValues = z.infer<typeof schema>

export default function OrganizationCreatePage() {
  const router = useRouter()
  const { refreshOrganizations, setSelectedOrganizationId } = useDashboard()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await organizationApi.create(values)
      toast.success(
        `“${response.data?.name ?? values.name}” has been created.`,
      )
      await refreshOrganizations()
      if (response.data?.id) {
        setSelectedOrganizationId(response.data.id)
      }
      router.push('/dashboard/organizations')
    } catch (error) {
      handleApiError({ error, setError: form.setError })
    }
  })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-600">
          <Layers className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Create organization
          </h1>
          <p className="text-sm text-slate-500">
            Spin up a fresh workspace for a team, client, or department.
          </p>
        </div>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Organization details
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            You can change these later from the settings page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-6">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Name
              </label>
              <Input
                placeholder="Acme Inc."
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-rose-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Description
              </label>
              <Textarea
                placeholder="How will this organization be used?"
                {...form.register('description')}
              />
              {form.formState.errors.description && (
                <p className="text-xs text-rose-500">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
