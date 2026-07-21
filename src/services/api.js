// Serviço de integração com as APIs de Licitações Oficiais (PNCP e Compras.gov.br)

// Função auxiliar para buscar no PNCP
async function fetchPNCPData(filters) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dataInicial = `${yyyy}${mm}01`;

  const url = `/api-pncp/api/consulta/v1/contratacoes/proposta?dataInicial=${dataInicial}&pagina=1&tamanhoPagina=20`;
  
  const response = await fetch(url, { 
    headers: { 'accept': 'application/json' } 
  });

  if (!response.ok) {
    throw new Error(`PNCP API respondeu com status ${response.status} (${response.statusText})`);
  }

  const result = await response.json();
  const data = result.data || result;
  if (!Array.isArray(data)) {
    throw new Error("Formato de resposta inválido retornado pela API do PNCP");
  }

  return data.map((item, idx) => ({
    id: `pncp-real-${item.numeroItem || item.sequencialContratacao || idx}`,
    orgao: item.orgaoEntidade?.razaoSocial || item.orgaoSubrogado?.razaoSocial || 'Órgão Público (PNCP)',
    objeto: item.objetoCompra || item.descricao || 'Objeto não especificado no registro do PNCP',
    modalidade: item.modalidadeNome || item.modalidadeContratacaoNome || 'Pregão Eletrônico',
    status: 'Aberto',
    dataAbertura: item.dataAberturaProposta || item.dataPublicacaoPncp || new Date().toISOString(),
    valorEstimado: parseFloat(item.valorTotalEstimado || item.valorEstimado || 0),
    cidade: item.unidadeOrgao?.municipioNome || 'Não informada',
    estado: item.unidadeOrgao?.ufSigla || 'BR',
    linkEdital: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais`,
    fonte: 'PNCP'
  }));
}

// Função auxiliar para buscar no Compras.gov.br
async function fetchComprasGovData(filters) {
  const url = `/api-comprasgov/modulo-legado/api/v1/licitacoes?tamanhoPagina=20`;
  
  const response = await fetch(url, { 
    headers: { 'accept': 'application/json' } 
  });

  if (!response.ok) {
    throw new Error(`Compras.gov.br API respondeu com status ${response.status} (${response.statusText})`);
  }

  const result = await response.json();
  const items = result._embedded?.licitacoes || result.resultado || [];
  if (!Array.isArray(items)) {
    throw new Error("Formato de resposta inválido retornado pela API do Compras.gov.br");
  }

  return items.map((item, idx) => ({
    id: `compras-real-${item.id || idx}`,
    orgao: item.orgao_emissor || item.nome_orgao || 'Governo Federal (Compras.gov.br)',
    objeto: item.objeto || 'Licitação registrada no Compras.gov.br',
    modalidade: item.modalidade_licitacao || 'Pregão Eletrônico',
    status: 'Aberto',
    dataAbertura: item.data_abertura_proposta || new Date().toISOString(),
    valorEstimado: parseFloat(item.valor_estimado || 0),
    cidade: item.municipio || 'Capital',
    estado: item.uf || 'DF',
    linkEdital: item.link_edital || 'https://compras.gov.br',
    fonte: 'Compras.gov.br'
  }));
}

export async function fetchLicitacoes(filters = {}) {
  const promises = [];
  const fontesSolicitadas = [];

  const buscarPNCP = !filters.fonte || filters.fonte === 'PNCP';
  const buscarCompras = !filters.fonte || filters.fonte === 'Compras.gov.br';

  if (buscarPNCP) {
    promises.push(fetchPNCPData(filters));
    fontesSolicitadas.push('PNCP');
  }

  if (buscarCompras) {
    promises.push(fetchComprasGovData(filters));
    fontesSolicitadas.push('Compras.gov.br');
  }

  const results = await Promise.allSettled(promises);

  let realResults = [];
  let errorsEncountered = [];

  results.forEach((res, index) => {
    if (res.status === 'fulfilled') {
      realResults = realResults.concat(res.value);
    } else {
      errorsEncountered.push(`${fontesSolicitadas[index]}: ${res.reason?.message || 'Falha de conexão'}`);
    }
  });

  // Se NENHUMA API respondeu com sucesso e erros foram encontrados, lança a exceção para exibição da mensagem no frontend
  if (realResults.length === 0 && errorsEncountered.length > 0) {
    throw new Error(
      `Não foi possível consultar os portais oficiais. Detalhes: ${errorsEncountered.join(' | ')}`
    );
  }

  // Filtrar apenas dados reais recebidos
  return realResults.filter(item => {
    let match = true;

    // Filtro por palavra-chave (pesquisa em Objeto, Órgão e Cidade)
    if (filters.keyword && filters.keyword.trim() !== '') {
      const query = filters.keyword.toLowerCase().trim();
      const matchObjeto = item.objeto.toLowerCase().includes(query);
      const matchOrgao = item.orgao.toLowerCase().includes(query);
      const matchCidade = item.cidade.toLowerCase().includes(query);
      if (!matchObjeto && !matchOrgao && !matchCidade) match = false;
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

