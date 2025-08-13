// Log para garantir que o app.js foi carregado corretamente
console.log('app.js carregado');


// Configuração da API - Usar hostname dinâmico para acesso de diferentes máquinas
const API_URL = `${window.location.protocol}//${window.location.host}/api`;
console.log('API URL configurada:', API_URL);

// Variáveis globais
let itens = [];
let movimentacoes = [];



// Funções para chamadas da API
async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
        const fullUrl = `${API_URL}${endpoint}`;
        console.log(`Fazendo requisição ${method} para: ${fullUrl}`);
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        console.log('Opções da requisição:', options);
        
        const response = await fetch(fullUrl, options);
        
        if (!response.ok) {
            console.error(`Erro HTTP ${response.status} ao acessar ${fullUrl}`);
            console.error('Detalhes da resposta:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries([...response.headers]),
                url: response.url
            });
            throw new Error(`HTTP error! status: ${response.status}, url: ${fullUrl}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erro detalhado na API:', error);
        console.error('Informações da conexão:', {
            'API_URL': API_URL,
            'window.location.origin': window.location.origin,
            'window.location.host': window.location.host,
            'window.location.protocol': window.location.protocol,
            'window.location.pathname': window.location.pathname,
            'navigator.onLine': navigator.onLine
        });
        throw error;
    }
}

// Carregar dados da API
async function carregarDados() {
    try {
        // Primeiro verificar se a API está disponível usando o endpoint de health check
        try {
            const health = await apiRequest('/health');
            console.log('API health check:', health);
            
            // Se o banco de dados não estiver conectado, mostrar erro específico
            if (health.database && health.database.status !== 'connected') {
                throw new Error(`Problema de conexão com o banco de dados: ${health.database.error || 'status ' + health.database.status}`);
            }
        } catch (healthError) {
            console.error('Falha no health check da API:', healthError);
            // Continuar mesmo com falha no health check para tentar carregar os dados
        }
        
        // Tentar carregar os dados da API
        itens = await apiRequest('/itens');
        console.log(`Carregados ${itens.length} itens do estoque`);
        
        movimentacoes = await apiRequest('/movimentacoes');
        console.log(`Carregadas ${movimentacoes.length} movimentações`);
    } catch (error) {
        console.error('Erro detalhado ao carregar dados:', error);
        
        // Mensagem de erro mais detalhada para o usuário
        let mensagemErro = 'Erro ao carregar dados: ' + error.message;
        
        // Adicionar dicas para erros 404 (acesso de outras máquinas)
        if (error.message && error.message.includes('404')) {
            mensagemErro += '\n\nPossíveis causas:' +
                '\n- Você está acessando de uma máquina diferente da que hospeda o banco' +
                '\n- O servidor da API não está rodando ou não está acessível' +
                '\n- O caminho da API está incorreto' +
                '\n\nSugestões:' +
                '\n- Verifique se o servidor está rodando' +
                '\n- Verifique se você está usando a URL correta' +
                '\n- Tente acessar diretamente na máquina que hospeda o banco';
        }
        
        alert(mensagemErro);
    }
}

// Navegação entre seções
function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    const navLinks = document.querySelectorAll('.nav-link');
    
    sections.forEach(section => section.classList.remove('active'));
    navLinks.forEach(link => link.classList.remove('active'));
    
    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.classList.add('active');
    }
    
    // Encontrar e ativar o link correspondente
    const activeLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Atualizar dados específicos da seção
    if (sectionId === 'estoque') {
        atualizarControleEstoque().catch(error => {
            console.error('Erro ao atualizar controle de estoque:', error);
        });
    } else if (sectionId === 'retirada') {
        atualizarSelectRetirada().catch(error => {
            console.error('Erro ao atualizar select de retirada:', error);
        });
    } else if (sectionId === 'relatorio1') {
        gerarRelatorioEstoque().catch(error => {
            console.error('Erro ao gerar relatório de estoque:', error);
        });
    } else if (sectionId === 'relatorio2') {
        gerarRelatorioMovimentacao().catch(error => {
            console.error('Erro ao gerar relatório de movimentação:', error);
        });
    } else if (sectionId === 'dashboard') {
        loadDashboardData();
    }
    
    // Fechar sidebar no mobile após navegação
    if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('show');
        }
    }
}

// Cadastro de item
document.getElementById('itemForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const item = {
        nome: document.getElementById('nome').value.trim(),
        serie: document.getElementById('serie').value.trim(),
        descricao: document.getElementById('descricao').value.trim(),
        origem: document.getElementById('origem').value.trim(),
        destino: document.getElementById('destino').value.trim(),
        valor: parseFloat(document.getElementById('valor').value) || 0,
        nf: document.getElementById('nf').value.trim(),
        quantidade: parseInt(document.getElementById('quantidade').value),
        minimo: parseInt(document.getElementById('minimo').value),
        ideal: parseInt(document.getElementById('ideal').value),
        infos: document.getElementById('infos').value.trim()
    };
    
    try {
        await apiRequest('/itens', 'POST', item);
        alert('Item cadastrado com sucesso!');
        limparFormulario();
        await carregarDados();
    } catch (error) {
        alert('Erro ao cadastrar item: ' + error.message);
    }
});

function limparFormulario() {
    document.getElementById('itemForm').reset();
}

// Controle de estoque
async function atualizarControleEstoque() {
    // Verificar se estamos na seção de estoque antes de tentar atualizar
    const estoqueSection = document.getElementById('estoque');
    if (!estoqueSection || !estoqueSection.classList.contains('active')) {
        return; // Não atualizar se não estiver na seção de estoque
    }
    
    // Não recarregar dados aqui, apenas atualizar a exibição
    filtrarEstoque();
    
    let itensAbaixoMinimo = itens.filter(item => item.quantidade < item.minimo);
    let itensAbaixoIdeal = itens.filter(item => item.quantidade < item.ideal);
    
    // Atualizar estatísticas
    const totalItensElement = document.getElementById('totalItens');
    const itensAbaixoMinimoElement = document.getElementById('itensAbaixoMinimo');
    const itensAbaixoIdealElement = document.getElementById('itensAbaixoIdeal');
    
    if (totalItensElement) totalItensElement.textContent = itens.length;
    if (itensAbaixoMinimoElement) itensAbaixoMinimoElement.textContent = itensAbaixoMinimo.length;
    if (itensAbaixoIdealElement) itensAbaixoIdealElement.textContent = itensAbaixoIdeal.length;
    
    // Atualizar alertas se existir o elemento
    const alertas = document.getElementById('alertas');
    if (alertas) {
        let alertasTexto = [];
        itensAbaixoMinimo.forEach(item => {
            alertasTexto.push(`${item.nome} está abaixo do mínimo (${item.quantidade}/${item.minimo})`);
        });
        
        if (alertasTexto.length > 0) {
            alertas.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Alertas de Estoque:</strong><br>
                    ${alertasTexto.join('<br>')}
                </div>
            `;
        } else {
            alertas.innerHTML = '';
        }
    }
}

