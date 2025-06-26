import { getHistory } from '@/lib/db';
import { HistoryTable } from '@/components/app/history-table';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default async function History() {
  const history = await getHistory();
  return (
     <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scraping History</h1>
        <p className="text-muted-foreground">
          A log of your recent scraping activities.
        </p>
      </div>
       <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <HistoryTable history={history} />
       </Suspense>
    </div>
  );
}
