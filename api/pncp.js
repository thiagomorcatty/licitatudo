// Vercel Serverless Function - Proxy oficial para o PNCP (Portal Nacional de Contratações Públicas)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    const dataHojeFormatada = `${yyyy}${mm}${dd}`;

    const dataFinal = req.query.dataFinal || dataHojeFormatada;
    const pagina = req.query.pagina || '1';
    const tamanhoPagina = req.query.tamanhoPagina || '50';

    // URL oficial do PNCP para consulta de contratações com propostas abertas
    const params = new URLSearchParams({
      dataFinal: dataFinal,
      pagina: pagina,
      tamanhoPagina: tamanhoPagina
    });

    const pncpUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?${params.toString()}`;

    const pncpResponse = await fetch(pncpUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const textResponse = await pncpResponse.text();

    if (!pncpResponse.ok) {
      console.error("Erro da API PNCP:", pncpResponse.status, textResponse.substring(0, 500));
      return res.status(pncpResponse.status).json({
        error: "Falha na resposta do PNCP",
        upstreamStatus: pncpResponse.status,
        upstreamMessage: textResponse.substring(0, 300)
      });
    }

    let data;
    try {
      data = JSON.parse(textResponse);
    } catch (e) {
      return res.status(502).json({
        error: "Resposta do PNCP não é um JSON válido",
        details: textResponse.substring(0, 300)
      });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro interno no handler do PNCP:", error);
    return res.status(500).json({
      error: "Erro interno no servidor intermediário do LicitaTudo",
      details: error.message
    });
  }
}
