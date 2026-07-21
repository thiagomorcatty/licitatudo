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

  // Para o endpoint /contratacoes/proposta:
  // dataInicial = HOJE
  // dataFinal = X dias no FUTURO (janela de encerramento das propostas)
  const buscaComDias = async (diasNoFuturo) => {
    const dataFim = new Date(hoje.getTime() + diasNoFuturo * 24 * 60 * 60 * 1000);
    const dataInicial = formatarDataYYYYMMDD(hoje);
    const dataFinal = formatarDataYYYYMMDD(dataFim);

    const url = `/api-pncp/api/consulta/v1/contratacoes/proposta?dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=1&tamanhoPagina=50`;

    const response = await fetch(url, {
      headers: { 'accept': 'application/json' }
    });

    return { response, status: response.status };
  };

  let resObj;
  try {
    // Busca oportunidades que encerram nos próximos 30 dias
    resObj = await buscaComDias(30);
    if (resObj.status === 500) {
      console.warn("PNCP 500. Tentando janela de 15 dias no futuro...");
      resObj = await buscaComDias(15);
    }
    if (resObj.status === 500) {
      console.warn("PNCP 500. Tentando janela de 7 dias no futuro...");
      resObj = await buscaComDias(7);
    }
  } catch (e) {
    throw new Error(`Não foi possível conectar ao servidor do PNCP: ${e.message}`);
  }

  const { response } = resObj;

  if (!response.ok) {
    if (response.status === 500) {
      throw new Error("O servidor do Portal Nacional de Contratações Públicas (PNCP) está temporariamente indisponível ou em manutenção no momento (Erro 500 no Banco de Dados do Governo). Tente novamente em alguns instantes.");
    }
    throw new Error(`Servidor PNCP respondeu com código ${response.status} (${response.statusText})`);
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


