
const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./database');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(__dirname));

// Rota de health check
app.get('/api/health', async (req, res) => {
    try {
        // Verificar conexão com o banco de dados
        let databaseStatus = { status: 'unknown', error: null };
        try {
            await db.run('SELECT 1');
            databaseStatus = { status: 'connected' };
        } catch (dbError) {
            databaseStatus = { status: 'disconnected', error: dbError.message };
        }

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: databaseStatus,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    } catch (error) {
        console.error('Erro no health check:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Rotas de autenticação
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email e senha são obrigatórios' 
            });
        }

        const usuario = await db.autenticarUsuario(email, password);
        
        if (usuario) {
            res.json({
                success: true,
                user: usuario,
                message: 'Login realizado com sucesso'
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, userType } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Nome, email e senha são obrigatórios'
            });
        }

        // Verificar se o usuário já existe
        const usuarioExistente = await db.buscarUsuarioPorEmail(email);
        if (usuarioExistente) {
            return res.status(400).json({
                success: false,
                message: 'Usuário já existe com este email'
            });
        }

        const novoUsuario = await db.cadastrarUsuario({
            name,
            email,
            password,
            userType: userType || 'user'
        });

        res.json({
            success: true,
            user: novoUsuario,
            message: 'Usuário cadastrado com sucesso'
        });
    } catch (error) {
        console.error('Erro no cadastro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rotas para itens
app.get('/api/itens', async (req, res) => {
    try {
        const itens = await db.buscarItens();
        res.json(itens);
    } catch (error) {
        console.error('Erro ao buscar itens:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar itens'
        });
    }
});

// Rota alternativa para estoque (usada pelo dashboard)
app.get('/api/estoque', async (req, res) => {
    try {
        const itens = await db.buscarItens();
        res.json(itens);
    } catch (error) {
        console.error('Erro ao buscar estoque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estoque'
        });
    }
});

app.get('/api/itens/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const item = await db.buscarItemPorId(id);
        
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({
                success: false,
                message: 'Item não encontrado'
            });
        }
    } catch (error) {
        console.error('Erro ao buscar item:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar item'
        });
    }
});

app.post('/api/itens', async (req, res) => {
    try {
        const itemData = req.body;
        
        // Verificar se já existe um item com o mesmo nome e WBS
        const itemExistente = await db.buscarItemPorNomeEWBS(itemData.nome, itemData.serie);
        
        let resultado;
        if (itemExistente) {
            // Se o item existe, atualiza a quantidade
            const novaQuantidade = itemExistente.quantidade + parseInt(itemData.quantidade || 0);
            await db.atualizarQuantidadeItem(itemExistente.id, novaQuantidade);
            
            // Registrar movimentação de entrada
            await db.inserirMovimentacao({
                itemId: itemExistente.id,
                itemNome: itemExistente.nome,
                tipo: 'entrada',
                quantidade: parseInt(itemData.quantidade || 0),
                origem: itemData.origem || 'Não especificada',
                descricao: 'Adição ao estoque existente'
            });
            
            resultado = {
                success: true,
                itemId: itemExistente.id,
                message: 'Quantidade atualizada com sucesso',
                atualizacao: true,
                quantidadeAnterior: itemExistente.quantidade,
                novaQuantidade: novaQuantidade
            };
        } else {
            // Se não existe, cria um novo item
            const novoItemId = await db.inserirItem(itemData);
            
            // Registrar movimentação inicial
            if (itemData.quantidade > 0) {
                await db.inserirMovimentacao({
                    itemId: novoItemId,
                    itemNome: itemData.nome,
                    tipo: 'entrada',
                    quantidade: parseInt(itemData.quantidade || 0),
                    origem: itemData.origem || 'Cadastro inicial',
                    descricao: 'Cadastro inicial do item'
                });
            }
            
            resultado = {
                success: true,
                itemId: novoItemId,
                message: 'Item cadastrado com sucesso',
                atualizacao: false
            };
        }
        
        res.json(resultado);
    } catch (error) {
        console.error('Erro ao processar item:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar item',
            error: error.message
        });
    }
});

// Rota para unificar itens duplicados
app.post('/api/unificar-itens', async (req, res) => {
    try {
        const resultado = await db.unificarItensDuplicados();
        res.json({
            success: true,
            message: 'Itens duplicados unificados com sucesso',
            ...resultado
        });
    } catch (error) {
        console.error('Erro ao unificar itens:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao unificar itens: ' + error.message
        });
    }
});

