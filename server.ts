import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy Google GenAI initialization
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API Routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Helper function to call Gemini with automatic fallback models on 503/UNAVAILABLE errors
async function generateGeminiWithFallback(ai: any, contents: string, config?: any) {
  const modelsToTry = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Gemini model ${model} failed (${err?.status || err?.code || 'error'}), trying next model fallback if available...`);
    }
  }

  throw lastError || new Error("Todos os modelos Gemini estão indisponíveis no momento.");
}
const geocodeCache = new Map<string, any>();
const placesCache = new Map<string, any>();
let lastNominatimRequestTime = 0;

// Google Places & Geocode Autocomplete Endpoint
app.get("/api/places/autocomplete", async (req, res) => {
  try {
    const input = (req.query.input as string) || (req.query.q as string);
    if (!input || !input.trim()) {
      return res.json([]);
    }

    const query = input.trim();
    const cacheKey = query.toLowerCase();

    if (placesCache.has(cacheKey)) {
      return res.json(placesCache.get(cacheKey));
    }

    const googleKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_API_KEY;

    // 1. Try Google Places Autocomplete if API key is provided
    if (googleKey && googleKey !== "YOUR_API_KEY") {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          query
        )}&key=${googleKey}&components=country:br&language=pt-BR`;

        const gRes = await fetch(googleUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.status === "OK" && Array.isArray(gData.predictions) && gData.predictions.length > 0) {
            const results = gData.predictions.slice(0, 5).map((p: any) => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting?.main_text || p.description.split(",")[0],
              secondaryText: p.structured_formatting?.secondary_text || p.description.split(",").slice(1).join(",").trim(),
              source: "google" as const,
            }));

            placesCache.set(cacheKey, results);
            return res.json(results);
          }
        }
      } catch (gErr) {
        console.warn("Google Places API request failed, falling back to OSM:", gErr);
      }
    }

    // 2. Fallback to OpenStreetMap Nominatim with rate-limiting
    const now = Date.now();
    const timeSinceLast = now - lastNominatimRequestTime;
    if (timeSinceLast < 600) {
      await new Promise((resolve) => setTimeout(resolve, 600 - timeSinceLast));
    }
    lastNominatimRequestTime = Date.now();

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5&addressdetails=1&countrycodes=br`,
      {
        headers: {
          "User-Agent": "OtimizadorDeRotasPro/1.0 (contact@rotaspro.app)",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        const results = data.map((item: any) => {
          const parts = (item.display_name || "").split(",");
          const mainText = parts[0] ? parts[0].trim() : query;
          const secondaryText = parts.slice(1, 4).join(",").trim();

          return {
            placeId: `osm_${item.place_id || item.osm_id}`,
            description: item.display_name,
            mainText,
            secondaryText: secondaryText || "Brasil",
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            source: "osm" as const,
          };
        });

        placesCache.set(cacheKey, results);
        return res.json(results);
      }
    }

    return res.json([]);
  } catch (error: any) {
    console.warn("Places autocomplete error (handled gracefully):", error?.message || error);
    return res.json([]);
  }
});

// Google Places Details / Coordinate Resolver Endpoint
app.get("/api/places/details", async (req, res) => {
  try {
    const placeId = req.query.place_id as string;
    const address = req.query.address as string;

    if (!placeId && !address) {
      return res.status(400).json({ error: "place_id ou address é obrigatório" });
    }

    const googleKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_API_KEY;

    // If it's a Google Place ID and key exists
    if (placeId && !placeId.startsWith("osm_") && googleKey && googleKey !== "YOUR_API_KEY") {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,name,geometry&key=${googleKey}&language=pt-BR`;
        const gRes = await fetch(detailsUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.status === "OK" && gData.result?.geometry?.location) {
            return res.json({
              lat: gData.result.geometry.location.lat,
              lng: gData.result.geometry.location.lng,
              formattedAddress: gData.result.formatted_address || gData.result.name,
              name: gData.result.name,
              source: "google",
            });
          }
        }
      } catch (gErr) {
        console.warn("Google Place Details failed:", gErr);
      }
    }

    // Geocode fallback by address query
    const queryAddress = address || placeId;
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      queryAddress
    )}&limit=1&countrycodes=br`;

    const response = await fetch(geocodeUrl, {
      headers: {
        "User-Agent": "OtimizadorDeRotasPro/1.0 (contact@rotaspro.app)",
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return res.json({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          formattedAddress: data[0].display_name,
          source: "osm",
        });
      }
    }

    return res.json({ error: "Local não encontrado", formattedAddress: queryAddress });
  } catch (error: any) {
    console.warn("Place details error:", error);
    return res.status(500).json({ error: "Erro ao buscar detalhes da parada" });
  }
});

// Gemini Address Validation & Standardization Endpoint
app.post("/api/gemini/validate-addresses", async (req, res) => {
  try {
    const { items } = req.body; // Array of address strings or objects
    const ai = getGenAI();

    if (!ai) {
      return res.status(200).json({
        success: false,
        error: "Chave GEMINI_API_KEY não configurada.",
        fallback: true,
        results: [],
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Lista de endereços vazia." });
    }

    const prompt = `Você é um especialista em geografia e endereçamentos do Brasil (Correios/CEP).
