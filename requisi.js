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
        // Carregar projetos
        const projetosResponse = await fetch(`${API_URL}/projetos`);
        if (projetosResponse.ok) {
            const projetos = await projetosResponse.json();
            const projetoSelect = document.getElementById('projeto');
            if (projetoSelect) {
                projetoSelect.innerHTML = '<option value="">Selecione um projeto...</option>';
                projetos.forEach(projeto => {
                    const option = document.createElement('option');
                    option.value = projeto.nome;
                    option.textContent = projeto.nome;
                    projetoSelect.appendChild(option);
                });
            }
        }

        // Carregar centros de custo
        const centrosResponse = await fetch(`${API_URL}/centros-custo`);
        if (centrosResponse.ok) {
            const centrosCusto = await centrosResponse.json();
            const centroSelect = document.getElementById('centroCusto');
            if (centroSelect) {
                centroSelect.innerHTML = '<option value="">Selecione um centro de custo...</option>';
                centrosCusto.forEach(centro => {
                    const option = document.createElement('option');
                    option.value = centro.nome;
                    option.textContent = centro.nome;
                    centroSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Erro ao carregar configurações de pacotes:', error);
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
    
    // Carregar itens para o select de pacotes
    carregarItensDisponiveis();
    
    // Carregar configurações de pacotes
    carregarConfiguracoesPacotes();
    
    // Carregar pacotes do usuário
    carregarMeusPacotes();
    
    // Se for admin, carregar pacotes pendentes
    if (isUserAdmin()) {
        carregarRequisicoesPendentes();
    }
    
    // Configurar interface baseada no tipo de usuário
    setTimeout(() => {
        configureUserInterface();
    }, 100);
}

// Função para exportar pacotes para Excel
function exportarPacotesParaExcel(pacotes, tipo = 'meus-pacotes') {
    // Criar uma nova planilha
    const wb = XLSX.utils.book_new();
    
    pacotes.forEach(pacote => {
        // Formatar dados do pacote
        const dadosPacote = {
            'ID do Pacote': pacote.id,
            'Data de Criação': new Date(pacote.data_criacao).toLocaleString(),
            'Centro de Custo': pacote.centroCusto,
            'Projeto': pacote.projeto,
            'Justificativa': pacote.justificativa,
            'Status': pacote.status,
            'Total de Itens': pacote.itens ? pacote.itens.length : 0
        };

        // Criar planilha para o pacote
        const wsPacote = XLSX.utils.json_to_sheet([dadosPacote]);
        
        // Adicionar espaço entre as tabelas
        XLSX.utils.sheet_add_json(wsPacote, [{}], {origin: -1});
        
        // Adicionar itens do pacote
        if (pacote.itens && pacote.itens.length > 0) {
            const dadosItens = pacote.itens.map(item => ({
                'Item': item.nome,
                'Quantidade': item.quantidade,
                'Status': item.status || pacote.status
            }));
            XLSX.utils.sheet_add_json(wsPacote, dadosItens, {origin: -1});
        }
        
        // Adicionar a planilha ao workbook
        XLSX.utils.book_append_sheet(wb, wsPacote, `Pacote ${pacote.id}`);
    });

    // Gerar nome do arquivo
    const dataHora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const nomeArquivo = `${tipo}-${dataHora}.xlsx`;
    
    // Salvar o arquivo
    XLSX.writeFile(wb, nomeArquivo);
}

// Botões de exportação para as seções
function adicionarBotoesExportacao() {
    // Botão para Meus Pacotes
    const containerMeusPacotes = document.getElementById('listaPacotes');
    if (containerMeusPacotes) {
        const btnExportar = document.createElement('button');
        btnExportar.className = 'btn btn-warning';
        btnExportar.innerHTML = 'Exportar para Excel';
        btnExportar.onclick = async function() {
            const response = await fetch(`${API_URL}/pacotes-requisicao/meus-pacotes`);
            const pacotes = await response.json();
            exportarPacotesParaExcel(pacotes, 'meus-pacotes');
        };
        containerMeusPacotes.parentNode.insertBefore(btnExportar, containerMeusPacotes);
    }

    // Botão para Aprovar Pacotes (apenas para admin)
    if (isUserAdmin()) {
        const containerAprovarPacotes = document.getElementById('aprovarPacotes');
        if (containerAprovarPacotes) {
            const btnExportar = document.createElement('button');
            btnExportar.className = 'btn btn-warning';
            btnExportar.innerHTML = 'Exportar Pendentes para Excel';
            btnExportar.onclick = async function() {
                const response = await fetch(`${API_URL}/pacotes-requisicao/pendentes`);
                const pacotes = await response.json();
                exportarPacotesParaExcel(pacotes, 'pacotes-pendentes');
            };
            containerAprovarPacotes.insertBefore(btnExportar, containerAprovarPacotes.firstChild);
        }
    }
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

// Função para carregar requisições do usuário (agora apenas através de pacotes)
function carregarMinhasRequisicoes() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    fetch(`${API_URL}/pacotes/usuario/${userData.id}`)
        .then(response => response.json())
        .then(pacotes => {
            const tabela = document.getElementById('tabelaMinhasRequisicoes').getElementsByTagName('tbody')[0];
            tabela.innerHTML = '';
            
            if (pacotes.length === 0) {
                tabela.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhuma requisição encontrada</td></tr>';
                return;
            }
            
            pacotes.forEach(pacote => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(pacote.data_criacao).toLocaleDateString()}</td>
                    <td>📦 Pacote #${pacote.id} (${pacote.total_itens || 0} itens)</td>
                    <td>${pacote.total_quantidade || 0}</td>
                    <td>${pacote.centroCusto}</td>
                    <td><span class="status-${pacote.status}">${pacote.status}</span></td>
                    <td>${pacote.observacoes || '-'}</td>
                `;
                tabela.appendChild(tr);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar pacotes:', error);
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
            modal.className = 'modal';
            
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
                                        <button class="btn btn-info btn-sm" onclick="expandirPacote(${pacote.id})">Ver Itens</button>
                <button class="btn btn-success btn-sm" onclick="aprovarPacoteCompleto(${pacote.id})">Aprovar Tudo</button>
                <button class="btn btn-warning btn-sm" onclick="editarPacote(${pacote.id})">Editar Pacote</button>
                <button class="btn btn-danger btn-sm" onclick="rejeitarPacoteCompleto(${pacote.id})">Rejeitar</button>
                <button class="btn btn-secondary btn-sm" onclick="gerarRelatorioPacote(${pacote.id})">Relatório</button>
                <button class="btn btn-primary btn-sm" onclick="exportarRelatorioPacote(${pacote.id})">Exportar CSV</button>
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
    logoutButton.className = 'btn btn-logout';
    logoutButton.textContent = 'Sair';
    logoutButton.onclick = logout;
    logoutButton.className += ' btn-logout';
    
    document.body.appendChild(logoutButton);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Garantir que a página comece no topo
    window.scrollTo(0, 0);
    
    inicializarSistemaRequisicoes();
    adicionarBotaoLogout();
    
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
    document.getElementById(`config-${tabName}`).classList.add('active');
    
    // Adicionar classe active no botão correspondente
    event.target.classList.add('active');
    
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
        modal.className = 'modal';
        modal.style.display = 'block';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
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
        modal.className = 'modal';
        modal.style.display = 'block';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
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
        a.style.display = 'none';
        
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
        
        pacote.style.display = mostrar ? '' : 'none';
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
        pacote.style.display = '';
    });
}