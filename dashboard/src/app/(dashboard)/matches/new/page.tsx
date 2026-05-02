import { MatchUploadForm } from '@/components/match-upload-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewMatchPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New match</h1>
        <p className="text-muted-foreground">
          Paste a YouTube link. We&apos;ll download, analyze, and produce a report.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Match details</CardTitle>
          <CardDescription>This will queue a processing job.</CardDescription>
        </CardHeader>
        <CardContent>
          <MatchUploadForm />
        </CardContent>
      </Card>
    </div>
  );
}
