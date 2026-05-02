'use client';

import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import type { Job } from '@/types';

interface ProcessingStatusProps {
  matchId: string;
}

export function ProcessingStatus({ matchId }: ProcessingStatusProps) {
  const { data: job } = useQuery<Job | null>({
    queryKey: ['job', matchId],
    queryFn: async () => {
      const { data } = await api.get<Job | null>(`/api/matches/${matchId}/job`);
      return data;
    },
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 3_000;
    },
  });

  if (!job) {
    return <p className="text-sm text-muted-foreground">No active job for this match.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Status</span>
        <Badge variant={job.status === 'failed' ? 'destructive' : 'default'}>{job.status}</Badge>
      </div>
      <Progress value={job.progressPct} />
      {job.errorMessage && <p className="text-sm text-destructive">{job.errorMessage}</p>}
    </div>
  );
}
