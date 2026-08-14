import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RouteStop, RouteSummary } from '../types';

export function generateRoutePdfReport(
  stops: RouteStop[],
  summary: RouteSummary,
  driverName: string = 'Motorista RotaExpress'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR');

  // Header Styling
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 32, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('ROTA EXPRESS PRO', 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Relatório Final de Entregas & Histórico de Rotas GPS', 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(`Gerado em: ${dateStr} às ${timeStr}`, 145, 15);
  doc.text(`Motorista: ${driverName}`, 145, 22);

  // Summary Metrics Section Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 38, 182, 24, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  // Metric 1: Total
  doc.text('TOTAL DE PARADAS', 20, 46);
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${summary.totalCount}`, 20, 55);

  // Metric 2: Concluídas
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text('ENTREGAS CONCLUÍDAS', 65, 46);
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text(`${summary.completedCount}`, 65, 55);

  // Metric 3: Distância
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text('DISTÂNCIA TOTAL', 120, 46);
  doc.setFontSize(14);
  doc.setTextColor(14, 165, 233); // sky-500
  doc.text(`${summary.totalDistanceKm} km`, 120, 55);

  // Metric 4: Tempo Estimado
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text('TEMPO ESTIMADO', 160, 46);
  doc.setFontSize(14);
  doc.setTextColor(139, 92, 246); // violet-500
  doc.text(`${summary.totalDurationMin} min`, 160, 55);

  // Table Data Preparation
  const tableData = stops.map((stop, index) => {
    let statusText = 'Pendente';
    if (stop.status === 'concluido') statusText = 'Concluído ✓';
    if (stop.status === 'falha') statusText = 'Falha ✗';
    if (stop.status === 'em_transito') statusText = 'Em Trânsito 🚗';

    let completedTime = '—';
    if (stop.completedAt) {
      try {
        const d = new Date(stop.completedAt);
        completedTime = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      } catch {
        completedTime = stop.completedAt;
      }
    } else if (stop.status === 'concluido') {
      completedTime = `${timeStr}`;
    }

    const customerInfo = [
      stop.customerName || 'Cliente não informado',
      stop.phone ? `Tel: ${stop.phone}` : null,
      stop.notes ? `Obs: ${stop.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return [
      `#${index + 1}`,
      stop.address,
      customerInfo,
      (stop.priority || 'normal').toUpperCase(),
      statusText,
      completedTime,
    ];
  });

  // Table rendering via autoTable
  autoTable(doc, {
    startY: 68,
    head: [['Ordem', 'Endereço da Parada', 'Cliente / Observações', 'Prioridade', 'Status', 'Horário Registro']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 55 },
      2: { cellWidth: 45 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 22, halign: 'center' },
    },
    didParseCell: (data) => {
      // Style status column cells
      if (data.section === 'body' && data.column.index === 4) {
        const text = String(data.cell.raw);
        if (text.includes('Concluído')) {
          data.cell.styles.textColor = [16, 185, 129]; // green
        } else if (text.includes('Falha')) {
          data.cell.styles.textColor = [225, 29, 72]; // red
        } else {
          data.cell.styles.textColor = [217, 119, 6]; // amber
        }
      }
    },
    foot: [
      [
        'Resumo',
        `Total de ${stops.length} paradas no itinerário`,
        '',
        '',
        `Taxa: ${summary.totalCount > 0 ? Math.round((summary.completedCount / summary.totalCount) * 100) : 0}%`,
        '',
      ],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
    },
  });

  // Footer page numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Página ${i} de ${pageCount} — RotaExpress PRO Sistema de Logística GPS`,
      105,
      290,
      { align: 'center' }
    );
  }

  // Save the generated PDF
  const filename = `Relatorio_RotaExpress_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
