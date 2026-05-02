import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Match } from '@/types';

const STATUS_VARIANT: Record<Match['status'], 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  queued: 'secondary',
  downloading: 'default',
  processing: 'default',
  completed: 'default',
  failed: 'destructive',
};

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <Link href={`/matches/${match.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{match.title}</CardTitle>
            <Badge variant={STATUS_VARIANT[match.status]}>{match.status}</Badge>
          </div>
          <CardDescription>
            {match.sourceType === 'youtube' ? 'YouTube' : 'Uploaded video'}
            {match.durationSeconds && ` · ${Math.round(Number(match.durationSeconds))}s`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Created {new Date(match.createdAt).toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
