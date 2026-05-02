import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back. Upload a match to get started.</p>
        </div>
        <Button asChild>
          <Link href="/matches/new">New match</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total matches</CardDescription>
            <CardTitle>—</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">TODO: wire to API</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Processing</CardDescription>
            <CardTitle>—</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">TODO: wire to API</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Reports generated</CardDescription>
            <CardTitle>—</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">TODO: wire to API</CardContent>
        </Card>
      </div>
    </div>
  );
}
