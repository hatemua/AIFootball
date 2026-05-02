'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { ProcessingStatus } from '@/components/processing-status';
import { ReportViewer } from '@/components/report-viewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { Match, Report } from '@/types';

interface MatchDetail {
  match: Match;
  report: Report | null;
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;

  const { data, isLoading, error } = useQuery<MatchDetail>({
    queryKey: ['match', matchId],
    queryFn: async () => {
      const { data } = await api.get<MatchDetail>(`/api/matches/${matchId}`);
      return data;
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (error || !data) return <p className="text-destructive">Failed to load match.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{data.match.title}</h1>
        <p className="text-muted-foreground">
          {data.match.sourceType === 'youtube' ? 'YouTube' : 'Uploaded'} ·{' '}
          {new Date(data.match.createdAt).toLocaleString()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Processing</CardTitle>
          <CardDescription>Live job status from the GPU pipeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProcessingStatus matchId={matchId} />
        </CardContent>
      </Card>

      <ReportViewer report={data.report} />
    </div>
  );
}
