    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const fs = require('fs');
    const bcrypt = require('bcrypt'); // Você precisa instalar: npm install bcrypt

    // Criar conexão com o banco de dados
    const dbPath = path.join(__dirname, 'estoque.db');

    // Verificar se o diretório do banco de dados existe
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    // Verificar se o arquivo do banco de dados existe, se não existir, criar um novo
    const dbExists = fs.existsSync(dbPath);
    if (!dbExists) {
        console.log('Arquivo de banco de dados não encontrado. Criando um novo banco de dados.');
    }

    // Configurações para conexão mais robusta
    const connectionOptions = {
        // Ativar chaves estrangeiras
        foreignKeys: true,
        // Tentar novamente se o banco estiver ocupado (aumentado para 10 segundos)
        busyTimeout: 10000
    };


    // Função para verificar permissões de arquivo
    function verificarPermissoesArquivo() {
        try {
            if (fs.existsSync(dbPath)) {
                const stats = fs.statSync(dbPath);
                console.log('Permissões do arquivo de banco:', {
                    owner: stats.uid,
                    group: stats.gid,
                    mode: stats.mode.toString(8),
                    size: stats.size,
                    modifiedTime: stats.mtime
                });
                
                // Testar escrita
                try {
                    fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
                    console.log('Arquivo do banco tem permissões de leitura e escrita');
                    return true;
                } catch (e) {
                    console.error('Erro de permissões no arquivo do banco:', e.message);
                    return false;
                }
            }
            return true; // Retorna true se o arquivo não existir (será criado)
        } catch (e) {
            console.error('Erro ao verificar permissões do arquivo:', e);
            return false;
        }
    }

    // Verificar permissões do arquivo antes de conectar
    verificarPermissoesArquivo();

    // Criar conexão com o banco de dados com tratamento de erros melhorado
    const db = new sqlite3.Database(dbPath, connectionOptions, (err) => {
        if (err) {
            console.error('ERRO CRÍTICO ao conectar ao banco de dados SQLite:', err);
            console.error('Detalhes do erro:', {
                code: err.code,
                errno: err.errno,
                syscall: err.syscall,
                message: err.message
            });
            console.error('Caminho do banco de dados:', dbPath);
            console.error('Diretório atual:', process.cwd());
            
            // Verificar se o diretório do banco existe e tem permissões
            try {
                const dirStats = fs.statSync(dbDir);
                console.log('Permissões do diretório do banco:', {
                    owner: dirStats.uid,
                    group: dirStats.gid,
                    mode: dirStats.mode.toString(8)
                });
            } catch (e) {
                console.error('Erro ao verificar diretório do banco:', e.message);
            }
        } else {
            console.log('Conectado ao banco de dados SQLite:', dbPath);
            
            // Se o banco acabou de ser criado, será inicializado com as tabelas
            if (!dbExists) {
                console.log('Inicializando novo banco de dados com estrutura padrão...');
            }
            
            // Executar PRAGMA para verificar a saúde do banco de dados
            db.get("PRAGMA integrity_check", [], (err, result) => {
                if (err) {
                    console.error("Erro ao verificar integridade do banco:", err.message);
                } else {
                    console.log("Verificação de integridade:", result);
                }
            });
        }
    });

    // Criar tabelas
    db.serialize(() => {
        // Tabela de usuários
        db.run(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                userType TEXT NOT NULL CHECK (userType IN ('admin', 'user')) DEFAULT 'user',
                data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de itens
        db.run(`
            CREATE TABLE IF NOT EXISTS itens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                serie TEXT,
                descricao TEXT,
                origem TEXT,
                destino TEXT,
                valor REAL DEFAULT 0,
                nf TEXT,
                quantidade INTEGER NOT NULL DEFAULT 0,
                minimo INTEGER NOT NULL DEFAULT 0,
                ideal INTEGER NOT NULL DEFAULT 0,
                infos TEXT,
                data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de movimentações
        db.run(`
            CREATE TABLE IF NOT EXISTS movimentacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL,
                item_nome TEXT NOT NULL,
                tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
                quantidade INTEGER NOT NULL,
                destino TEXT,
                descricao TEXT,
                data DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES itens (id)
            )
        `);

        // Tabela de requisições
        db.run(`
            CREATE TABLE IF NOT EXISTS requisicoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                itemId INTEGER,
                quantidade INTEGER,
                centroCusto TEXT,
                projeto TEXT,
                justificativa TEXT,
                status TEXT DEFAULT 'pendente',
                data DATETIME DEFAULT CURRENT_TIMESTAMP,
                observacoes TEXT,
                pacoteId INTEGER,
                FOREIGN KEY (userId) REFERENCES usuarios(id),
                FOREIGN KEY (itemId) REFERENCES itens(id)
            )
        `);

        // Tabela de pacotes de requisição
        db.run(`
            CREATE TABLE IF NOT EXISTS pacotes_requisicao (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                centroCusto TEXT,
                projeto TEXT,
                justificativa TEXT,
                status TEXT DEFAULT 'pendente',
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_aprovacao DATETIME,
                observacoes TEXT,
                FOREIGN KEY (userId) REFERENCES usuarios(id)
            )
        `);

        // Índices para melhor performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_itens_nome ON itens(nome)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_movimentacoes_item_id ON movimentacoes(item_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data)`);
    });

    // Funções para usuários

    // Buscar usuário por email
    function buscarUsuarioPorEmail(email) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM usuarios WHERE email = ?`;
            
            db.get(sql, [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Cadastrar usuário
    function cadastrarUsuario(userData) {
        return new Promise(async (resolve, reject) => {
            try {
                // Hash da senha
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
                
                const sql = `
                    INSERT INTO usuarios (name, email, password, userType)
                    VALUES (?, ?, ?, ?)
                `;
                
                db.run(sql, [
                    userData.name,
                    userData.email,
                    hashedPassword,
                    userData.userType || 'user'
                ], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Retornar o usuário criado (sem a senha)
                        resolve({
                            id: this.lastID,
                            name: userData.name,
                            email: userData.email,
                            userType: userData.userType || 'user'
                        });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Autenticar usuário
    function autenticarUsuario(email, password) {
        return new Promise(async (resolve, reject) => {
            try {
                const usuario = await buscarUsuarioPorEmail(email);
                
                if (!usuario) {
                    resolve(null);
                    return;
                }
                
                // Verificar senha
                const senhaValida = await bcrypt.compare(password, usuario.password);
                
                if (senhaValida) {
                    // Retornar dados do usuário (sem a senha)
                    resolve({
                        id: usuario.id,
                        name: usuario.name,
                        email: usuario.email,
                        userType: usuario.userType
                    });
                } else {
                    resolve(null);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // Funções para operações no banco de itens

    // Inserir item
    function inserirItem(item) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO itens (nome, serie, descricao, origem, destino, valor, nf, quantidade, minimo, ideal, infos)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.run(sql, [
                item.nome, item.serie, item.descricao, item.origem, item.destino,
                item.valor, item.nf, item.quantidade, item.minimo, item.ideal, item.infos
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // Buscar todos os itens
    function buscarItens() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM itens ORDER BY nome`;
            
            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Buscar item por ID
    function buscarItemPorId(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM itens WHERE id = ?`;
            
            db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Atualizar quantidade do item
    function atualizarQuantidade(id, novaQuantidade) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE itens SET quantidade = ? WHERE id = ?`;
            
            db.run(sql, [novaQuantidade, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Remover item
    function removerItem(id) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM itens WHERE id = ?`;
            
            db.run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Inserir movimentação
    function inserirMovimentacao(movimentacao) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO movimentacoes (item_id, item_nome, tipo, quantidade, destino, descricao)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            db.run(sql, [
                movimentacao.itemId, movimentacao.itemNome, movimentacao.tipo,
                movimentacao.quantidade, movimentacao.destino, movimentacao.descricao
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // Buscar movimentações por período
    function buscarMovimentacoes(dias = 30) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM movimentacoes 
                WHERE data >= datetime('now', '-${dias} days')
                ORDER BY data DESC
            `;
            
            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Função utilitária para executar comandos SQL genéricos (como DELETE)
    function run(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    // Fechar conexão
    function fecharConexao() {
        db.close((err) => {
            if (err) {
                console.error('Erro ao fechar banco:', err.message);
            } else {
                console.log('Conexão com banco fechada.');
            }
        });
    }

    // Verificar estado do banco de dados
    function verificarBanco() {
        return new Promise((resolve, reject) => {
            db.get("PRAGMA integrity_check", [], (err, result) => {
                if (err) {
                    console.error("Erro ao verificar integridade do banco:", err.message);
                    reject(err);
                } else {
                    if (result.integrity_check === 'ok') {
                        console.log("Banco de dados íntegro e pronto para uso");
                        resolve(true);
                    } else {
                        console.warn("Problemas de integridade no banco:", result.integrity_check);
                        resolve(false);
                    }
                }
            });
        });
    }

    // Funções para exportar e importar dados (para sincronização entre diferentes máquinas)
    async function exportarDados() {
        try {
            // Exportar tabela de itens
            const itens = await buscarItens();
            
            // Exportar tabela de movimentações (últimos 365 dias para não ficar muito grande)
            const movimentacoes = await buscarMovimentacoes(365);
            
            return {
                itens,
                movimentacoes,
                timestamp: new Date().toISOString(),
                versao: '1.0'
            };
        } catch (error) {
            console.error('Erro ao exportar dados:', error);
            throw error;
        }
    }

    async function importarDados(dados) {
        if (!dados || !dados.itens) {
            throw new Error('Dados inválidos para importação');
        }
        
        try {
            // Iniciar transação para garantir atomicidade da operação
            await run('BEGIN TRANSACTION');
            
            // Limpar tabelas existentes
            await run('DELETE FROM movimentacoes');
            await run('DELETE FROM itens');
            
            // Inserir itens
            for (const item of dados.itens) {
                // Remover o ID para evitar conflitos com a sequência do autoincrement
                const { id, data_cadastro, ...itemSemId } = item;
                await inserirItem(itemSemId);
            }
            
            if (dados.movimentacoes && Array.isArray(dados.movimentacoes)) {
                for (const mov of dados.movimentacoes) {
                    // Formatar dados para inserção
                    const movimentacao = {
                        itemId: mov.item_id,
                        itemNome: mov.item_nome,
                        tipo: mov.tipo,
                        quantidade: mov.quantidade,
                        destino: mov.destino,
                        descricao: mov.descricao
                    };
                    
                    await inserirMovimentacao(movimentacao);
                }
            }
            
            // Confirmar transação
            await run('COMMIT');
            
            return {
                sucesso: true,
                itensImportados: dados.itens.length,
                movimentacoesImportadas: dados.movimentacoes ? dados.movimentacoes.length : 0
            };
        } catch (error) {
            // Reverter alterações em caso de erro
            await run('ROLLBACK');
            console.error('Erro ao importar dados:', error);
            throw error;
        }
    }

    // Função para unificar itens duplicados
    async function unificarItensDuplicados() {
        try {
            // Começar uma transação
            await run('BEGIN TRANSACTION');

            // Buscar itens duplicados por nome+serie
            const duplicados = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT nome, serie, COUNT(*) as count, GROUP_CONCAT(id) as ids
                    FROM itens
                    GROUP BY nome, serie
                    HAVING COUNT(*) > 1
                `, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            let totalUnificados = 0;

            for (const grupo of duplicados) {
                const ids = grupo.ids.split(',').map(Number);
                const [idPrincipal, ...idsParaUnificar] = ids;

                // Somar as quantidades dos itens duplicados
                const itensParaUnificar = await Promise.all(idsParaUnificar.map(id => buscarItemPorId(id)));
                const itemPrincipal = await buscarItemPorId(idPrincipal);

                const novaQuantidade = itensParaUnificar.reduce(
                    (total, item) => total + (item ? item.quantidade : 0),
                    itemPrincipal.quantidade
                );

                // Atualizar o item principal com a soma das quantidades
                await run(
                    'UPDATE itens SET quantidade = ? WHERE id = ?',
                    [novaQuantidade, idPrincipal]
                );

                // Atualizar movimentações para apontar para o item principal
                if (idsParaUnificar.length > 0) {
                    const placeholders = idsParaUnificar.map(() => '?').join(',');
                    await run(
                        `UPDATE movimentacoes SET item_id = ? WHERE item_id IN (${placeholders})`,
                        [idPrincipal, ...idsParaUnificar]
                    );
                    // Deletar os itens duplicados
                    await run(
                        `DELETE FROM itens WHERE id IN (${placeholders})`,
                        idsParaUnificar
                    );
                    totalUnificados += idsParaUnificar.length;
                }
            }

            // Confirmar as alterações
            await run('COMMIT');

            return {
                total: totalUnificados,
                message: `${totalUnificados} itens duplicados foram unificados com sucesso.`
            };
        } catch (error) {
            // Em caso de erro, reverter todas as alterações
            await run('ROLLBACK');
            throw error;
        }
    }

    // Funções de requisições
    function criarRequisicao(requisicao) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO requisicoes (userId, itemId, quantidade, centroCusto, projeto, justificativa, pacoteId) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.run(sql, [
                requisicao.userId,
                requisicao.itemId,
                requisicao.quantidade,
                requisicao.centroCusto,
                requisicao.projeto,
                requisicao.justificativa,
                requisicao.pacoteId || null
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // Função para criar pacote de requisições
    function criarPacoteRequisicao(pacote) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO pacotes_requisicao (userId, centroCusto, projeto, justificativa) 
                        VALUES (?, ?, ?, ?)`;
            db.run(sql, [
                pacote.userId,
                pacote.centroCusto,
                pacote.projeto,
                pacote.justificativa
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // Função para buscar pacotes pendentes
    function buscarPacotesPendentes() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    p.*,
                    u.name as usuario_nome,
                    COUNT(r.id) as total_itens,
                    SUM(r.quantidade) as total_quantidade
                FROM pacotes_requisicao p
                JOIN usuarios u ON p.userId = u.id
                LEFT JOIN requisicoes r ON p.id = r.pacoteId
                WHERE p.status = 'pendente'
                GROUP BY p.id
                ORDER BY p.data_criacao ASC
            `;
            db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Função para buscar itens de um pacote
    function buscarItensPacote(pacoteId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    r.*,
                    i.nome as item_nome,
                    i.descricao as item_descricao,
                    i.quantidade as estoque_disponivel
                FROM requisicoes r
                JOIN itens i ON r.itemId = i.id
                WHERE r.pacoteId = ?
                ORDER BY r.data ASC
            `;
            db.all(sql, [pacoteId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Função para buscar pacotes do usuário
    function buscarPacotesUsuario(userId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    p.*,
                    COUNT(r.id) as total_itens,
                    SUM(r.quantidade) as total_quantidade
                FROM pacotes_requisicao p
                LEFT JOIN requisicoes r ON p.id = r.pacoteId
                WHERE p.userId = ?
                GROUP BY p.id
                ORDER BY p.data_criacao DESC
            `;
            db.all(sql, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Função para aprovar pacote completo
    function aprovarPacoteCompleto(pacoteId) {
        return new Promise(async (resolve, reject) => {
            try {
                await run('BEGIN TRANSACTION');
                
                // Buscar todas as requisições do pacote
                const requisicoes = await buscarItensPacote(pacoteId);
                
                // Verificar disponibilidade de todos os itens
                for (const req of requisicoes) {
                    if (req.quantidade > req.estoque_disponivel) {
                        throw new Error(`Item ${req.item_nome} não tem quantidade suficiente em estoque`);
                    }
                }
                
                // Aprovar todas as requisições do pacote
                for (const req of requisicoes) {
                    await atualizarStatusRequisicao(req.id, 'aprovado');
                    await descontarEstoque(req.itemId, req.quantidade);
                }
                
                // Atualizar status do pacote
                await run(
                    'UPDATE pacotes_requisicao SET status = ?, data_aprovacao = datetime("now") WHERE id = ?',
                    ['aprovado', pacoteId]
                );
                
                await run('COMMIT');
                resolve(true);
            } catch (error) {
                await run('ROLLBACK');
                reject(error);
            }
        });
    }

    // Função para aprovar itens específicos do pacote
    function aprovarItensPacote(pacoteId, itemIds) {
        return new Promise(async (resolve, reject) => {
            try {
                await run('BEGIN TRANSACTION');
                
                // Buscar requisições específicas
                const requisicoes = await new Promise((resolve, reject) => {
                    const placeholders = itemIds.map(() => '?').join(',');
                    const sql = `
                        SELECT 
                            r.*,
                            i.nome as item_nome,
                            i.quantidade as estoque_disponivel
                        FROM requisicoes r
                        JOIN itens i ON r.itemId = i.id
                        WHERE r.pacoteId = ? AND r.id IN (${placeholders})
                    `;
                    db.all(sql, [pacoteId, ...itemIds], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
                
                // Verificar disponibilidade e aprovar itens selecionados
                for (const req of requisicoes) {
                    if (req.quantidade > req.estoque_disponivel) {
                        throw new Error(`Item ${req.item_nome} não tem quantidade suficiente em estoque`);
                    }
                    await atualizarStatusRequisicao(req.id, 'aprovado');
                    await descontarEstoque(req.itemId, req.quantidade);
                }
                
                // Verificar status do pacote após aprovação
                await verificarEAtualizarStatusPacote(pacoteId);
                
                await run('COMMIT');
                resolve(true);
            } catch (error) {
                await run('ROLLBACK');
                reject(error);
            }
        });
    }

    // Função para negar itens específicos do pacote
    function negarItensPacote(pacoteId, itemIds, motivo = 'Negado pelo administrador') {
        return new Promise(async (resolve, reject) => {
            try {
                await run('BEGIN TRANSACTION');
                
                // Negar requisições específicas
                for (const itemId of itemIds) {
                    await atualizarStatusRequisicao(itemId, 'rejeitado', motivo);
                }
                
                // Verificar status do pacote após negação
                await verificarEAtualizarStatusPacote(pacoteId);
                
                await run('COMMIT');
                resolve(true);
            } catch (error) {
                await run('ROLLBACK');
                reject(error);
            }
        });
    }

    // Função auxiliar para verificar e atualizar status do pacote
    async function verificarEAtualizarStatusPacote(pacoteId) {
        // Buscar estatísticas do pacote
        const stats = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_itens,
                    SUM(CASE WHEN status = 'aprovado' THEN 1 ELSE 0 END) as itens_aprovados,
                    SUM(CASE WHEN status = 'rejeitado' THEN 1 ELSE 0 END) as itens_rejeitados,
                    SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as itens_pendentes
                FROM requisicoes 
                WHERE pacoteId = ?
            `;
            db.get(sql, [pacoteId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Se todos os itens foram processados (aprovados ou rejeitados)
        if (stats.itens_pendentes === 0) {
            if (stats.itens_rejeitados === stats.total_itens) {
                // Todos os itens foram rejeitados
                await run(
                    'UPDATE pacotes_requisicao SET status = ?, data_aprovacao = datetime("now") WHERE id = ?',
                    ['rejeitado', pacoteId]
                );
            } else if (stats.itens_aprovados === stats.total_itens) {
                // Todos os itens foram aprovados
                await run(
                    'UPDATE pacotes_requisicao SET status = ?, data_aprovacao = datetime("now") WHERE id = ?',
                    ['aprovado', pacoteId]
                );
            } else {
                // Alguns itens aprovados e outros rejeitados - parcialmente aprovado
                await run(
                    'UPDATE pacotes_requisicao SET status = ?, data_aprovacao = datetime("now") WHERE id = ?',
                    ['parcialmente aprovado', pacoteId]
                );
            }
        }
    }

    // Função para rejeitar pacote completo
    function rejeitarPacoteCompleto(pacoteId, motivo) {
        return new Promise(async (resolve, reject) => {
            try {
                await run('BEGIN TRANSACTION');
                
                // Rejeitar todas as requisições do pacote
                await run(
                    'UPDATE requisicoes SET status = ?, observacoes = ? WHERE pacoteId = ?',
                    ['rejeitado', motivo, pacoteId]
                );
                
                // Atualizar status do pacote
                await run(
                    'UPDATE pacotes_requisicao SET status = ?, observacoes = ?, data_aprovacao = datetime("now") WHERE id = ?',
                    ['rejeitado', motivo, pacoteId]
                );
                
                await run('COMMIT');
                resolve(true);
            } catch (error) {
                await run('ROLLBACK');
                reject(error);
            }
        });
    }

    function buscarRequisicoesUsuario(userId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT r.*, i.nome as item_nome, u.name as usuario_nome
                FROM requisicoes r
                JOIN itens i ON r.itemId = i.id
                JOIN usuarios u ON r.userId = u.id
                WHERE r.userId = ?
                ORDER BY r.data DESC`;
            db.all(sql, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    function buscarRequisicoesPendentes() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT r.*, i.nome as item_nome, u.name as usuario_nome
                FROM requisicoes r
                JOIN itens i ON r.itemId = i.id
                JOIN usuarios u ON r.userId = u.id
                WHERE r.status = 'pendente'
                ORDER BY r.data ASC`;
            db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Função para buscar requisições pendentes que não são de pacotes
    function buscarRequisicoesIndividuaisPendentes() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT r.*, i.nome as item_nome, u.name as usuario_nome
                FROM requisicoes r
                JOIN itens i ON r.itemId = i.id
                JOIN usuarios u ON r.userId = u.id
                WHERE r.status = 'pendente' AND r.pacoteId IS NULL
                ORDER BY r.data ASC`;
            db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    function atualizarStatusRequisicao(id, status, observacoes = null) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE requisicoes SET status = ?, observacoes = ? WHERE id = ?`;
            db.run(sql, [status, observacoes, id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    // Atualiza o estoque ao aprovar requisição
    function descontarEstoque(itemId, quantidade) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE itens SET quantidade = quantidade - ? WHERE id = ? AND quantidade >= ?`;
            db.run(sql, [quantidade, itemId, quantidade], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async function buscarRequisicaoPorId(id) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    r.id,
                    r.userId,
                    r.itemId,
                    r.quantidade,
                    r.centroCusto,
                    r.projeto,
                    r.justificativa,
                    r.status,
                    r.observacoes,
                    r.data,
                    u.name as userName,
                    i.nome as itemNome,
                    i.descricao as itemDescricao
                FROM requisicoes r
                JOIN usuarios u ON r.userId = u.id
                JOIN itens i ON r.itemId = i.id
                WHERE r.id = ?
            `;
            
            db.get(query, [id], (err, row) => {
                if (err) {
                    console.error('Erro ao buscar requisição por ID:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

   // 1. Adicionar a função buscarItemPorNomeEWBS que está faltando:
function buscarItemPorNomeEWBS(nome, serie) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM itens WHERE nome = ? AND serie = ?`;
        
        db.get(sql, [nome, serie], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// 2. Adicionar a função atualizarQuantidadeItem que também está faltando:
function atualizarQuantidadeItem(id, novaQuantidade) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE itens SET quantidade = ? WHERE id = ?`;
        
        db.run(sql, [novaQuantidade, id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// 3. Adicionar essas funções no module.exports:
module.exports = {
    // Funções de usuários
    buscarUsuarioPorEmail,
    cadastrarUsuario,
    autenticarUsuario,
    
    // Funções de itens
    inserirItem,
    buscarItens,
    buscarItemPorId,
    atualizarQuantidade,
    removerItem,
    buscarItemPorNomeEWBS,
    atualizarQuantidadeItem,
    
    // Funções de movimentação
    inserirMovimentacao,
    buscarMovimentacoes,
    
    // Funções de banco de dados
    fecharConexao,
    verificarBanco,
    run,
    exportarDados,
    importarDados,
    unificarItensDuplicados,
    
    // Funções de requisições
    criarRequisicao,
    buscarRequisicoesUsuario,
    buscarRequisicoesPendentes,
    buscarRequisicoesIndividuaisPendentes,
    atualizarStatusRequisicao,
    descontarEstoque,
    buscarRequisicaoPorId,
    
    // Funções de pacotes
    criarPacoteRequisicao,
    buscarPacotesPendentes,
    buscarItensPacote,
    buscarPacotesUsuario,
    aprovarPacoteCompleto,
    aprovarItensPacote,
    negarItensPacote,
    rejeitarPacoteCompleto,
    verificarEAtualizarStatusPacote
};
