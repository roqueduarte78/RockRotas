import React, { useState, useEffect, useRef } from 'react';
import { RouteStop } from '../types';
import { geocodeAddress } from '../utils/routeOptimizer';
import {
  X,
  MapPin,
  Save,
  User,
  Phone,
  FileText,
  AlertCircle,
  Search,
  RefreshCw,
  Key,
  Package,
  Clock,
  Timer,
  Plus,
  Minus,
  Copy,
  ChevronRight,
  HelpCircle,
  Tag,
  Camera,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

interface EditStopModalProps {
  isOpen: boolean;
  stop: RouteStop | null;
  onClose: () => void;
  onSave: (updatedStop: RouteStop) => void;
  onDuplicate?: (stop: RouteStop) => void;
}

const COLOR_TAGS = [
  { name: 'Laranja', bg: 'bg-orange-500' },
  { name: 'Azul', bg: 'bg-blue-500' },
  { name: 'Verde', bg: 'bg-emerald-500' },
  { name: 'Vermelho', bg: 'bg-rose-500' },
  { name: 'Roxo', bg: 'bg-purple-500' },
];

export const EditStopModal: React.FC<EditStopModalProps> = ({
  isOpen,
  stop,
  onClose,
  onSave,
  onDuplicate,
}) => {
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<RouteStop['priority']>('normal');
  const [status, setStatus] = useState<RouteStop['status']>('pendente');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);

  // New Personalize UI fields matching mockup
  const [colorTag, setColorTag] = useState<string>('Laranja');
  const [gateCode, setGateCode] = useState<string>('');
  const [packageLocation, setPackageLocation] = useState<string>('');
  const [packagesCount, setPackagesCount] = useState<number>(1);
  const [packageNumbersStr, setPackageNumbersStr] = useState<string>('');
  const [stopOrderType, setStopOrderType] = useState<'primeira' | 'automatica' | 'ultima'>('automatica');
  const [serviceType, setServiceType] = useState<'entrega' | 'coleta'>('entrega');
  const [arrivalTimeWindow, setArrivalTimeWindow] = useState<string>('Qualquer momento');
  const [plannedDwellTimeMin, setPlannedDwellTimeMin] = useState<number>(5);
  const [deliveryProofPhoto, setDeliveryProofPhoto] = useState<string | undefined>(undefined);
  const [deliveryProofTimestamp, setDeliveryProofTimestamp] = useState<string | undefined>(undefined);
  const [deliveryProofNotes, setDeliveryProofNotes] = useState<string | undefined>(undefined);

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ address: string; lat: number; lng: number }>>([]);
  const [geocodeMessage, setGeocodeMessage] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (stop) {
      setAddress(stop.address || '');
      setCustomerName(stop.customerName || '');
      setPhone(stop.phone || '');
      setNotes(stop.notes || '');
      setPriority(stop.priority || 'normal');
      setStatus(stop.status || 'pendente');
      setLat(stop.lat);
      setLng(stop.lng);
      setColorTag(stop.colorTag || 'Laranja');
      setGateCode(stop.gateCode || '');
      setPackageLocation(stop.packageLocation || '');
      setPackagesCount(stop.packagesCount ?? (stop.packageNumbers?.length || 1));
      setPackageNumbersStr(stop.packageNumbers?.join(', ') || '');
      setStopOrderType(stop.stopOrderType || 'automatica');
      setServiceType(stop.serviceType || 'entrega');
      setArrivalTimeWindow(stop.arrivalTimeWindow || 'Qualquer momento');
      setPlannedDwellTimeMin(stop.plannedDwellTimeMin ?? 5);
      setDeliveryProofPhoto(stop.deliveryProofPhoto);
      setDeliveryProofTimestamp(stop.deliveryProofTimestamp);
      setDeliveryProofNotes(stop.deliveryProofNotes);
      setGeocodeMessage(null);
      setSearchResults([]);
    }
  }, [stop, isOpen]);

  if (!isOpen || !stop) return null;

  const handleAddressSearch = (val: string) => {
    setAddress(val);
    setGeocodeMessage(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length > 3) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(val)}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              setSearchResults(
                data.slice(0, 4).map((item: any) => ({
                  address: item.display_name,
                  lat: parseFloat(item.lat),
                  lng: parseFloat(item.lon),
                }))
              );
            }
          }
        } catch (err) {
          console.warn('Geocode search error:', err);
        }
      }, 400);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectSuggestion = (item: { address: string; lat: number; lng: number }) => {
    setAddress(item.address);
    setLat(item.lat);
    setLng(item.lng);
    setSearchResults([]);
    setGeocodeMessage('Coordenadas atualizadas pela sugestão!');
  };

  const handleForceRegeocode = async () => {
    if (!address.trim()) return;
    setIsGeocoding(true);
    setGeocodeMessage(null);
    try {
      const result = await geocodeAddress(address);
      if (result) {
        setAddress(result.formattedAddress);
        setLat(result.lat);
        setLng(result.lng);
        setGeocodeMessage(`Localizado com sucesso! Coordenadas: ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
      } else {
        setGeocodeMessage('Endereço não localizado com precisão. Mantenha os dados ou tente um endereço mais detalhado.');
      }
    } catch (error) {
      setGeocodeMessage('Erro ao conectar com o serviço de geocodificação.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalLat = lat;
    let finalLng = lng;
    let finalAddress = address.trim();

    if (address !== stop.address && (!finalLat || !finalLng)) {
      setIsGeocoding(true);
      const res = await geocodeAddress(address);
      setIsGeocoding(false);
      if (res) {
        finalLat = res.lat;
        finalLng = res.lng;
        finalAddress = res.formattedAddress;
      }
    }

    const parsedPackageNumbers = packageNumbersStr
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const updated: RouteStop = {
      ...stop,
      address: finalAddress,
      customerName: customerName.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      priority,
      status,
      lat: finalLat,
      lng: finalLng,
      colorTag,
      gateCode: gateCode.trim() || undefined,
      packageLocation: packageLocation.trim() || undefined,
      packagesCount: Math.max(packagesCount, parsedPackageNumbers.length || 1),
      packageNumbers: parsedPackageNumbers.length > 0 ? parsedPackageNumbers : undefined,
      stopOrderType,
      serviceType,
      arrivalTimeWindow,
      plannedDwellTimeMin,
      deliveryProofPhoto,
      deliveryProofTimestamp,
      deliveryProofNotes,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Mockup Header: Editar parada | Concluído */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-slate-600" />
          </button>
          <h3 className="font-black text-slate-900 text-base">Editar parada</h3>
          <button
            type="button"
            onClick={handleSubmit}
            className="text-blue-600 hover:text-blue-800 font-black text-sm transition-colors"
          >
            Concluído
          </button>
        </div>

        {/* Form Body - Styled strictly after the 'Personalize' mockup */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Color Tag Picker */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs font-bold text-slate-800">
              <span className={`w-3 h-3 rounded-full ${COLOR_TAGS.find(c => c.name === colorTag)?.bg || 'bg-orange-500'}`} />
              <select
                value={colorTag}
                onChange={(e) => setColorTag(e.target.value)}
                className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer"
              >
                {COLOR_TAGS.map((tag) => (
                  <option key={tag.name} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Address Display & Edit */}
          <div className="space-y-1">
            <h4 className="text-lg font-black text-slate-900 leading-snug">
              {address || 'Endereço sem nome'}
            </h4>
            <p className="text-xs font-semibold text-slate-500">
              {stop.city ? `${stop.city}, ` : ''}{stop.cep || stop.state || 'Brasil'}
            </p>
          </div>

          {/* Gate Code / Notes Card (Matching mockup: O código do portão é 1684) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-600 shrink-0" />
              <input
                type="text"
                value={gateCode}
                onChange={(e) => setGateCode(e.target.value)}
                placeholder="O código do portão é ex: 1684"
                className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
              <FileText className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações de entrega (ex: deixar com porteiro)"
                className="w-full bg-transparent text-xs font-medium text-slate-700 placeholder:text-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Detailed Attributes list matching mockup */}
          <div className="space-y-3 divide-y divide-slate-100">
            {/* Package Locator */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-2 shrink-0">
                <Package className="w-4 h-4 text-slate-500" />
                Localizador de pacote
              </label>
              <input
                type="text"
                value={packageLocation}
                onChange={(e) => setPackageLocation(e.target.value)}
                placeholder="Ex: Grande, Sacola, FDC"
                className="text-right text-xs font-bold text-blue-600 placeholder:text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Packages count [- 1 +] and Package Numbers */}
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" />
                  Quantidade de Pacotes
                </label>
                <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPackagesCount(Math.max(1, packagesCount - 1))}
                    className="p-1.5 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 text-xs font-black text-slate-900">{packagesCount}</span>
                  <button
                    type="button"
                    onClick={() => setPackagesCount(packagesCount + 1)}
                    className="p-1.5 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Package Numbers / Codes */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                  Números / Códigos dos Pacotes (separados por vírgula):
                </label>
                <input
                  type="text"
                  value={packageNumbersStr}
                  onChange={(e) => setPackageNumbersStr(e.target.value)}
                  placeholder="Ex: PKG-001, PKG-002, 108492"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-indigo-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Order Preference [ Primeira | Automática | Última ] */}
            <div className="flex items-center justify-between gap-2 pt-3">
              <label className="text-xs font-extrabold text-slate-800 shrink-0">
                Ordem
              </label>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 text-xs">
                {(['primeira', 'automatica', 'ultima'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setStopOrderType(type)}
                    className={`px-2.5 py-1 rounded-lg font-extrabold capitalize transition-all ${
                      stopOrderType === type
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type === 'automatica' ? 'Automática' : type === 'primeira' ? 'Primeira' : 'Última'}
                  </button>
                ))}
              </div>
            </div>

            {/* Type [ Entrega | Coleta ] */}
            <div className="flex items-center justify-between gap-2 pt-3">
              <label className="text-xs font-extrabold text-slate-800 shrink-0">
                Tipo
              </label>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 text-xs">
                {(['entrega', 'coleta'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setServiceType(t)}
                    className={`px-3 py-1 rounded-lg font-extrabold capitalize transition-all ${
                      serviceType === t
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t === 'entrega' ? 'Entrega' : 'Coleta'}
                  </button>
                ))}
              </div>
            </div>

            {/* Arrival Time Window */}
            <div className="flex items-center justify-between gap-3 pt-3">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Horário de chegada
              </label>
              <input
                type="text"
                value={arrivalTimeWindow}
                onChange={(e) => setArrivalTimeWindow(e.target.value)}
                placeholder="Qualquer momento"
                className="text-right text-xs font-bold text-slate-600 bg-transparent outline-none focus:text-slate-900"
              />
            </div>

            {/* Dwell Stop Time (Tempo na parada: 5 minutos) */}
            <div className="flex items-center justify-between gap-3 pt-3">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                <Timer className="w-4 h-4 text-slate-500" />
                Tempo na parada
              </label>
              <div className="flex items-center gap-1">
                <select
                  value={plannedDwellTimeMin}
                  onChange={(e) => setPlannedDwellTimeMin(Number(e.target.value))}
                  className="bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl text-xs font-extrabold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={2}>2 minutos</option>
                  <option value={3}>3 minutos</option>
                  <option value={5}>5 minutos</option>
                  <option value={10}>10 minutos</option>
                  <option value={15}>15 minutos</option>
                  <option value={20}>20 minutos</option>
                </select>
              </div>
            </div>
          </div>

          {/* Delivery Proof Photo Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                Comprovante de Entrega (Foto)
              </span>
              {deliveryProofPhoto && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Foto Registrada
                </span>
              )}
            </div>

            {deliveryProofPhoto ? (
              <div className="flex items-center gap-3 pt-1">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-300 bg-black shrink-0 shadow-xs">
                  <img
                    src={deliveryProofPhoto}
                    alt="Comprovante"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[11px] font-bold text-slate-700 truncate">
                    {deliveryProofTimestamp || 'Capturado no app'}
                  </p>
                  {deliveryProofNotes && (
                    <p className="text-[10px] text-slate-500 italic truncate">
                      "{deliveryProofNotes}"
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryProofPhoto(undefined);
                      setDeliveryProofTimestamp(undefined);
                      setDeliveryProofNotes(undefined);
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remover Foto</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 font-medium">
                Nenhum comprovante fotográfico registrado ainda. A foto é solicitada automaticamente ao marcar a parada como concluída.
              </p>
            )}
          </div>

          {/* Extra Action List matching mockup */}
          <div className="pt-2 space-y-2 border-t border-slate-200">
            {/* Mudar endereço */}
            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={(e) => handleAddressSearch(e.target.value)}
                placeholder="Mudar endereço"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleForceRegeocode}
                className="absolute right-3 top-2.5 text-blue-600 font-bold text-xs flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeocoding ? 'animate-spin' : ''}`} />
                Mudar
              </button>
            </div>

            {/* Duplicar parada button */}
            {onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  onDuplicate(stop);
                  onClose();
                }}
                className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Copy className="w-4 h-4 text-slate-600" />
                  Duplicar parada
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
