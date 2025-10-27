
const API_URL = '/api'; 

let itensPacoteAtual = [];
let itensEstoque = [];

//  verificar admin
function isUserAdmin() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    return userData.userType === 'admin';
}

// Função para configurar visibilidade dos elementos baseado no tipo de usuário
function configureUserInterface() {
    const isAdmin = isUserAdmin(); 
    
    // Mostrar/ocultar elementos admin
    document.querySelectorAll('.admin-only').forEach(el => {
        if (isAdmin) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });


}

// Carrega itens disponíveis no select - FUNÇÃO CORRIGIDA
async function carregarItensDisponiveis() {
    try {
        const response = await fetch(`${API_URL}/itens`);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        itensEstoque = await response.json();
        
        // Atualizar apenas o select de pacotes
        const select = document.getElementById('itemSelect');
        if (select) {
            select.innerHTML = '<option value="">Selecione um item...</option>';
            
            itensEstoque.forEach(item => {
                if (item.quantidade > 0) {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = `${item.nome} (Disponível: ${item.quantidade})`;
                    select.appendChild(option);
                }
            });
        }

        console.log(`Carregados ${itensEstoque.length} itens do estoque`);
    } catch (error) {
        console.error('Erro detalhado ao carregar itens:', error);
        alert('Erro ao carregar lista de itens disponíveis. Verifique o console para mais detalhes.');
    }
}

// Carregar centros de custo para os selects
async function carregarConfiguracoesPacotes() {
    try {
        // Carregar centros de custo
        const centrosResponse = await fetch(`${API_URL}/centros-custo`);

        // Verificar resposta
        if (!centrosResponse.ok) throw new Error('Erro ao carregar centros de custo');

        // Processar dados
        let response = await centrosResponse.json();
        let centrosCusto = response;

        // Verificar se a resposta está encapsulada em um objeto de resposta
        if (response && !Array.isArray(response)) {
            if (Array.isArray(response.data)) {
                centrosCusto = response.data;
            } else if (Array.isArray(response.centrosCusto)) {
                centrosCusto = response.centrosCusto;
            } else {
                console.error('Formato inesperado de resposta:', response);
                throw new Error('Formato de resposta inválido');
            }
        }

        // Atualizar select de centros de custo
        const centroSelect = document.getElementById('centroCusto');
        if (!centroSelect) {
            console.error('Select de centro de custo não encontrado no DOM');
            return;
        }

        // Limpar opções existentes
        centroSelect.innerHTML = '<option value="">Selecione um centro de custo...</option>';

        // Verificar se centrosCusto é um array
        if (!Array.isArray(centrosCusto)) {
            console.error('Dados de centros de custo não são um array:', centrosCusto);
            throw new Error('Formato de dados inválido');
        }

        // Filtrar apenas centros ativos e adicionar ao select
        const centrosAtivos = centrosCusto.filter(centro => centro && centro.ativo !== false);
        centrosAtivos.forEach(centro => {
            const option = document.createElement('option');
            option.value = centro.nome;
            option.textContent = centro.nome;
            centroSelect.appendChild(option);
        });

        // Log da quantidade de centros carregados
        console.log(`Carregados ${centrosAtivos.length} centros de custo ativos`);

        // Se não houver centros ativos, mostrar mensagem
        if (centrosAtivos.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Nenhum centro de custo cadastrado";
            centroSelect.appendChild(option);
            console.warn('Nenhum centro de custo ativo encontrado');
        }

    } catch (error) {
        console.error('Erro ao carregar centros de custo:', error);
        const centroSelect = document.getElementById('centroCusto');
        if (centroSelect) {
            centroSelect.innerHTML = '<option value="">Erro ao carregar centros de custo</option>';
        }
        alert('Erro ao carregar centros de custo. Por favor, recarregue a página.');
    }
}

// Adiciona item à tabela do formulário
function adicionarItemAoFormulario() {
    const itemSelect = document.getElementById('itemSelect');
    const quantidade = parseInt(document.getElementById('itemQuantidade').value);
    
    if (!itemSelect.value || quantidade < 1) {
        alert('Selecione um item e uma quantidade válida');
        return;
    }

    const itemSelecionado = itensEstoque.find(item => item.id === parseInt(itemSelect.value));
    if (!itemSelecionado) {
        alert('Item não encontrado no estoque');
        return;
    }

    if (quantidade > itemSelecionado.quantidade) {
        alert(`Quantidade indisponível. Máximo disponível: ${itemSelecionado.quantidade}`);
        return;
    }

    // Verifica se o item já existe no pacote
    const itemExistente = itensPacoteAtual.find(item => item.id === itemSelecionado.id);
    if (itemExistente) {
        if (itemExistente.quantidade + quantidade > itemSelecionado.quantidade) {
            alert(`Quantidade total excederia o disponível em estoque.\nDisponível: ${itemSelecionado.quantidade}\nJá no pacote: ${itemExistente.quantidade}`);
            return;
        }
        itemExistente.quantidade += quantidade;
    } else {
        itensPacoteAtual.push({
            id: itemSelecionado.id,
            nome: itemSelecionado.nome,
            quantidade: quantidade
        });
    }

    atualizarTabelaItens();
    
    // Limpa campos
    itemSelect.value = '';
    document.getElementById('itemQuantidade').value = 1;
}

// Atualiza a tabela de itens do pacote
function atualizarTabelaItens() {
    const tbody = document.querySelector('#tabelaItensPacote tbody');
    tbody.innerHTML = '';
    
    itensPacoteAtual.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.quantidade}</td>
            <td>
                <button type="button" class="btn btn-danger" onclick="removerItemDoPacote(${index})">
                    Remover
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Remove item do pacote
function removerItemDoPacote(index) {
    itensPacoteAtual.splice(index, 1);
    atualizarTabelaItens();
}

// Função para verificar acesso ao estoque
function verificarAcessoEstoque() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    if (!userData.userType || userData.userType !== 'admin') {
        alert('Acesso negado! Apenas administradores podem acessar o sistema de estoque.');
        window.location.href = 'requisi.html';
        return false;
    }
    return true;
}