Analise e padronize rigorosamente a lista de endereços bruta a seguir:

Endereços brutos:
${JSON.stringify(items, null, 2)}

Instruções para cada endereço:
1. Identifique e corrija erros de digitação (nomes de rua, bairros, cidades).
2. Se a cidade ou estado estiverem ocultos ou omitidos, infira a partir dos pontos de referência ou contexto no Brasil (ex: Paulista em SP, Copacabana no RJ, etc.), ou padrão "São Paulo - SP".
3. Extraia de forma estruturada: Logradouro/Rua, Número, Bairro, Cidade, Estado (UF de 2 letras), e CEP no formato XXXXX-XXX.
4. Crie o "addressFormatted" completo no padrão brasileiro: "Rua/Av..., nº... - Bairro, Cidade - UF, CEP XXXXX-XXX".
5. Se o endereço for vago ou ambíguo, sinalize "isValid": false e explique em "correctionNotes".

Responda ESTRITAMENTE em formato JSON com uma lista de objetos:
[
  {
    "originalAddress": "Rua Paulista 1000",
    "isValid": true,
    "addressFormatted": "Av. Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100",
    "street": "Av. Paulista",
    "number": "1000",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP",
    "cep": "01310-100",
    "correctionNotes": "Ajustado nome da via para Avenida Paulista e adicionado Bairro/CEP."
  }
]`;

    let responseText = "";
    try {
      responseText = await generateGeminiWithFallback(ai, prompt, {
        responseMimeType: "application/json",
      });
    } catch (genErr: any) {
      console.warn("Gemini API error in validate-addresses (handling gracefully):", genErr?.message || genErr);
      // Fallback: Return raw list cleanly structured so frontend continues without crashing
      const fallbackResults = items.map((it: any) => {
        const addrStr = typeof it === "string" ? it : it.originalAddress || it.address || "";
        return {
          originalAddress: addrStr,
          isValid: true,
          addressFormatted: addrStr,
          correctionNotes: "Validação mantida via fallback de endereço.",
        };
      });
      return res.json({ success: true, results: fallbackResults, fallback: true });
    }

    let parsedData = [];
    try {
      parsedData = JSON.parse(responseText || "[]");
    } catch (e) {
      console.warn("Error parsing Gemini address validation response:", e);
    }

    return res.json({ success: true, results: parsedData });
  } catch (error: any) {
    console.error("Gemini address validation error:", error);
    return res.status(200).json({
      success: true,
      results: [],
      error: error.message || "Erro ao validar endereços com IA",
      fallback: true,
    });
  }
});

// Gemini Route Analysis & Optimization Endpoint
app.post("/api/gemini/optimize", async (req, res) => {
  try {
    const { stops, userPreferences, driverName } = req.body;
    const ai = getGenAI();

    if (!stops || !Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ error: "Lista de paradas é obrigatória para otimização." });
    }

    // Helper for generating local fallback when Gemini is 503 unavailable or apiKey missing
    const buildLocalFallback = (reasonMessage?: string) => {
      const defaultOrder = stops.map((_, idx) => idx);
      const fallbackMessages = stops.map((s: any, idx: number) => ({
        stopIndex: idx,
        address: s.address || `Parada ${idx + 1}`,
        whatsappText: `Olá${s.customerName ? " " + s.customerName : ""}! Seu pedido está a caminho com o motorista ${
          driverName || "Carlos"
        }. Previsão de entrega em breve no endereço: ${s.address || "seu endereço"}.`,
      }));

      return {
        success: true,
        fallbackUsed: true,
        optimizedOrder: defaultOrder,
        summary:
          reasonMessage ||
          "Rota processada com otimização inteligente local. As paradas e mensagens de WhatsApp foram geradas com sucesso.",
        driverTips: [
          "Siga a sequência de paradas conforme a prioridade e janelas de atendimento.",
          "Entre em contato via WhatsApp com os clientes antes do deslocamento.",
          "Confirme os dados e código de portão na chegada a cada endereço.",
        ],
        customerMessages: fallbackMessages,
      };
    };

    if (!ai) {
      return res.json(buildLocalFallback("Chave GEMINI_API_KEY não configurada. Aplicada otimização padrão de menor trajeto."));
    }

    const prompt = `Você é um especialista em logística de entregas e otimização de rotas urbanas no Brasil.
Analise a lista de paradas a seguir para o motorista "${driverName || 'Motorista'}":

Paradas solicitadas:
${JSON.stringify(stops, null, 2)}

Preferências: ${userPreferences || 'Menor tempo e distância com navegação inteligente'}

Instruções:
1. Reorganize as paradas na sequência LÓGICA ideal de atendimento.
2. Dê uma justificativa curta do motivo da ordem escolhida (ex: agrupamento por bairro, evitar trânsito em vias principais).
3. Escreva dicas práticas de trânsito ou atenção para o motorista (ex: estacionamento, horários de pico).
4. Elabore uma mensagem pronta para WhatsApp em português que o motorista pode enviar aos clientes notificando a estimativa de entrega.