// REMOVIDO: Rotas obsoletas de requisições normais
// As requisições agora são feitas apenas através de pacotes

// Rotas para pacotes de requisições
app.post('/api/pacotes', async (req, res) => {
    try {
        const { userId, centroCusto, justificativa, itens, projeto: projetoBody } = req.body;
        
        if (!userId || !centroCusto || !justificativa || !itens || !Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos para criar pacote'
            });
        }

        // Verificar disponibilidade de todos os itens
        for (const item of itens) {
            const itemEstoque = await db.buscarItemPorId(item.id);
            if (!itemEstoque) {
                return res.status(404).json({
                    success: false,
                    message: `Item ${item.nome} não encontrado`
                });
            }
            if (itemEstoque.quantidade < item.quantidade) {
                return res.status(400).json({
                    success: false,
                    message: `Quantidade indisponível para ${item.nome}. Disponível: ${itemEstoque.quantidade}`
                });
            }
        }

        // Criar pacote
        const pacoteId = await db.criarPacoteRequisicao({
            userId,
            centroCusto,
            // Campo projeto foi removido do pacote; manter compatibilidade aceitando valor opcional
            projeto: projetoBody || null,
            justificativa
        });

        // Criar requisições individuais para cada item
        const promessas = itens.map(item => {
            return db.criarRequisicao({
                userId,
                itemId: item.id,
                quantidade: item.quantidade,
                centroCusto,
                projeto: projetoBody || null,
                justificativa: `PACOTE: ${justificativa}`,
                pacoteId
            });
        });

        await Promise.all(promessas);

        res.json({
            success: true,
            message: 'Pacote criado com sucesso',
            pacoteId
        });
    } catch (error) {
        console.error('Erro ao criar pacote:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rota para buscar pacotes pendentes
app.get('/api/pacotes/pendentes', async (req, res) => {
    try {
        const pacotes = await db.buscarPacotesPendentes();
        res.json(pacotes);
    } catch (error) {
        console.error('Erro ao buscar pacotes pendentes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar pacotes pendentes'
        });
    }
});

// Rota para buscar itens de um pacote
app.get('/api/pacotes/:id/itens', async (req, res) => {
    try {
        const { id } = req.params;
        const itens = await db.buscarItensPacote(id);
        res.json(itens);
    } catch (error) {
        console.error('Erro ao buscar itens do pacote:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar itens do pacote'
        });
    }
});

// Rota para buscar pacotes do usuário
app.get('/api/pacotes/usuario/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const pacotes = await db.buscarPacotesUsuario(userId);
        res.json(pacotes);
    } catch (error) {
        console.error('Erro ao buscar pacotes do usuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar pacotes do usuário'
        });
    }
});

// Rota para aprovar pacote completo
app.post('/api/pacotes/:id/aprovar', async (req, res) => {
    try {
        const { id } = req.params;
        const { aprovador_id, aprovador_nome } = req.body || {};
        await db.aprovarPacoteCompleto(id, { aprovador_id, aprovador_nome });
        res.json({
            success: true,
            message: 'Pacote aprovado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao aprovar pacote:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao aprovar pacote'
        });
    }
});

// Rota para aprovar itens específicos do pacote
app.post('/api/pacotes/:id/aprovar-itens', async (req, res) => {
    try {
        const { id } = req.params;
        const { itemIds, aprovador_id, aprovador_nome } = req.body;
        
        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Lista de itens é obrigatória'
            });
        }

        await db.aprovarItensPacote(id, itemIds, { aprovador_id, aprovador_nome });
        res.json({
            success: true,
            message: 'Itens aprovados com sucesso'
        });
    } catch (error) {
        console.error('Erro ao aprovar itens do pacote:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao aprovar itens do pacote'
        });
    }
});

// Rota para negar itens específicos do pacote
app.post('/api/pacotes/:id/negar-itens', async (req, res) => {
    try {
        const { id } = req.params;
        const { itemIds, motivo } = req.body;
        
        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Lista de itens é obrigatória'
            });
        }

        await db.negarItensPacote(id, itemIds, motivo || 'Negado pelo administrador');
        res.json({
            success: true,
            message: 'Itens negados com sucesso'
        });
    } catch (error) {
        console.error('Erro ao negar itens do pacote:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao negar itens do pacote'
        });
    }
});