// Função para inicializar o sistema de requisições
async function inicializarSistemaRequisicoes() {
    try {
        // Verificar se o usuário está logado
        const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        if (!userData.id) {
            alert('Você precisa estar logado para acessar o sistema.');
            window.location.href = 'login.html';
            return;
        }
        
        // Carregar dados específicos do usuário
        carregarDadosUsuario();
        
        // Load items and requisitions data
        await carregarItensDisponiveis();
        await carregarMeusPacotes();
        
        // Load admin-specific data if user is admin
        if (isUserAdmin()) {
            await carregarRequisicoesPendentes();
        }
        
        // Carregar centros de custo para o formulário de novo pacote
        await carregarConfiguracoesPacotes();
        // Se estiver na aba de configurações, também carregar a tabela
        const currentSection = document.querySelector('.content-section.active');
        if (currentSection && currentSection.id === 'configuracoes') {
            await carregarCentrosCusto();
        }
        
        // Configurar interface baseada no tipo de usuário
        configureUserInterface();
        
        console.log('Sistema inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar sistema:', error);
        alert('Erro ao carregar dados do sistema. Tente novamente.');
    }
}

// Função para carregar dados do usuário logado
function carregarDadosUsuario() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    
    // Atualizar nome do usuário no header se existir
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userData.name || 'Usuário';
    }
}

// Função para carregar requisições do usuário (agora apenas através de pacotes)
function carregarMinhasRequisicoes() {
    // Esta função foi substituída por carregarMeusPacotes()
    // Mantida para compatibilidade
    carregarMeusPacotes();
}

// Função para carregar pacotes do usuário
function carregarMeusPacotes() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    fetch(`${API_URL}/pacotes/usuario/${userData.id}`)
        .then(response => response.json())
        .then(pacotes => {
            const container = document.getElementById('listaPacotes');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (pacotes.length === 0) {
                container.innerHTML = '<p>Nenhum pacote encontrado.</p>';
                return;
            }
            
            pacotes.forEach(pacote => {
                const pacoteDiv = document.createElement('div');
                pacoteDiv.className = 'pacote-card';
                
                const statusClass = pacote.status === 'aprovado' ? 'status-aprovado' :
                               pacote.status === 'aprovado_pendente_retirada' ? 'status-aprovado-pendente-retirada' :
                               pacote.status === 'rejeitado' ? 'status-rejeitado' :
                               pacote.status === 'parcialmente aprovado' ? 'status-parcialmente-aprovado' :
                               pacote.status === 'parcialmente_aprovado_pendente_retirada' ? 'status-parcialmente-aprovado-pendente-retirada' :
                               'status-pendente';
                
                pacoteDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h4>Pacote #${pacote.id}</h4>

                            <p><strong>Centro de Custo:</strong> ${pacote.centroCusto}</p>
                            <p><strong>Justificativa:</strong> ${pacote.justificativa}</p>
                            <p><strong>Itens:</strong> ${pacote.total_itens || 0} • <strong>Total:</strong> ${pacote.total_quantidade || 0} unidades</p>
                            <p><strong>Data:</strong> ${new Date(pacote.data_criacao).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <span class="${statusClass}">${pacote.status}</span>
                            ${pacote.observacoes ? `<br><small>${pacote.observacoes}</small>` : ''}
                        </div>
                    </div>
                    <div style="margin-top: 10px;">
                        <button class="btn btn-info btn-sm" onclick="verItensPacote(${pacote.id})" style="margin-right: 5px;">
                            Ver Itens
                        </button>
                        ${pacote.status === 'aprovado' || pacote.status === 'aprovado_pendente_retirada' || pacote.status === 'rejeitado' || pacote.status === 'parcialmente aprovado' || pacote.status === 'parcialmente_aprovado_pendente_retirada' ? 
                            `<button class="btn btn-primary btn-sm" onclick="exportarRelatorioPacote(${pacote.id})">Exportar XLSX</button>` : 
                            ''
                        }
                    </div>
                `;
                
                container.appendChild(pacoteDiv);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar pacotes:', error);
        });
}

// Função para ver itens de um pacote (usuário)
function verItensPacote(pacoteId) {
    fetch(`${API_URL}/pacotes/${pacoteId}/itens`)
        .then(response => response.json())
        .then(itens => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            
            let itensHtml = `
                <h3>Itens do Pacote</h3>
                <div class="table-container">
                    <table class="modern-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Quantidade</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            itens.forEach(item => {
                itensHtml += `
                    <tr>
                        <td>${item.item_nome}</td>
                        <td>${item.quantidade}</td>
                        <td><span class="status-${item.status}">${item.status}</span></td>
                    </tr>
                `;
            });
            
            itensHtml += `
                        </tbody>
                    </table>
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
                </div>
            `;
            
            modalContent.innerHTML = itensHtml;
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
        })
        .catch(error => {
            console.error('Erro ao carregar itens do pacote:', error);
            alert('Erro ao carregar itens do pacote');
        });
}

