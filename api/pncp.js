// Vercel Serverless Function - Proxy oficial para o PNCP

export const config = {
  maxDuration: 15, // aumenta o tempo limite se disponível na Vercel
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const hoje = new Date();
  const fmt = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');

  // Função auxiliar para chamar o PNCP com timeout interno de 7 segundos
  const fetchWithTimeout = async (dataFinal, pagina = '1', tamanho = '50') => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7 segundos

    const params = new URLSearchParams({
      dataFinal: dataFinal,
      pagina: pagina,
      tamanhoPagina: tamanho
    });

    const pncpUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?${params.toString()}`;

    try {
      const response = await fetch(pncpUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    let dataFinalParam = req.query.dataFinal;

    // Se não passou dataFinal, pega 7 dias no futuro (janela ideal rápida)
    if (!dataFinalParam) {
      dataFinalParam = fmt(new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000));
    }

    let pncpResponse;

    try {
      // Primeira tentativa com o parâmetro recebido
      pncpResponse = await fetchWithTimeout(dataFinalParam, req.query.pagina || '1', req.query.tamanhoPagina || '50');
    } catch (e1) {
      console.warn("Primeira tentativa no PNCP estourou tempo (timeout). Tentando janela curta de 7 dias...");
      // Se estourar o tempo (timeout), tenta com janela rápida de 7 dias no futuro
      const dataSeteDias = fmt(new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000));
      pncpResponse = await fetchWithTimeout(dataSeteDias, '1', '50');
    }

    const textResponse = await pncpResponse.text();

    if (!pncpResponse.ok) {
      console.error("PNCP respondeu com status de erro:", pncpResponse.status);
      return res.status(pncpResponse.status).json({
        error: "Falha ao obter resposta do PNCP",
        upstreamStatus: pncpResponse.status,
        upstreamMessage: textResponse.substring(0, 300)
      });
    }

    const data = JSON.parse(textResponse);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro interno/timeout no PNCP Proxy:", error);
    return res.status(504).json({
      error: "O servidor do PNCP demorou muito para responder (Timeout).",
      details: error.message
    });
  }
}
