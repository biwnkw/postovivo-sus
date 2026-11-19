const el = id => document.getElementById(id);

const room =
    new URLSearchParams(location.search).get('sessao') || 'demo';

const lotacoes = {
    tranquila: 'Pouco movimento',
    moderada: 'Movimento moderado',
    lotada: 'Muito movimento'
};

const statusLabels = {
    aguardando: 'Aguardando uma vaga',
    chamado: 'Ligação simulada em andamento',
    confirmado: 'Consulta confirmada',
    cancelado_vaga_liberada: 'Consulta cancelada · Vaga liberada',
    cancelado: 'Cancelado'
};

let state = null;
let code = null;
let busy = false;
let online = false;

let appointments = [];
let queue = [];

let appointmentsLoaded = false;
let queueLoaded = false;

let appointmentsSignature = '';
let queueSignature = '';

let knownAppointments = new Set();
let revision = 0;

function updateText(id, text) {
    const element = el(id);

    if (element && element.textContent !== text) {
        element.textContent = text;
    }
}

function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function formatDate(date) {
    return date
        ? date.split('-').reverse().join('/')
        : 'Não informado';
}

function formatTimestamp(value) {
    if (!value) return 'Não informado';

    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setConnection(connected) {
    online = connected;

    el('live').dataset.online = String(connected);

    updateText(
        'live',
        connected
            ? 'Conectado ao servidor'
            : 'Sem conexão · Tentando reconectar'
    );

    updateControls();
}

function updateControls() {
    el('presenca').disabled = !online || busy;
    el('lotacao').disabled = !online || busy;

    document.querySelectorAll(
        '#cadastro button, #ligar, [data-tecla], .remove-queue'
    ).forEach(button => {
        button.disabled = !online || busy;
    });
}

function paint(next) {
    state = next;

    setConnection(true);

    updateText(
        'indicador-lotacao',
        lotacoes[next.unit.lotacao] || 'Não informado'
    );

    updateText(
        'indicador-especialista',
        next.doctor.presente
            ? '1 profissional presente'
            : 'Nenhum profissional monitorado presente'
    );

    updateText(
        'indicador-vagas',
        next.offer
            ? '1 vaga disponível'
            : 'Nenhuma vaga disponível'
    );

    updateText(
        'indicador-fila',
        String(next.totalFila ?? 'Não informado')
    );

    updateText(
        'indicador-agendamentos',
        String(next.totalAgendamentos ?? 'Não informado')
    );

    el('presenca').setAttribute(
        'aria-checked',
        String(next.doctor.presente)
    );

    updateText(
        'presenca',
        next.doctor.presente
            ? '✓ Presente hoje'
            : 'Ausente hoje'
    );

    if (document.activeElement !== el('lotacao')) {
        el('lotacao').value = next.unit.lotacao;
    }

    updateText(
        'movimento',
        `${next.relatos} check-ins nos últimos 30 minutos. Movimento atualizado em ${formatTimestamp(next.unit.atualizado)}.`
    );

    if (next.protocolo && next.protocolo.canal === 'telefone_voz') {
        const status = next.protocolo.status;

        el('fase').dataset.status = status;

        updateText(
            'fase',
            statusLabels[status] || status
        );

        el('protocolo').hidden = false;
        el('ligar').hidden = status !== 'aguardando';
        el('teclas').hidden = status !== 'chamado';
    }
}

function feedback(message, error = false) {
    const result = el('resultado');

    result.dataset.type = error
        ? 'error'
        : 'success';

    result.textContent = message;
}

async function request(path, body, signal) {
    const response = await fetch(path, {
        method: body ? 'POST' : 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Demo-Room': room
        },
        body: body
            ? JSON.stringify(body)
            : undefined,
        cache: 'no-store',
        signal
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.erro ||
            'Não foi possível concluir a operação.'
        );
    }

    return result;
}

function createCell(text, className = '') {
    const cell = document.createElement('td');

    cell.textContent =
        text === null || text === undefined || text === ''
            ? 'Não informado'
            : String(text);

    if (className) {
        cell.className = className;
    }

    return cell;
}

function createStatus(status) {
    const cell = document.createElement('td');
    const badge = document.createElement('span');

    badge.className = 'appointment-status';

    if (status === 'confirmado') {
        badge.classList.add('confirmado');
        badge.textContent = '✓ Confirmado';

    } else if (
        status === 'cancelado' ||
        status === 'cancelado_vaga_liberada'
    ) {
        badge.classList.add('cancelado');
        badge.textContent = 'Cancelado';

    } else {
        badge.textContent =
            statusLabels[status] || 'Não informado';
    }

    cell.appendChild(badge);

    return cell;
}