// Função para carregar requisições pendentes (admin) - apenas pacotes
function carregarRequisicoesPendentes() {
    fetch(`${API_URL}/pacotes/pendentes`)
        .then(response => response.json())
        .then(pacotes => {
            const container = document.getElementById('cardsAprovarRequisicoes');
            if (!container) return;
            container.innerHTML = '';
            if (pacotes.length === 0) {
                container.innerHTML = '<p style="text-align:center;">Nenhum pacote pendente encontrado.</p>';
                return;
            }
            pacotes.forEach(pacote => {
                const card = document.createElement('div');
                card.className = 'requisicao-card';
                card.innerHTML = `
                    <div class="requisicao-header">
                        <div class="requisicao-title">
                            <div class="requisicao-icon"><i class="fas fa-box"></i></div>
                            <div class="requisicao-info">
                                <span class="requisicao-id">PACOTE #${pacote.id}</span>
                                <span class="requisicao-date">${new Date(pacote.data_criacao).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <span class="status-tag pendente"><i class="fas fa-clock"></i> Pendente</span>
                    </div>
                    <div class="requisicao-content">
                        <div class="requisicao-grid">
                            <div class="info-group">
                                <span class="info-label">Solicitante</span>
                                <span class="info-value">${pacote.usuario_nome}</span>
                            </div>
                            <div class="info-group">
                                <span class="info-label">Centro de Custo</span>
                                <span class="info-value">${pacote.centroCusto}</span>
                            </div>

                            <div class="info-group">
                                <span class="info-label">Total de Itens</span>
                                <span class="info-value">${pacote.total_itens} itens</span>
                            </div>
                            <div class="info-group">
                                <span class="info-label">Total de Unidades</span>
                                <span class="info-value">${pacote.total_quantidade}</span>
                            </div>
                            <div class="info-group">
                                <span class="info-label">Justificativa</span>
                                <span class="info-value">${pacote.justificativa}</span>
                            </div>
                            <div class="info-group">
                                <span class="info-label">Aprovador</span>
                                <span class="info-value">${pacote.aprovador_nome || 'Não definido'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="requisicao-footer">
                        <button class="btn-actions" onclick="abrirModalAcoes(${pacote.id})">
                            Ações <i class="fas fa-cogs"></i>
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar pacotes pendentes:', error);
        });
}

// REMOVIDO: Funções obsoletas de aprovar/rejeitar requisições individuais
// As requisições agora são processadas apenas através de pacotes

// Função para expandir pacote e mostrar itens
function expandirPacote(pacoteId) {
    fetch(`${API_URL}/pacotes/${pacoteId}/itens`)
        .then(response => response.json())
        .then(itens => {
            // Criar modal para mostrar itens do pacote
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content-large';
            
            let itensHtml = `
                <h3>Itens do Pacote</h3>
                <div class="table-container">
                    <table class="modern-table">
                        <thead>
                            <tr>
                                <th><input type="checkbox" id="selectAll" onchange="toggleSelectAll()"></th>
                                <th>Item</th>
                                <th>Quantidade</th>
                                <th>Estoque Disponível</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            itens.forEach(item => {
                const disponivel = item.quantidade <= item.estoque_disponivel;
                const podeAprovar = item.status === 'pendente' && disponivel;
                
                itensHtml += `
                    <tr>
                        <td>
                            ${podeAprovar ? 
                                `<input type="checkbox" class="item-checkbox" value="${item.id}">` :
                                `<input type="checkbox" class="item-checkbox" value="${item.id}" disabled>`
                            }
                        </td>
                        <td>${item.item_nome}</td>
                        <td>${item.quantidade}</td>
                        <td>${item.estoque_disponivel}</td>
                        <td>
                            <span class="status-${item.status}">${item.status}</span>
                            ${!disponivel ? '<br><small style="color: red;">Indisponível</small>' : ''}
                            ${item.status === 'aprovado' || item.status === 'aprovado_pendente_retirada' ? '<br><small style="color: green;">✓ Já aprovado</small>' : ''}
                            ${item.status === 'rejeitado' ? '<br><small style="color: red;">✗ Já rejeitado</small>' : ''}
                        </td>
                    </tr>
                `;
            });
            
            itensHtml += `
                        </tbody>
                    </table>
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
                    <button class="btn btn-danger" onclick="negarItensSelecionados(${pacoteId})">Negar Selecionados</button>
                    <button class="btn btn-primary" onclick="aprovarItensSelecionados(${pacoteId})">Aprovar Selecionados</button>
                </div>
            `;
            
            modalContent.innerHTML = itensHtml;
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
        })
        .catch(error => {
            console.error('Erro ao carregar itens do pacote:', error);
            alert('Erro ao carregar itens do pacote');
        });
}

// Função para fechar modal
function fecharModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Função para selecionar/deselecionar todos os itens
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.item-checkbox:not(:disabled)');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
}

// Função para aprovar itens selecionados do pacote
function aprovarItensSelecionados(pacoteId) {
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    const itemIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if (itemIds.length === 0) {
        alert('Selecione pelo menos um item para aprovar');
        return;
    }
    
    fetch(`${API_URL}/pacotes/${pacoteId}/aprovar-itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds, aprovador_id: (JSON.parse(sessionStorage.getItem('currentUser')||'{}').id || null), aprovador_nome: (JSON.parse(sessionStorage.getItem('currentUser')||'{}').name || null) })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`${itemIds.length} itens aprovados com sucesso!`);
            fecharModal();
            carregarRequisicoesPendentes();
            carregarMeusPacotes();
        } else {
            alert(data.message || 'Erro ao aprovar itens');
        }
    })
    .catch(error => {
        alert('Erro ao aprovar itens');
    });
}

// Função para negar itens selecionados do pacote
function negarItensSelecionados(pacoteId) {
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    const itemIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (itemIds.length === 0) {
        alert('Selecione pelo menos um item para negar');
        return;
    }

    if (!confirm(`Deseja negar ${itemIds.length} itens selecionados?`)) {
        return;
    }

    fetch(`${API_URL}/pacotes/${pacoteId}/negar-itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`${itemIds.length} itens negados com sucesso!`);
            fecharModal();
            carregarRequisicoesPendentes();
            carregarMeusPacotes();
        } else {
            alert(data.message || 'Erro ao negar itens');
        }
    })
    .catch(error => {
        alert('Erro ao negar itens');
    });
}

// Função para aprovar pacote completo
function aprovarPacoteCompleto(pacoteId) {
    if (!confirm('Deseja aprovar todo o pacote?')) return;
    
    fetch(`${API_URL}/pacotes/${pacoteId}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprovador_id: (JSON.parse(sessionStorage.getItem('currentUser')||'{}').id || null), aprovador_nome: (JSON.parse(sessionStorage.getItem('currentUser')||'{}').name || null) })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Pacote aprovado com sucesso!');
            carregarRequisicoesPendentes();
            carregarMeusPacotes();
        } else {
            alert(data.message || 'Erro ao aprovar pacote');
        }
    })
    .catch(error => {
        alert('Erro ao aprovar pacote');
    });
}

// Função para rejeitar pacote completo
function rejeitarPacoteCompleto(pacoteId) {
    const motivo = prompt('Motivo da rejeição do pacote:');
    if (motivo === null) return;
    
    fetch(`${API_URL}/pacotes/${pacoteId}/rejeitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Pacote rejeitado com sucesso!');
            carregarRequisicoesPendentes();
            carregarMeusPacotes();
        } else {
            alert(data.message || 'Erro ao rejeitar pacote');
        }
    })
    .catch(error => {
        alert('Erro ao rejeitar pacote');
    });
}

// REMOVIDO: Função obsoleta de enviar requisição individual
// As requisições agora são feitas apenas através de pacotes