// Rota para rejeitar pacote completo
app.post('/api/pacotes/:id/rejeitar', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        
        await db.rejeitarPacoteCompleto(id, motivo || 'Rejeitado pelo administrador');
        res.json({
            success: true,
            message: 'Pacote rejeitado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao rejeitar pacote:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao rejeitar pacote'
        });
    }
});

// Rotas para movimentações
app.get('/api/movimentacoes', async (req, res) => {
    try {
        const { dias = 30, limit, data } = req.query;
        let movimentacoes = await db.buscarMovimentacoes(dias);
        
        // Filtrar por data específica se fornecida
        if (data) {
            const dataFiltro = new Date(data);
            movimentacoes = movimentacoes.filter(mov => {
                const movData = new Date(mov.data);
                return movData.toDateString() === dataFiltro.toDateString();
            });
        }
        
        // Limitar número de resultados se especificado
        if (limit) {
            movimentacoes = movimentacoes.slice(0, parseInt(limit));
        }
        
        res.json(movimentacoes);
    } catch (error) {
        console.error('Erro ao buscar movimentações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar movimentações'
        });
    }
});

// Rota para exportar banco de dados
app.get('/api/exportar-banco', async (req, res) => {
    try {
        // Usar a nova função de exportação que inclui todos os dados
        const dadosExportacao = await db.exportarDados();

        // Adicionar informações do servidor
        dadosExportacao.metadata.server_info = {
            node_version: process.version,
            platform: process.platform,
            memory_usage: process.memoryUsage(),
            uptime: process.uptime()
        };

        res.json({
            success: true,
            data: dadosExportacao
        });
    } catch (error) {
        console.error('Erro ao exportar banco:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar banco de dados',
            error: error.message
        });
    }
});

// Rota para importar banco de dados (sincronização)
app.post('/api/importar-banco', async (req, res) => {
    try {
        const dados = req.body;

        // Verificações de segurança e validação
        if (!dados || !dados.data || !dados.data.metadata) {
            return res.status(400).json({
                success: false,
                error: 'Formato de dados inválido: dados de sincronização ausentes ou malformados.'
            });
        }

        // Verificar versão dos dados
        const versaoAtual = '1.1';
        if (dados.data.metadata.versao !== versaoAtual) {
            return res.status(400).json({
                success: false,
                error: `Versão incompatível. Esperada: ${versaoAtual}, Recebida: ${dados.data.metadata.versao}`
            });
        }

        // Verificar integridade dos dados
        try {
            // Importar dados usando a função melhorada do banco
            const resultado = await db.importarDados(dados.data);

            // Registrar log da sincronização
            await db.run(`
                INSERT INTO sincronizacao_log (
                    timestamp, 
                    origem, 
                    hash_dados, 
                    status,
                    detalhes
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                new Date().toISOString(),
                req.ip,
                dados.data.metadata.hash,
                'sucesso',
                JSON.stringify(resultado)
            ]);

            res.json({
                success: true,
                message: 'Dados importados com sucesso',
                resultado
            });
        } catch (error) {
            // Registrar falha na sincronização
            await db.run(`
                INSERT INTO sincronizacao_log (
                    timestamp,
                    origem,
                    hash_dados,
                    status,
                    detalhes
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                new Date().toISOString(),
                req.ip,
                dados.data.metadata.hash,
                'erro',
                error.message
            ]);

            throw error;
        }
    } catch (error) {
        console.error('Erro ao importar banco:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Erro ao importar banco de dados.'
        });
    }
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
    });
});