function emptyRow(tbody, columns, message) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');

    cell.colSpan = columns;
    cell.textContent = message;

    row.appendChild(cell);

    tbody.replaceChildren(row);
}

function renderAppointments(newCodes = new Set()) {
    if (!appointmentsLoaded) return;

    const tbody = el('lista-agendamentos');

    const search = normalize(
        el('buscar-agendamento').value
    );

    const specialty =
        el('filtro-especialidade').value;

    const filtered = appointments
        .filter(item => {
            const searchable = normalize(
                `${item.protocolo} ${item.especialista} ${item.especialidade}`
            );

            return (
                searchable.includes(search) &&
                (
                    specialty === 'todos' ||
                    item.especialidade === specialty
                )
            );
        })
        .sort((a, b) =>
            `${a.data} ${a.horario}`.localeCompare(
                `${b.data} ${b.horario}`
            )
        );

    updateText(
        'total-agendamentos',
        `${filtered.length} de ${appointments.length} consultas registradas`
    );

    if (filtered.length === 0) {
        emptyRow(
            tbody,
            7,
            appointments.length === 0
                ? 'Nenhuma consulta foi agendada pela Agendinha.'
                : 'Nenhum agendamento encontrado.'
        );

        return;
    }

    const fragment =
        document.createDocumentFragment();

    filtered.forEach(item => {
        const row = document.createElement('tr');

        if (newCodes.has(item.protocolo)) {
            row.classList.add('appointment-new');
        }

        row.appendChild(
            createCell(item.protocolo)
        );

        row.appendChild(
            createCell(item.especialidade)
        );

        row.appendChild(
            createCell(item.especialista)
        );

        row.appendChild(
            createCell(formatDate(item.data))
        );

        row.appendChild(
            createCell(item.horario)
        );

        row.appendChild(
            createCell(
                item.origem || 'Agendinha',
                'appointment-source'
            )
        );

        row.appendChild(
            createStatus(item.status)
        );

        fragment.appendChild(row);
    });

    tbody.replaceChildren(fragment);
}

function renderQueue() {
    if (!queueLoaded) return;

    const tbody = el('lista-fila');

    const search = normalize(
        el('buscar-fila').value
    );

    const specialty = el('filtro-fila').value;

    const filtered = queue
        .filter(item => {
            const searchable = normalize(
                `${item.codigo} ${item.especialidade}`
            );

            return (
                searchable.includes(search) &&
                (
                    specialty === 'todos' ||
                    item.especialidade === specialty
                )
            );
        })
        .sort((a, b) => {
            const specialtyOrder =
                a.especialidade.localeCompare(
                    b.especialidade,
                    'pt-BR'
                );

            return specialtyOrder ||
                a.posicao - b.posicao;
        });

    updateText(
        'total-fila',
        `${filtered.length} de ${queue.length} cidadãos na fila de espera`
    );

    const focusedCode =
        document.activeElement?.dataset?.codigo;

    if (filtered.length === 0) {
        emptyRow(
            tbody,
            6,
            queue.length === 0
                ? 'Nenhum cidadão está aguardando uma vaga.'
                : 'Nenhum protocolo encontrado.'
        );

        if (focusedCode) {
            el('buscar-fila').focus();
        }

        return;
    }

    const fragment =
        document.createDocumentFragment();

    filtered.forEach(item => {
        const row = document.createElement('tr');

        row.appendChild(
            createCell(`${item.posicao}º`)
        );

        row.appendChild(
            createCell(item.codigo)
        );

        row.appendChild(
            createCell(item.especialidade)
        );

        row.appendChild(
            createCell(item.pessoasNaFrente)
        );

        row.appendChild(
            createStatus(item.status)
        );

        const actions =
            document.createElement('td');

        const button =
            document.createElement('button');

        button.type = 'button';

        button.className = 'remove-queue';

        button.dataset.codigo = item.codigo;

        button.textContent = 'Retirar da fila';

        button.disabled = busy || !online;

        button.setAttribute(
            'aria-label',
            `Retirar protocolo ${item.codigo} da fila de espera`
        );

        button.addEventListener(
            'click',
            () => removeFromQueue(item)
        );

        actions.appendChild(button);
        row.appendChild(actions);

        fragment.appendChild(row);
    });

    tbody.replaceChildren(fragment);

    if (focusedCode) {
        const button = Array.from(
            tbody.querySelectorAll('.remove-queue')
        ).find(
            item => item.dataset.codigo === focusedCode
        );

        if (button) {
            button.focus();
        } else {
            el('buscar-fila').focus();
        }
    }
}

