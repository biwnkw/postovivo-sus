import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const databaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

if (Boolean(SUPABASE_URL) !== Boolean(SUPABASE_KEY)) {
    throw new Error('Configuração incompleta do Supabase.');
}

function nextDate(weekday) {
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());

    const date = new Date(today + 'T12:00:00Z');
    const difference = (weekday - date.getUTCDay() + 7) % 7 || 7;

    date.setUTCDate(date.getUTCDate() + difference);

    return date.toISOString().slice(0, 10);
}

function initialState() {
    const now = new Date().toISOString();

    const unit = {
        id: 'DEMO-01',
        nome: 'UBS Jardim Aurora',
        bairro: 'Jardim Aurora',
        endereco: 'Rua das Acácias, 120',
        horario: 'Segunda a sexta, das 7h às 19h',
        lotacao: 'tranquila',
        atualizado: now
    };

    const doctor = {
        nome: 'Dra. Helena Duarte',
        especialidade: 'Cardiologia',
        crm: 'DEMO 1001',
        rqe: 'DEMO 201',
        dias: 'Segundas e quintas',
        presente: false,
        atualizado: now
    };

    const createSlot = (
        id,
        especialista,
        especialidade,
        dia,
        weekday,
        horario
    ) => ({
        id,
        especialista,
        especialidade,
        dia,
        data: nextDate(weekday),
        horario,
        unidade: unit.nome,
        endereco: unit.endereco,
        disponivel: true
    });

    return {
        versao: randomUUID(),
        unit,
        doctor,
        offer: false,
        sequence: 4,
        reports: [],
        bookings: [],

        agenda: [
            createSlot('AG-001', 'Dra. Helena Duarte', 'Cardiologia', 'Segunda-feira', 1, '09:00'),
            createSlot('AG-002', 'Dra. Helena Duarte', 'Cardiologia', 'Quinta-feira', 4, '14:30'),
            createSlot('AG-003', 'Dr. Rafael Almeida', 'Clínica Geral', 'Terça-feira', 2, '10:00'),
            createSlot('AG-004', 'Dra. Marina Costa', 'Oftalmologia', 'Quarta-feira', 3, '11:30'),
            createSlot('AG-005', 'Dra. Marina Costa', 'Oftalmologia', 'Sexta-feira', 5, '15:00')
        ],

        protocols: Object.fromEntries(
            ['SUS-4089', 'SUS-4090', 'SUS-4092', 'SUS-4093']
                .map((codigo, index) => [
                    codigo,
                    {
                        status: 'aguardando',
                        especialidade: 'Cardiologia',
                        canal: 'app',
                        ordem: index + 1
                    }
                ])
        )
    };
}

let memoryState = initialState();

async function databaseRequest(query, method = 'GET', body, prefer) {
    const headers = {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json'
    };

    if (!SUPABASE_KEY.startsWith('sb_secret_')) {
        headers.Authorization = `Bearer ${SUPABASE_KEY}`;
    }

    if (prefer) {
        headers.Prefer = prefer;
    }

    const response = await fetch(
        SUPABASE_URL.replace(/\/+$/, '') +
        '/rest/v1/postovivo_estado' +
        query,
        {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(8000)
        }
    );

    if (!response.ok) {
        console.error('Erro no Supabase:', response.status);
        throw new Error('Banco de dados indisponível.');
    }

    return response.json();
}

async function loadState() {
    if (!databaseEnabled) {
        return structuredClone(memoryState);
    }

    let rows = await databaseRequest(
        '?id=eq.demo&select=dados'
    );

    if (rows.length === 0) {
        await databaseRequest(
            '?on_conflict=id',
            'POST',
            {
                id: 'demo',
                dados: initialState(),
                atualizado_em: new Date().toISOString()
            },
            'resolution=ignore-duplicates,return=representation'
        );

        rows = await databaseRequest(
            '?id=eq.demo&select=dados'
        );
    }

    if (!rows[0]?.dados?.versao) {
        throw new Error('Estado do banco inválido.');
    }

    return rows[0].dados;
}

async function saveState(state) {
    const previousVersion = state.versao;

    const updated = {
        ...state,
        versao: randomUUID()
    };

    if (!databaseEnabled) {
        if (memoryState.versao !== previousVersion) {
            return false;
        }

        memoryState = structuredClone(updated);
        return true;
    }

    const params = new URLSearchParams({
        id: 'eq.demo',
        'dados->>versao': `eq.${previousVersion}`
    });

    const rows = await databaseRequest(
        '?' + params.toString(),
        'PATCH',
        {
            dados: updated,
            atualizado_em: new Date().toISOString()
        },
        'return=representation'
    );

    return rows.length === 1;
}

