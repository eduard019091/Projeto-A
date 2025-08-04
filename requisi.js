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
        el.style.display = isAdmin ? 'block' : 'none';
    });

    // Configurar o botão de voltar ao estoque
    const btnVoltar = document.getElementById('btnVoltarEstoque');
    if (btnVoltar) {
        btnVoltar.style.display = isAdmin ? 'block' : 'none';
        btnVoltar.onclick = function() {
            window.location.href = 'index.html';
        };
    }
}

// Carrega itens disponíveis no select - FUNÇÃO CORRIGIDA
async function carregarItensDisponiveis() {
    try {
        const response = await fetch(`${API_URL}/itens`);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        itensEstoque = await response.json();
        
        // Atualizar ambos os selects: itemSelect (pacotes) e itemRequisicao (requisições individuais)
        const selects = ['itemSelect', 'itemRequisicao'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
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
        });

        console.log(`Carregados ${itensEstoque.length} itens do estoque`);
    } catch (error) {
        console.error('Erro detalhado ao carregar itens:', error);
        alert('Erro ao carregar lista de itens disponíveis. Verifique o console para mais detalhes.');
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
function inicializarSistemaRequisicoes() {
    // Verificar se o usuário está logado
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    if (!userData.id) {
        alert('Você precisa estar logado para acessar o sistema.');
        window.location.href = 'login.html';
        return;
    }
    
    // Carregar dados específicos do usuário
    carregarDadosUsuario();
    
    // Carregar itens para ambos os selects
    carregarItensDisponiveis(); // Esta função agora atualiza ambos os selects
    
    // Carregar requisições do usuário
    carregarMinhasRequisicoes();
    
    // Carregar pacotes do usuário
    carregarMeusPacotes();
    
    // Se for admin, carregar requisições pendentes
    if (isUserAdmin()) {
        carregarRequisicoesPendentes();
    }
    
    // Configurar interface baseada no tipo de usuário
    setTimeout(() => {
        configureUserInterface();
    }, 100);
}

// Função para carregar dados do usuário logado
function carregarDadosUsuario() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    
    // Adicionar indicador do tipo de usuário na interface
    const userTypeIndicator = document.createElement('div');
    userTypeIndicator.className = 'user-type-indicator';
    userTypeIndicator.innerHTML = `
        <span class="user-info">
            Logado como: <strong>${userData.name}</strong> 
            ${userData.userType === 'admin' ? '(Administrador)' : '(Usuário)'}
        </span>
    `;
    
    // Adicionar ao header
    const header = document.querySelector('.header');
    if (header) {
        header.appendChild(userTypeIndicator);
    }
}