// Rota para servir o HTML principal

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/requisi', (req, res) => {
    res.sendFile(path.join(__dirname, 'requisi.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    
    // Verificar integridade do banco
    db.verificarBanco().then(isOk => {
        if (isOk) {
            console.log('Banco de dados verificado e funcionando');
        } else {
            console.error('Problemas detectados no banco de dados');
        }
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nDesligando servidor...');
    db.fecharConexao();
    process.exit(0);
});

// Rota para retirada de item
app.post('/api/itens/:id/retirar', async (req, res) => {
    try {
        const { id } = req.params;
        const { quantidade, destino, observacao } = req.body;
        const { usuario_id, usuario_nome } = req.body;

        if (!quantidade || !destino) {
            return res.status(400).json({
                success: false,
                message: 'Quantidade e destino são obrigatórios'
            });
        }

        // Verificar se o item existe
        const item = await db.buscarItemPorId(id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item não encontrado'
            });
        }

        // Verificar se há quantidade suficiente
        if (item.quantidade < quantidade) {
            return res.status(400).json({
                success: false,
                message: 'Quantidade insuficiente no estoque'
            });
        }

        // Iniciar transação para garantir consistência
        await db.run('BEGIN TRANSACTION');

        try {
            // Descontar do estoque
            await db.descontarEstoque(id, quantidade);

            // Registrar movimentação
            await db.inserirMovimentacao({
                itemId: parseInt(id),
                itemNome: item.nome,
                tipo: 'saida',
                quantidade: parseInt(quantidade),
                destino: destino,
                descricao: observacao || 'Retirada direta do estoque',
                usuario_id: usuario_id || null,
                usuario_nome: usuario_nome || null
            });

            await db.run('COMMIT');

            res.json({
                success: true,
                message: 'Retirada realizada com sucesso',
                novaQuantidade: item.quantidade - quantidade
            });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Erro ao realizar retirada:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao realizar retirada',
            error: error.message
        });
    }
});

// ===== ROTAS PARA RETIRADAS PENDENTES =====

// Rota para buscar todas as retiradas pendentes
app.get('/api/retiradas-pendentes', async (req, res) => {
    try {
        const retiradasPendentes = await db.buscarRetiradasPendentes();
        res.json({
            success: true,
            data: retiradasPendentes
        });
    } catch (error) {
        console.error('Erro ao buscar retiradas pendentes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar retiradas pendentes',
            error: error.message
        });
    }
});

// Rota para buscar retirada pendente por ID
app.get('/api/retiradas-pendentes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const retirada = await db.buscarRetiradaPorId(id);
        
        if (!retirada) {
            return res.status(404).json({
                success: false,
                message: 'Retirada não encontrada'
            });
        }
        
        res.json({
            success: true,
            data: retirada
        });
    } catch (error) {
        console.error('Erro ao buscar retirada:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar retirada',
            error: error.message
        });
    }
});

// Rota para confirmar retirada (debitar do estoque)
app.post('/api/retiradas-pendentes/:id/confirmar', async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmado_por } = req.body;
        
        if (!confirmado_por || !confirmado_por.id || !confirmado_por.name) {
            return res.status(400).json({
                success: false,
                message: 'Dados do usuário que confirma são obrigatórios'
            });
        }
        
        const resultado = await db.confirmarRetirada(id, confirmado_por);
        res.json(resultado);
    } catch (error) {
        console.error('Erro ao confirmar retirada:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao confirmar retirada',
            error: error.message
        });
    }
});

// Rota para cancelar retirada
app.post('/api/retiradas-pendentes/:id/cancelar', async (req, res) => {
    try {
        const { id } = req.params;
        const { cancelado_por, motivo } = req.body;
        
        if (!cancelado_por || !cancelado_por.id || !cancelado_por.name) {
            return res.status(400).json({
                success: false,
                message: 'Dados do usuário que cancela são obrigatórios'
            });
        }
        
        const resultado = await db.cancelarRetirada(id, cancelado_por, motivo);
        res.json(resultado);
    } catch (error) {
        console.error('Erro ao cancelar retirada:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao cancelar retirada',
            error: error.message
        });
    }
});

// Adicione esta rota no seu server.js, junto com as outras rotas de itens

