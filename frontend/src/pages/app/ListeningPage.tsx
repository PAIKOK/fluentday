import { Headphones } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { VideoLesson } from '@/features/listening/VideoLesson'
import { useApiQuery } from '@/hooks/useApiQuery'
import type { ListeningToday } from '@/types/phase4'

export function ListeningPage() {
  const { data, error, isLoading, reload } = useApiQuery<ListeningToday>('/listening/today')
  return (
    <>
      <PageHeader
        eyebrow="Listening Room"
        title="Today’s listening lessons"
        description="Watch, take notes beside the video, save useful expressions and check your understanding."
      />
      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={data !== null}>
        {data && data.items.length === 0 ? (
          <EmptyState
            icon={Headphones}
            title="No videos scheduled yet"
            description="Today’s lessons from Learn English with TV Series and BBC Learning English’s 6 Minute English will appear here once the FluentDay team adds them."
          />
        ) : (
          <div className="space-y-12">
            {data?.items.map(({ video, progress }) => <VideoLesson key={video.id} video={video} initialProgress={progress} />)}
          </div>
        )}
      </LoadState>
    </>
  )
}