// Função para carregar requisições do usuário
function carregarMinhasRequisicoes() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    fetch(`${API_URL}/requisicoes/usuario/${userData.id}`)
        .then(response => response.json())
        .then(data => {
            const tabela = document.getElementById('tabelaMinhasRequisicoes').getElementsByTagName('tbody')[0];
            tabela.innerHTML = '';
            data.forEach(req => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(req.data).toLocaleDateString()}</td>
                    <td>${req.item_nome}</td>
                    <td>${req.quantidade}</td>
                    <td>${req.centroCusto}</td>
                    <td><span class="status-${req.status}">${req.status}</span></td>
                    <td>${req.observacoes || '-'}</td>
                `;
                tabela.appendChild(tr);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar requisições:', error);
        });
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
                pacoteDiv.style.cssText = `
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 15px;
                    background: white;
                `;
                
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
                    <button class="btn btn-info btn-sm" onclick="verItensPacote(${pacote.id})" style="margin-top: 10px;">
                        Ver Itens
                    </button>
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
            modal.className = 'modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
            `;
            
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

// Função para carregar requisições pendentes (admin)
function carregarRequisicoesPendentes() {
    // Primeiro carregar pacotes pendentes
    fetch(`${API_URL}/pacotes/pendentes`)
        .then(response => response.json())
        .then(pacotes => {
            const tabela = document.getElementById('tabelaAprovarRequisicoes').getElementsByTagName('tbody')[0];
            tabela.innerHTML = '';
            
            // Adicionar pacotes como itens únicos
            pacotes.forEach(pacote => {
                const tr = document.createElement('tr');
                tr.className = 'pacote-row';
                tr.setAttribute('data-pacote-id', pacote.id);
                tr.innerHTML = `
                    <td>${new Date(pacote.data_criacao).toLocaleDateString()}</td>
                    <td>${pacote.usuario_nome}</td>
                    <td>
                        <strong>📦 PACOTE</strong><br>
                        <small>${pacote.total_itens} itens • ${pacote.total_quantidade} unidades</small>
                        <br><small>Projeto: ${pacote.projeto}</small>
                    </td>
                    <td>${pacote.total_quantidade}</td>
                    <td>${pacote.centroCusto}</td>
                    <td>${pacote.projeto}</td>
                    <td>${pacote.justificativa}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="expandirPacote(${pacote.id})">Ver Itens</button>
                        <button class="btn btn-success btn-sm" onclick="aprovarPacoteCompleto(${pacote.id})">Aprovar Tudo</button>
                        <button class="btn btn-danger btn-sm" onclick="rejeitarPacoteCompleto(${pacote.id})">Rejeitar</button>
                    </td>
                `;
                tabela.appendChild(tr);
            });
            
            // Depois carregar requisições individuais (não de pacotes)
            return fetch(`${API_URL}/requisicoes/pendentes`);
        })
        .then(response => response.json())
        .then(requisicoes => {
            const tabela = document.getElementById('tabelaAprovarRequisicoes').getElementsByTagName('tbody')[0];
            
            // Filtrar apenas requisições que não são de pacotes
            const requisicoesIndividuais = requisicoes.filter(req => !req.pacoteId);
            
            requisicoesIndividuais.forEach(req => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(req.data).toLocaleDateString()}</td>
                    <td>${req.usuario_nome}</td>
                    <td>${req.item_nome}</td>
                    <td>${req.quantidade}</td>
                    <td>${req.centroCusto}</td>
                    <td>${req.projeto}</td>
                    <td>${req.justificativa}</td>
                    <td>
                        <button class="btn btn-success" onclick="aprovarRequisicao(${req.id})">Aprovar</button>
                        <button class="btn btn-danger" onclick="rejeitarRequisicao(${req.id})">Rejeitar</button>
                    </td>
                `;
                tabela.appendChild(tr);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar requisições pendentes:', error);
        });
}

// Função para aprovar requisição
function aprovarRequisicao(id) {
    fetch(`${API_URL}/requisicoes/${id}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Requisição aprovada com sucesso!');
            carregarRequisicoesPendentes();
            carregarMinhasRequisicoes();
            carregarMeusPacotes();
        } else {
            alert(data.message || 'Erro ao aprovar requisição');
        }
    })
    .catch(error => {
        alert('Erro ao aprovar requisição');
    });
}

// Função para rejeitar requisição
function rejeitarRequisicao(id) {
    const motivo = prompt('Motivo da rejeição:');
    if (motivo === null) return;
    
    fetch(`${API_URL}/requisicoes/${id}/rejeitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Requisição rejeitada com sucesso!');
            carregarRequisicoesPendentes();
            carregarMinhasRequisicoes();
            carregarMeusPacotes();
        } else {
            alert(data.message || 'Erro ao rejeitar requisição');
        }
    })
    .catch(error => {
        alert('Erro ao rejeitar requisição');
    });
}

// Função para expandir pacote e mostrar itens
function expandirPacote(pacoteId) {
    fetch(`${API_URL}/pacotes/${pacoteId}/itens`)
        .then(response => response.json())
        .then(itens => {
            // Criar modal para mostrar itens do pacote
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 800px;
                max-height: 80vh;
                overflow-y: auto;
            `;
            
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
                itensHtml += `
                    <tr>
                        <td>
                            <input type="checkbox" class="item-checkbox" value="${item.id}" 
                                   ${disponivel ? '' : 'disabled'}>
                        </td>
                        <td>${item.item_nome}</td>
                        <td>${item.quantidade}</td>
                        <td>${item.estoque_disponivel}</td>
                        <td>
                            <span class="status-${item.status}">${item.status}</span>
                            ${!disponivel ? '<br><small style="color: red;">Indisponível</small>' : ''}
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
    const modal = document.querySelector('.modal');
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
            carregarMinhasRequisicoes();
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
            carregarMinhasRequisicoes();
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
            carregarMinhasRequisicoes();
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
            carregarMinhasRequisicoes();
            carregarMeusPacotes();
        } else {
            alert(data.message || 'Erro ao rejeitar pacote');
        }
    })
    .catch(error => {
        alert('Erro ao rejeitar pacote');
    });
}

// Função para enviar nova requisição individual
function enviarNovaRequisicao(event) {
    event.preventDefault();
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const itemId = document.getElementById('itemRequisicao').value;
    const quantidade = document.getElementById('quantidadeRequisicao').value;
    const centroCusto = document.getElementById('centroCusto').value;
    const projeto = document.getElementById('projeto').value;
    const justificativa = document.getElementById('justificativa').value;
    
    if (!itemId || !quantidade || !centroCusto || !projeto) {
        alert('Preencha todos os campos obrigatórios!');
        return;
    }
    
    fetch(`${API_URL}/requisicoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: userData.id,
            itemId,
            quantidade,
            centroCusto,
            projeto,
            justificativa
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Requisição enviada com sucesso!');
            document.getElementById('requisicaoForm').reset();
            carregarMinhasRequisicoes();
            if (isUserAdmin()) {
                carregarRequisicoesPendentes();
            }
        } else {
            alert(data.message || 'Erro ao enviar requisição');
        }
    })
    .catch(error => {
        alert('Erro ao enviar requisição');
    });
}

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
            carregarMinhasRequisicoes();
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
    logoutButton.className = 'btn btn-logout';
    logoutButton.textContent = 'Sair';
    logoutButton.onclick = logout;
    logoutButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: #dc3545;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        z-index: 1000;
    `;
    
    document.body.appendChild(logoutButton);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Garantir que a página comece no topo
    window.scrollTo(0, 0);
    
    inicializarSistemaRequisicoes();
    adicionarBotaoLogout();
    
    // Event listener para o formulário de requisição individual
    const requisicaoForm = document.getElementById('requisicaoForm');
    if (requisicaoForm) {
        requisicaoForm.addEventListener('submit', enviarNovaRequisicao);
    }
    
    // Event listener para o formulário de pacote
    const pacoteForm = document.getElementById('pacoteForm');
    if (pacoteForm) {
        pacoteForm.addEventListener('submit', criarPacoteRequisicoes);
    }
});

// Garantir que a página comece no topo após carregamento completo
window.addEventListener('load', function() {
    window.scrollTo(0, 0);
});

// Função para mostrar seções (se não estiver definida no HTML)
function showSection(sectionId) {
    // Ocultar todas as seções
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remover classe active de todos os botões
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar seção selecionada
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
    
    // Adicionar classe active no botão correspondente (se existir event.target)
    if (event && event.target) {
        event.target.classList.add('active');
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