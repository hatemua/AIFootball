import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>TODO: name, email, password change.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Not implemented yet.</CardContent>
      </Card>
    </div>
  );
}
