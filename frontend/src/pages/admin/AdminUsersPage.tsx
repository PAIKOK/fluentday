import { useState } from 'react'
import { Search, Users } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/features/admin/labels'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { AdminUser, Page } from '@/types/admin'

export function AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebouncedValue(query, 300)
  const params = new URLSearchParams({ page: String(page), page_size: '25' })
  if (debounced.trim()) params.set('q', debounced.trim())
  const { data, error, isLoading, reload } = useApiQuery<Page<AdminUser>>(`/admin/users?${params}`)
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <>
      <PageHeader eyebrow="Admin" title="Users" description="Registered learners and their preferences." />
      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search by email"
          placeholder="Search by email"
          className="pl-10"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(1)
          }}
        />
      </div>
      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={data !== null}>
        {data && data.items.length === 0 ? (
          <EmptyState icon={Users} title="No users found" description={debounced ? 'Try a different search.' : 'Nobody has registered yet.'} />
        ) : (
          data && (
            <Card className="relative overflow-x-auto p-0" role="region" aria-label="Users table" tabIndex={0}>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Level</th>
                    <th className="px-5 py-3 font-medium">Notifications</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                    <th className="px-5 py-3 font-medium">Last login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 font-medium">
                          {u.full_name || '—'}
                          {u.role === 'admin' && <Badge variant="coral">Admin</Badge>}
                          {!u.email_verified && <Badge variant="outline">Unconfirmed</Badge>}
                        </div>
                        <div className="text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-5 py-3.5 capitalize">{u.proficiency_level ?? '—'}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {(['email', 'push', 'in_app'] as const).filter((k) => u.notifications[k]).map((k) => (k === 'in_app' ? 'in-app' : k)).join(', ') || 'none'}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{formatDateTime(u.created_at)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{formatDateTime(u.last_login_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )
        )}
      </LoadState>
      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </>
  )
}