// Rota para atualizar item completo
app.put('/api/itens/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const itemData = req.body;
        
        // Verificar se o item existe
        const itemExistente = await db.buscarItemPorId(id);
        if (!itemExistente) {
            return res.status(404).json({
                success: false,
                message: 'Item não encontrado'
            });
        }

        // Atualizar item no banco de dados
        const sql = `
            UPDATE itens SET 
                nome = ?, 
                serie = ?, 
                descricao = ?, 
                origem = ?, 
                destino = ?, 
                valor = ?, 
                nf = ?, 
                quantidade = ?, 
                minimo = ?, 
                infos = ?
            WHERE id = ?
        `;

        await db.run(sql, [
            itemData.nome || itemExistente.nome,
            itemData.serie || itemExistente.serie,
            itemData.descricao || itemExistente.descricao,
            itemData.origem || itemExistente.origem,
            itemData.destino || itemExistente.destino,
            itemData.valor || itemExistente.valor,
            itemData.nf || itemExistente.nf,
            itemData.quantidade !== undefined ? itemData.quantidade : itemExistente.quantidade,
            itemData.minimo !== undefined ? itemData.minimo : itemExistente.minimo,
            itemData.infos || itemExistente.infos,
            id
        ]);

        // Se a quantidade foi alterada, registrar movimentação
        if (itemData.quantidade !== undefined && itemData.quantidade !== itemExistente.quantidade) {
            const diferenca = itemData.quantidade - itemExistente.quantidade;
            const tipo = diferenca > 0 ? 'entrada' : 'saida';
            const quantidade = Math.abs(diferenca);

            await db.inserirMovimentacao({
                itemId: parseInt(id),
                itemNome: itemData.nome || itemExistente.nome,
                tipo: tipo,
                quantidade: quantidade,
                origem: tipo === 'entrada' ? 'Atualização de item' : null,
                destino: tipo === 'saida' ? 'Atualização de item' : null,
                descricao: `Quantidade ${tipo === 'entrada' ? 'aumentada' : 'diminuída'} via edição do item`
            });
        }

        // Buscar item atualizado
        const itemAtualizado = await db.buscarItemPorId(id);

        res.json({
            success: true,
            message: 'Item atualizado com sucesso',
            item: itemAtualizado
        });
    } catch (error) {
        console.error('Erro ao atualizar item:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar item',
            error: error.message
        });
    }
});

// Rota alternativa para atualizar apenas campos específicos (PATCH)
app.patch('/api/itens/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Verificar se o item existe
        const itemExistente = await db.buscarItemPorId(id);
        if (!itemExistente) {
            return res.status(404).json({
                success: false,
                message: 'Item não encontrado'
            });
        }

        // Construir query dinamicamente baseada nos campos enviados
        const camposPermitidos = ['nome', 'serie', 'descricao', 'origem', 'destino', 'valor', 'nf', 'quantidade', 'minimo', 'ideal', 'infos'];
        const camposParaAtualizar = [];
        const valores = [];

        Object.keys(updates).forEach(campo => {
            if (camposPermitidos.includes(campo)) {
                camposParaAtualizar.push(`${campo} = ?`);
                valores.push(updates[campo]);
            }
        });

        if (camposParaAtualizar.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum campo válido para atualizar'
            });
        }

        valores.push(id); // Adicionar ID para a cláusula WHERE

        const sql = `UPDATE itens SET ${camposParaAtualizar.join(', ')} WHERE id = ?`;
        await db.run(sql, valores);

        // Se a quantidade foi alterada, registrar movimentação
        if (updates.quantidade !== undefined && updates.quantidade !== itemExistente.quantidade) {
            const diferenca = updates.quantidade - itemExistente.quantidade;
            const tipo = diferenca > 0 ? 'entrada' : 'saida';
            const quantidade = Math.abs(diferenca);

            await db.inserirMovimentacao({
                itemId: parseInt(id),
                itemNome: updates.nome || itemExistente.nome,
                tipo: tipo,
                quantidade: quantidade,
                origem: tipo === 'entrada' ? 'Atualização parcial' : null,
                destino: tipo === 'saida' ? 'Atualização parcial' : null,
                descricao: `Quantidade ${tipo === 'entrada' ? 'aumentada' : 'diminuída'} via edição parcial`
            });
        }

        // Buscar item atualizado
        const itemAtualizado = await db.buscarItemPorId(id);

        res.json({
            success: true,
            message: 'Item atualizado com sucesso',
            item: itemAtualizado,
            camposAtualizados: Object.keys(updates)
        });
    } catch (error) {
        console.error('Erro ao atualizar item:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar item',
            error: error.message
        });
    }
});

// Adicione esta rota no seu server.js, junto com as outras rotas de itens