// Função para criar pacote de requisições
function criarPacoteRequisicoes(event) {
    event.preventDefault();
    
    if (itensPacoteAtual.length === 0) {
        alert('Adicione pelo menos um item ao pacote!');
        return;
    }
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const centroCusto = document.getElementById('centroCusto').value;
    const justificativa = document.getElementById('justificativa').value;
    
    if (!centroCusto || !justificativa) {
        alert('Preencha todos os campos do pacote!');
        return;
    }
    
    // Usar a nova API de pacotes
    fetch(`${API_URL}/pacotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: userData.id,
            centroCusto,
            justificativa,
            itens: itensPacoteAtual
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`Pacote criado com sucesso! ID: ${data.pacoteId}`);
            // Limpar formulário
            document.getElementById('pacoteForm').reset();
            itensPacoteAtual = [];
            atualizarTabelaItens();
            // Atualizar todas as listas
            carregarMeusPacotes();
            if (isUserAdmin()) {
                carregarRequisicoesPendentes();
            }
        } else {
            alert(data.message || 'Erro ao criar pacote');
        }
    })
    .catch(error => {
        alert('Erro ao criar pacote de requisições');
        console.error(error);
    });
}

// Função para logout
function logout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// Adicionar botão de logout na interface
function adicionarBotaoLogout() {
    // Verificar se já existe um botão de logout
    if (document.querySelector('.btn-logout')) {
        return;
    }
    
    const logoutButton = document.createElement('button');
    logoutButton.className = 'btn-logout-dynamic';
    logoutButton.textContent = 'Sair';
    logoutButton.onclick = logout;
    
    document.body.appendChild(logoutButton);
}

// Event listeners
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Inicializar sistema
        await inicializarSistemaRequisicoes();
        
        // Inicializar sidebar
        initializeSidebar();
        
        // Event listener para o formulário de pacote
        const pacoteForm = document.getElementById('pacoteForm');
        if (pacoteForm) {
            pacoteForm.addEventListener('submit', criarPacoteRequisicoes);
        }
        
        // Event listeners para formulários de configuração
        await carregarUsuariosAprovador();
        
        const centroCustoForm = document.getElementById('centroCustoForm');
        if (centroCustoForm) {
            centroCustoForm.addEventListener('submit', criarCentroCusto);
        }
    } catch (error) {
        console.error('Erro na inicialização:', error);
    }
});

// Garantir que a página comece no topo após carregamento completo
window.addEventListener('load', function() {
    window.scrollTo(0, 0);
});

// Função para mostrar seções (atualizada para trabalhar com sidebar)
function showSection(sectionId) {
    // Ocultar todas as seções
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remover classe active de todos os links da sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Mostrar seção selecionada
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
    
    // Adicionar classe active no link correspondente
    const activeLink = event.target.closest('.nav-link');
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Fechar sidebar no mobile após navegação
    if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('show');
        }
    }
    
    // Load section-specific data
    if (sectionId === 'configuracoes') {
        // Load centers of cost configuration
        carregarConfiguracoesPacotes();
        carregarCentrosCusto();
    } else if (sectionId === 'novoPacote') {
        // Garantir que o select de centro de custo esteja carregado ao abrir a criação
        carregarConfiguracoesPacotes();
    }
    
    // Fazer scroll para o topo da página com múltiplas opções para garantir compatibilidade
    setTimeout(() => {
        // Método 1: scrollTo with smooth behavior
        if (window.scrollTo) {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
        
        // Método 2: scrollTop as fallback
        if (document.documentElement.scrollTop !== undefined) {
            document.documentElement.scrollTop = 0;
        }
        
        // Método 3: scrollTop of body as additional fallback
        if (document.body.scrollTop !== undefined) {
            document.body.scrollTop = 0;
        }
    }, 100);
}

// ===== NOVAS FUNÇÕES PARA CONFIGURAÇÕES =====

// Função para mostrar abas de configuração
function showConfigTab(tabName) {
    // Carregar dados da aba selecionada
    if (tabName === 'centros-custo') {
        carregarCentrosCusto();
    }
}



// Função para carregar usuários para o select de aprovador
async function carregarUsuariosAprovador() {
    try {
        const response = await fetch(`${API_URL}/usuarios`);
        if (!response.ok) throw new Error('Erro ao carregar usuários');
        
        const usuariosResponse = await response.json();
        const usuarios = Array.isArray(usuariosResponse)
            ? usuariosResponse
            : (usuariosResponse.usuarios || []);
        const usuariosAdmins = usuarios.filter(u => u.userType === 'admin');
        const aprovadorSelect = document.getElementById('centroCustoAprovador');
        
        if (aprovadorSelect) {
            aprovadorSelect.innerHTML = '<option value="">Selecione um aprovador...</option>';
            usuariosAdmins.forEach(usuario => {
                const option = document.createElement('option');
                option.value = usuario.id;
                option.textContent = usuario.name;
                aprovadorSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

// Funções para gerenciar centros de custo
async function carregarCentrosCusto() {
    try {
        const response = await fetch(`${API_URL}/centros-custo`);
        if (!response.ok) throw new Error('Erro ao carregar centros de custo');
        
        const centrosCusto = await response.json();
        const tbody = document.querySelector('#tabelaCentrosCusto tbody');
        tbody.innerHTML = '';
        
        centrosCusto.forEach(centro => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${centro.nome}</td>
                <td>${centro.descricao || '-'}</td>
                <td>${centro.aprovador_nome || '-'}</td>
                <td><span class="status-ativo">Ativo</span></td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editarCentroCusto(${centro.id})">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="removerCentroCusto(${centro.id})">Remover</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Erro ao carregar centros de custo:', error);
        alert('Erro ao carregar centros de custo');
    }
}

async function criarCentroCusto(event) {
    event.preventDefault();
    
    const nome = document.getElementById('centroCustoNome').value.trim();
    const descricao = document.getElementById('centroCustoDescricao').value.trim();
    const aprovadorId = document.getElementById('centroCustoAprovador').value;
    
    if (!nome || !aprovadorId) {
        alert('Nome do centro de custo e aprovador são obrigatórios');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/centros-custo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, descricao, aprovador_id: aprovadorId })
        });
        
        if (!response.ok) throw new Error('Erro ao criar centro de custo');
        
        const result = await response.json();
        if (result.success) {
            alert('Centro de custo criado com sucesso!');
            document.getElementById('centroCustoForm').reset();
            carregarCentrosCusto();
        } else {
            alert(result.message || 'Erro ao criar centro de custo');
        }
    } catch (error) {
        console.error('Erro ao criar centro de custo:', error);
        alert('Erro ao criar centro de custo');
    }
}

async function editarCentroCusto(id) {
    const novoNome = prompt('Digite o novo nome do centro de custo:');
    if (!novoNome) return;
    
    const novaDescricao = prompt('Digite a nova descrição (opcional):');
    const novoAprovadorId = prompt('Digite o ID do novo aprovador (ou deixe vazio para manter o atual):');
    
    try {
        const response = await fetch(`${API_URL}/centros-custo/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                nome: novoNome, 
                descricao: novaDescricao || '', 
                aprovador_id: novoAprovadorId || null,
                ativo: 1 
            })
        });
        
        if (!response.ok) throw new Error('Erro ao atualizar centro de custo');
        
        const result = await response.json();
        if (result.success) {
            alert('Centro de custo atualizado com sucesso!');
            carregarCentrosCusto();
        } else {
            alert(result.message || 'Erro ao atualizar centro de custo');
        }
    } catch (error) {
        console.error('Erro ao atualizar centro de custo:', error);
        alert('Erro ao atualizar centro de custo');
    }
}

