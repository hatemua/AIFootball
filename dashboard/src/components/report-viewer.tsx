'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Report } from '@/types';

interface ReportViewerProps {
  report: Report | null;
}

export function ReportViewer({ report }: ReportViewerProps) {
  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No report yet</CardTitle>
          <CardDescription>A report will be generated once processing completes.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report</CardTitle>
        <CardDescription>
          {report.type} · created {new Date(report.createdAt).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {report.pdfPath ? (
          <iframe
            src={report.pdfPath}
            className="h-[600px] w-full rounded-md border"
            title="Match report"
          />
        ) : (
          <p className="text-sm text-muted-foreground">PDF not yet available.</p>
        )}
      </CardContent>
    </Card>
  );
}
