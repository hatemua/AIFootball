import type { FastifyBaseLogger } from 'fastify';

export interface GenerateReportInput {
  matchId: string;
  reportType: 'single_match' | 'multi_match' | 'opponent';
}

export interface GenerateReportOutput {
  pdfPath: string;
  insights: Record<string, unknown>;
}

/**
 * Build a PDF report for a match (or set of matches).
 *
 * TODO: implement PDF generation. Likely candidates:
 *   - puppeteer (HTML → PDF, most flexible)
 *   - pdfkit (programmatic)
 *   - react-pdf with server-side rendering
 */
export async function generateReport(
  input: GenerateReportInput,
  log: FastifyBaseLogger,
): Promise<GenerateReportOutput> {
  log.info({ input }, 'TODO: generateReport');
  throw new Error('PDF report generation not implemented yet');
}
