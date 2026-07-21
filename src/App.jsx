import React, { useState, useEffect } from 'react';
import { 
  Search, Bookmark, BookmarkPlus, Calendar, MapPin, 
  Building, DollarSign, Filter, X, FileText, ExternalLink,
  ChevronDown, AlertCircle, RefreshCw, CheckCircle2, ShieldCheck, Sparkles
} from 'lucide-react';
import { fetchLicitacoes } from './services/api';

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const formatarMoeda = (valor) => {
  if (!valor || isNaN(valor)) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const formatarData = (dataString) => {
  if (!dataString) return 'A definir';
  try {
    const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dataString).toLocaleDateString('pt-BR', options);
  } catch (e) {
    return dataString;
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [licitacoes, setLicitacoes] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    keyword: '',
    estado: '',
    modalidade: '',
    status: 'Aberto',
    fonte: '',
    dataAbertura: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem('@LicitacoesApp:saved');
    if (saved) {
      try {
        setSavedItems(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar salvos:", e);
      }
    }
    handleSearch();
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchLicitacoes(filters);
      setLicitacoes(data);
    } catch (error) {
      console.error("Erro ao buscar licitações:", error);
      setErrorMessage(error.message || "Erro de conexão ao consultar as APIs oficiais.");
      setLicitacoes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      keyword: '',
      estado: '',
      modalidade: '',
      status: 'Aberto',
      fonte: '',
      dataAbertura: ''
    });
  };

  const toggleSaveItem = (item) => {
    setSavedItems(prev => {
      const isSaved = prev.some(saved => saved.id === item.id);
      let newSaved;
      if (isSaved) {
        newSaved = prev.filter(saved => saved.id !== item.id);
      } else {
        newSaved = [...prev, item];
      }
      localStorage.setItem('@LicitacoesApp:saved', JSON.stringify(newSaved));
      return newSaved;
    });
  };

  const isSaved = (id) => savedItems.some(item => item.id === id);

  const LicitacaoCard = ({ item }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all duration-200 mb-4 group">
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
              item.status === 'Aberto' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${item.status === 'Aberto' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              {item.status}
            </span>
            
            <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
              {item.modalidade}
            </span>

            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              item.fonte === 'PNCP' 
                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              {item.fonte}
            </span>
          </div>

          <h3 className="text-lg font-bold text-slate-800 leading-snug mb-3 group-hover:text-blue-600 transition-colors cursor-pointer" onClick={() => setSelectedItem(item)}>
            {item.objeto}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-600 mb-2">
            <div className="flex items-center gap-2">
              <Building size={16} className="text-slate-400 shrink-0"/>
              <span className="truncate max-w-[220px]" title={item.orgao}>{item.orgao}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-slate-400 shrink-0"/>
              <span>{item.cidade} - {item.estado}</span>
            </div>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <DollarSign size={16} className="text-emerald-600 shrink-0"/>
              <span className="text-emerald-700">{formatarMoeda(item.valorEstimado)}</span>
            </div>
          </div>
        </div>

        <div className="flex sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <button 
            onClick={() => toggleSaveItem(item)}
            className={`flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
              isSaved(item.id) 
                ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100' 
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isSaved(item.id) ? <Bookmark size={16} fill="currentColor" /> : <BookmarkPlus size={16} />}
            {isSaved(item.id) ? 'Salvo' : 'Salvar'}
          </button>
          <button 
            onClick={() => setSelectedItem(item)}
            className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm"
          >
            <FileText size={16} />
            Detalhes
          </button>
        </div>
      </div>
    </div>
  );

  const DetalhesModal = () => {
    if (!selectedItem) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
          
          <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                <FileText size={20} />
              </div>
              Detalhes da Licitação
            </h2>
            <button onClick={() => setSelectedItem(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                selectedItem.status === 'Aberto' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                Status: {selectedItem.status}
              </span>
              <span className="text-xs font-medium bg-slate-100 text-slate-800 px-3 py-1.5 rounded-full border border-slate-200">
                {selectedItem.modalidade}
              </span>
              <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
                Fonte: {selectedItem.fonte}
              </span>
            </div>

            <div>
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Objeto da Contratação</h3>
              <p className="text-slate-800 text-base leading-relaxed font-medium bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                {selectedItem.objeto}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Órgão Publicador</h3>
                <p className="text-slate-800 font-semibold text-sm flex items-center gap-2">
                  <Building size={18} className="text-blue-600 shrink-0"/> {selectedItem.orgao}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Localidade</h3>
                <p className="text-slate-800 font-semibold text-sm flex items-center gap-2">
                  <MapPin size={18} className="text-blue-600 shrink-0"/> {selectedItem.cidade} - {selectedItem.estado}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Data / Horário de Abertura</h3>
                <p className="text-slate-800 font-semibold text-sm flex items-center gap-2">
                  <Calendar size={18} className="text-blue-600 shrink-0"/> {formatarData(selectedItem.dataAbertura)}
                </p>
              </div>

              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Valor Estimado</h3>
                <p className="text-emerald-700 font-extrabold text-lg flex items-center gap-1.5">
                  <DollarSign size={20} /> {formatarMoeda(selectedItem.valorEstimado)}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <button 
              onClick={() => toggleSaveItem(selectedItem)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
            >
              {isSaved(selectedItem.id) ? <Bookmark fill="currentColor" size={18} className="text-blue-600"/> : <BookmarkPlus size={18}/>}
              {isSaved(selectedItem.id) ? 'Remover dos Salvos' : 'Salvar na Mesa de Análise'}
            </button>
            
            <a 
              href={selectedItem.linkEdital}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
            >
              Acessar Edital Oficial <ExternalLink size={16} />
            </a>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('search')}>
              <div className="bg-gradient-to-tr from-blue-700 to-blue-500 p-2.5 rounded-xl text-white shadow-md">
                <Search size={22} />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">
                  Portal<span className="text-blue-600">LicitaTudo</span>
                </h1>
                <p className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase">Busca Aberta Oficial</p>
              </div>
            </div>

            <nav className="flex gap-2">
              <button 
                onClick={() => setActiveTab('search')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'search' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Search size={18} /> Oportunidades
              </button>
              
              <button 
                onClick={() => setActiveTab('saved')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'saved' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Bookmark size={18} /> Mesa de Análise 
                {savedItems.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-extrabold">{savedItems.length}</span>
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {activeTab === 'search' && (
          <div className="animate-in fade-in duration-300">
            <form onSubmit={handleSearch} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mb-8">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Search size={20} />
                  </div>
                  <input 
                    type="text" 
                    name="keyword"
                    value={filters.keyword}
                    onChange={handleFilterChange}
                    className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium"
                    placeholder="Digite a palavra-chave (ex: informática, limpeza, frota, papel A4)..."
                  />
                </div>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0">
                  <Search size={18} />
                  Pesquisar
                </button>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <button 
                    type="button" 
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors py-1"
                  >
                    <Filter size={16} className="text-blue-600"/> 
                    {showFilters ? 'Ocultar Filtros Avançados' : 'Filtros Avançados'}
                    <ChevronDown size={16} className={`transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
                  </button>

                  {(filters.estado || filters.modalidade || filters.fonte || filters.keyword) && (
                    <button 
                      type="button" 
                      onClick={handleClearFilters}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>

                {showFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Estado (UF)</label>
                      <select name="estado" value={filters.estado} onChange={handleFilterChange} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">Todos os Estados</option>
                        {ESTADOS_BRASIL.map(uf => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Modalidade</label>
                      <select name="modalidade" value={filters.modalidade} onChange={handleFilterChange} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">Todas as Modalidades</option>
                        <option value="Pregão Eletrônico">Pregão Eletrônico</option>
                        <option value="Concorrência">Concorrência Pública</option>
                        <option value="Dispensa">Dispensa de Licitação</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Portal Origem (API)</label>
                      <select name="fonte" value={filters.fonte} onChange={handleFilterChange} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">Ambos (PNCP + Compras.gov.br)</option>
                        <option value="PNCP">Apenas PNCP</option>
                        <option value="Compras.gov.br">Apenas Compras.gov.br</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Status</label>
                      <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="Aberto">Aberto (Recebendo Propostas)</option>
                        <option value="Em Andamento">Em Andamento</option>
                        <option value="">Todos</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </form>

            <div>
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  Licitações Encontradas
                </h2>
                <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  {licitacoes.length} oportunidades abertas
                </span>
              </div>

              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-500 bg-white rounded-3xl border border-slate-100">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                  <p className="font-semibold text-slate-700">Consultando APIs oficiais (PNCP e Compras.gov.br)...</p>
                  <p className="text-xs text-slate-400 mt-1">Carregando apenas licitações reais em tempo real</p>
                </div>
              ) : errorMessage ? (
                <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center flex flex-col items-center">
                  <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl mb-3">
                    <AlertCircle size={36} />
                  </div>
                  <h3 className="text-lg font-bold text-rose-900 mb-1">Falha na Conexão com as APIs Oficiais</h3>
                  <p className="text-rose-700 max-w-lg text-sm mb-6 leading-relaxed">{errorMessage}</p>
                  <button 
                    onClick={() => handleSearch()} 
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={16} /> Tentar Novamente
                  </button>
                </div>
              ) : licitacoes.length > 0 ? (
                <div className="space-y-4">
                  {licitacoes.map(item => (
                    <LicitacaoCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center">
                  <div className="p-4 bg-slate-100 text-slate-400 rounded-2xl mb-4">
                    <Search size={36} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Nenhuma licitação encontrada com estes filtros</h3>
                  <p className="text-slate-500 max-w-md text-sm mb-6">Tente remover os filtros ou buscar por palavras-chave mais genéricas.</p>
                  <button onClick={handleClearFilters} className="px-5 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl text-sm hover:bg-blue-100 transition-colors">
                    Limpar todos os filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 text-amber-700 p-3 rounded-2xl">
                  <Bookmark size={26} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Mesa de Análise</h2>
                  <p className="text-slate-500 text-sm">Licitações separadas para estudo detalhado do edital e participação.</p>
                </div>
              </div>
            </div>

            {savedItems.length > 0 ? (
              <div className="space-y-4">
                {savedItems.map(item => (
                  <LicitacaoCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center flex flex-col items-center">
                <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl mb-4">
                  <BookmarkPlus size={36} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Sua lista de análise está vazia</h3>
                <p className="text-slate-500 text-sm max-w-md mb-6">Navegue pelas oportunidades e clique em "Salvar" para guardar as licitações do seu interesse.</p>
                <button 
                  onClick={() => setActiveTab('search')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all"
                >
                  Explorar Licitações Abertas
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Dados sincronizados em tempo real com os portais oficiais do Governo Federal.</span>
          </div>
          <p>© 2026 Portal LicitaTudo. Todos os direitos reservados.</p>
        </div>
      </footer>

      <DetalhesModal />
    </div>
  );
}
