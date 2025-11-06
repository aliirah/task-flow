'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2, Layers } from 'lucide-react'
import * as z from 'zod'
import { toast } from 'sonner'

import { organizationApi } from '@/lib/api'
import { Organization } from '@/lib/types/api'
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

interface EditPageProps {
  params: { id: string }
}

export default function OrganizationEditPage({ params }: EditPageProps) {
  const router = useRouter()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const response = await organizationApi.get(params.id)
        setOrganization(response.data)
        form.reset({
          name: response.data?.name ?? '',
          description: response.data?.description ?? '',
        })
      } catch (error) {
        handleApiError({ error })
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [params.id, form])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await organizationApi.update(params.id, values)
      toast.success('Organization updated')
      router.push('/dashboard/organizations')
      router.refresh()
    } catch (error) {
      handleApiError({ error, setError: form.setError })
    }
  })

  const onDelete = async () => {
    try {
      setDeleting(true)
      await organizationApi.remove(params.id)
      toast.success('Organization deleted')
      router.push('/dashboard/organizations')
      router.refresh()
    } catch (error) {
      handleApiError({ error })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-600">
          <Layers className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Edit organization
          </h1>
          <p className="text-sm text-slate-500">
            Update how your workspace is presented to collaborators.
          </p>
        </div>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Details
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Changes will be visible immediately to your teammates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !organization ? (
            <p className="text-sm text-slate-500">
              Organization not found or you no longer have access.
            </p>
          ) : (
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 text-rose-500 hover:text-rose-600"
                  onClick={onDelete}
                  disabled={deleting}
                >
                  <Trash2 className="size-4" />
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
