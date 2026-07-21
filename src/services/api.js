// Serviço de integração oficial com a API de Licitações do PNCP (Portal Nacional de Contratações Públicas)

function formatarDataYYYYMMDD(data) {
  const yyyy = data.getFullYear();
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

// Função para buscar dados reais de licitações no PNCP
async function fetchPNCPData(filters = {}) {
  const hoje = new Date();
  // Janela ideal de 7 dias no futuro para resposta ultra-rápida do banco do governo
  const seteDiasNoFuturo = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dataFinalStr = formatarDataYYYYMMDD(seteDiasNoFuturo);

  let response;

  // 1ª Tentativa: Serverless Function da Vercel (/api/pncp)
  try {
    response = await fetch(`/api/pncp?dataFinal=${dataFinalStr}&pagina=1&tamanhoPagina=50`, {
      headers: { 'accept': 'application/json' }
    });
  } catch (err) {
    console.warn("Falha de rede na função serverless /api/pncp");
  }

  // Se a serverless der 504 (timeout) ou não responder OK, tenta o proxy direto do Vercel Rewrites
  if (!response || !response.ok) {
    console.warn("Serverless /api/pncp não retornou 200 (Status: " + (response ? response.status : 'offline') + "). Usando proxy direto Vercel /api-pncp...");
    
    const urlDirect = `/api-pncp/v1/contratacoes/proposta?dataFinal=${dataFinalStr}&pagina=1&tamanhoPagina=50`;
    try {
      response = await fetch(urlDirect, {
        headers: { 'accept': 'application/json' }
      });
    } catch (e) {
      console.error("Falha também no proxy direto:", e);
    }
  }

  if (!response || !response.ok) {
    let errorDetail = "";
    if (response) {
      try {
        const errJson = await response.json();
        errorDetail = errJson.details || errJson.upstreamMessage || errJson.error || "";
      } catch(e) {}
    }

    const statusStr = response ? response.status : 'Timeout';
    if (statusStr === 504) {
      throw new Error("O servidor oficial do PNCP demorou para responder (Timeout 504). O portal do governo pode estar sobrecarregado no momento. Tente novamente em instantes.");
    }
    throw new Error(`Falha na conexão com os servidores do PNCP (Código ${statusStr}). ${errorDetail}`);
  }

  const result = await response.json();
  const items = result.data || result;

  if (!Array.isArray(items)) {
    throw new Error("Resposta inválida da API do PNCP. O formato de dados recebido não é uma lista.");
  }

  return items.map((item, idx) => {
    const isComprasGov = item.usuarioNome?.toLowerCase().includes('compras.gov') || 
                         item.linkSistemaOrigem?.toLowerCase().includes('compras.gov');

    // Mapear situacaoCompraNome oficial do PNCP ("Divulgada no PNCP") para status "Aberto"
    let statusFormatado = 'Aberto';
    if (item.situacaoCompraNome) {
      const situacaoLower = item.situacaoCompraNome.toLowerCase();
      if (situacaoLower.includes('divulgada') || situacaoLower.includes('proposta') || situacaoLower.includes('abert')) {
        statusFormatado = 'Aberto';
      } else {
        statusFormatado = item.situacaoCompraNome;
      }
    }

    return {
      id: `pncp-${item.numeroControlePNCP || item.sequencialCompra || idx}`,
      numeroControlePNCP: item.numeroControlePNCP || 'N/A',
      cnpjOrgao: item.orgaoEntidade?.cnpj || 'N/A',
      orgao: item.orgaoEntidade?.razaoSocial || item.orgaoSubrogado?.razaoSocial || 'Órgão Público',
      unidadeOrgao: item.unidadeOrgao?.nomeUnidade || '',
      objeto: item.objetoCompra || item.descricao || 'Objeto de licitação registrado no portal oficial',
      modalidade: item.modalidadeNome || item.tipoInstrumentoConvocatorioNome || 'Pregão Eletrônico',
      modoDisputa: item.modoDisputaNome || 'Não informado',
      amparoLegal: item.amparoLegal?.nome || item.amparoLegal?.descricao || 'Lei 14.133/2021',
      processo: item.processo || item.numeroCompra || 'N/A',
      status: statusFormatado,
      situacaoOriginal: item.situacaoCompraNome || 'Divulgada no PNCP',
      dataAbertura: item.dataAberturaProposta || item.dataPublicacaoPncp || new Date().toISOString(),
      dataEncerramento: item.dataEncerramentoProposta || null,
      valorEstimado: parseFloat(item.valorTotalEstimado || 0),
      cidade: item.unidadeOrgao?.municipioNome || 'Não informada',
      estado: item.unidadeOrgao?.ufSigla || 'BR',
      linkEdital: item.linkSistemaOrigem || item.linkProcessoEletronico || `https://pncp.gov.br/app/editais`,
      fonte: isComprasGov ? 'Compras.gov.br' : (item.usuarioNome || 'PNCP')
    };
  });
}

export async function fetchLicitacoes(filters = {}) {
  let realResults = [];

  try {
    realResults = await fetchPNCPData(filters);
  } catch (err) {
    console.error("Erro ao consultar PNCP:", err);
    throw new Error(`Falha ao conectar com o Portal Nacional de Contratações Públicas (PNCP): ${err.message}`);
  }

  if (!realResults || realResults.length === 0) {
    throw new Error("Nenhuma licitação ativa foi retornada pelos servidores oficiais no período consultado.");
  }

  // Filtrar apenas dados reais recebidos
  return realResults.filter(item => {
    let match = true;

    // Filtro inteligente por palavras-chave com condição "OU" (separado por vírgula ou espaço)
    if (filters.keyword && filters.keyword.trim() !== '') {
      // Separa os termos pela vírgula
      const termos = filters.keyword
        .toLowerCase()
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      
      const textoParaBusca = `${item.objeto} ${item.orgao} ${item.cidade}`.toLowerCase();
      
      // Verifica se o texto da licitação inclui PELO MENOS UM dos termos buscados
      const possuiMatch = termos.some(termo => textoParaBusca.includes(termo));
      
      if (!possuiMatch) {
        match = false;
      }
    }

    // Filtro por Estado (UF)
    if (filters.estado && filters.estado !== '') {
      if (item.estado.toUpperCase() !== filters.estado.toUpperCase()) match = false;
    }

    // Filtro por Modalidade
    if (filters.modalidade && filters.modalidade !== '') {
      if (!item.modalidade.toLowerCase().includes(filters.modalidade.toLowerCase())) match = false;
    }

    // Filtro por Status
    if (filters.status && filters.status !== '') {
      if (item.status.toLowerCase() !== filters.status.toLowerCase()) match = false;
    }

    // Filtro por Fonte (PNCP vs Compras.gov.br)
    if (filters.fonte && filters.fonte !== '') {
      if (item.fonte.toLowerCase() !== filters.fonte.toLowerCase()) match = false;
    }

    return match;
  });
}


