import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const TaskCreatePageClient = dynamic(
  () => import('./page-client').then((mod) => mod.TaskCreatePageClient),
  {
    ssr: false,
    suspense: true,
  }
)

export default function TaskCreatePage() {
  return (
    <Suspense fallback={null}>
      <TaskCreatePageClient />
    </Suspense>
  )
}