// Rota para adicionar estoque ao item
app.post('/api/itens/:id/adicionar', async (req, res) => {
    try {
        const { id } = req.params;
        const { quantidade, origem, observacao } = req.body;

        if (!quantidade || quantidade <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantidade deve ser um número positivo'
            });
        }

        // Verificar se o item existe
        const item = await db.buscarItemPorId(id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item não encontrado'
            });
        }

        // Calcular nova quantidade
        const novaQuantidade = item.quantidade + parseInt(quantidade);

        // Atualizar estoque
        await db.atualizarQuantidadeItem(id, novaQuantidade);

        // Registrar movimentação
        await db.inserirMovimentacao({
            itemId: item.id,
            itemNome: item.nome,
            tipo: 'entrada',
            quantidade: parseInt(quantidade),
            origem: origem || 'Adição manual',
            descricao: observacao || 'Adição manual ao estoque'
        });

        res.json({
            success: true,
            message: 'Estoque adicionado com sucesso',
            quantidadeAnterior: item.quantidade,
            quantidadeAdicionada: parseInt(quantidade),
            novaQuantidade: novaQuantidade
        });
    } catch (error) {
        console.error('Erro ao adicionar estoque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao adicionar estoque',
            error: error.message
        });
    }
});

// Rota para deletar item
app.delete('/api/itens/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se o item existe
        const item = await db.buscarItemPorId(id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item não encontrado'
            });
        }

        // Verificar se há requisições pendentes para este item
        const requisicoesPendentes = await db.buscarRequisicoesPendentes();
        const temRequisicaoPendente = requisicoesPendentes.some(req => req.itemId === parseInt(id));
        
        if (temRequisicaoPendente) {
            return res.status(400).json({
                success: false,
                message: 'Não é possível remover o item pois existem requisições pendentes'
            });
        }

        // Remover o item
        await db.removerItem(id);
        
        res.json({
            success: true,
            message: 'Item removido com sucesso'
        });
    } catch (error) {
        console.error('Erro ao remover item:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover item'
        });
    }
});

// ===== NOVAS ROTAS PARA CONFIGURAÇÕES E RELATÓRIOS =====

// Rotas para gerenciar projetos
app.post('/api/projetos', async (req, res) => {
    try {
        const { nome, descricao } = req.body;
        
        if (!nome) {
            return res.status(400).json({
                success: false,
                message: 'Nome do projeto é obrigatório'
            });
        }

        const projeto = await db.criarProjeto({ nome, descricao });
        
        res.json({
            success: true,
            projeto,
            message: 'Projeto criado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar projeto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar projeto'
        });
    }
});

app.get('/api/projetos', async (req, res) => {
    try {
        const projetos = await db.buscarProjetos();
        res.json(projetos);
    } catch (error) {
        console.error('Erro ao buscar projetos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar projetos'
        });
    }
});

app.put('/api/projetos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, ativo } = req.body;
        
        await db.atualizarProjeto(id, { nome, descricao, ativo });
        
        res.json({
            success: true,
            message: 'Projeto atualizado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao atualizar projeto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar projeto'
        });
    }
});

app.delete('/api/projetos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.removerProjeto(id);
        
        res.json({
            success: true,
            message: 'Projeto removido com sucesso'
        });
    } catch (error) {
        console.error('Erro ao remover projeto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover projeto'
        });
    }
});

// Rotas para gerenciar centros de custo
app.post('/api/centros-custo', async (req, res) => {
    try {
        const { nome, descricao, aprovador_id } = req.body;
        
        if (!nome) {
            return res.status(400).json({
                success: false,
                message: 'Nome do centro de custo é obrigatório'
            });
        }

        const centroCusto = await db.criarCentroCusto({ nome, descricao, aprovador_id });
        
        res.json({
            success: true,
            centroCusto,
            message: 'Centro de custo criado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar centro de custo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar centro de custo'
        });
    }
});

app.get('/api/centros-custo', async (req, res) => {
    try {
        const centrosCusto = await db.buscarCentrosCusto();
        res.json(centrosCusto);
    } catch (error) {
        console.error('Erro ao buscar centros de custo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar centros de custo'
        });
    }
});

app.put('/api/centros-custo/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, ativo, aprovador_id } = req.body;
        
        await db.atualizarCentroCusto(id, { nome, descricao, ativo, aprovador_id });
        
        res.json({
            success: true,
            message: 'Centro de custo atualizado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao atualizar centro de custo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar centro de custo'
        });
    }
});

