import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  X,
  AlertCircle,
  ListPlus,
  FileDown,
  Sparkles,
  CheckCircle2,
  MapPin,
  Package,
  Layers,
  FileText,
} from 'lucide-react';
import { RouteStop, RouteSummary } from '../types';
import {
  parseSpreadsheetFile,
  downloadSampleExcel,
  exportCurrentRouteToExcel,
  geocodeAddress,
  validateAddressesWithGemini,
  getUfFromCep,
  getUfFromLatLng,
} from '../utils/routeOptimizer';
import { parsePdfDocumentFile } from '../utils/pdfParser';

const BRAZIL_UFS = [
  'SP', 'RJ', 'MG', 'PR', 'RS', 'SC', 'BA', 'PE', 'CE', 'GO', 'ES', 'DF',
  'PA', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI', 'MT', 'MS', 'TO', 'RO', 'AM',
  'AC', 'AP', 'RR'
];

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStops: (newStops: RouteStop[], suggestedRouteName?: string) => void;
  setIsSearching: (searching: boolean) => void;
  currentStops?: RouteStop[];
  summary?: RouteSummary;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportStops,
  setIsSearching,
  currentStops = [],
  summary,
}) => {
  const [parsedPreview, setParsedPreview] = useState<Partial<RouteStop>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingGemini, setIsValidatingGemini] = useState(false);
  const [geminiValidated, setGeminiValidated] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'excel' | 'pdf' | 'csv' | null>(null);
  const [customRouteName, setCustomRouteName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [totalPackagesCount, setTotalPackagesCount] = useState<number>(0);

  // State verification status
  const [detectedState, setDetectedState] = useState<string | null>(null);
  const [detectedSource, setDetectedSource] = useState<'planilha' | 'pdf' | 'cep' | 'latlng' | 'manual' | null>(null);
  const [selectedManualUf, setSelectedManualUf] = useState<string>('SP');
  const [selectedManualCity, setSelectedManualCity] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMsg(null);
    setFileName(file.name);
    setGeminiValidated(false);

    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    setFileType(isPdf ? 'pdf' : isCsv ? 'csv' : 'excel');

    // Extract filename without extension for route name suggestion
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[_]/g, ' ');
    setCustomRouteName(nameWithoutExt);

    try {
      let items: Partial<RouteStop>[] = [];
      let autoDetectedUf: string | null = null;
      let autoDetectedCity: string | null = null;

      if (isPdf) {
        // Parse PDF file using pdfjs-dist and AI document extractor
        const pdfResult = await parsePdfDocumentFile(file);
        items = pdfResult.stops;
        if (pdfResult.routeName) setCustomRouteName(pdfResult.routeName);
        if (pdfResult.detectedState) autoDetectedUf = pdfResult.detectedState;
        if (pdfResult.detectedCity) autoDetectedCity = pdfResult.detectedCity;
      } else {
        // Parse Excel (.xlsx, .xls) / CSV
        items = await parseSpreadsheetFile(file);
      }

      if (items.length === 0) {
        throw new Error('Nenhum endereço válido foi identificado no arquivo.');
      }

      // Calculate total packages
      const totalPkgs = items.reduce((sum, item) => {
        const count = item.packagesCount ?? (item.packageNumbers?.length || 1);
        return sum + count;
      }, 0);
      setTotalPackagesCount(totalPkgs);

      // Step 1: Check if file explicitly has state/UF
      let foundState: string | null = autoDetectedUf || null;
      let source: 'planilha' | 'pdf' | 'cep' | 'latlng' | 'manual' | null = isPdf && autoDetectedUf ? 'pdf' : null;

      if (!foundState) {
        for (const item of items) {
          if (item.state && item.state.trim()) {
            foundState = item.state.trim().toUpperCase();
            source = isPdf ? 'pdf' : 'planilha';
            break;
          }
        }
      }

      // Step 2: If no state in file, check CEP
      if (!foundState) {
        for (const item of items) {
          const ufCep = getUfFromCep(item.cep);
          if (ufCep) {
            foundState = ufCep;
            source = 'cep';
            break;
          }
        }
      }

      // Step 3: If no state from CEP, check lat / lng
      if (!foundState) {
        for (const item of items) {
          const ufGeo = getUfFromLatLng(item.lat, item.lng);
          if (ufGeo) {
            foundState = ufGeo;
            source = 'latlng';
            break;
          }
        }
      }

      if (autoDetectedCity) {
        setSelectedManualCity(autoDetectedCity);
      }

      // Update state tracking
      setDetectedState(foundState);
      setDetectedSource(source);

      // If state was detected automatically, update items
      if (foundState) {
        const updated = items.map((it) => ({
          ...it,
          state: it.state || foundState || undefined,
          city: it.city || autoDetectedCity || undefined,
        }));
        setParsedPreview(updated);
      } else {
        setParsedPreview(items);
      }
    } catch (err: any) {
      console.error('File import error:', err);
      setErrorMsg(err.message || 'Erro ao processar arquivo selecionado.');
    } finally {
      setIsLoading(false);
    }
  };

  // Apply user manual state/city selection to preview
  const handleApplyManualState = (uf: string, city: string) => {
    setSelectedManualUf(uf);
    setSelectedManualCity(city);
    setDetectedState(uf);
    setDetectedSource('manual');

    setParsedPreview((prev) =>
      prev.map((item) => ({
        ...item,
        state: uf,
        city: item.city || city || undefined,
      }))
    );
  };

  const handleValidateWithGemini = async () => {
    if (parsedPreview.length === 0) return;
    setIsValidatingGemini(true);
    setErrorMsg(null);

    try {
      const stopsToValidate = parsedPreview.map((item) => ({
        id: 'temp',
        address: item.address || '',
        city: item.city || selectedManualCity || undefined,
        state: item.state || detectedState || selectedManualUf || undefined,
        cep: item.cep,
        neighborhood: item.neighborhood,
        status: 'pendente' as const,
      }));

      const results = await validateAddressesWithGemini(stopsToValidate);

      if (results && results.length > 0) {
        const updated = parsedPreview.map((item, idx) => {
          const matched = results[idx];
          if (matched && matched.addressFormatted) {
            return {
              ...item,
              address: matched.addressFormatted,
              city: matched.city || item.city,
              state: matched.state || item.state || detectedState || undefined,
              cep: matched.cep || item.cep,
              neighborhood: matched.neighborhood || item.neighborhood,
            };
          }
          return item;
        });

        setParsedPreview(updated);
        setGeminiValidated(true);
      } else {
        setErrorMsg('Não foi possível validar com IA no momento. Mantendo dados originais.');
      }
    } catch (err: any) {
      console.warn('Gemini validation error:', err);
      setErrorMsg('Ocorreu um erro ao chamar a IA para validação de endereços.');
    } finally {
      setIsValidatingGemini(false);
    }
  };

  const handleConfirmImport = async () => {
    setIsLoading(true);
    setIsSearching(true);

    const geocodedStops: RouteStop[] = [];

    for (let i = 0; i < parsedPreview.length; i++) {
      const item = parsedPreview[i];
      let lat = item.lat;
      let lng = item.lng;

      // Ensure city and state are assigned if present or manually selected
      const stopState = item.state || detectedState || selectedManualUf || undefined;
      const stopCity = item.city || selectedManualCity || undefined;

      // Only geocode if coordinates are missing
      if ((lat === undefined || lng === undefined) && item.address) {
        if (i > 0) {
          // Respect geocode rate limits
          await new Promise((res) => setTimeout(res, 250));
        }

        // Construct targeted address query including City and State if known
        let searchAddr = item.address;
        if (stopCity && !searchAddr.toLowerCase().includes(stopCity.toLowerCase())) {
          searchAddr += `, ${stopCity}`;
        }
        if (stopState && !searchAddr.toLowerCase().includes(stopState.toLowerCase())) {
          searchAddr += ` - ${stopState}`;
        }
        searchAddr += `, Brasil`;

        const geo = await geocodeAddress(searchAddr);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
        } else {
          // Fallback geocode with address raw string
          const fallbackGeo = await geocodeAddress(item.address);
          if (fallbackGeo) {
            lat = fallbackGeo.lat;
            lng = fallbackGeo.lng;
          }
        }
      }

      geocodedStops.push({
        id: `stop-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        address: item.address || 'Endereço sem nome',
        city: stopCity,
        state: stopState,
        cep: item.cep,
        neighborhood: item.neighborhood,
        customerName: item.customerName,
        phone: item.phone,
        notes: item.notes,
        priority: item.priority || 'normal',
        lat,
        lng,
        packageNumbers: item.packageNumbers,
        packageNumber: item.packageNumber,
        packagesCount: item.packagesCount ?? (item.packageNumbers?.length || 1),
        packageLocation: item.packageLocation,
        gateCode: item.gateCode,
        status: 'pendente',
      });
    }

    onImportStops(geocodedStops, customRouteName || fileName || undefined);
    setIsSearching(false);
    setIsLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg leading-tight flex items-center gap-2">
                <span>Importar Listas & Romaneios</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-emerald-300 font-mono">
                  XLSX / CSV / PDF
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Importe romaneios, NFs ou planilhas. Agrupa automaticamente múltiplos pacotes no mesmo endereço.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-700">
          {/* Export Current Route Section */}
          {currentStops.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
              <div>
                <span className="font-extrabold text-blue-950 text-xs uppercase tracking-wider block">
                  📊 Rota Atual Otimizada ({currentStops.length} paradas)
                </span>
                <p className="text-xs text-blue-800 font-medium mt-0.5">
                  Baixe a planilha com pacotes, ordem otimizada, cidade, CEP e horários.
                </p>
              </div>
              <button
                onClick={() => exportCurrentRouteToExcel(currentStops, summary)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 shrink-0 transition-all"
              >
                <FileDown className="w-4 h-4" />
                Exportar Rota (.XLSX)
              </button>
            </div>
          )}

          {/* Sample file download */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-emerald-900 block">Modelo Completo em Branco (.XLSX)</span>
              <span className="text-emerald-700">Com colunas para Endereço, Pacotes, Volumes, Bairro, CEP e Cliente.</span>
            </div>
            <button
              onClick={downloadSampleExcel}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-all"
            >
              <Download className="w-4 h-4" />
              Modelo .XLSX
            </button>
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center transition-all bg-slate-50 relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv, .pdf, application/pdf"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex items-center justify-center gap-3 mb-2">
              <Upload className="w-7 h-7 text-blue-600" />
              <FileText className="w-7 h-7 text-rose-500" />
            </div>
            <h4 className="font-bold text-sm text-slate-800 mb-1">
              {fileName ? fileName : 'Clique ou arraste seu arquivo Excel, CSV ou PDF aqui'}
            </h4>
            <p className="text-xs text-slate-500">
              Formatos aceitos: <strong>.xlsx, .xls, .csv, .pdf</strong> (Romaneios, Manifestos, Notas Fiscais e Planilhas).
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Preview */}
          {parsedPreview.length > 0 && (
            <div className="space-y-3">
              {/* Route Name Input Field */}
              <div className="p-3 bg-violet-50/80 border border-violet-200 rounded-2xl space-y-1">
                <label className="text-xs font-bold text-violet-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  Nome da Rota (sugerido a partir do documento):
                </label>
                <input
                  type="text"
                  value={customRouteName}
                  onChange={(e) => setCustomRouteName(e.target.value)}
                  placeholder="Ex: Rota Entregas Zona Sul"
                  className="w-full px-3 py-1.5 bg-white border border-violet-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>

              {/* Package Summary Badge */}
              <div className="p-3 bg-indigo-50/90 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-indigo-950">
                    Total de Pacotes / Volumes extraídos: <strong className="text-indigo-700">{totalPackagesCount}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-800 font-medium">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{parsedPreview.length} Paradas Únicas</span>
                </div>
              </div>

              {/* Geographic State / UF Detection & Manual Prompt Bar */}
              <div className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                detectedSource === 'planilha'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : detectedSource === 'pdf'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : detectedSource === 'cep'
                  ? 'bg-blue-50 border-blue-200 text-blue-950'
                  : detectedSource === 'latlng'
                  ? 'bg-cyan-50 border-cyan-200 text-cyan-950'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-extrabold">
                    <MapPin className="w-4 h-4 text-violet-600 shrink-0" />
                    <span>
                      {detectedSource === 'planilha' && `✓ Estado (UF) identificado na Planilha: ${detectedState}`}
                      {detectedSource === 'pdf' && `✓ Estado (UF) identificado no Documento PDF: ${detectedState}`}
                      {detectedSource === 'cep' && `✓ Estado (UF) identificado automaticamente pelo CEP: ${detectedState}`}
                      {detectedSource === 'latlng' && `✓ Estado (UF) identificado pelas Coordenadas: ${detectedState}`}
                      {detectedSource === 'manual' && `✓ Estado (UF) definido manualmente: ${detectedState}`}
                      {!detectedSource && `⚠️ Estado (UF) não encontrado no arquivo, CEP ou coordenadas.`}
                    </span>
                  </div>
                </div>

                {(!detectedSource || detectedSource === 'manual') && (
                  <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                    O documento não continha coluna explícita de Estado/UF. Selecione abaixo o Estado (UF) das entregas para garantir que os endereços sejam localizados com precisão:
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <label className="font-bold text-[11px] text-slate-700">Estado (UF):</label>
                    <select
                      value={detectedState || selectedManualUf}
                      onChange={(e) => handleApplyManualState(e.target.value, selectedManualCity)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 focus:ring-2 focus:ring-violet-500 outline-none"
                    >
                      {BRAZIL_UFS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                    <label className="font-bold text-[11px] text-slate-700 shrink-0">Cidade (opcional):</label>
                    <input
                      type="text"
                      value={selectedManualCity}
                      onChange={(e) => handleApplyManualState(detectedState || selectedManualUf, e.target.value)}
                      placeholder="Ex: Rio de Janeiro, São Paulo"
                      className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Pré-visualização ({parsedPreview.length} paradas consolidadas)
                </h4>

                <button
                  onClick={handleValidateWithGemini}
                  disabled={isValidatingGemini || geminiValidated}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                    geminiValidated
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
                  }`}
                >
                  {isValidatingGemini ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Validando com IA...</span>
                    </>
                  ) : geminiValidated ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Endereços Padronizados por IA</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Padronizar Endereços com IA Gemini</span>
                    </>
                  )}
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-200 rounded-2xl p-2 bg-slate-50">
                {parsedPreview.map((item, idx) => {
                  const pkgCount = item.packagesCount ?? (item.packageNumbers?.length || 1);
                  const isMultiPackage = pkgCount > 1 || (item.packageNumbers && item.packageNumbers.length > 1);

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border text-xs transition-all ${
                        isMultiPackage
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-slate-800 leading-tight">
                          {idx + 1}. {item.address}
                        </p>
                        {isMultiPackage && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] rounded-full shrink-0 flex items-center gap-1">
                            <Layers className="w-3 h-3 text-amber-700" />
                            {pkgCount} PACOTES AGRUPADOS
                          </span>
                        )}
                      </div>

                      {/* Package numbers pills */}
                      {item.packageNumbers && item.packageNumbers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                            <Package className="w-3 h-3 text-indigo-600" />
                            Pacotes:
                          </span>
                          {item.packageNumbers.map((pkg, pIdx) => (
                            <span
                              key={pIdx}
                              className="px-1.5 py-0.5 bg-indigo-100 text-indigo-900 font-mono text-[10px] font-bold rounded-md"
                            >
                              {pkg}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500 text-[11px] mt-1">
                        {item.customerName && <span>👤 Cliente: {item.customerName}</span>}
                        {item.phone && <span>📞 Tel: {item.phone}</span>}
                        {(item.city || item.state || detectedState) && (
                          <span>
                            📍 {item.city ? `${item.city} ` : ''}
                            ({item.state || detectedState || selectedManualUf})
                          </span>
                        )}
                        {item.cep && <span>CEP: {item.cep}</span>}
                        {item.notes && <span className="text-amber-700 font-medium">📝 {item.notes}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleConfirmImport}
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processando e geolocalizando paradas...</span>
                  </>
                ) : (
                  <>
                    <ListPlus className="w-4 h-4" />
                    <span>Adicionar {parsedPreview.length} Paradas ({totalPackagesCount} Pacotes) à Rota</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