// Filtro e pesquisa no controle de estoque
function filtrarEstoque() {
    const pesquisaElement = document.getElementById('pesquisaEstoque');
    const statusFiltroElement = document.getElementById('filtroStatus');
    const ordenacaoElement = document.getElementById('ordenacao');
    
    // Verificar se os elementos existem antes de acessar suas propriedades
    if (!pesquisaElement || !statusFiltroElement) {
        console.warn('Elementos de filtro não encontrados, pulando filtragem');
        return;
    }
    
    const pesquisa = pesquisaElement.value.trim().toLowerCase();
    const statusFiltro = statusFiltroElement.value;
    const ordenacao = ordenacaoElement ? ordenacaoElement.value : 'nome'; // Valor padrão se não existir
    let itensFiltrados = itens.filter(item => {
        let nomeMatch = item.nome && item.nome.toLowerCase().includes(pesquisa);
        let wbsMatch = item.serie && item.serie.toLowerCase().includes(pesquisa);
        let status = 'ideal';
        if (item.quantidade < item.minimo) status = 'abaixo-minimo';
        else if (item.quantidade < item.ideal) status = 'abaixo-ideal';
        let statusMatch = !statusFiltro || status === statusFiltro;
        // Se pesquisa estiver vazia, mostrar todos
        if (!pesquisa) return statusMatch;
        return (nomeMatch || wbsMatch) && statusMatch;
    });
    // Ordenação
    if (ordenacao === 'nome') {
        itensFiltrados.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } else if (ordenacao === 'quantidade') {
        itensFiltrados.sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0));
    } else if (ordenacao === 'status') {
        const getStatus = x => (x.quantidade < x.minimo) ? 0 : (x.quantidade < x.ideal) ? 1 : 2;
        itensFiltrados.sort((a, b) => getStatus(a) - getStatus(b));
    }
    // Atualiza tabela
    const tbody = document.querySelector('#tabelaEstoque tbody');
    tbody.innerHTML = '';
    itensFiltrados.forEach(item => {
        const row = tbody.insertRow();
        let status = 'Ideal';
        let statusClass = 'status-ideal';
        if (item.quantidade < item.minimo) {
            status = 'Abaixo do Mínimo';
            statusClass = 'status-baixo';
        } else if (item.quantidade < item.ideal) {
            status = 'Abaixo do Ideal';
            statusClass = 'status-baixo';
        }
        row.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.serie || '-'}</td>
            <td>${item.quantidade}</td>
            <td>${item.minimo}</td>
            <td>${item.ideal}</td>
            <td><span class="${statusClass}">${status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="abrirModalEstoque(${item.id});event.stopPropagation();">
                    <i class="fas fa-plus"></i> Adicionar
                </button>
                <button class="btn btn-sm btn-secondary" onclick="abrirModalEditarItem(${item.id});event.stopPropagation();">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-sm btn-danger" onclick="removerItem(${item.id});event.stopPropagation();">
                    <i class="fas fa-trash"></i> Remover
                </button>
            </td>
        `;
        row.classList.add('cursor-pointer');
        row.addEventListener('click', function(e) {
            if (e.target.tagName === 'BUTTON') return;
            abrirModalEditarItem(item.id);


        });
    });
}

// Modal para adicionar estoque
function abrirModalEstoque(itemId) {
    document.getElementById('itemIdModal').value = itemId;
    const modal = document.getElementById('modalEstoque');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

function fecharModal() {
    const modal = document.getElementById('modalEstoque');
    modal.style.display = 'none';
    modal.classList.remove('show');
    document.getElementById('adicionarEstoqueForm').reset();
}

// Adicionar estoque
document.getElementById('adicionarEstoqueForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const itemId = document.getElementById('itemIdModal').value;
    const quantidade = parseInt(document.getElementById('quantidadeAdicionar').value);
    const observacao = document.getElementById('observacaoAdicionar').value;
    
    try {
        await apiRequest(`/itens/${itemId}/adicionar`, 'POST', {
            quantidade: quantidade,
            observacao: observacao
        });
        
        alert('Estoque adicionado com sucesso!');
        fecharModal();
         await carregarDados();
                await atualizarControleEstoque();
    } catch (error) {
        alert('Erro ao adicionar estoque: ' + error.message);
    }
});

// Remover item
async function removerItem(itemId) {
    if (confirm('Tem certeza que deseja remover este item?')) {
        try {
            await apiRequest(`/itens/${itemId}`, 'DELETE');
            alert('Item removido com sucesso!');
            await atualizarControleEstoque();
        } catch (error) {
            alert('Erro ao remover item: ' + error.message);
        }
    }
}

// Retirada de itens
async function atualizarSelectRetirada() {
    await carregarDados();
    
    // Atualiza o select de itens
    const select = document.getElementById('itemRetirada');
    select.innerHTML = '<option value="">Selecione um item...</option>';
    
    itens.forEach(item => {
        if (item.quantidade > 0) {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.nome} (Disponível: ${item.quantidade})`;
            select.appendChild(option);
        }
    });

    // Atualiza a lista de pacotes de requisição pendentes (para admins)
    const pacotesList = document.getElementById('pacotesPendentes');
    if (pacotesList) {
        try {
            const pacotes = await apiRequest('/pacotes/pendentes', 'GET');
            pacotesList.innerHTML = '';
            
            if (pacotes.length === 0) {
                pacotesList.innerHTML = '<p>Não há pacotes pendentes de aprovação.</p>';
            } else {
                pacotes.forEach(pacote => {
                    const div = document.createElement('div');
                    div.className = 'pacote-requisicao';
                    div.innerHTML = `
                        <h4>Pacote #${pacote.id}</h4>
                        <p><strong>Centro de Custo:</strong> ${pacote.centroCusto}</p>
                        <p><strong>Projeto:</strong> ${pacote.projeto}</p>
                        <p><strong>Justificativa:</strong> ${pacote.justificativa}</p>
                        <p><strong>Itens:</strong> ${pacote.total_itens || 0} • <strong>Total:</strong> ${pacote.total_quantidade || 0} unidades</p>
                        <div class="acoes-pacote">
                            <button onclick="aprovarPacote(${pacote.id})" class="btn btn-success">Aprovar</button>
                            <button onclick="rejeitarPacote(${pacote.id})" class="btn btn-danger">Rejeitar</button>
                        </div>
                    `;
                    pacotesList.appendChild(div);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar pacotes:', error);
            pacotesList.innerHTML = '<p class="error">Erro ao carregar pacotes pendentes.</p>';
        }
    }
}

// REMOVIDO: Funções obsoletas de criar pacote de requisição
// Os pacotes agora são criados através da interface de requisições

document.getElementById('retiradaForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const itemId = document.getElementById('itemRetirada').value;
    const quantidade = parseInt(document.getElementById('quantidadeRetirada').value);
    const destino = document.getElementById('destinoRetirada').value;
    const observacao = document.getElementById('observacaoRetirada').value;

    // Pega usuário logado do sessionStorage
    let currentUser = null;
    try {
        currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    } catch (e) {}

    try {
        await apiRequest(`/itens/${itemId}/retirar`, 'POST', {
            quantidade: quantidade,
            destino: destino,
            observacao: observacao,
            usuario_id: currentUser && currentUser.id ? currentUser.id : null,
            usuario_nome: currentUser && currentUser.name ? currentUser.name : null
        });
        
        alert('Retirada realizada com sucesso!');
        document.getElementById('retiradaForm').reset();
        await atualizarSelectRetirada();
    } catch (error) {
        alert('Erro ao realizar operação: ' + error.message);
    }
});

// Relatório de estoque
async function gerarRelatorioEstoque() {
    await carregarDados();

    const container = document.getElementById('relatorioEstoque');

    // Itens abaixo do mínimo
    const itensAbaixoMinimo = itens.filter(item => item.quantidade < item.minimo);
    // Itens abaixo do ideal, mas não abaixo do mínimo
    const itensAbaixoIdeal = itens.filter(item => item.quantidade < item.ideal && item.quantidade >= item.minimo);

    let html = '';

    // Seção: Itens abaixo do mínimo
    html += '<h3>Itens Abaixo do Estoque Mínimo</h3>';
    if (itensAbaixoMinimo.length > 0) {
        html += `
            <div class="table-container">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Atual</th>
                            <th>Mínimo</th>
                            <th>Falta</th>
                            <th>Ideal</th>
                            <th>Para Ideal</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        itensAbaixoMinimo.forEach(item => {
            const faltaMinimo = item.minimo - item.quantidade;
            const faltaIdeal = item.ideal - item.quantidade;
            html += `
                <tr>
                    <td>${item.nome}</td>
                    <td>${item.quantidade}</td>
                    <td>${item.minimo}</td>
                    <td>${faltaMinimo}</td>
                    <td>${item.ideal}</td>
                    <td>${faltaIdeal}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
    } else {
        html += '<div class="alert alert-info">Nenhum item abaixo do estoque mínimo.</div>';
    }

    // Seção: Itens abaixo do ideal
    html += '<h3 style="margin-top:32px;">Itens Abaixo do Estoque Ideal</h3>';
    if (itensAbaixoIdeal.length > 0) {
        html += `
            <div class="table-container">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Atual</th>
                            <th>Ideal</th>
                            <th>Falta</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        itensAbaixoIdeal.forEach(item => {
            const faltaIdeal = item.ideal - item.quantidade;
            html += `
                <tr>
                    <td>${item.nome}</td>
                    <td>${item.quantidade}</td>
                    <td>${item.ideal}</td>
                    <td>${faltaIdeal}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
    } else {
        html += '<div class="alert alert-info">Nenhum item abaixo do estoque ideal.</div>';
    }

    container.innerHTML = html;
}

// Relatório de movimentação
async function gerarRelatorioMovimentacao() {
    const filtroDias = document.getElementById('filtroData').value;
    // Adicionar campos de filtro se não existirem
    let filtrosDiv = document.getElementById('filtrosMovimentacao');
    if (!filtrosDiv) {
        filtrosDiv = document.createElement('div');
        filtrosDiv.id = 'filtrosMovimentacao';
        filtrosDiv.innerHTML = `
            <div class="filter-grid">
                <div class="form-group full-width">
                    <label for="pesquisaMovimentacao">Pesquisar</label>
                    <input type="text" id="pesquisaMovimentacao" placeholder="Pesquisar por nome, destino, descrição ou data">
                </div>
                <div class="form-group">
                    <label for="filtroQtdMov">Quantidade</label>
                    <input type="number" id="filtroQtdMov" placeholder="Quantidade" min="1">
                </div>
                <div class="form-group">
                    <label for="filtroTipoMov">Tipo</label>
                    <select id="filtroTipoMov" class="filter-select">
                        <option value="">Todos os tipos</option>
                        <option value="entrada">Entradas</option>
                        <option value="saida">Saídas</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="filtroUsuarioMov">Usuário</label>
                    <select id="filtroUsuarioMov" class="filter-select">
                        <option value="">Todos os usuários</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary" id="btnFiltrarMov">Filtrar</button>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-secondary" id="btnLimparFiltroMov">Limpar</button>
                </div>
            </div>
        `;
        document.getElementById('relatorioMovimentacao').parentNode.insertBefore(filtrosDiv, document.getElementById('relatorioMovimentacao'));
        // Carregar lista de usuários
        carregarUsuariosParaFiltro();
    }

    try {
        movimentacoes = await apiRequest(`/movimentacoes?dias=${filtroDias}`);
        const container = document.getElementById('relatorioMovimentacao');

        // Filtros
        let pesquisa = document.getElementById('pesquisaMovimentacao').value.trim().toLowerCase();
        let qtdFiltro = document.getElementById('filtroQtdMov').value;
        let usuarioFiltro = document.getElementById('filtroUsuarioMov').value;
        let tipoFiltro = document.getElementById('filtroTipoMov').value;

        let movFiltradas = movimentacoes.filter(mov => {
            let nomeMatch = mov.item_nome && mov.item_nome.toLowerCase().includes(pesquisa);
            let destinoMatch = mov.destino && mov.destino.toLowerCase().includes(pesquisa);
            let origemMatch = mov.origem && mov.origem.toLowerCase().includes(pesquisa);
            let descricaoMatch = mov.descricao && mov.descricao.toLowerCase().includes(pesquisa);
            let dataMov = mov.data ? new Date(mov.data) : null;
            let dataStr = dataMov ? dataMov.toLocaleDateString('pt-BR') : '';
            let dataMatch = dataStr.includes(pesquisa);
            let pesquisaOk = !pesquisa || nomeMatch || destinoMatch || origemMatch || descricaoMatch || dataMatch;
            let qtdOk = !qtdFiltro || mov.quantidade == qtdFiltro;
            // Filtro por usuário: aceita tanto id quanto nome
            let usuarioOk = true;
            if (usuarioFiltro) {
                usuarioOk = (mov.usuario_id && mov.usuario_id.toString() === usuarioFiltro) ||
                            (mov.usuario_nome && mov.usuario_nome.toLowerCase().includes(usuarioFiltro.toLowerCase()));
            }
            let tipoOk = !tipoFiltro || mov.tipo === tipoFiltro;
            return pesquisaOk && qtdOk && usuarioOk && tipoOk;
        });

        // Ordenar por data decrescente
        movFiltradas.sort((a, b) => new Date(b.data) - new Date(a.data));

        // Estatísticas do período
        const entradas = movFiltradas.filter(mov => mov.tipo === 'entrada');
        const saidas = movFiltradas.filter(mov => mov.tipo === 'saida');

        const totalEntradas = entradas.reduce((sum, mov) => sum + mov.quantidade, 0);
        const totalSaidas = saidas.reduce((sum, mov) => sum + mov.quantidade, 0);

        let html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${totalEntradas}</div>
                    <div class="stat-label">Itens Adicionados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalSaidas}</div>
                    <div class="stat-label">Itens Retirados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${movFiltradas.length}</div>
                    <div class="stat-label">Total de Movimentações</div>
                </div>
            </div>
            <h3>Movimentações dos Últimos ${filtroDias} dias</h3>
        `;

        if (movFiltradas.length > 0) {
            html += `
                <div class="table-container">
                    <table class="modern-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Item</th>
                                <th>Tipo</th>
                                <th>QTDE</th>
                                <th>Projeto</th>
                                <th>Centro de Custo</th>
                                <th>Solicitante</th>
                                <th>Aprovador</th>
                                <th>Descrição</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            movFiltradas.forEach(mov => {
                const data = new Date(mov.data).toLocaleDateString('pt-BR');
                const hora = new Date(mov.data).toLocaleTimeString('pt-BR');
                const tipoClass = mov.tipo === 'entrada' ? 'status-ideal' : 'status-baixo';
                const tipoTexto = mov.tipo === 'entrada' ? 'Entrada' : 'Saída';
                let centroCusto = '-';
                if (mov.descricao && mov.descricao.toLowerCase().includes('requisição')) {
                    centroCusto = mov.destino || '-';
                }
                // Exibir nome do solicitante e aprovador (se disponível)
                const solicitante = mov.usuario_nome || mov.usuario || mov.nome_usuario || '-';
                const aprovador = mov.aprovador_nome || mov.aprovador || mov.nome_aprovador || '-';
                html += `
                    <tr>
                        <td>${data} ${hora}</td>
                        <td>${mov.item_nome}</td>
                        <td><span class="${tipoClass}">${tipoTexto}</span></td>
                        <td>${mov.quantidade}</td>
                        <td>${mov.destino || mov.origem || '-'}</td>
                        <td>${centroCusto}</td>
                        <td>${solicitante}</td>
                        <td>${aprovador}</td>
                        <td>${mov.descricao || '-'}</td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
        } else {
            html += '<div class="alert alert-info">Nenhuma movimentação encontrada no período/filtro selecionado.</div>';
        }

        container.innerHTML = html;

        // Eventos dos filtros
        document.getElementById('btnFiltrarMov').onclick = gerarRelatorioMovimentacao;
        document.getElementById('btnLimparFiltroMov').onclick = function() {
            document.getElementById('pesquisaMovimentacao').value = '';
            document.getElementById('filtroQtdMov').value = '';
            document.getElementById('filtroTipoMov').value = '';
            document.getElementById('filtroUsuarioMov').value = '';
            gerarRelatorioMovimentacao();
        };
    } catch (error) {
        alert('Erro ao gerar relatório: ' + error.message);
    }
}

// Função para importar planilha de EPIs (CSV/XLSX)
window.importarPlanilhaEPI = async function(event) {
    try {
        console.log('Função importarPlanilhaEPI chamada');
        const file = event.target.files[0];
        if (!file) {
            alert('Nenhum arquivo selecionado!');
            return;
        }
        const reader = new FileReader();
        reader.onload = async function(e) {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, {type: 'array'});
            let firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            let json = XLSX.utils.sheet_to_json(firstSheet, {defval: ''});
            console.log('Planilha lida:', json);
            if (!json.length) {
                alert('Nenhum dado encontrado na planilha.');
                return;
            }
            let sucesso = 0;
            let falha = 0;
            let erros = [];
            let nomesSucesso = [];
            // Campos padrão do banco
            const camposPadrao = [
                'nome', 'Nome', 'Nome do Item',
                'serie', 'Serie', 'Código',
                'descricao', 'Descrição',
                'origem', 'Origem',
                'destino', 'Destino',
                'valor', 'Valor',
                'nf', 'Nota Fiscal',
                'quantidade', 'Quantidade',
                'minimo', 'Quantidade Mínima',
                'ideal', 'Quantidade Ideal',
                'infos', 'Informações Adicionais'
            ];
            for (const item of json) {
                // Mapeamento especial para planilhas do modelo fornecido
                const nomePlanilha = item["Descrição Material Atendido"] || '';
                // Prioriza 'Cod. Material Atendido' como série (WBS), se existir
                const codMaterial = item["Cod. Material Atendido"] || '';
                const wbsPlanilha = item["WBS"] || item["Wbs"] || item["wbs"] || '';
                const seriePlanilha = codMaterial || wbsPlanilha;
                const quantidadePlanilha = item["Qtd. Atendida"] || '';
                const novoItem = {
                    nome: nomePlanilha || item.nome || item.Nome || item["Nome do Item"] || '',
                    serie: seriePlanilha || item.serie || item.Serie || item["Código"] || '',
                    descricao: item.descricao || item["Descrição"] || '',
                    origem: item.origem || item.Origem || '',
                    destino: item.destino || item.Destino || '',
                    valor: parseFloat(item.valor || item.Valor || 0) || 0,
                    nf: item.nf || item["Nota Fiscal"] || '',
                    quantidade: parseInt(item.quantidade || item.Quantidade || quantidadePlanilha || 0) || 0,
                    minimo: parseInt(item.minimo || item["Quantidade Mínima"] || 0) || 0,
                    ideal: parseInt(item.ideal || item["Quantidade Ideal"] || 0) || 0,
                    infos: item.infos || item["Informações Adicionais"] || ''
                };
                // Adiciona todos os campos extras em infos (inclusive vazios)
                let extras = [];
                for (const key in item) {
                    if (!camposPadrao.includes(key)) {
                        let valor = item[key];
                        extras.push(`${key}: ${valor}`);
                    }
                }
                if (extras.length > 0) {
                    novoItem.infos = (novoItem.infos ? novoItem.infos + '; ' : '') + extras.join('; ');
                }
                if (!novoItem.nome) {
                    falha++;
                    erros.push('Linha sem nome, ignorada.');
                    continue;
                }
                // NOVO: Verifica duplicidade por nome+serie (WBS)
                const existente = itens.find(i => i.nome === novoItem.nome && i.serie === novoItem.serie);
                if (existente) {
                    // Atualiza quantidade do item existente
                    try {
                        const novaQtd = (parseInt(existente.quantidade) || 0) + (parseInt(novoItem.quantidade) || 0);
                        const atualizado = { ...existente, quantidade: novaQtd };
                        const resp = await apiRequest(`/itens/${existente.id}`, 'PUT', atualizado);
                        if (resp && resp.id) {
                            sucesso++;
                            nomesSucesso.push(novoItem.nome + ' (unido)');
                        } else {
                            falha++;
                            erros.push(`Erro ao unir: ${novoItem.nome} - ${resp && resp.error ? resp.error : 'Erro desconhecido'}`);
                        }
                    } catch (err) {
                        falha++;
                        erros.push(`Erro ao unir: ${novoItem.nome} - ${err.message}`);
                    }
                    continue;
                }
                try {
                    const resp = await apiRequest('/itens', 'POST', novoItem);
                    if (resp && resp.id) {
                        sucesso++;
                        nomesSucesso.push(novoItem.nome);
                    } else {
                        falha++;
                        erros.push(`Erro ao importar: ${novoItem.nome} - ${resp && resp.error ? resp.error : 'Erro desconhecido'}`);
                    }
                } catch (err) {
                    falha++;
                    erros.push(`Erro ao importar: ${novoItem.nome} - ${err.message}`);
                }
            }
            let msg = `Importação concluída! Sucesso: ${sucesso}, Falha: ${falha}`;
            if (nomesSucesso.length > 0) msg += '\nItens importados: ' + nomesSucesso.join(', ');
            if (sucesso === 0 && falha === 0) msg += '\nNenhum item válido encontrado na planilha.';
            if (erros.length > 0 && falha > 0) msg += '\n' + erros.join('\n');
            alert(msg);
            await carregarDados();
            await atualizarControleEstoque();
        };
        reader.readAsArrayBuffer(file);
    } catch (e) {
        alert('Erro inesperado na importação: ' + e.message);
        console.error(e);
    }
};

// Modal editar item
function abrirModalEditarItem(itemId) {
    const item = itens.find(i => i.id === itemId);
    if (!item) return;
    document.getElementById('editarItemId').value = item.id;
    document.getElementById('editarNome').value = item.nome || '';
    document.getElementById('editarSerie').value = item.serie || '';
    document.getElementById('editarDescricao').value = item.descricao || '';
    document.getElementById('editarOrigem').value = item.origem || '';
    document.getElementById('editarDestino').value = item.destino || '';
    document.getElementById('editarValor').value = item.valor || '';
    document.getElementById('editarNF').value = item.nf || '';
    document.getElementById('editarQuantidade').value = item.quantidade || 0;
    document.getElementById('editarMinimo').value = item.minimo || 0;
    document.getElementById('editarIdeal').value = item.ideal || 0;
    document.getElementById('editarInfos').value = item.infos || '';
    const modal = document.getElementById('modalEditarItem');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

function fecharModalEditarItem() {
    const modal = document.getElementById('modalEditarItem');
    modal.style.display = 'none';
    modal.classList.remove('show');
    document.getElementById('editarItemForm').reset();
}
// Salvar edição do item

document.getElementById('editarItemForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('editarItemId').value;
    const itemEditado = {
        nome: document.getElementById('editarNome').value.trim(),
        serie: document.getElementById('editarSerie').value.trim(),
        descricao: document.getElementById('editarDescricao').value.trim(),
        origem: document.getElementById('editarOrigem').value.trim(),
        destino: document.getElementById('editarDestino').value.trim(),
        valor: parseFloat(document.getElementById('editarValor').value) || 0,
        nf: document.getElementById('editarNF').value.trim(),
        quantidade: parseInt(document.getElementById('editarQuantidade').value),
        minimo: parseInt(document.getElementById('editarMinimo').value),
        ideal: parseInt(document.getElementById('editarIdeal').value),
        infos: document.getElementById('editarInfos').value.trim()
    };
    try {
        await apiRequest(`/itens/${id}`, 'PUT', itemEditado);
        alert('Item atualizado com sucesso!');
        fecharModalEditarItem();
        await carregarDados();
        await atualizarControleEstoque();
        await atualizarSelectRetirada();
        await gerarRelatorioEstoque();
        await gerarRelatorioMovimentacao();
    } catch (error) {
        alert('Erro ao atualizar item: ' + error.message);
    }
});

// Unificar itens duplicados via botão
window.unificarItensDuplicados = async function() {
    if (!confirm('Deseja realmente unificar todos os itens duplicados? Esta ação não pode ser desfeita.')) return;
    try {
        const resp = await fetch(API_URL + '/unificar-itens', { method: 'POST' });
        const contentType = resp.headers.get('content-type');
        let data;
        if (resp.ok) {
            if (contentType && contentType.includes('application/json')) {
                data = await resp.json();
            } else {
                throw new Error('Resposta inesperada do servidor');
            }
            alert('Itens duplicados unificados com sucesso! Total de itens únicos: ' + data.total);
            await carregarDados();
            await atualizarControleEstoque();
        } else {
            // Tenta extrair mensagem de erro do JSON, se possível
            if (contentType && contentType.includes('application/json')) {
                const erro = await resp.json();
                alert('Erro ao unificar itens: ' + (erro.error || resp.status));
            } else {
                const text = await resp.text();
                alert('Erro ao unificar itens: ' + (text || resp.status));
            }
        }
    } catch (e) {
        alert('Erro inesperado ao unificar itens: ' + e.message);
    }
};

// Exportar relatório
window.exportarRelatorio = async function(tipo) {
    try {
        // Garantir que temos os dados mais recentes
        await carregarDados();
        
        // Criar uma nova planilha
        const wb = XLSX.utils.book_new();
        
        if (tipo === 'estoque') {
            console.log('Exportando relatório de estoque...');
            // Preparar dados do relatório de estoque
            const MAX_CELL_LENGTH = 32000;
            const sanitizar = txt => {
                if (txt === undefined || txt === null) return '-';
                let str = String(txt);
                str = str.replace(/[\r\n]+/g, ' ');
                return str.slice(0, MAX_CELL_LENGTH);
            };
            const dadosEstoque = itens.map(item => ({
                'Nome do Item': sanitizar(item.nome),
                'Código/WBS': sanitizar(item.serie || '-'),
                'Quantidade Atual': item.quantidade,
                'Quantidade Mínima': item.minimo,
                'Quantidade Ideal': item.ideal,
                'Status': sanitizar(item.quantidade < item.minimo ? 'Abaixo do Mínimo' : 
                         item.quantidade < item.ideal ? 'Abaixo do Ideal' : 'Ideal'),
                'Descrição': sanitizar(item.descricao || '-'),
                'Origem': sanitizar(item.origem || '-'),
                'Valor': item.valor || 0,
                'Nota Fiscal': sanitizar(item.nf || '-'),
                'Informações': sanitizar(item.infos || '-')
            }));

            if (dadosEstoque.length === 0) {
                throw new Error('Não há dados de estoque para exportar.');
            }

            // Criar planilha
            const ws = XLSX.utils.json_to_sheet(dadosEstoque);
            
            // Adicionar a planilha ao workbook
            XLSX.utils.book_append_sheet(wb, ws, "Relatório de Estoque");
            
            // Salvar o arquivo
            const dataHora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `relatorio-estoque-${dataHora}.xlsx`;
            XLSX.writeFile(wb, filename);
            console.log('Relatório de estoque exportado:', filename);
            
        } else if (tipo === 'movimentacao') {
            console.log('Exportando relatório de movimentação...');
            // Preparar dados do relatório de movimentação
            const MAX_CELL_LENGTH = 32000;
            const sanitizar = txt => {
                if (txt === undefined || txt === null) return '-';
                let str = String(txt);
                str = str.replace(/[\r\n]+/g, ' ');
                return str.slice(0, MAX_CELL_LENGTH);
            };
            const dadosMovimentacao = movimentacoes.map(mov => ({
                'Data': sanitizar(new Date(mov.data).toLocaleString('pt-BR')),
                'Item': sanitizar(mov.item_nome),
                'Tipo': sanitizar(mov.tipo === 'entrada' ? 'Entrada' : 'Saída'),
                'QTDE': mov.quantidade,
                'Projeto': sanitizar(mov.destino || mov.origem || '-'),
                'Centro de Custo': sanitizar(mov.centroCusto || '-'),
                'Solicitante': sanitizar(mov.usuario_nome || mov.usuario || mov.nome_usuario || '-'),
                'Aprovador': sanitizar(mov.aprovador_nome || mov.aprovador || mov.nome_aprovador || '-'),
                'Descrição': sanitizar(mov.descricao || '-')
            }));

            if (dadosMovimentacao.length === 0) {
                throw new Error('Não há dados de movimentação para exportar.');
            }

            // Criar planilha
            const ws = XLSX.utils.json_to_sheet(dadosMovimentacao);
            
            // Adicionar a planilha ao workbook
            XLSX.utils.book_append_sheet(wb, ws, "Relatório de Movimentação");
            
            // Salvar o arquivo
            const dataHora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `relatorio-movimentacao-${dataHora}.xlsx`;
            XLSX.writeFile(wb, filename);
            console.log('Relatório de movimentação exportado:', filename);
        }
        
        alert('Relatório exportado com sucesso!');
    } catch (error) {
        console.error('Erro na exportação:', error);
        alert('Erro ao exportar relatório: ' + error.message);
    }
};

// Funções para aprovar/rejeitar pacotes
async function aprovarPacote(pacoteId) {
    if (confirm('Tem certeza que deseja aprovar este pacote?')) {
        try {
            await apiRequest(`/pacotes/${pacoteId}/aprovar`, 'POST');
            alert('Pacote aprovado com sucesso!');
            await atualizarSelectRetirada(); // Atualiza a lista de pacotes
        } catch (error) {
            alert('Erro ao aprovar pacote: ' + error.message);
        }
    }
}

async function rejeitarPacote(pacoteId) {
    const motivo = prompt('Por favor, informe o motivo da rejeição:');
    if (motivo) {
        try {
            await apiRequest(`/pacotes/${pacoteId}/rejeitar`, 'POST', { motivo });
            alert('Pacote rejeitado com sucesso!');
            await atualizarSelectRetirada(); // Atualiza a lista de pacotes
        } catch (error) {
            alert('Erro ao rejeitar pacote: ' + error.message);
        }
    }
}

// Exportar banco de dados para sincronização
window.exportarBancoDados = async function() {
    try {
        const resultadoDiv = document.getElementById('resultadoSincronizacao');
        resultadoDiv.innerHTML = '<div class="alert alert-info">Exportando dados do banco, aguarde...</div>';
        
        const response = await fetch(API_URL + '/exportar-banco', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
        }
        
        const dados = await response.json();
        
        // Converter para JSON string formatado
        const dadosStr = JSON.stringify(dados, null, 2);
        
        // Criar blob e link para download
        const blob = new Blob([dadosStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const dataHora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `backup-estoque-${dataHora}.json`;
        a.classList.add('hidden');
        
        document.body.appendChild(a);
        a.click();
        
        // Limpar após download
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        resultadoDiv.innerHTML = `
            <div class="alert alert-success">
                Exportação concluída com sucesso!<br>
                Itens exportados: ${dados.itens.length}<br>
                Movimentações exportadas: ${dados.movimentacoes.length}<br>
                Data: ${new Date().toLocaleString()}
            </div>
        `;
    } catch (error) {
        document.getElementById('resultadoSincronizacao').innerHTML = `
            <div class="alert alert-danger">
                Erro ao exportar banco: ${error.message}
            </div>
        `;
    }
};

// Importar banco de dados para sincronização
// Importar banco de dados para sincronização
window.importarBancoDados = async function(event) {
    try {
        const file = event.target.files[0];
        const resultadoDiv = document.getElementById('resultadoSincronizacao');
        if (!file) {
            resultadoDiv.innerHTML = '<div class="alert alert-danger">Nenhum arquivo selecionado!</div>';
            return;
        }
        resultadoDiv.innerHTML = '<div class="alert alert-info">Lendo arquivo, aguarde...</div>';
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const conteudo = e.target.result;
                let dados;
                try {
                    dados = JSON.parse(conteudo);
                } catch (jsonError) {
                    resultadoDiv.innerHTML = `<div class="alert alert-danger">Arquivo inválido ou corrompido.<br>Erro: ${jsonError.message}</div>`;
                    return;
                }
                if (!dados || !Array.isArray(dados.itens)) {
                    resultadoDiv.innerHTML = '<div class="alert alert-danger">Formato de arquivo inválido: não contém itens.</div>';
                    return;
                }
                if (!confirm(`Tem certeza que deseja importar ${dados.itens.length} itens? Todos os dados atuais serão substituídos.`)) {
                    resultadoDiv.innerHTML = '<div class="alert alert-info">Importação cancelada pelo usuário.</div>';
                    return;
                }
                resultadoDiv.innerHTML = '<div class="alert alert-info">Enviando dados para o servidor...</div>';
                const response = await fetch(API_URL + '/importar-banco', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dados)
                });
                
                // CORREÇÃO: Verificar se a resposta é JSON antes de tentar fazer parse
                const contentType = response.headers.get('content-type');
                let resultado;
                
                if (contentType && contentType.includes('application/json')) {
                    try {
                        resultado = await response.json();
                    } catch (respError) {
                        const textContent = await response.text();
                        console.error('Resposta não é JSON válido:', textContent);
                        resultadoDiv.innerHTML = `<div class="alert alert-danger">Servidor retornou resposta inválida.<br>Status: ${response.status}<br>Conteúdo: ${textContent.substring(0, 200)}...</div>`;
                        return;
                    }
                } else {
                    const textContent = await response.text();
                    console.error('Resposta não é JSON:', textContent);
                    resultadoDiv.innerHTML = `<div class="alert alert-danger">Servidor não retornou JSON.<br>Status: ${response.status}<br>Conteúdo: ${textContent.substring(0, 200)}...</div>`;
                    return;
                }
                
                if (!response.ok) {
                    resultadoDiv.innerHTML = `<div class="alert alert-danger">Erro do servidor: ${resultado.error || response.status}</div>`;
                    return;
                }
                resultadoDiv.innerHTML = `
                    <div class="alert alert-success">
                        Importação concluída com sucesso!<br>
                        Itens importados: ${resultado.itensImportados}<br>
                        Movimentações importadas: ${resultado.movimentacoesImportadas}<br>
                        Data: ${new Date().toLocaleString()}
                    </div>
                `;
                await carregarDados();
                await atualizarControleEstoque();
                await atualizarSelectRetirada();
                await gerarRelatorioEstoque();
                await gerarRelatorioMovimentacao();
            } catch (error) {
                resultadoDiv.innerHTML = `<div class="alert alert-danger">Erro ao importar: ${error.message}</div>`;
            }
        };
        reader.onerror = function() {
            resultadoDiv.innerHTML = `<div class="alert alert-danger">Erro ao ler arquivo!</div>`;
        };
        reader.readAsText(file);
    } catch (error) {
        document.getElementById('resultadoSincronizacao').innerHTML = `<div class="alert alert-danger">Erro inesperado: ${error.message}</div>`;
    }
};

// Mecanismo de reconexão
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 5000; // 5 segundos

async function tentarReconectar() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`Falha após ${MAX_RECONNECT_ATTEMPTS} tentativas de reconexão`);
        alert(`Não foi possível conectar ao servidor após ${MAX_RECONNECT_ATTEMPTS} tentativas. Verifique sua conexão e recarregue a página.`);
        return false;
    }
    
    reconnectAttempts++;
    console.log(`Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
    
    try {
        // Tentar carregar dados novamente após atraso
        await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
        await carregarDados();
        console.log('Reconexão bem-sucedida!');
        reconnectAttempts = 0; // Resetar contador em caso de sucesso
        return true;
    } catch (error) {
        console.error('Falha na tentativa de reconexão:', error);
        return false;
    }
}

// Monitor de conectividade de rede
window.addEventListener('online', async function() {
    console.log('Conexão de rede restaurada, tentando reconectar...');
    const statusBar = document.getElementById('connectionStatus');
    if (statusBar) {
        statusBar.className = 'connecting';
        statusBar.textContent = 'Tentando reconectar...';
    }
    
    if (await tentarReconectar()) {
        // Atualizar interface após reconexão bem-sucedida
        await atualizarControleEstoque();
        await atualizarSelectRetirada();
        
        if (statusBar) {
            statusBar.className = 'connected';
            statusBar.textContent = 'Conectado';
            
            // Ocultar após alguns segundos
            setTimeout(() => {
                statusBar.classList.add('hidden');
            }, 3000);
        }
    }
});

window.addEventListener('offline', function() {
    console.log('Conexão de rede perdida');
    const statusBar = document.getElementById('connectionStatus');
    if (statusBar) {
        statusBar.classList.remove('hidden');
        statusBar.className = 'status-bar status-bar-error disconnected';
        statusBar.textContent = 'Desconectado - Verifique sua conexão';
    }
});

// REMOVIDO: Controle de visibilidade do formulário de pacotes obsoleto

// Funções para gerenciar a sidebar e interface moderna
function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const menuToggle = document.getElementById('menuToggle');
    const sidebarToggle = document.getElementById('sidebarToggle');
    
    // Toggle sidebar no mobile
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }
    
    // Toggle sidebar no desktop
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    }
    
    // Gerenciar submenus
    const submenuItems = document.querySelectorAll('.nav-item.has-submenu');
    submenuItems.forEach(item => {
        const link = item.querySelector('.nav-link');
        link.addEventListener('click', (e) => {
            e.preventDefault();
            item.classList.toggle('open');
        });
    });
    
    // Fechar sidebar no mobile ao clicar fora
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        }
    });
}

