import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const unit = {
    id: 'DEMO-01',
    nome: 'UBS Jardim Aurora',
    bairro: 'Jardim Aurora',
    endereco: 'Rua das Acácias, 120',
    horario: 'Segunda a sexta, das 7h às 19h',
    lotacao: 'tranquila',
    atualizado: new Date().toISOString()
};

const doctor = {
    nome: 'Dra. Helena Duarte',
    especialidade: 'Cardiologia',
    crm: 'DEMO 1001',
    rqe: 'DEMO 201',
    dias: 'Segundas e quintas',
    presente: false,
    atualizado: unit.atualizado
};

function nextDate(weekday) {
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());

    const date = new Date(today + 'T12:00:00Z');

    let difference =
        (weekday - date.getUTCDay() + 7) % 7;

    if (difference === 0) {
        difference = 7;
    }

    date.setUTCDate(
        date.getUTCDate() + difference
    );

    return date.toISOString().slice(0, 10);
}

const agenda = [
    {
        id: 'AG-001',
        especialista: 'Dra. Helena Duarte',
        especialidade: 'Cardiologia',
        dia: 'Segunda-feira',
        data: nextDate(1),
        horario: '09:00',
        unidade: unit.nome,
        endereco: unit.endereco,
        disponivel: true
    },
    {
        id: 'AG-002',
        especialista: 'Dra. Helena Duarte',
        especialidade: 'Cardiologia',
        dia: 'Quinta-feira',
        data: nextDate(4),
        horario: '14:30',
        unidade: unit.nome,
        endereco: unit.endereco,
        disponivel: true
    },
    {
        id: 'AG-003',
        especialista: 'Dr. Rafael Almeida',
        especialidade: 'Clínica Geral',
        dia: 'Terça-feira',
        data: nextDate(2),
        horario: '10:00',
        unidade: unit.nome,
        endereco: unit.endereco,
        disponivel: true
    },
    {
        id: 'AG-004',
        especialista: 'Dra. Marina Costa',
        especialidade: 'Oftalmologia',
        dia: 'Quarta-feira',
        data: nextDate(3),
        horario: '11:30',
        unidade: unit.nome,
        endereco: unit.endereco,
        disponivel: true
    },
    {
        id: 'AG-005',
        especialista: 'Dra. Marina Costa',
        especialidade: 'Oftalmologia',
        dia: 'Sexta-feira',
        data: nextDate(5),
        horario: '15:00',
        unidade: unit.nome,
        endereco: unit.endereco,
        disponivel: true
    }
];

const bookings = [];
const reports = [];
const streams = new Set();

let offer = false;
let sequence = 4;

const protocols = new Map([
    [
        'SUS-4089',
        {
            status: 'aguardando',
            especialidade: 'Cardiologia',
            canal: 'app',
            ordem: 1
        }
    ],
    [
        'SUS-4090',
        {
            status: 'aguardando',
            especialidade: 'Cardiologia',
            canal: 'app',
            ordem: 2
        }
    ],
    [
        'SUS-4092',
        {
            status: 'aguardando',
            especialidade: 'Cardiologia',
            canal: 'app',
            ordem: 3
        }
    ],
    [
        'SUS-4093',
        {
            status: 'aguardando',
            especialidade: 'Cardiologia',
            canal: 'app',
            ordem: 4
        }
    ]
]);

function waitingQueue(especialidade) {
    return [...protocols.entries()]
        .filter(([codigo, item]) =>
            item.status === 'aguardando' &&
            item.canal === 'app' &&
            (!especialidade ||
                item.especialidade === especialidade)
        )
        .sort((a, b) => a[1].ordem - b[1].ordem);
}

function getPosition(codigo) {
    const item = protocols.get(codigo);

    if (
        !item ||
        item.status !== 'aguardando' ||
        item.canal !== 'app'
    ) {
        return null;
    }

    const queue = waitingQueue(
        item.especialidade
    );

    const index = queue.findIndex(
        ([key]) => key === codigo
    );

    return index === -1 ? null : index + 1;
}

function getProtocol(codigo) {
    const item = protocols.get(codigo);

    if (!item) return undefined;

    const position = getPosition(codigo);

    return {
        codigo,
        status: item.status,
        especialidade: item.especialidade,
        posicao: position,
        pessoasNaFrente:
            position === null ? null : position - 1,
        consulta: item.consulta,
        canal: item.canal
    };
}

function getQueue() {
    return waitingQueue()
        .map(([codigo]) => getProtocol(codigo));
}

function snapshot() {
    return {
        unit,
        doctor,
        offer,
        relatos: reports.filter(
            report =>
                Date.now() - report.time < 1800000
        ).length,
        agenda: agenda.filter(
            item => item.disponivel
        ),
        totalAgendamentos: bookings.length,
        totalFila: waitingQueue().length
    };
}