function waitingQueue(state, especialidade) {
    return Object.entries(state.protocols)
        .filter(([codigo, item]) =>
            item.status === 'aguardando' &&
            item.canal === 'app' &&
            (!especialidade || item.especialidade === especialidade)
        )
        .sort((a, b) => a[1].ordem - b[1].ordem);
}

function getProtocol(state, codigo) {
    if (!Object.hasOwn(state.protocols, codigo)) {
        return undefined;
    }

    const item = state.protocols[codigo];

    const index = waitingQueue(state, item.especialidade)
        .findIndex(([key]) => key === codigo);

    const position = index === -1 ? null : index + 1;

    return {
        codigo,
        status: item.status,
        especialidade: item.especialidade,
        posicao: position,
        pessoasNaFrente: position === null ? null : position - 1,
        consulta: item.consulta,
        canal: item.canal
    };
}

function snapshot(state) {
    return {
        unit: state.unit,
        doctor: state.doctor,
        offer: state.offer,
        relatos: state.reports.filter(
            item => Date.now() - item.time < 1800000
        ).length,
        agenda: state.agenda.filter(item => item.disponivel),
        totalAgendamentos: state.bookings.length,
        totalFila: waitingQueue(state).length
    };
}

function generateCode() {
    return 'SUS-' +
        randomUUID()
            .replace(/-/g, '')
            .slice(0, 12)
            .toUpperCase();
}

const streams = new Set();

function publish(state) {
    const event = 'data: ' +
        JSON.stringify(snapshot(state)) +
        '\n\n';

    for (const stream of streams) {
        stream.write(event);
    }
}

const assets = {
    '/': 'index.html',
    '/app.js': 'app.js',
    '/style.css': 'style.css'
};

const types = {
    'index.html': 'text/html',
    'app.js': 'text/javascript',
    'style.css': 'text/css'
};

createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;

    const send = (code, data) => {
        res.writeHead(code, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        });

        res.end(JSON.stringify(data));
    };

    const invalid = message => send(409, { erro: message });

    try {
        if (req.method === 'GET' && Object.hasOwn(assets, path)) {
            const file = assets[path];

            const content = await readFile(
                new URL('../web/' + file, import.meta.url)
            );

            res.writeHead(200, {
                'Content-Type': types[file] + '; charset=utf-8'
            });

            return res.end(content);
        }

        if (req.method === 'GET') {
            const state = await loadState();

            if (path === '/state') {
                return send(200, snapshot(state));
            }

            if (path === '/agenda') {
                return send(
                    200,
                    state.agenda.filter(item => item.disponivel)
                );
            }

            if (path === '/agendamentos') {
                return send(200, state.bookings);
            }

            if (path === '/fila') {
                return send(
                    200,
                    waitingQueue(state).map(
                        ([codigo]) => getProtocol(state, codigo)
                    )
                );
            }

            if (path === '/events') {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache'
                });

                streams.add(res);

                res.write(
                    'data: ' +
                    JSON.stringify(snapshot(state)) +
                    '\n\n'
                );

                res.on('close', () => streams.delete(res));

                return;
            }
        }

        if (req.method !== 'POST') {
            return send(404, { erro: 'Rota inexistente.' });
        }

        let raw = '';

        for await (const chunk of req) {
            raw += chunk;

            if (raw.length > 4096) {
                return send(413, {
                    erro: 'Requisição muito grande.'
                });
            }
        }

        let body;

        try {
            body = JSON.parse(raw || '{}');

            if (!body || typeof body !== 'object' || Array.isArray(body)) {
                throw new Error();
            }
        } catch {
            return send(400, {
                erro: 'Dados inválidos.'
            });
        }

        const state = await loadState();

        const {
            codigo,
            presente,
            lotacao,
            telefone,
            tecla,
            horarioId,
            especialidade
        } = body;

        const protocol = Object.hasOwn(state.protocols, codigo)
            ? state.protocols[codigo]
            : undefined;

        const commit = async (code, extra = {}) => {
            if (!await saveState(state)) {
                return invalid(
                    'Os dados foram atualizados por outro usuário. Tente novamente.'
                );
            }

            publish(state);

            return send(code, {
                ...snapshot(state),
                ...extra
            });
        };

        if (path === '/protocolo') {
            if (!protocol) {
                return send(404, {
                    erro: 'Protocolo não encontrado.'
                });
            }

            return send(200, {
                ...snapshot(state),
                protocolo: getProtocol(state, codigo)
            });
        }

        if (path === '/entrar-fila') {
            if (![
                'Cardiologia',
                'Clínica Geral',
                'Oftalmologia'
            ].includes(especialidade)) {
                return invalid('Escolha uma especialidade válida.');
            }

            const generatedCode = generateCode();

            state.protocols[generatedCode] = {
                status: 'aguardando',
                especialidade,
                canal: 'app',
                ordem: ++state.sequence
            };

            return await commit(201, {
                protocolo: getProtocol(state, generatedCode)
            });
        }

        if (path === '/retirar-fila') {
            if (
                !protocol ||
                protocol.status !== 'aguardando' ||
                protocol.canal !== 'app'
            ) {
                return invalid(
                    'Este protocolo não está na fila de espera.'
                );
            }

            protocol.status = 'cancelado';

            return await commit(200, {
                protocolo: getProtocol(state, codigo)
            });
        }

        if (path === '/agendar') {
            const slot = state.agenda.find(
                item => item.id === horarioId
            );

            if (!slot || !slot.disponivel) {
                return invalid(
                    'Este horário não está mais disponível.'
                );
            }

            const generatedCode = generateCode();

            slot.disponivel = false;

            const booking = {
                protocolo: generatedCode,
                especialista: slot.especialista,
                especialidade: slot.especialidade,
                dia: slot.dia,
                data: slot.data,
                horario: slot.horario,
                unidade: slot.unidade,
                endereco: slot.endereco,
                origem: 'Agendinha',
                status: 'confirmado',
                registradoEm: new Date().toISOString()
            };

            state.bookings.push(booking);

            state.protocols[generatedCode] = {
                status: 'confirmado',
                especialidade: slot.especialidade,
                canal: 'agendinha',
                consulta: booking
            };

            return await commit(201, {
                agendamento: booking
            });
        }

        if (
            path === '/presenca' &&
            typeof presente === 'boolean'
        ) {
            state.doctor.presente = presente;
            state.doctor.atualizado = new Date().toISOString();
        }

        else if (
            ['/lotacao', '/checkin'].includes(path) &&
            ['tranquila', 'moderada', 'lotada'].includes(lotacao)
        ) {
            state.unit.lotacao = lotacao;
            state.unit.atualizado = new Date().toISOString();

            if (path === '/checkin') {
                state.reports = state.reports.filter(
                    item => Date.now() - item.time < 1800000
                );

                state.reports.push({
                    time: Date.now(),
                    lotacao
                });
            }
        }

        else if (path === '/cadastro') {
            if (
                typeof codigo !== 'string' ||
                !/^SUS-[A-Z0-9]{4,16}$/.test(codigo) ||
                protocol ||
                typeof telefone !== 'string' ||
                !/^[1-9]{2}0{8,9}$/.test(telefone)
            ) {
                return invalid(
                    'Confira o protocolo e utilize um telefone fictício.'
                );
            }

            state.protocols[codigo] = {
                status: 'aguardando',
                especialidade: 'Cardiologia',
                canal: 'telefone_voz'
            };
        }

        else if (path === '/chamar') {
            if (
                protocol?.canal !== 'telefone_voz' ||
                protocol.status !== 'aguardando' ||
                state.offer
            ) {
                return invalid(
                    'Não foi possível iniciar esta chamada.'
                );
            }

            protocol.status = 'chamado';
        }

        else if (path === '/responder') {
            if (
                protocol?.status !== 'chamado' ||
                ![1, 2].includes(tecla) ||
                (tecla === 2 && state.offer)
            ) {
                return invalid(
                    'A chamada ou a vaga não está disponível.'
                );
            }

            protocol.status = tecla === 1
                ? 'confirmado'
                : 'cancelado_vaga_liberada';

            if (tecla === 2) {
                state.offer = true;
            }
        }

        else if (path === '/encaixe') {
            if (
                !state.offer ||
                protocol?.canal !== 'app' ||
                protocol.status !== 'aguardando' ||
                protocol.especialidade !== 'Cardiologia'
            ) {
                return invalid(
                    'Encaixe indisponível para este protocolo.'
                );
            }

            if (getProtocol(state, codigo).posicao !== 1) {
                return invalid(
                    'A vaga está reservada para o primeiro cidadão da fila.'
                );
            }

            protocol.status = 'confirmado';
            state.offer = false;
        }

        else {
            return send(400, {
                erro: 'Ação ou dados inválidos.'
            });
        }

        return await commit(200, {
            protocolo: getProtocol(state, codigo)
        });

    } catch (error) {
        console.error('Falha na operação:', error.message);

        if (!res.headersSent) {
            send(503, {
                erro: 'Serviço temporariamente indisponível. Tente novamente.'
            });
        } else {
            res.end();
        }
    }

}).listen(
    Number(process.env.PORT || 8080),
    '0.0.0.0',
    () => {
        console.log('PostoVivo SUS iniciado.');

        console.log(
            databaseEnabled
                ? 'Armazenamento: Supabase'
                : 'Armazenamento: memória local'
        );
    }
);