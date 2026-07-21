// Vercel Serverless Function - Proxy oficial para o PNCP

export const config = {
  maxDuration: 15,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const hoje = new Date();
  const fmt = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');

  const fetchWithTimeout = async (paramsObj, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const searchParams = new URLSearchParams(paramsObj);
    const pncpUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?${searchParams.toString()}`;

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
    const tresDias = fmt(new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000));
    
    // Filtros justos e diretos
    const queryParams = {
      dataFinal: req.query.dataFinal || tresDias,
      pagina: req.query.pagina || '1',
      tamanhoPagina: req.query.tamanhoPagina || '30'
    };

    if (req.query.codigoModalidadeContratacao) {
      queryParams.codigoModalidadeContratacao = req.query.codigoModalidadeContratacao;
    }
    if (req.query.uf) {
      queryParams.ufSigla = req.query.uf;
    }

    let pncpResponse;

    try {
      pncpResponse = await fetchWithTimeout(queryParams, 8000);
    } catch (e1) {
      console.warn("Primeira busca estourou tempo (timeout). Aplicando filtro por Pregão Eletrônico (codigoModalidadeContratacao=8)...");
      queryParams.codigoModalidadeContratacao = '8'; // Pregão Eletrônico
      queryParams.tamanhoPagina = '20';
      pncpResponse = await fetchWithTimeout(queryParams, 8000);
    }

    const textResponse = await pncpResponse.text();

    if (!pncpResponse.ok) {
      return res.status(pncpResponse.status).json({
        error: "Falha na consulta ao PNCP",
        upstreamStatus: pncpResponse.status,
        upstreamMessage: textResponse.substring(0, 300)
      });
    }

    const data = JSON.parse(textResponse);
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro no PNCP Proxy:", error.message);
    return res.status(504).json({
      error: "O servidor do PNCP demorou muito para responder.",
      details: error.message
    });
  }
}