async function refreshAppointments(signal) {
    try {
        const result = await request(
            '/agendamentos',
            undefined,
            signal
        );

        if (!Array.isArray(result)) {
            throw new Error();
        }

        const signature = JSON.stringify(result);

        if (
            !appointmentsLoaded ||
            signature !== appointmentsSignature
        ) {
            const newCodes = new Set(
                result
                    .filter(item =>
                        appointmentsLoaded &&
                        !knownAppointments.has(item.protocolo)
                    )
                    .map(item => item.protocolo)
            );

            appointments = result;

            appointmentsSignature = signature;

            knownAppointments = new Set(
                result.map(item => item.protocolo)
            );

            appointmentsLoaded = true;

            renderAppointments(newCodes);

            if (newCodes.size > 0) {
                feedback(
                    `${newCodes.size} novo(s) agendamento(s) recebido(s) pela Agendinha.`
                );
            }
        }

        updateText(
            'atualizacao-agendamentos',
            `Última sincronização: ${new Date().toLocaleTimeString('pt-BR')}.`
        );

    } catch {
        if (!appointmentsLoaded) {
            updateText(
                'total-agendamentos',
                'Agendamentos indisponíveis.'
            );
        }

        updateText(
            'atualizacao-agendamentos',
            'Não foi possível sincronizar. Os dados podem estar desatualizados.'
        );
    }
}

async function refreshQueue(signal) {
    try {
        const result = await request(
            '/fila',
            undefined,
            signal
        );

        if (!Array.isArray(result)) {
            throw new Error();
        }

        const signature = JSON.stringify(result);

        if (
            !queueLoaded ||
            signature !== queueSignature
        ) {
            queue = result;
            queueSignature = signature;
            queueLoaded = true;

            renderQueue();
        }

        updateText(
            'atualizacao-fila',
            `Última sincronização: ${new Date().toLocaleTimeString('pt-BR')}.`
        );

    } catch {
        if (!queueLoaded) {
            updateText(
                'total-fila',
                'Fila indisponível.'
            );
        }

        updateText(
            'atualizacao-fila',
            'As posições podem estar desatualizadas. Tentando reconectar.'
        );
    }
}

async function send(path, body, confirmation) {
    if (busy || !online) return false;

    busy = true;
    revision++;

    updateControls();

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        8000
    );

    try {
        const result = await request(
            path,
            body,
            controller.signal
        );

        paint(result);

        if (confirmation) {
            feedback(confirmation);
        }

        return true;

    } catch (error) {
        feedback(
            error.name === 'AbortError'
                ? 'O servidor demorou para responder. Confira os dados antes de repetir a operação.'
                : error.message,
            true
        );

        return false;

    } finally {
        clearTimeout(timeout);

        revision++;
        busy = false;

        updateControls();
    }
}

async function removeFromQueue(item) {
    if (busy || !online) return;

    const confirmed = window.confirm(
        `Deseja retirar o protocolo ${item.codigo} da fila de ${item.especialidade}?`
    );

    if (!confirmed) return;

    const success = await send(
        '/retirar-fila',
        { codigo: item.codigo },
        'Protocolo retirado. As posições serão atualizadas automaticamente.'
    );

    if (success) {
        await refreshQueue(
            AbortSignal.timeout(5000)
        );
    }
}

async function refresh() {
    if (busy) {
        setTimeout(refresh, 1500);
        return;
    }

    const currentRevision = revision;

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        6000
    );

    try {
        const next = await request(
            '/state',
            undefined,
            controller.signal
        );

        if (!busy && revision === currentRevision) {
            paint(next);

            await Promise.all([
                refreshAppointments(controller.signal),
                refreshQueue(controller.signal)
            ]);
        }

    } catch {
        if (!busy && revision === currentRevision) {
            setConnection(false);
        }

        updateText(
            'atualizacao-fila',
            'Sem conexão. Últimas posições recebidas.'
        );

        updateText(
            'atualizacao-agendamentos',
            'Sem conexão. Últimos dados recebidos.'
        );

    } finally {
        clearTimeout(timeout);

        setTimeout(refresh, 1500);
    }
}

function applyContrast(enabled) {
    document.body.classList.toggle(
        'contraste',
        enabled
    );

    el('contraste').setAttribute(
        'aria-pressed',
        String(enabled)
    );

    updateText(
        'contraste',
        enabled
            ? 'Desativar alto contraste'
            : 'Ativar alto contraste'
    );

    localStorage.setItem(
        'postovivo-contraste',
        String(enabled)
    );
}

el('contraste').onclick = () => {
    applyContrast(
        !document.body.classList.contains('contraste')
    );
};

const fontOptions = {
    'fonte-normal': 16,
    'fonte-maior': 19,
    'fonte-grande': 22
};

function changeFont(size) {
    document.documentElement.style.fontSize =
        `${size}px`;

    Object.entries(fontOptions).forEach(([id, value]) => {
        el(id).setAttribute(
            'aria-pressed',
            String(value === size)
        );
    });

    localStorage.setItem(
        'postovivo-font',
        String(size)
    );
}