// Função para carregar dados do dashboard
function loadDashboardData() {
    // Carregar métricas principais
    carregarMetricasDashboard();
    
    // Carregar tabela de principais itens
    carregarTopItems();
    
    // Carregar atividade recente
    carregarAtividadeRecente();
    
    // Carregar gráfico de status do estoque
    carregarGraficoStatus();
}

// Carregar métricas do dashboard
function carregarMetricasDashboard() {
    fetch('/api/estoque')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const totalItens = data.length;
            const itensAbaixoMinimo = data.filter(item => item.quantidade < item.minimo).length;
            const itensIdeal = data.filter(item => item.quantidade >= item.ideal).length;
            
            // Atualizar cards de métricas
            const totalItensCard = document.getElementById('totalItensCard');
            const itensAbaixoMinimoCard = document.getElementById('itensAbaixoMinimoCard');
            const itensIdealCard = document.getElementById('itensIdealCard');
            
            if (totalItensCard) totalItensCard.textContent = totalItens;
            if (itensAbaixoMinimoCard) itensAbaixoMinimoCard.textContent = itensAbaixoMinimo;
            if (itensIdealCard) itensIdealCard.textContent = itensIdeal;
            
            // Carregar retiradas de hoje
            carregarRetiradasHoje();
        })
        .catch(error => {
            console.error('Erro ao carregar métricas:', error);
            // Definir valores padrão em caso de erro
            const totalItensCard = document.getElementById('totalItensCard');
            const itensAbaixoMinimoCard = document.getElementById('itensAbaixoMinimoCard');
            const itensIdealCard = document.getElementById('itensIdealCard');
            
            if (totalItensCard) totalItensCard.textContent = '0';
            if (itensAbaixoMinimoCard) itensAbaixoMinimoCard.textContent = '0';
            if (itensIdealCard) itensIdealCard.textContent = '0';
        });
}