async function removerCentroCusto(id) {
    if (!confirm('Tem certeza que deseja remover este centro de custo?')) return;
    
    try {
        const response = await fetch(`${API_URL}/centros-custo/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Erro ao remover centro de custo');
        
        const result = await response.json();
        if (result.success) {
            alert('Centro de custo removido com sucesso!');
            carregarCentrosCusto();
        } else {
            alert(result.message || 'Erro ao remover centro de custo');
        }
    } catch (error) {
        console.error('Erro ao remover centro de custo:', error);
        alert('Erro ao remover centro de custo');
    }
}

// Função para gerar relatório detalhado de pacote
async function gerarRelatorioPacote(pacoteId) {
    try {
        console.log('Gerando relatório para pacote:', pacoteId);
        const response = await fetch(`${API_URL}/pacotes/${pacoteId}/detalhes`);
        if (!response.ok) throw new Error('Erro ao buscar detalhes do pacote');
        
        const result = await response.json();
        console.log('Resposta da API:', result);
        
        if (!result.success) {
            alert(result.message || 'Erro ao buscar detalhes do pacote');
            return;
        }
        
        const pacote = result.pacote;
        
        // Criar modal com relatório detalhado
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        modal.innerHTML = `
            <div class="modal-content-large">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h3>Relatório Detalhado - Pacote #${pacote.id}</h3>
                
                <div class="relatorio-detalhado">
                    <div class="relatorio-header">
                        <h4>Informações Gerais</h4>
                        <span class="status-${pacote.status}">${pacote.status.toUpperCase()}</span>
                    </div>
                    
                    <div class="relatorio-info">
                        <div class="relatorio-info-item">
                            <div class="relatorio-info-label">Solicitante</div>
                            <div class="relatorio-info-value">${pacote.solicitante_nome}</div>
                        </div>
                        <div class="relatorio-info-item">
                            <div class="relatorio-info-label">Data de Criação</div>
                            <div class="relatorio-info-value">${new Date(pacote.data_criacao).toLocaleDateString('pt-BR')}</div>
                        </div>
                        <div class="relatorio-info-item">
                            <div class="relatorio-info-label">Centro de Custo</div>
                            <div class="relatorio-info-value">${pacote.centroCusto}</div>
                        </div>

                        ${pacote.aprovador_nome ? `
                        <div class="relatorio-info-item">
                            <div class="relatorio-info-label">Aprovado por</div>
                            <div class="relatorio-info-value">${pacote.aprovador_nome}</div>
                        </div>
                        <div class="relatorio-info-item">
                            <div class="relatorio-info-label">Data de Aprovação</div>
                            <div class="relatorio-info-value">${new Date(pacote.data_aprovacao).toLocaleDateString('pt-BR')}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="relatorio-info-item">
                        <div class="relatorio-info-label">Justificativa</div>
                        <div class="relatorio-info-value">${pacote.justificativa || 'Não informada'}</div>
                    </div>
                    
                    <h4>Itens do Pacote</h4>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Quantidade Solicitada</th>
                                    <th>Quantidade Aprovada</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pacote.itens.map(item => `
                                    <tr>
                                        <td>${item.item_nome}</td>
                                        <td>${item.quantidade}</td>
                                        <td>${item.status === 'aprovado' || item.status === 'aprovado_pendente_retirada' ? item.quantidade : 0}</td>
                                        <td><span class="status-${item.status}">${item.status.toUpperCase()}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        alert('Erro ao gerar relatório do pacote');
    }
}

// Função para editar pacote (quantidades)
async function editarPacote(pacoteId) {
    try {
        console.log('Abrindo modal de edição para pacote:', pacoteId);
        // Buscar detalhes do pacote
        const response = await fetch(`${API_URL}/pacotes/${pacoteId}/detalhes`);
        if (!response.ok) throw new Error('Erro ao buscar detalhes do pacote');
        
        const result = await response.json();
        console.log('Resposta da API para edição:', result);
        
        if (!result.success) {
            alert(result.message || 'Erro ao buscar detalhes do pacote');
            return;
        }
        
        const pacote = result.pacote;
        
        // Criar modal para editar quantidades
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        modal.innerHTML = `
            <div class="modal-content-large">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h3>Editar Quantidades - Pacote #${pacote.id}</h3>
                
                <div class="relatorio-detalhado">
                    <div class="relatorio-header">
                        <h4>Informações do Pacote</h4>
                        <div class="relatorio-info">
                            <div class="relatorio-info-item">
                                <span class="relatorio-info-label">Solicitante:</span>
                                <span class="relatorio-info-value">${pacote.solicitante_nome || 'N/A'}</span>
                            </div>
                            <div class="relatorio-info-item">
                                <span class="relatorio-info-label">Centro de Custo:</span>
                                <span class="relatorio-info-value">${pacote.centroCusto || 'N/A'}</span>
                            </div>

                            <div class="relatorio-info-item">
                                <span class="relatorio-info-label">Justificativa:</span>
                                <span class="relatorio-info-value">${pacote.justificativa || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <form id="formEditarPacote">
                    <h4>Itens do Pacote</h4>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Quantidade Atual</th>
                                    <th>Quantidade Disponível</th>
                                    <th>Nova Quantidade</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pacote.itens.map(item => {
                                    const podeEditar = item.status === 'pendente';
                                    return `
                                        <tr>
                                            <td>${item.item_nome}</td>
                                            <td>${item.quantidade}</td>
                                            <td>${item.estoque_disponivel || 0}</td>
                                            <td>
                                                ${podeEditar ? 
                                                    `<div class="quantidade-aprovacao">
                                                        <input type="number" 
                                                               name="quantidade_${item.id}" 
                                                               value="${item.quantidade}" 
                                                               min="0" 
                                                               max="${item.estoque_disponivel || item.quantidade}"
                                                               required>
                                                        <span>/ ${item.quantidade}</span>
                                                    </div>` :
                                                    `<div class="quantidade-aprovacao">
                                                        <input type="number" 
                                                               name="quantidade_${item.id}" 
                                                               value="${item.quantidade}" 
                                                               disabled>
                                                        <span style="color: ${item.status === 'aprovado' || item.status === 'aprovado_pendente_retirada' ? 'green' : 'red'};">
                                                            ${item.status === 'aprovado' || item.status === 'aprovado_pendente_retirada' ? '✓ Aprovado' : '✗ Rejeitado'}
                                                        </span>
                                                    </div>`
                                                }
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <button type="submit" class="btn btn-success">Salvar Alterações</button>
                        <button type="button" class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.parentElement.remove()">Cancelar</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Adicionar evento de submit
        document.getElementById('formEditarPacote').addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const formData = new FormData(event.target);
            const itensEditados = [];
            
            pacote.itens.forEach(item => {
                const quantidade = parseInt(formData.get(`quantidade_${item.id}`));
                // Só editar itens que estão pendentes
                if (quantidade > 0 && item.status === 'pendente') {
                    itensEditados.push({
                        item_id: item.id,
                        nova_quantidade: quantidade
                    });
                }
            });
            
            if (itensEditados.length === 0) {
                alert('Selecione pelo menos um item para editar');
                return;
            }
            
            try {
                const response = await fetch(`${API_URL}/pacotes/${pacoteId}/editar-quantidades`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itensEditados })
                });
                
                if (!response.ok) throw new Error('Erro ao editar quantidades');
                
                const result = await response.json();
                if (result.success) {
                    alert('Quantidades editadas com sucesso!');
                    // Após editar, permitir aprovar com quantidade personalizada
                    const itensAprovados = itensEditados.map(it => ({ item_id: it.item_id, quantidade_aprovada: it.nova_quantidade }));
                    const user = JSON.parse(sessionStorage.getItem('currentUser')||'{}');
                    const respAprovar = await fetch(`${API_URL}/pacotes/${pacoteId}/aprovar-itens-quantidade`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ itensAprovados, aprovador_id: user.id || null, aprovador_nome: user.name || null })
                    });
                    const dataAprovar = await respAprovar.json();
                    if (dataAprovar && dataAprovar.success) {
                        alert('Itens aprovados com as novas quantidades!');
                        document.querySelector('.modal-overlay')?.remove();
                        carregarRequisicoesPendentes();
                        carregarMeusPacotes();
                    } else {
                        alert('Erro ao aprovar itens com quantidade personalizada');
                    }
                } else {
                    alert(result.message || 'Erro ao editar quantidades');
                }
            } catch (error) {
                console.error('Erro ao editar quantidades:', error);
                alert('Erro ao editar quantidades');
            }
        });
        
    } catch (error) {
        console.error('Erro ao abrir modal de edição:', error);
        alert('Erro ao abrir modal de edição');
    }
}