Object.entries(fontOptions).forEach(([id, size]) => {
    el(id).onclick = () => changeFont(size);
});

el('buscar-agendamento').addEventListener(
    'input',
    () => renderAppointments()
);

el('filtro-especialidade').addEventListener(
    'change',
    () => renderAppointments()
);

el('buscar-fila').addEventListener(
    'input',
    renderQueue
);

el('filtro-fila').addEventListener(
    'change',
    renderQueue
);

el('presenca').onclick = () => {
    if (!state) return;

    send(
        '/presenca',
        {
            presente: !state.doctor.presente
        },
        'Disponibilidade atualizada no aplicativo do cidadão.'
    );
};

el('lotacao').onchange = async event => {
    const success = await send(
        '/lotacao',
        {
            lotacao: event.target.value
        },
        'Movimento da unidade atualizado com sucesso.'
    );

    if (!success && state) {
        el('lotacao').value =
            state.unit.lotacao;
    }
};

el('cadastro').onsubmit = async event => {
    event.preventDefault();

    const codigo = el('codigo')
        .value
        .trim()
        .toUpperCase();

    const telefone = el('telefone')
        .value
        .replace(/\D/g, '');

    if (!/^SUS-[A-Z0-9]{4,16}$/.test(codigo)) {
        feedback(
            'Informe um protocolo válido, como SUS-7001.',
            true
        );

        el('codigo').focus();

        return;
    }

    if (!/^[1-9]{2}0{8,9}$/.test(telefone)) {
        feedback(
            'Utilize somente um telefone fictício, como 11000000000.',
            true
        );

        el('telefone').focus();

        return;
    }

    const success = await send(
        '/cadastro',
        {
            codigo,
            telefone
        },
        'Protocolo cadastrado. Você já pode simular a chamada.'
    );

    if (success) {
        code = codigo;

        el('ligar').focus();
    }
};

el('ligar').onclick = async () => {
    if (!code) return;

    const success = await send(
        '/chamar',
        {
            codigo: code
        },
        'Chamada simulada iniciada. Escolha a resposta do paciente.'
    );

    if (!success) return;

    document.querySelector(
        '[data-tecla="1"]'
    ).focus();

    if (!('speechSynthesis' in window)) {
        return;
    }

    window.speechSynthesis.cancel();

    const voice = new SpeechSynthesisUtterance(
        'Olá. Aqui é o PostoVivo. Sua consulta de cardiologia está marcada para segunda-feira, às dez horas. Para confirmar sua consulta, pressione um. Se não puder comparecer, pressione dois.'
    );

    voice.lang = 'pt-BR';
    voice.rate = 0.85;

    window.speechSynthesis.speak(voice);
};

async function respond(tecla) {
    if (
        el('teclas').hidden ||
        busy ||
        !code
    ) {
        return;
    }

    window.speechSynthesis?.cancel();

    const message =
        tecla === 1
            ? 'Consulta confirmada pelo paciente.'
            : 'Consulta cancelada. A vaga foi disponibilizada ao primeiro cidadão da fila de cardiologia.';

    await send(
        '/responder',
        {
            codigo: code,
            tecla
        },
        message
    );
}

document
    .querySelectorAll('[data-tecla]')
    .forEach(button => {
        button.onclick = () => {
            respond(
                Number(button.dataset.tecla)
            );
        };
    });

document.addEventListener(
    'keydown',
    event => {
        const ignored = [
            'INPUT',
            'SELECT',
            'TEXTAREA'
        ];

        if (
            ignored.includes(event.target.tagName) ||
            event.target.isContentEditable ||
            event.repeat
        ) {
            return;
        }

        if (
            !el('teclas').hidden &&
            ['1', '2'].includes(event.key)
        ) {
            respond(Number(event.key));
        }
    }
);

const navigation =
    document.querySelectorAll('.sidebar nav a');

function updateNavigation() {
    const current = location.hash || '#inicio';

    navigation.forEach(link => {
        const selected =
            link.getAttribute('href') === current;

        link.classList.toggle(
            'active',
            selected
        );

        if (selected) {
            link.setAttribute(
                'aria-current',
                'location'
            );
        } else {
            link.removeAttribute(
                'aria-current'
            );
        }
    });
}

window.addEventListener(
    'hashchange',
    updateNavigation
);

applyContrast(
    localStorage.getItem(
        'postovivo-contraste'
    ) === 'true'
);

const savedFont = Number(
    localStorage.getItem('postovivo-font')
);

changeFont(
    Object.values(fontOptions).includes(savedFont)
        ? savedFont
        : 16
);

updateNavigation();
updateControls();
refresh();