// Carregar retiradas de hoje
function carregarRetiradasHoje() {
    const hoje = new Date().toISOString().split('T')[0];
    fetch(`/api/movimentacoes?data=${hoje}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const retiradasHoje = data.filter(mov => mov.tipo === 'saida').length;
            const retiradasHojeCard = document.getElementById('retiradasHojeCard');
            if (retiradasHojeCard) {
                retiradasHojeCard.textContent = retiradasHoje;
            }
        })
        .catch(error => {
            console.error('Erro ao carregar retiradas:', error);
            const retiradasHojeCard = document.getElementById('retiradasHojeCard');
            if (retiradasHojeCard) {
                retiradasHojeCard.textContent = '0';
            }
        });
}

// Carregar principais itens
function carregarTopItems() {
    fetch('/api/estoque')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Ordenar por quantidade (menor primeiro para mostrar itens críticos)
            const itensCriticos = data
                .filter(item => item.quantidade < item.minimo)
                .sort((a, b) => a.quantidade - b.quantidade)
                .slice(0, 5);
            
            const tableContainer = document.getElementById('topItemsTable');
            if (!tableContainer) {
                console.error('Elemento topItemsTable não encontrado');
                return;
            }
            
            if (itensCriticos.length > 0) {
                let html = `
                    <table class="compact-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Atual</th>
                                <th>Mínimo</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                itensCriticos.forEach(item => {
                    const status = item.quantidade < item.minimo ? 'Crítico' : 'Normal';
                    const statusClass = item.quantidade < item.minimo ? 'status-baixo' : 'status-ideal';
                    
                    html += `
                        <tr>
                            <td>${item.nome || 'Sem nome'}</td>
                            <td>${item.quantidade || 0}</td>
                            <td>${item.minimo || 0}</td>
                            <td><span class="${statusClass}">${status}</span></td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table>';
                tableContainer.innerHTML = html;
            } else {
                tableContainer.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Nenhum item crítico encontrado</p>';
            }
        })
        .catch(error => {
            console.error('Erro ao carregar itens críticos:', error);
            const tableContainer = document.getElementById('topItemsTable');
            if (tableContainer) {
                tableContainer.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Erro ao carregar dados</p>';
            }
        });
}

// Carregar atividade recente
function carregarAtividadeRecente() {
    fetch('/api/movimentacoes?limit=5')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const activityContainer = document.getElementById('recentActivity');
            if (!activityContainer) {
                console.error('Elemento recentActivity não encontrado');
                return;
            }
            
            if (data.length > 0) {
                let html = '';
                
                data.forEach(mov => {
                    const icon = mov.tipo === 'saida' ? 'fas fa-sign-out-alt' : 'fas fa-plus';
                    const bgColor = mov.tipo === 'saida' ? '#ef4444' : '#10b981';
                    const tipo = mov.tipo === 'saida' ? 'Retirada' : 'Adição';
                    
                    html += `
                        <div class="activity-item">
                            <div class="activity-icon" style="background: ${bgColor};">
                                <i class="${icon}"></i>
                            </div>
                            <div class="activity-content">
                                <div class="activity-title">${tipo} de ${mov.quantidade || 0} unidades</div>
                                <div class="activity-time">${formatarData(mov.data)}</div>
                            </div>
                        </div>
                    `;
                });
                
                activityContainer.innerHTML = html;
            } else {
                activityContainer.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Nenhuma atividade recente</p>';
            }
        })
        .catch(error => {
            console.error('Erro ao carregar atividade:', error);
            const activityContainer = document.getElementById('recentActivity');
            if (activityContainer) {
                activityContainer.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Erro ao carregar dados</p>';
            }
        });
}

// Carregar gráfico de status do estoque
function carregarGraficoStatus() {
    fetch('/api/estoque')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const chartContainer = document.getElementById('stockStatusChart');
            if (!chartContainer) {
                console.error('Elemento stockStatusChart não encontrado');
                return;
            }
            
            const total = data.length;
            const critico = data.filter(item => item.quantidade < item.minimo).length;
            const baixo = data.filter(item => item.quantidade >= item.minimo && item.quantidade < item.ideal).length;
            const ideal = data.filter(item => item.quantidade >= item.ideal).length;
            
            if (total > 0) {
                const html = `
                    <div style="text-align: center;">
                        <div style="display: flex; justify-content: space-around; margin-bottom: 20px;">
                            <div>
                                <div style="width: 60px; height: 60px; border-radius: 50%; background: #ef4444; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin: 0 auto 8px;">${critico}</div>
                                <div style="font-size: 12px; color: #64748b;">Crítico</div>
                            </div>
                            <div>
                                <div style="width: 60px; height: 60px; border-radius: 50%; background: #f59e0b; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin: 0 auto 8px;">${baixo}</div>
                                <div style="font-size: 12px; color: #64748b;">Baixo</div>
                            </div>
                            <div>
                                <div style="width: 60px; height: 60px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin: 0 auto 8px;">${ideal}</div>
                                <div style="font-size: 12px; color: #64748b;">Ideal</div>
                            </div>
                        </div>
                        <div style="font-size: 14px; color: #374151; font-weight: 500;">Total: ${total} itens</div>
                    </div>
                `;
                chartContainer.innerHTML = html;
            } else {
                chartContainer.innerHTML = '<p style="text-align: center; color: #64748b;">Nenhum item cadastrado</p>';
            }
        })
        .catch(error => {
            console.error('Erro ao carregar gráfico:', error);
            const chartContainer = document.getElementById('stockStatusChart');
            if (chartContainer) {
                chartContainer.innerHTML = '<p style="text-align: center; color: #64748b;">Erro ao carregar dados</p>';
            }
        });
}

// Função auxiliar para formatar data
function formatarData(dataString) {
    if (!dataString) {
        return 'Data não disponível';
    }
    
    try {
        const data = new Date(dataString);
        
        // Verificar se a data é válida
        if (isNaN(data.getTime())) {
            return 'Data inválida';
        }
        
        const hoje = new Date();
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        
        if (data.toDateString() === hoje.toDateString()) {
            return 'Hoje às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } else if (data.toDateString() === ontem.toDateString()) {
            return 'Ontem às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } else {
            return data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return 'Data inválida';
    }
}

// Inicializar o sistema
document.addEventListener('DOMContentLoaded', async function() {
    // Adicionar barra de status de conexão
    const statusBar = document.createElement('div');
    statusBar.id = 'connectionStatus';
    statusBar.className = 'connecting';
    statusBar.textContent = 'Conectando...';
    statusBar.className = 'status-bar status-bar-warning connecting hidden';
    document.body.appendChild(statusBar);
    
    try {
        statusBar.classList.remove('hidden');
        await carregarDados();
        await atualizarSelectRetirada();
        await gerarRelatorioEstoque();
        await gerarRelatorioMovimentacao();
        loadDashboardData(); // Carregar dados do dashboard
        
        // Atualizar controle de estoque apenas se estiver na seção correta
        if (document.getElementById('estoque') && document.getElementById('estoque').classList.contains('active')) {
            await atualizarControleEstoque();
        }
        
        // Atualizar status de conexão
        statusBar.className = 'status-bar status-bar-success connected';
        statusBar.textContent = 'Conectado';
        
        // Ocultar após alguns segundos
        setTimeout(() => {
            statusBar.classList.add('hidden');
        }, 2000);
    } catch (error) {
        console.error('Erro na inicialização:', error);
        statusBar.className = 'status-bar status-bar-error disconnected';
        statusBar.textContent = 'Falha na conexão - Tentando reconectar...';
        
        // Tentar reconectar automaticamente
        tentarReconectar();
    }
});

// Função para carregar usuários para o filtro
async function carregarUsuariosParaFiltro() {
    try {
        const resp = await apiRequest('/usuarios');
        const usuarios = resp && Array.isArray(resp.usuarios) ? resp.usuarios : (Array.isArray(resp) ? resp : []);
        const select = document.getElementById('filtroUsuarioMov');
        if (select) {
            // Manter a opção "Todos os usuários"
            select.innerHTML = '<option value="">Todos os usuários</option>';
            usuarios.forEach(usuario => {
                const option = document.createElement('option');
                option.value = usuario.id;
                option.textContent = usuario.name + (usuario.email ? ` (${usuario.email})` : '');
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar usuários para filtro:', error);
    }
}

// Fechar modal ao clicar fora dele
window.onclick = function(event) {
    const modal = document.getElementById('modalEstoque');
    if (event.target == modal) {
        fecharModal();
    }
}