// Função para exportar relatório de pacote em CSV
async function exportarRelatorioPacote(pacoteId) {
    try {
        console.log('Exportando relatório XLSX para pacote:', pacoteId);
        // Fazer download do arquivo XLSX
        const response = await fetch(`${API_URL}/pacotes/${pacoteId}/exportar-xlsx`);
        if (!response.ok) {
            throw new Error('Erro ao exportar relatório XLSX');
        }
        // Obter o nome do arquivo do header Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `relatorio-pacote-${pacoteId}.xlsx`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }
        // Criar blob e link para download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.classList.add('hidden');
        document.body.appendChild(a);
        a.click();
        // Limpar após download
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
        console.log('Relatório XLSX exportado com sucesso');
    } catch (error) {
        console.error('Erro ao exportar relatório XLSX:', error);
        alert('Erro ao exportar relatório XLSX: ' + error.message);
    }
}

// Função para filtrar meus pacotes
function filtrarMeusPacotes() {
    const filtroStatus = document.getElementById('filtroStatusMeusPacotes').value;
    const filtroData = document.getElementById('filtroDataMeusPacotes').value;
    const pesquisa = document.getElementById('pesquisaMeusPacotes').value.toLowerCase();

    const pacotes = document.querySelectorAll('.pacote-card');

    pacotes.forEach(pacote => {
        // Extrair status
        const statusElement = pacote.querySelector('.status-aprovado, .status-rejeitado, .status-pendente, .status-parcialmente-aprovado');
        const status = statusElement ? statusElement.textContent.trim().toLowerCase() : '';

        // Extrair centro de custo
        let centroCusto = '';
        const pTags = pacote.querySelectorAll('p');
        pTags.forEach(p => {
            if (p.textContent.toLowerCase().includes('centro de custo:')) {
                centroCusto = p.textContent.replace('Centro de Custo:', '').trim().toLowerCase();
            }
        });

        // Extrair data
        let data = '';
        pTags.forEach(p => {
            if (p.textContent.toLowerCase().includes('data:')) {
                data = p.textContent.split(':')[1]?.trim();
            }
        });

        let mostrar = true;

        // Filtro por status
        if (filtroStatus && status !== filtroStatus.toLowerCase()) {
            mostrar = false;
        }

        // Filtro por data
        if (filtroData && data) {
            // data formato dd/mm/yyyy ou yyyy-mm-dd
            let dataPacote = data;
            if (data.includes('/')) {
                const [dia, mes, ano] = data.split('/');
                dataPacote = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            }
            const dataFiltro = filtroData;
            if (dataPacote !== dataFiltro) {
                mostrar = false;
            }
        }

        // Filtro por pesquisa
        if (pesquisa && !centroCusto.includes(pesquisa)) {
            mostrar = false;
        }

        if (mostrar) {
            pacote.classList.remove('hidden');
        } else {
            pacote.classList.add('hidden');
        }
    });
}

