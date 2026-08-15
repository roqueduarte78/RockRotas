import * as pdfjsLib from 'pdfjs-dist';
import { RouteStop } from '../types';
import { groupStopsBySameAddress } from './routeOptimizer';

// Configure pdfjs worker if available
if (typeof window !== 'undefined') {
  try {
    // Set CDN worker or fallback to internal worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF.js worker initialization warning:', e);
  }
}

export interface PdfParseResult {
  stops: Partial<RouteStop>[];
  routeName?: string;
  detectedCity?: string;
  detectedState?: string;
  totalExtractedPackages?: number;
  extractedRawText: string;
  pageCount: number;
}

/**
 * Extracts raw text from all pages of a PDF File
 */
export async function extractTextFromPdf(file: File): Promise<{ fullText: string; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  let fullText = '';

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');
    fullText += `\n--- PÁGINA ${i} ---\n` + pageText;
  }

  return { fullText, pageCount };
}

/**
 * Parses PDF text with local heuristic/regex parsing for Brazilian addresses, NFs, and tracking codes
 */
export function parsePdfTextLocally(rawText: string): Partial<RouteStop>[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('--- PÁGINA'));

  const extracted: Partial<RouteStop>[] = [];

  // Patterns for Brazilian streets, CEPs, and Package Tracking
  const streetRegex = /(?:Rua|R\.|Av\.|Avenida|Travessa|Tv\.|Alameda|Al\.|Praça|Pç\.|Rodovia|Rod\.|Estrada|Estr\.)\s+[^,;]+,\s*(?:nº?\s*)?\d+/i;
  const cepRegex = /\b\d{5}-?\d{3}\b/;
  const phoneRegex = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-\s]?\d{4}/;
  const packageRegex = /(?:Pacote|Pkg|Volume|Vol|Rastreio|Tracking|NF|Nota|Etiqueta|ID)[\s:#-]*([A-Za-z0-9_-]+)/gi;

  let currentBlock: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentBlock.push(line);

    // If we find an address or every 3-5 lines
    const hasStreet = streetRegex.test(line);
    const hasCep = cepRegex.test(line);

    if (hasStreet || hasCep || currentBlock.length >= 4 || i === lines.length - 1) {
      const combined = currentBlock.join(' ');
      const streetMatch = combined.match(streetRegex);
      const cepMatch = combined.match(cepRegex);
      const phoneMatch = combined.match(phoneRegex);

      // Collect all packages in this block
      const packageMatches: string[] = [];
      let pkgMatch: RegExpExecArray | null;
      const pkgRegexLocal = new RegExp(packageRegex.source, 'gi');
      while ((pkgMatch = pkgRegexLocal.exec(combined)) !== null) {
        if (pkgMatch[1] && pkgMatch[1].length > 2) {
          packageMatches.push(pkgMatch[1].toUpperCase());
        }
      }

      if (streetMatch || cepMatch) {
        const address = streetMatch ? streetMatch[0] : combined.slice(0, 80);
        extracted.push({
          address: address.trim(),
          cep: cepMatch ? cepMatch[0] : undefined,
          phone: phoneMatch ? phoneMatch[0] : undefined,
          packageNumbers: packageMatches.length > 0 ? packageMatches : undefined,
          packagesCount: packageMatches.length > 0 ? packageMatches.length : 1,
          status: 'pendente' as const,
        });
        currentBlock = [];
      } else if (currentBlock.length >= 5) {
        currentBlock = [];
      }
    }
  }

  // Group multiple deliveries with same address
  return groupStopsBySameAddress(extracted);
}

/**
 * Main function to parse a PDF file:
 * 1. Extracts all text with PDF.js
 * 2. Calls server AI endpoint `/api/gemini/parse-document` for high-precision extraction
 * 3. Falls back to local regex parsing if AI is unavailable
 * 4. Automatically groups items sharing the same address
 */
export async function parsePdfDocumentFile(file: File): Promise<PdfParseResult> {
  const { fullText, pageCount } = await extractTextFromPdf(file);

  if (!fullText.trim()) {
    throw new Error('Não foi possível extrair texto legível do arquivo PDF.');
  }

  try {
    const res = await fetch('/api/gemini/parse-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentText: fullText,
        documentName: file.name,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.stops) && data.stops.length > 0) {
        // Group any duplicate addresses that may exist
        const grouped = groupStopsBySameAddress(data.stops);
        return {
          stops: grouped,
          routeName: data.routeName || file.name.replace(/\.pdf$/i, ''),
          detectedCity: data.detectedCity,
          detectedState: data.detectedState,
          totalExtractedPackages: data.totalExtractedPackages || grouped.reduce((sum, s) => sum + (s.packagesCount || 1), 0),
          extractedRawText: fullText,
          pageCount,
        };
      }
    }
  } catch (aiErr) {
    console.warn('AI document parsing error, falling back to local heuristic extraction:', aiErr);
  }

  // Fallback to local heuristic extraction
  const localStops = parsePdfTextLocally(fullText);
  return {
    stops: localStops,
    routeName: file.name.replace(/\.pdf$/i, ''),
    extractedRawText: fullText,
    totalExtractedPackages: localStops.reduce((sum, s) => sum + (s.packagesCount || 1), 0),
    pageCount,
  };
}
