const express = require('express');
const router = express.Router();
const db = require('./database');

// Criar novo pacote de requisição
router.post('/requisicoes-pacote', async (req, res) => {
    try {
        const { centroCusto, projeto, justificativa, itens } = req.body;
        const userId = req.session.userId; // ID do usuário logado

        if (!centroCusto || !projeto || !itens || !Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ error: 'Dados inválidos para criar pacote' });
        }

        // Validar disponibilidade dos itens
        const itensDisponiveis = await db.all('SELECT id, quantidade FROM itens WHERE id IN (?)', 
            [itens.map(i => i.id)]);
        
        const itemIndisponivel = itens.find(item => {
            const disponivel = itensDisponiveis.find(d => d.id === item.id);
            return !disponivel || disponivel.quantidade < item.quantidade;
        });

        if (itemIndisponivel) {
            return res.status(400).json({ error: 'Quantidade indisponível em estoque' });
        }

        // Criar pacote de requisição
        const result = await db.run(
            'INSERT INTO pacotes_requisicao (usuario_id, centro_custo, projeto, justificativa, status, data_criacao) VALUES (?, ?, ?, ?, ?, datetime("now"))',
            [userId, centroCusto, projeto, justificativa, 'pendente']
        );
        
        const pacoteId = result.lastID;

        // Adicionar itens ao pacote
        for (const item of itens) {
            await db.run(
                'INSERT INTO itens_pacote (pacote_id, item_id, quantidade) VALUES (?, ?, ?)',
                [pacoteId, item.id, item.quantidade]
            );
        }

        res.json({ success: true, pacoteId });
    } catch (error) {
        console.error('Erro ao criar pacote:', error);
        res.status(500).json({ error: 'Erro interno ao criar pacote' });
    }
});

// Buscar pacotes pendentes (admin)
router.get('/requisicoes-pacote/pendentes', async (req, res) => {
    try {
        const pacotes = await db.all(`
            SELECT 
                p.*,
                u.name as solicitante,
                GROUP_CONCAT(json_object(
                    'id', i.id,
                    'nome', i.nome,
                    'quantidade', ip.quantidade
                )) as itens
            FROM pacotes_requisicao p
            JOIN users u ON p.usuario_id = u.id
            JOIN itens_pacote ip ON p.id = ip.pacote_id
            JOIN itens i ON ip.item_id = i.id
            WHERE p.status = 'pendente'
            GROUP BY p.id
        `);

        // Parse itens string para array
        pacotes.forEach(p => {
            p.itens = JSON.parse(`[${p.itens}]`);
        });

        res.json(pacotes);
    } catch (error) {
        console.error('Erro ao buscar pacotes pendentes:', error);
        res.status(500).json({ error: 'Erro ao buscar pacotes' });
    }
});

// Buscar pacotes do usuário
router.get('/requisicoes-pacote/minhas', async (req, res) => {
    try {
        const userId = req.session.userId;
        const pacotes = await db.all(`
            SELECT 
                p.*,
                GROUP_CONCAT(json_object(
                    'id', i.id,
                    'nome', i.nome,
                    'quantidade', ip.quantidade
                )) as itens
            FROM pacotes_requisicao p
            JOIN itens_pacote ip ON p.id = ip.pacote_id
            JOIN itens i ON ip.item_id = i.id
            WHERE p.usuario_id = ?
            GROUP BY p.id
        `, [userId]);

        // Parse itens string para array
        pacotes.forEach(p => {
            p.itens = JSON.parse(`[${p.itens}]`);
        });

        res.json(pacotes);
    } catch (error) {
        console.error('Erro ao buscar pacotes do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar pacotes' });
    }
});

// Aceitar pacote
router.post('/requisicoes-pacote/:id/aceitar', async (req, res) => {
    try {
        const pacoteId = req.params.id;
        
        // Buscar dados do pacote
        const pacote = await db.get('SELECT * FROM pacotes_requisicao WHERE id = ?', [pacoteId]);
        if (!pacote) {
            return res.status(404).json({ error: 'Pacote não encontrado' });
        }
        
        // Buscar itens do pacote
        const itensPacote = await db.all(`
            SELECT ip.*, i.nome, i.quantidade as estoque_atual
            FROM itens_pacote ip
            JOIN itens i ON ip.item_id = i.id
            WHERE ip.pacote_id = ?
        `, [pacoteId]);

        // Verificar disponibilidade atual
        const itemIndisponivel = itensPacote.find(i => i.quantidade > i.estoque_atual);
        if (itemIndisponivel) {
            return res.status(400).json({ 
                error: `Item ${itemIndisponivel.nome} não tem quantidade suficiente em estoque` 
            });
        }

        // Iniciar transação
        await db.run('BEGIN TRANSACTION');

        try {
            // Atualizar status do pacote
            await db.run(
                'UPDATE pacotes_requisicao SET status = ?, data_aprovacao = datetime("now") WHERE id = ?',
                ['aprovado', pacoteId]
            );

            // Processar cada item
            for (const item of itensPacote) {
                // Retirar do estoque
                await db.run(
                    'UPDATE itens SET quantidade = quantidade - ? WHERE id = ?',
                    [item.quantidade, item.item_id]
                );

                // Registrar movimentação
                await db.run(`
                    INSERT INTO movimentacoes (
                        item_id, tipo, quantidade, destino, descricao, data
                    ) VALUES (?, 'saida', ?, ?, ?, datetime("now"))
                `, [
                    item.item_id,
                    item.quantidade,
                    pacote.centro_custo,
                    `Requisição em pacote (${pacote.projeto}) - ${pacote.justificativa}`
                ]);
            }

            await db.run('COMMIT');
            res.json({ success: true });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Erro ao aceitar pacote:', error);
        res.status(500).json({ error: 'Erro ao processar pacote' });
    }
});

// Recusar pacote
router.post('/requisicoes-pacote/:id/recusar', async (req, res) => {
    try {
        const pacoteId = req.params.id;
        
        await db.run(
            'UPDATE pacotes_requisicao SET status = ?, data_aprovacao = datetime("now") WHERE id = ?',
            ['recusado', pacoteId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao recusar pacote:', error);
        res.status(500).json({ error: 'Erro ao recusar pacote' });
    }
});

module.exports = router;