// Função para limpar filtros
function limparFiltrosMeusPacotes() {
    document.getElementById('filtroStatusMeusPacotes').value = '';
    document.getElementById('filtroDataMeusPacotes').value = '';
    document.getElementById('pesquisaMeusPacotes').value = '';
    
    // Mostrar todos os pacotes
    const pacotes = document.querySelectorAll('.pacote-card');
    pacotes.forEach(pacote => {
        pacote.classList.remove('hidden');
    });
}

function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleButtons = document.querySelectorAll('.sidebar-toggle');
    
    // Toggle sidebar (funciona para desktop e mobile)
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            sidebar.classList.toggle('show');
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    });
    // Fechar sidebar no mobile ao clicar fora
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        }
    });
}


// Função para abrir modal de ações do pacote
// Função para abrir modal de ações do pacote - CORRIGIDA
function abrirModalAcoes(pacoteId) {
    // Remove qualquer modal de ações já aberto
    document.querySelectorAll('.modal-overlay.modal-acoes').forEach(m => m.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-acoes';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="fecharModalAcoes()">&times;</span>
            <h3>Ações do Pacote #${pacoteId}</h3>
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">
                <button class="btn btn-secondary" onclick="expandirPacote(${pacoteId}); fecharModalAcoes();">
                    <i class="fas fa-eye"></i> Ver Itens
                </button>
                <button class="btn btn-success" onclick="aprovarPacoteCompleto(${pacoteId}); fecharModalAcoes();">
                    <i class="fas fa-check"></i> Aprovar Tudo
                </button>
                <button class="btn btn-warning" onclick="editarPacote(${pacoteId}); fecharModalAcoes();">
                    <i class="fas fa-edit"></i> Editar Pacote
                </button>
                <button class="btn btn-danger" onclick="rejeitarPacoteCompleto(${pacoteId}); fecharModalAcoes();">
                    <i class="fas fa-times"></i> Rejeitar
                </button>
                <button class="btn btn-info" onclick="gerarRelatorioPacote(${pacoteId}); fecharModalAcoes();">
                    <i class="fas fa-file-alt"></i> Relatório
                </button>
                <button class="btn btn-primary" onclick="exportarRelatorioPacote(${pacoteId}); fecharModalAcoes();">
                    <i class="fas fa-file-export"></i> Exportar XLSX
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Função auxiliar para fechar modal de ações
function fecharModalAcoes() {
    const modal = document.querySelector('.modal-overlay.modal-acoes');
    if (modal) {
        modal.remove();
    }
}

// Função para exportar relatório de pacote em XLSX - CORRIGIDA
async function exportarRelatorioPacote(pacoteId) {
    try {
        console.log('Exportando relatório XLSX para pacote:', pacoteId);
        
        // Mostrar indicador de carregamento
        const loadingIndicator = document.createElement('div');
        loadingIndicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            text-align: center;
        `;
        loadingIndicator.innerHTML = `
            <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
            <div>Gerando arquivo XLSX...</div>
        `;
        document.body.appendChild(loadingIndicator);
        
        // Fazer download do arquivo XLSX
        const response = await fetch(`${API_URL}/pacotes/${pacoteId}/exportar-xlsx`);
        
        // Remover indicador de carregamento
        document.body.removeChild(loadingIndicator);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
        }
        
        // Verificar se a resposta tem conteúdo
        const contentLength = response.headers.get('content-length');
        if (contentLength === '0' || contentLength === null) {
            throw new Error('Arquivo vazio recebido do servidor');
        }
        
        // Obter o nome do arquivo do header Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `relatorio-pacote-${pacoteId}.xlsx`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }
        
        // Criar blob e link para download
        const blob = await response.blob();
        
        // Verificar se o blob tem conteúdo
        if (blob.size === 0) {
            throw new Error('Arquivo vazio gerado');
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Limpar após download
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
        
        console.log('Relatório XLSX exportado com sucesso:', filename);
        
        // Mostrar mensagem de sucesso
        alert('Relatório XLSX exportado com sucesso!');
        
    } catch (error) {
        console.error('Erro detalhado ao exportar relatório XLSX:', error);
        
        // Remover indicador de carregamento se ainda estiver presente
        const loadingIndicator = document.querySelector('div[style*="position: fixed"]');
        if (loadingIndicator) {
            document.body.removeChild(loadingIndicator);
        }
        
        // Mostrar erro mais específico
        let errorMessage = 'Erro ao exportar relatório XLSX';
        if (error.message.includes('404')) {
            errorMessage = 'Endpoint de exportação não encontrado no servidor';
        } else if (error.message.includes('500')) {
            errorMessage = 'Erro interno do servidor ao gerar o arquivo';
        } else if (error.message.includes('vazio')) {
            errorMessage = 'Arquivo vazio - verifique se o pacote tem dados válidos';
        } else {
            errorMessage += ': ' + error.message;
        }
        
        alert(errorMessage);
    }
}

// ===== FUNÇÕES PARA RETIRADAS PENDENTES =====

// Carregar retiradas pendentes
async function carregarRetiradasPendentes() {
    try {
        const container = document.getElementById('retiradasPendentesContainer');
        container.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i>
                Carregando retiradas pendentes...
            </div>
        `;

        const response = await fetch('/api/retiradas-pendentes');
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        const retiradas = result.data;
        
        if (retiradas.length === 0) {
            container.innerHTML = `
                <div class="empty-message">
                    <i class="fas fa-check-circle"></i>
                    Não há retiradas pendentes de confirmação
                </div>
            `;
            return;
        }

        container.innerHTML = retiradas.map(retirada => criarCardRetirada(retirada)).join('');
        
    } catch (error) {
        console.error('Erro ao carregar retiradas pendentes:', error);
        const container = document.getElementById('retiradasPendentesContainer');
        container.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-exclamation-triangle"></i>
                Erro ao carregar retiradas pendentes: ${error.message}
            </div>
        `;
    }
}

// Criar card para uma retirada pendente
function criarCardRetirada(retirada) {
    const dataAprovacao = new Date(retirada.data_aprovacao).toLocaleString();
    const estoqueWarning = retirada.estoque_atual < retirada.quantidade ? 'style="color: #dc3545; font-weight: bold;"' : '';
    
    return `
        <div class="retirada-card" data-retirada-id="${retirada.id}">
            <div class="retirada-header">
                <div class="retirada-info">
                    <h4>${retirada.item_nome}</h4>
                    <small>Requisição #${retirada.requisicao_id}</small>
                </div>
                <div class="retirada-status">
                    Pendente Confirmação
                </div>
            </div>
            
            <div class="retirada-details">
                <div class="detail-item">
                    <span class="detail-label">Quantidade Solicitada</span>
                    <span class="detail-value">${retirada.quantidade}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Estoque Atual</span>
                    <span class="detail-value" ${estoqueWarning}>${retirada.estoque_atual}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Centro de Custo</span>
                    <span class="detail-value">${retirada.centro_custo || 'Não informado'}</span>
                </div>

                <div class="detail-item">
                    <span class="detail-label">Solicitado por</span>
                    <span class="detail-value">${retirada.usuario_nome || 'Não informado'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Aprovado por</span>
                    <span class="detail-value">${retirada.aprovador_nome || 'Não informado'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Data da Aprovação</span>
                    <span class="detail-value">${dataAprovacao}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Justificativa</span>
                    <span class="detail-value">${retirada.justificativa || 'Não informado'}</span>
                </div>
            </div>
            
            ${retirada.estoque_atual < retirada.quantidade ? 
                `<div class="alert alert-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    Atenção: Estoque insuficiente para confirmar esta retirada!
                </div>` : ''
            }
            
            <div class="retirada-actions">
                <button class="btn-cancelar" onclick="abrirModalCancelamento(${retirada.id})">
                    <i class="fas fa-times"></i>
                    Cancelar
                </button>
                <button class="btn-confirmar" onclick="confirmarRetirada(${retirada.id})" 
                        ${retirada.estoque_atual < retirada.quantidade ? 'disabled title="Estoque insuficiente"' : ''}>
                    <i class="fas fa-check"></i>
                    Confirmar Retirada
                </button>
            </div>
        </div>
    `;
}

// Confirmar retirada
async function confirmarRetirada(retiradaId) {
    if (!confirm('Tem certeza que deseja confirmar esta retirada? O item será debitado do estoque.')) {
        return;
    }
    
    try {
        const usuario = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        
        // Verificar se o usuário está logado
        if (!usuario || !usuario.id) {
            mostrarAlerta('Erro: Usuário não está logado. Faça login novamente.', 'error');
            window.location.href = 'login.html';
            return;
        }
        
        const response = await fetch(`/api/retiradas-pendentes/${retiradaId}/confirmar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                confirmado_por: {
                    id: usuario.id,
                    name: usuario.name
                }
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message);
        }
        
        // Mostrar mensagem de sucesso
        mostrarAlerta('Retirada confirmada com sucesso!', 'success');
        
        // Recarregar lista
        carregarRetiradasPendentes();
        
    } catch (error) {
        console.error('Erro ao confirmar retirada:', error);
        mostrarAlerta('Erro ao confirmar retirada: ' + error.message, 'error');
    }
}

// Abrir modal de cancelamento
function abrirModalCancelamento(retiradaId) {
    const modal = document.createElement('div');
    modal.className = 'cancel-modal';
    modal.innerHTML = `
        <div class="cancel-modal-content">
            <h3>Cancelar Retirada</h3>
            <p>Tem certeza que deseja cancelar esta retirada? Esta ação não pode ser desfeita.</p>
            
            <div class="cancel-form">
                <label for="motivoCancelamento">Motivo do cancelamento:</label>
                <textarea id="motivoCancelamento" placeholder="Digite o motivo do cancelamento..."></textarea>
                
                <div class="cancel-form-actions">
                    <button class="btn btn-secondary" onclick="fecharModalCancelamento()">
                        Cancelar
                    </button>
                    <button class="btn-cancelar" onclick="confirmarCancelamento(${retiradaId})">
                        <i class="fas fa-times"></i>
                        Confirmar Cancelamento
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Fechar modal de cancelamento
function fecharModalCancelamento() {
    const modal = document.querySelector('.cancel-modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

// Confirmar cancelamento da retirada
async function confirmarCancelamento(retiradaId) {
    try {
        const motivo = document.getElementById('motivoCancelamento').value.trim();
        const usuario = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        
        // Verificar se o usuário está logado
        if (!usuario || !usuario.id) {
            mostrarAlerta('Erro: Usuário não está logado. Faça login novamente.', 'error');
            window.location.href = 'login.html';
            return;
        }
        
        const response = await fetch(`/api/retiradas-pendentes/${retiradaId}/cancelar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cancelado_por: {
                    id: usuario.id,
                    name: usuario.name
                },
                motivo: motivo
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message);
        }
        
        // Fechar modal
        fecharModalCancelamento();
        
        //  mensagem de sucesso
        mostrarAlerta('Retirada cancelada com sucesso!', 'success');
        
        // Recarregar 
        carregarRetiradasPendentes();
        
    } catch (error) {
        console.error('Erro ao cancelar retirada:', error);
        mostrarAlerta('Erro ao cancelar retirada: ' + error.message, 'error');
    }
}

// Mostrar alerta
function mostrarAlerta(mensagem, tipo) {
    const container = document.getElementById('retiradasPendentesContainer');
    const alerta = document.createElement('div');
    alerta.className = `alert alert-${tipo}`;
    alerta.innerHTML = mensagem;
    
    container.insertBefore(alerta, container.firstChild);
    

    setTimeout(() => {
        if (alerta.parentNode) {
            alerta.parentNode.removeChild(alerta);
        }
    }, 5000);
}

// Carregar retiradas automaticamente quando a seção for exibida
document.addEventListener('DOMContentLoaded', function() {
    // Adicionar listener para carregar retiradas quando a seção for exibida
    const originalShowSection = window.showSection;
    window.showSection = function(sectionId) {
        originalShowSection(sectionId);
        
        if (sectionId === 'confirmarRetiradas') {
            carregarRetiradasPendentes();
        }
    };
});