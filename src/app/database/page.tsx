import { getDb } from '@/lib/db';
import { DatabasePage } from '@/components/app/database-page';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default async function Database() {
  const properties = await getDb();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Property Database</h1>
        <p className="text-muted-foreground">
          View, edit, and manage your saved properties.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <DatabasePage initialProperties={properties} />
      </Suspense>
    </div>
  );
}