app.delete('/api/centros-custo/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.removerCentroCusto(id);
        
        res.json({
            success: true,
            message: 'Centro de custo removido com sucesso'
        });
    } catch (error) {
        console.error('Erro ao remover centro de custo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover centro de custo'
        });
    }
});

// Rota para buscar detalhes completos de um pacote
app.get('/api/pacotes/:id/detalhes', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Buscando detalhes do pacote:', id);
        
        const pacote = await db.buscarPacoteDetalhado(id);
        console.log('Pacote encontrado:', pacote);
        
        if (!pacote) {
            return res.status(404).json({
                success: false,
                message: 'Pacote não encontrado'
            });
        }
        
        res.json({
            success: true,
            pacote
        });
    } catch (error) {
        console.error('Erro ao buscar detalhes do pacote:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar detalhes do pacote'
        });
    }
});

// Rota para exportar relatório de pacote em CSV
app.get('/api/pacotes/:id/exportar-csv', async (req, res) => {
    try {
        const { id } = req.params;
        
        const pacote = await db.buscarPacoteDetalhado(id);
        
        if (!pacote) {
            return res.status(404).json({
                success: false,
                message: 'Pacote não encontrado'
            });
        }
        
        // Criar cabeçalho do CSV
        let csvContent = 'ID do Pacote,Status,Data de Criação,Data de Aprovação,Solicitante,Email do Solicitante,Centro de Custo,Projeto,Justificativa,Observações\n';
        
        // Adicionar dados do pacote
        csvContent += `"${pacote.id}","${pacote.status || ''}","${pacote.data_criacao || ''}","${pacote.data_aprovacao || ''}","${pacote.solicitante_nome || ''}","${pacote.solicitante_email || ''}","${pacote.centroCusto || ''}","${pacote.projeto || ''}","${pacote.justificativa || ''}","${pacote.observacoes || ''}"\n\n`;
        
        // Adicionar cabeçalho dos itens
        csvContent += 'ID do Item,Nome do Item,Descrição do Item,Quantidade Solicitada,Quantidade Disponível,Status do Item,Observações\n';
        
        // Adicionar dados dos itens
        if (pacote.itens && pacote.itens.length > 0) {
            pacote.itens.forEach(item => {
                csvContent += `"${item.id}","${item.item_nome || ''}","${item.item_descricao || ''}","${item.quantidade || 0}","${item.estoque_disponivel || 0}","${item.status || ''}","${item.observacoes || ''}"\n`;
            });
        }
        
        // Configurar headers para download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="relatorio-pacote-${id}-${new Date().toISOString().split('T')[0]}.csv"`);
        
        res.send(csvContent);
        
    } catch (error) {
        console.error('Erro ao exportar relatório CSV:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar relatório CSV'
        });
    }
});

// Rota para editar quantidades de itens do pacote (sem aprovar)
app.post('/api/pacotes/:id/editar-quantidades', async (req, res) => {

// Rota para exportar relatório de pacote em XLSX
app.get('/api/pacotes/:id/exportar-xlsx', async (req, res) => {
    try {
        const { id } = req.params;
        const pacote = await db.buscarPacoteDetalhado(id);
        if (!pacote) {
            return res.status(404).json({
                success: false,
                message: 'Pacote não encontrado'
            });
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Relatório do Pacote');

        // Cabeçalho do pacote
        sheet.addRow(['ID do Pacote', 'Status', 'Data de Criação', 'Data de Aprovação', 'Solicitante', 'Email do Solicitante', 'Centro de Custo', 'Projeto', 'Justificativa', 'Observações']);
        sheet.addRow([
            pacote.id,
            pacote.status || '',
            pacote.data_criacao || '',
            pacote.data_aprovacao || '',
            pacote.solicitante_nome || '',
            pacote.solicitante_email || '',
            pacote.centroCusto || '',
            pacote.projeto || '',
            pacote.justificativa || '',
            pacote.observacoes || ''
        ]);
        sheet.addRow([]);

        // Cabeçalho dos itens
        sheet.addRow(['ID do Item', 'Nome do Item', 'Descrição do Item', 'Quantidade Solicitada', 'Quantidade Disponível', 'Status do Item', 'Observações']);
        if (pacote.itens && pacote.itens.length > 0) {
            pacote.itens.forEach(item => {
                sheet.addRow([
                    item.id,
                    item.item_nome || '',
                    item.item_descricao || '',
                    item.quantidade || 0,
                    item.estoque_disponivel || 0,
                    item.status || '',
                    item.observacoes || ''
                ]);
            });
        }

        // Ajustar largura das colunas
        sheet.columns.forEach(column => {
            let maxLength = 10;
            column.eachCell({ includeEmpty: true }, cell => {
                maxLength = Math.max(maxLength, (cell.value ? cell.value.toString().length : 0));
            });
            column.width = maxLength + 2;
        });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-pacote-${id}-${new Date().toISOString().split('T')[0]}.xlsx"`);

    // Gerar buffer e enviar
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(Buffer.from(buffer));
    } catch (error) {
        console.error('Erro ao exportar relatório XLSX:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar relatório XLSX'
        });
    }
});
    try {
        const { id } = req.params;
        const { itensEditados } = req.body;
        
        if (!itensEditados || !Array.isArray(itensEditados)) {
            return res.status(400).json({
                success: false,
                message: 'Lista de itens editados é obrigatória'
            });
        }

        await db.editarQuantidadesPacote(id, itensEditados);
        
        res.json({
            success: true,
            message: 'Quantidades editadas com sucesso'
        });
    } catch (error) {
        console.error('Erro ao editar quantidades:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao editar quantidades'
        });
    }
});