function publish() {
    const event =
        'data: ' +
        JSON.stringify(snapshot()) +
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
    const path = new URL(
        req.url,
        'http://localhost'
    ).pathname;

    const send = (code, data) => {
        res.writeHead(code, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        });

        res.end(JSON.stringify(data));
    };

    const invalid = message =>
        send(409, { erro: message });

    try {
        if (
            req.method === 'GET' &&
            Object.hasOwn(assets, path)
        ) {
            const file = assets[path];

            const content = await readFile(
                new URL(
                    '../web/' + file,
                    import.meta.url
                )
            );

            res.writeHead(200, {
                'Content-Type':
                    types[file] + '; charset=utf-8'
            });

            return res.end(content);
        }

        if (
            req.method === 'GET' &&
            path === '/events'
        ) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache'
            });

            streams.add(res);

            res.write(
                'data: ' +
                JSON.stringify(snapshot()) +
                '\n\n'
            );

            res.on('close', () => {
                streams.delete(res);
            });

            return;
        }

        if (
            req.method === 'GET' &&
            path === '/state'
        ) {
            return send(200, snapshot());
        }

        if (
            req.method === 'GET' &&
            path === '/agenda'
        ) {
            return send(
                200,
                agenda.filter(item => item.disponivel)
            );
        }

        if (
            req.method === 'GET' &&
            path === '/agendamentos'
        ) {
            return send(200, bookings);
        }

        if (
            req.method === 'GET' &&
            path === '/fila'
        ) {
            return send(200, getQueue());
        }

        if (req.method !== 'POST') {
            return send(404, {
                erro: 'Rota inexistente.'
            });
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

        const body = JSON.parse(raw || '{}');

        const {
            codigo,
            presente,
            lotacao,
            telefone,
            tecla,
            horarioId,
            especialidade
        } = body;

        const protocol = protocols.get(codigo);

        const validLoad = [
            'tranquila',
            'moderada',
            'lotada'
        ].includes(lotacao);

        if (path === '/entrar-fila') {
            const specialties = [
                'Cardiologia',
                'Clínica Geral',
                'Oftalmologia'
            ];

            if (
                !specialties.includes(especialidade)
            ) {
                return invalid(
                    'Escolha uma especialidade válida.'
                );
            }

            const generatedCode =
                'SUS-' +
                randomUUID()
                    .replace(/-/g, '')
                    .slice(0, 12)
                    .toUpperCase();

            protocols.set(generatedCode, {
                status: 'aguardando',
                especialidade,
                canal: 'app',
                ordem: ++sequence
            });

            publish();

            return send(201, {
                ...snapshot(),
                protocolo: getProtocol(generatedCode)
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

            publish();

            return send(200, {
                ...snapshot(),
                protocolo: getProtocol(codigo)
            });
        }

        if (path === '/agendar') {
            const slot = agenda.find(
                item => item.id === horarioId
            );

            if (!slot || !slot.disponivel) {
                return invalid(
                    'Este horário não está mais disponível. Escolha outro horário.'
                );
            }

            const generatedCode =
                'SUS-' +
                randomUUID()
                    .replace(/-/g, '')
                    .slice(0, 12)
                    .toUpperCase();

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

            bookings.push(booking);

            protocols.set(generatedCode, {
                status: 'confirmado',
                especialidade: slot.especialidade,
                canal: 'agendinha',
                consulta: booking
            });

            publish();

            return send(201, {
                ...snapshot(),
                agendamento: booking
            });
        }

        if (
            path === '/presenca' &&
            typeof presente === 'boolean'
        ) {
            Object.assign(doctor, {
                presente,
                atualizado: new Date().toISOString()
            });
        }

        else if (
            (
                path === '/lotacao' ||
                path === '/checkin'
            ) &&
            validLoad
        ) {
            Object.assign(unit, {
                lotacao,
                atualizado: new Date().toISOString()
            });

            if (path === '/checkin') {
                reports.push({
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

            protocols.set(codigo, {
                status: 'aguardando',
                especialidade: 'Cardiologia',
                canal: 'telefone_voz'
            });
        }

        else if (path === '/chamar') {
            if (
                protocol?.canal !== 'telefone_voz' ||
                protocol.status !== 'aguardando' ||
                offer
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
                (tecla === 2 && offer)
            ) {
                return invalid(
                    'A chamada ou a vaga não está disponível.'
                );
            }

            protocol.status =
                tecla === 1
                    ? 'confirmado'
                    : 'cancelado_vaga_liberada';

            if (tecla === 2) {
                offer = true;
            }
        }

        else if (path === '/encaixe') {
            if (
                !offer ||
                protocol?.canal !== 'app' ||
                protocol.status !== 'aguardando' ||
                protocol.especialidade !== 'Cardiologia'
            ) {
                return invalid(
                    'Encaixe indisponível para este protocolo.'
                );
            }

            if (getPosition(codigo) !== 1) {
                return invalid(
                    'A vaga está reservada para o primeiro cidadão da fila.'
                );
            }

            protocol.status = 'confirmado';
            offer = false;
        }

        else if (path !== '/protocolo') {
            return send(400, {
                erro: 'Ação ou dados inválidos.'
            });
        }

        if (
            path === '/protocolo' &&
            !protocol
        ) {
            return send(404, {
                erro: 'Protocolo não encontrado.'
            });
        }

        if (path !== '/protocolo') {
            publish();
        }

        return send(200, {
            ...snapshot(),
            protocolo: getProtocol(codigo)
        });

    } catch {
        if (!res.headersSent) {
            send(400, {
                erro: 'Não foi possível processar a requisição.'
            });
        } else {
            res.end();
        }
    }
}).listen(
    Number(process.env.PORT || 8080),
    '0.0.0.0',
    () => console.log(
        'PostoVivo SUS em http://localhost:' +
        (process.env.PORT || 8080)
    )
);