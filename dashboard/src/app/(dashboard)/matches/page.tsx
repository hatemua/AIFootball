'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { MatchCard } from '@/components/match-card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Match } from '@/types';

export default function MatchesPage() {
  const { data: matches, isLoading, error } = useQuery<Match[]>({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data } = await api.get<Match[]>('/api/matches');
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Matches</h1>
        <Button asChild>
          <Link href="/matches/new">New match</Link>
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">Failed to load matches.</p>}
      {matches && matches.length === 0 && (
        <p className="text-muted-foreground">No matches yet. Upload one to get started.</p>
      )}
      {matches && matches.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
