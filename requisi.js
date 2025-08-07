// Configuração da API
const API_URL = '/api'; // Simplificado para usar caminho relativo

let itensPacoteAtual = [];
let itensEstoque = [];

// Função para verificar se o usuário é admin
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

// Carregar projetos e centros de custo para os selects
async function carregarConfiguracoesPacotes() {
    try {
        // Carregar projetos e centros de custo em paralelo
        const [projetosResponse, centrosResponse] = await Promise.all([
            fetch(`${API_URL}/projetos`),
            fetch(`${API_URL}/centros-custo`)
        ]);

        // Verificar respostas
        if (!projetosResponse.ok) throw new Error('Erro ao carregar projetos');
        if (!centrosResponse.ok) throw new Error('Erro ao carregar centros de custo');

        // Processar dados
        const [projetos, centrosCusto] = await Promise.all([
            projetosResponse.json(),
            centrosResponse.json()
        ]);

        // Atualizar select de projetos
        const projetoSelect = document.getElementById('projeto');
        if (projetoSelect) {
            projetoSelect.innerHTML = '<option value="">Selecione um projeto...</option>';
            projetos.forEach(projeto => {
                if (projeto.ativo) {
                    const option = document.createElement('option');
                    option.value = projeto.nome;
                    option.textContent = projeto.nome;
                    projetoSelect.appendChild(option);
                }
            });
        }

        // Atualizar select de centros de custo
        const centroSelect = document.getElementById('centroCusto');
        if (centroSelect) {
            centroSelect.innerHTML = '<option value="">Selecione um centro de custo...</option>';
            centrosCusto.forEach(centro => {
                if (centro.ativo) {
                    const option = document.createElement('option');
                    option.value = centro.nome;
                    option.textContent = centro.nome;
                    centroSelect.appendChild(option);
                }
            });
        }

        console.log('Configurações carregadas:', {
            projetos: projetos.length,
            centrosCusto: centrosCusto.length
        });
    } catch (error) {
        console.error('Erro ao carregar configurações de pacotes:', error);
        alert('Erro ao carregar projetos e centros de custo. Por favor, recarregue a página.');
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
        
        // Carregar todos os dados necessários em paralelo
        await Promise.all([
            carregarItensDisponiveis(),
            carregarConfiguracoesPacotes(),
            carregarMeusPacotes()
        ]);
        
        // Se for admin, carregar pacotes pendentes
        if (isUserAdmin()) {
            await carregarRequisicoesPendentes();
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
                               pacote.status === 'rejeitado' ? 'status-rejeitado' :
                               pacote.status === 'parcialmente aprovado' ? 'status-parcialmente-aprovado' :
                               'status-pendente';
                
                pacoteDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h4>Pacote #${pacote.id}</h4>
                            <p><strong>Projeto:</strong> ${pacote.projeto}</p>
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
                        ${pacote.status === 'aprovado' || pacote.status === 'rejeitado' || pacote.status === 'parcialmente aprovado' ? 
                            `<button class="btn btn-primary btn-sm" onclick="exportarRelatorioPacote(${pacote.id})">Exportar CSV</button>` : 
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
                <table class="table">
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
                <div style="margin-top: 20px; text-align: right;">
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
            const tabela = document.getElementById('tabelaAprovarRequisicoes').getElementsByTagName('tbody')[0];
            tabela.innerHTML = '';
            
            if (pacotes.length === 0) {
                tabela.innerHTML = '<tr><td colspan="8" style="text-align: center;">Nenhum pacote pendente encontrado</td></tr>';
                return;
            }
            
            // Adicionar pacotes como itens únicos
            pacotes.forEach(pacote => {
                const tr = document.createElement('tr');
                tr.className = 'pacote-row';
                tr.setAttribute('data-pacote-id', pacote.id);
                tr.innerHTML = `
                    <td>${new Date(pacote.data_criacao).toLocaleDateString()}</td>
                    <td>${pacote.usuario_nome}</td>
                    <td>
                        <strong>📦 PACOTE #${pacote.id}</strong><br>
                        <small>${pacote.total_itens} itens • ${pacote.total_quantidade} unidades</small>
                        <br><small>Projeto: ${pacote.projeto}</small>
                    </td>
                    <td>${pacote.total_quantidade}</td>
                    <td>${pacote.centroCusto}</td>
                    <td>${pacote.projeto}</td>
                    <td>${pacote.justificativa}</td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-primary btn-sm dropdown-toggle" onclick="toggleDropdown(${pacote.id})">
                                Ações
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div id="dropdown-${pacote.id}" class="dropdown-menu">
                                <a href="#" onclick="expandirPacote(${pacote.id}); return false;">
                                    <i class="fas fa-eye"></i> Ver Itens
                                </a>
                                <a href="#" onclick="aprovarPacoteCompleto(${pacote.id}); return false;">
                                    <i class="fas fa-check"></i> Aprovar Tudo
                                </a>
                                <a href="#" onclick="editarPacote(${pacote.id}); return false;">
                                    <i class="fas fa-edit"></i> Editar Pacote
                                </a>
                                <a href="#" onclick="rejeitarPacoteCompleto(${pacote.id}); return false;">
                                    <i class="fas fa-times"></i> Rejeitar
                                </a>
                                <a href="#" onclick="gerarRelatorioPacote(${pacote.id}); return false;">
                                    <i class="fas fa-file-alt"></i> Relatório
                                </a>
                                <a href="#" onclick="exportarRelatorioPacote(${pacote.id}); return false;">
                                    <i class="fas fa-file-export"></i> Exportar CSV
                                </a>
                            </div>
                        </div>
                    </td>
                `;
                tabela.appendChild(tr);
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
                <table class="table">
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
                            ${item.status === 'aprovado' ? '<br><small style="color: green;">✓ Já aprovado</small>' : ''}
                            ${item.status === 'rejeitado' ? '<br><small style="color: red;">✗ Já rejeitado</small>' : ''}
                        </td>
                    </tr>
                `;
            });
            
            itensHtml += `
                    </tbody>
                </table>
                <div style="margin-top: 20px; text-align: right;">
                    <button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
                    <button class="btn btn-danger" onclick="negarItensSelecionados(${pacoteId})">Negar Selecionados</button>
                    <button class="btn btn-success" onclick="aprovarItensSelecionados(${pacoteId})">Aprovar Selecionados</button>
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
        body: JSON.stringify({ itemIds })
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
        headers: { 'Content-Type': 'application/json' }
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
    const projeto = document.getElementById('projeto').value;
    const justificativa = document.getElementById('justificativa').value;
    
    if (!centroCusto || !projeto || !justificativa) {
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
            projeto,
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
        const projetoForm = document.getElementById('projetoForm');
        if (projetoForm) {
            projetoForm.addEventListener('submit', criarProjeto);
        }
        
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
    
    // Fazer scroll para o topo da página com múltiplas opções para garantir compatibilidade
    setTimeout(() => {
        // Método 1: scrollTo com smooth behavior
        if (window.scrollTo) {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
        
        // Método 2: scrollTop como fallback
        if (document.documentElement.scrollTop !== undefined) {
            document.documentElement.scrollTop = 0;
        }
        
        // Método 3: scrollTop do body como fallback adicional
        if (document.body.scrollTop !== undefined) {
            document.body.scrollTop = 0;
        }
    }, 100);
}

// ===== NOVAS FUNÇÕES PARA CONFIGURAÇÕES =====

// Função para mostrar abas de configuração
function showConfigTab(tabName) {
    // Ocultar todas as seções
    document.querySelectorAll('.config-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remover classe active de todos os botões
    document.querySelectorAll('.config-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar seção selecionada
    const selectedSection = document.getElementById(`config-${tabName}`);
    if (selectedSection) {
        selectedSection.classList.add('active');
    }
    
    // Adicionar classe active no botão correspondente
    const activeButton = event.target.closest('.config-tab');
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Carregar dados da aba selecionada
    if (tabName === 'projetos') {
        carregarProjetos();
    } else if (tabName === 'centros-custo') {
        carregarCentrosCusto();
    }
}

// Funções para gerenciar projetos
async function carregarProjetos() {
    try {
        const response = await fetch(`${API_URL}/projetos`);
        if (!response.ok) throw new Error('Erro ao carregar projetos');
        
        const projetos = await response.json();
        const tbody = document.querySelector('#tabelaProjetos tbody');
        tbody.innerHTML = '';
        
        projetos.forEach(projeto => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${projeto.nome}</td>
                <td>${projeto.descricao || '-'}</td>
                <td><span class="status-ativo">Ativo</span></td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editarProjeto(${projeto.id})">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="removerProjeto(${projeto.id})">Remover</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Erro ao carregar projetos:', error);
        alert('Erro ao carregar projetos');
    }
}

async function criarProjeto(event) {
    event.preventDefault();
    
    const nome = document.getElementById('projetoNome').value.trim();
    const descricao = document.getElementById('projetoDescricao').value.trim();
    
    if (!nome) {
        alert('Nome do projeto é obrigatório');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/projetos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, descricao })
        });
        
        if (!response.ok) throw new Error('Erro ao criar projeto');
        
        const result = await response.json();
        if (result.success) {
            alert('Projeto criado com sucesso!');
            document.getElementById('projetoForm').reset();
            carregarProjetos();
        } else {
            alert(result.message || 'Erro ao criar projeto');
        }
    } catch (error) {
        console.error('Erro ao criar projeto:', error);
        alert('Erro ao criar projeto');
    }
}

async function editarProjeto(id) {
    const novoNome = prompt('Digite o novo nome do projeto:');
    if (!novoNome) return;
    
    const novaDescricao = prompt('Digite a nova descrição (opcional):');
    
    try {
        const response = await fetch(`${API_URL}/projetos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                nome: novoNome, 
                descricao: novaDescricao || '', 
                ativo: 1 
            })
        });
        
        if (!response.ok) throw new Error('Erro ao atualizar projeto');
        
        const result = await response.json();
        if (result.success) {
            alert('Projeto atualizado com sucesso!');
            carregarProjetos();
        } else {
            alert(result.message || 'Erro ao atualizar projeto');
        }
    } catch (error) {
        console.error('Erro ao atualizar projeto:', error);
        alert('Erro ao atualizar projeto');
    }
}

async function removerProjeto(id) {
    if (!confirm('Tem certeza que deseja remover este projeto?')) return;
    
    try {
        const response = await fetch(`${API_URL}/projetos/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Erro ao remover projeto');
        
        const result = await response.json();
        if (result.success) {
            alert('Projeto removido com sucesso!');
            carregarProjetos();
        } else {
            alert(result.message || 'Erro ao remover projeto');
        }
    } catch (error) {
        console.error('Erro ao remover projeto:', error);
        alert('Erro ao remover projeto');
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
    
    if (!nome) {
        alert('Nome do centro de custo é obrigatório');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/centros-custo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, descricao })
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
    
    try {
        const response = await fetch(`${API_URL}/centros-custo/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                nome: novoNome, 
                descricao: novaDescricao || '', 
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
                        <div class="relatorio-info-item">
                            <div class="relatorio-info-label">Projeto</div>
                            <div class="relatorio-info-value">${pacote.projeto}</div>
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
                                        <td>${item.status === 'aprovado' ? item.quantidade : 0}</td>
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
                                <span class="relatorio-info-label">Projeto:</span>
                                <span class="relatorio-info-value">${pacote.projeto || 'N/A'}</span>
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
                                                        <span style="color: ${item.status === 'aprovado' ? 'green' : 'red'};">
                                                            ${item.status === 'aprovado' ? '✓ Aprovado' : '✗ Rejeitado'}
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
                    modal.remove();
                    carregarRequisicoesPendentes();
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
        console.log('Exportando relatório CSV para pacote:', pacoteId);
        
        // Fazer download do arquivo CSV
        const response = await fetch(`${API_URL}/pacotes/${pacoteId}/exportar-csv`);
        
        if (!response.ok) {
            throw new Error('Erro ao exportar relatório CSV');
        }
        
        // Obter o nome do arquivo do header Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `relatorio-pacote-${pacoteId}.csv`;
        
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
        
        console.log('Relatório CSV exportado com sucesso');
        
    } catch (error) {
        console.error('Erro ao exportar relatório CSV:', error);
        alert('Erro ao exportar relatório CSV: ' + error.message);
    }
}

// Função para filtrar meus pacotes
function filtrarMeusPacotes() {
    const filtroStatus = document.getElementById('filtroStatusMeusPacotes').value;
    const filtroData = document.getElementById('filtroDataMeusPacotes').value;
    const pesquisa = document.getElementById('pesquisaMeusPacotes').value.toLowerCase();
    
    const pacotes = document.querySelectorAll('.pacote-card');
    
    pacotes.forEach(pacote => {
        const statusElement = pacote.querySelector('.status-aprovado, .status-rejeitado, .status-pendente, .status-parcialmente-aprovado');
        const status = statusElement ? statusElement.textContent.toLowerCase() : '';
        const projeto = pacote.querySelector('p:contains("Projeto:")')?.textContent.toLowerCase() || '';
        const centroCusto = pacote.querySelector('p:contains("Centro de Custo:")')?.textContent.toLowerCase() || '';
        const dataElement = pacote.querySelector('p:contains("Data:")');
        const data = dataElement ? dataElement.textContent.split(':')[1]?.trim() : '';
        
        let mostrar = true;
        
        // Filtro por status
        if (filtroStatus && status !== filtroStatus.toLowerCase()) {
            mostrar = false;
        }
        
        // Filtro por data
        if (filtroData && data) {
            const dataPacote = new Date(data.split('/').reverse().join('-'));
            const dataFiltro = new Date(filtroData);
            if (dataPacote.toDateString() !== dataFiltro.toDateString()) {
                mostrar = false;
            }
        }
        
        // Filtro por pesquisa
        if (pesquisa && !centroCusto.includes(pesquisa) && !projeto.includes(pesquisa)) {
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

// Function to toggle dropdown menu
function toggleDropdown(pacoteId) {
    const dropdown = document.getElementById(`dropdown-${pacoteId}`);
    // Close all other dropdowns first
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu.id !== `dropdown-${pacoteId}`) {
            menu.classList.remove('show');
        }
    });
    dropdown.classList.toggle('show');
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function closeDropdown(e) {
        if (!e.target.closest('.dropdown')) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeDropdown);
        }
    });
}