// Rota para aprovar itens com quantidade personalizada
app.post('/api/pacotes/:id/aprovar-itens-quantidade', async (req, res) => {
    try {
        const { id } = req.params;
        const { itensAprovados, aprovador_id, aprovador_nome } = req.body;
        
        if (!itensAprovados || !Array.isArray(itensAprovados)) {
            return res.status(400).json({
                success: false,
                message: 'Lista de itens aprovados é obrigatória'
            });
        }

        await db.aprovarItensPacoteComQuantidade(id, itensAprovados, { aprovador_id, aprovador_nome });
        
        res.json({
            success: true,
            message: 'Itens aprovados com sucesso'
        });
    } catch (error) {
        console.error('Erro ao aprovar itens:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao aprovar itens'
        });
    }
});

// Rota para buscar movimentações por usuário
app.get('/api/movimentacoes/usuario/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { dias } = req.query;
        
        const movimentacoes = await db.buscarMovimentacoesPorUsuario(userId, dias || 30);
        
        res.json({
            success: true,
            movimentacoes
        });
    } catch (error) {
        console.error('Erro ao buscar movimentações do usuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar movimentações do usuário'
        });
    }
});

// Rota para buscar todos os usuários
app.get('/api/usuarios', async (req, res) => {
    try {
        const usuarios = await db.buscarTodosUsuarios();
        
        res.json({
            success: true,
            usuarios
        });
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar usuários'
        });
    }
});

// Rota de teste para verificar pacotes
app.get('/api/teste-pacotes', async (req, res) => {
    try {
        const pacotes = await db.buscarPacotesPendentes();
        console.log('Pacotes encontrados:', pacotes);
        
        res.json({
            success: true,
            pacotes
        });
    } catch (error) {
        console.error('Erro ao buscar pacotes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar pacotes'
        });
    }
});

// Rota para criar pacote de teste
app.post('/api/criar-pacote-teste', async (req, res) => {
    try {
        // Primeiro, verificar se há itens no banco
        const itens = await db.buscarItens();
        if (itens.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Não há itens no banco para criar um pacote de teste'
            });
        }
        
        // Criar um pacote de teste
        const pacoteId = await db.criarPacoteRequisicao({
            userId: 1, // Assumindo que existe um usuário com ID 1
            centroCusto: 'Centro de Custo Teste',
            projeto: 'Projeto Teste',
            justificativa: 'Pacote de teste para verificar funcionalidades'
        });
        
        // Criar uma requisição de teste para o primeiro item
        const item = itens[0];
        await db.criarRequisicao({
            userId: 1,
            itemId: item.id,
            quantidade: 5,
            centroCusto: 'Centro de Custo Teste',
            projeto: 'Projeto Teste',
            justificativa: 'Requisição de teste',
            pacoteId: pacoteId
        });
        
        res.json({
            success: true,
            message: 'Pacote de teste criado com sucesso',
            pacoteId
        });
    } catch (error) {
        console.error('Erro ao criar pacote de teste:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar pacote de teste'
        });
    }
});

module.exports = app;