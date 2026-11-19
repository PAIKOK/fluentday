import { Link } from 'react-router-dom'
import { BookCheck, BookOpenText, FileText, Flag, Users } from 'lucide-react'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Button } from '@/components/ui/button'
import { useApiQuery } from '@/hooks/useApiQuery'
import type { AdminOverview } from '@/types/admin'

export function AdminOverviewPage() {
  const { data, error, isLoading, reload } = useApiQuery<AdminOverview>('/admin/overview')
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        description="Vocabulary pipeline and learners at a glance."
        actions={
          <Button asChild>
            <Link to="/admin/books">Manage books</Link>
          </Button>
        }
      />
      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={data !== null}>
        {data && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard icon={FileText} label="Books processed" value={`${data.books_ready} / 3`} tone="forest" />
            <StatCard icon={BookOpenText} label="Words extracted" value={data.words_total} tone="sage" />
            <StatCard icon={BookCheck} label="Approved words" value={data.words_approved} hint="Only approved words are used in daily lessons." tone="sage" />
            <StatCard icon={Flag} label="Flagged for review" value={data.words_needing_review} hint={`${data.words_pending} pending in total`} tone="coral" />
            <StatCard icon={Users} label="Registered users" value={data.users_total} tone="forest" />
          </div>
        )}
      </LoadState>
      {data && data.words_needing_review > 0 && (
        <div className="mt-6">
          <Button variant="outline" asChild>
            <Link to="/admin/vocabulary?needs_review=true&status=pending">Review flagged words</Link>
          </Button>
        </div>
      )}
    </>
  )
}