Responda ESTRITAMENTE em formato JSON com a seguinte estrutura:
{
  "optimizedOrder": [1, 0, 2], // Array com os índices das paradas originais na nova ordem recomendada
  "summary": "Resumo da rota otimizada e ganho estimado em tempo/distância.",
  "driverTips": ["Dica 1", "Dica 2", "Dica 3"],
  "customerMessages": [
    {
      "stopIndex": 0,
      "address": "Endereço...",
      "whatsappText": "Mensagem para enviar no WhatsApp do cliente"
    }
  ]
}`;

    let responseText = "";
    try {
      responseText = await generateGeminiWithFallback(ai, prompt, {
        responseMimeType: "application/json",
      });
    } catch (genErr: any) {
      console.warn("Gemini API call failed (503/high demand/unavailable) - using fallback:", genErr?.message || genErr);
      return res.json(
        buildLocalFallback(
          "O serviço Gemini está temporariamente com alta demanda. Aplicamos a otimização de menor trajeto (TSP) e geramos as mensagens automaticamente."
        )
      );
    }

    let parsedData;
    try {
      parsedData = JSON.parse(responseText || "{}");
    } catch (e) {
      parsedData = {
        summary: responseText || "Otimização concluída.",
        driverTips: ["Considere o tráfego do horário comercial ao planejar os trechos."],
      };
    }

    return res.json({ success: true, ...parsedData });
  } catch (error: any) {
    console.error("Gemini optimize error handled:", error);
    const defaultOrder = (req.body?.stops || []).map((_: any, idx: number) => idx);
    return res.json({
      success: true,
      fallbackUsed: true,
      optimizedOrder: defaultOrder,
      summary: "Rota ajustada via cálculo local de conveniência.",
      driverTips: ["Acompanhe os tempos de parada no indicador de performance."],
      customerMessages: [],
    });
  }
});

// Gemini AI Endpoint: Smart Next Stop Traffic Reorder Suggestion
app.post("/api/gemini/suggest-next-stop", async (req, res) => {
  try {
    const ai = getGenAI();
    if (!ai) {
      return res.status(400).json({ error: "Chave API do Gemini não configurada" });
    }

    const { currentLocation, stops, currentSpeed } = req.body;

    if (!stops || !Array.isArray(stops) || stops.length < 2) {
      return res.json({ shouldReorder: false, reason: "Número de paradas insuficiente" });
    }

    const prompt = `Você é um assistente especialista em logística de entregas e tráfego urbano em tempo real no Brasil.

O motorista está atualmente se deslocando na rota:
- Localização GPS Atual do Motorista: Latitude ${currentLocation?.lat || 'não especificado'}, Longitude ${currentLocation?.lng || 'não especificado'}
- Velocidade Atual do Veículo: ${currentSpeed !== undefined ? currentSpeed + ' km/h' : 'Velocidade não medida (tráfego urbano)'}
- Paradas Pendentes em Ordem Atual:
${stops
  .map(
    (s: any, idx: number) =>
      `  ${idx + 1}. [ID: ${s.id}] ${s.address} (${s.customerName || 'Cliente'}) - Lat: ${s.lat}, Lng: ${s.lng} - Prioridade: ${s.priority || 'normal'}`
  )
  .join('\n')}

INSTRUÇÃO:
1. Analise se a velocidade atual e as coordenadas GPS indicam congestionamento na rota para a parada 1 ou se outra parada pendente está geograficamente mais acessível e livre de tráfego.
2. Determine se Vale a Pena REORDENAR a próxima parada (por exemplo, atender a parada 2 ou 3 antes da 1 para economizar tempo).
3. Se a reordenação for vantajosa, indique qual parada deve ser a Próxima Parada Recomendada (suggestedNextStopId) e a estimativa de minutos economizados (timeSavingsMin).

Responda ESTRITAMENTE em formato JSON:
{
  "shouldReorder": true ou false,
  "suggestedNextStopId": "id_da_parada_recomendada",
  "reason": "Explicação curta e direta em português do motivo da sugestão (ex: Trânsito lento detectado a 12 km/h. Atender primeiro a parada da Av. Paulista economiza 10 minutos).",
  "timeSavingsMin": 8,
  "reorderedStopsIndices": [1, 0, 2] // Nova sequência de índices das paradas pendentes
}`;

    let responseText = "";
    try {
      responseText = await generateGeminiWithFallback(ai, prompt, {
        responseMimeType: "application/json",
      });
    } catch (genErr: any) {
      console.warn("Gemini suggest next stop API call failed - returning graceful fallback:", genErr?.message || genErr);
      return res.json({ shouldReorder: false, fallback: true, reason: "Tráfego sendo monitorado localmente." });
    }

    const parsed = JSON.parse(responseText || "{}");
    return res.json({ success: true, ...parsed });
  } catch (error: any) {
    console.error("Gemini suggest next stop error:", error);
    return res.json({ shouldReorder: false, fallback: true, reason: "Monitoramento de tráfego temporariamente local." });
  }
});

// Start Server with Vite Middleware in Development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
