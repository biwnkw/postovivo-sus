import React, { useEffect, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    Animated,
    Pressable,
    SafeAreaView,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    View,
    StyleSheet
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Agendinha from './Agendinha';

const API = process.env.EXPO_PUBLIC_API_URL;
const ROOM = process.env.EXPO_PUBLIC_DEMO_ROOM || 'demo';

const specialties = [
    'Cardiologia',
    'Clínica Geral',
    'Oftalmologia'
];

const documents =
    'Leve um documento com foto, o Cartão SUS e o encaminhamento, caso tenha sido solicitado.';

const loads = {
    tranquila: 'Pouco movimento',
    moderada: 'Movimento moderado',
    lotada: 'Muito movimento'
};

const statuses = {
    aguardando: 'Aguardando uma vaga',
    chamado: 'Paciente convocado',
    confirmado: 'Consulta confirmada',
    cancelado: 'Saída da fila confirmada',
    cancelado_vaga_liberada: 'Consulta cancelada'
};

const formatDate = date =>
    date ? date.split('-').reverse().join('/') : '';

const formatTime = value =>
    value
        ? new Date(value).toLocaleString('pt-BR')
        : 'Não informado';

async function request(path, body, signal) {
    const response = await fetch(`${API}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Demo-Room': ROOM
        },
        body: body ? JSON.stringify(body) : undefined,
        signal
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.erro || 'Não foi possível concluir a operação.'
        );
    }

    return result;
}

function Txt({
    children,
    theme,
    scale = 1,
    size = 16,
    bold = false,
    muted = false,
    color,
    heading = false
}) {
    return (
        <Text
            accessibilityRole={heading ? 'header' : undefined}
            style={{
                color: color || (muted ? theme.muted : theme.text),
                fontSize: size * scale,
                lineHeight: size * scale * 1.4,
                fontWeight: bold ? '700' : '400'
            }}
        >
            {children}
        </Text>
    );
}

function Button({
    title,
    onPress,
    theme,
    scale = 1,
    secondary = false,
    selected = false,
    disabled = false
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.button,
                {
                    backgroundColor: secondary
                        ? theme.surface
                        : theme.primary,
                    borderColor: selected
                        ? theme.text
                        : theme.primary,
                    borderWidth: selected ? 3 : 1,
                    opacity: disabled ? 0.5 : pressed ? 0.7 : 1
                }
            ]}
        >
            <Txt
                theme={theme}
                scale={scale}
                bold
                color={secondary ? theme.primary : theme.buttonText}
            >
                {title}
            </Txt>
        </Pressable>
    );
}

function Card({ children, theme, highlight = false }) {
    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: highlight
                        ? theme.light
                        : theme.surface,
                    borderColor: highlight
                        ? theme.primary
                        : theme.border
                }
            ]}
        >
            {children}
        </View>
    );
}

function Action({
    title,
    description,
    icon,
    onPress,
    theme,
    scale
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${description}`}
            onPress={onPress}
            style={({ pressed }) => [
                styles.action,
                {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: pressed ? 0.75 : 1
                }
            ]}
        >
            <View
                accessible={false}
                style={[
                    styles.actionIcon,
                    { backgroundColor: theme.light }
                ]}
            >
                <Txt theme={theme} size={26} bold>
                    {icon}
                </Txt>
            </View>

            <View style={{ flex: 1, gap: 5 }}>
                <Txt theme={theme} scale={scale} bold size={18}>
                    {title}
                </Txt>

                <Txt theme={theme} scale={scale} muted size={14}>
                    {description}
                </Txt>
            </View>

            <Txt theme={theme} size={24}>›</Txt>
        </Pressable>
    );
}

export default function App() {
    const [screen, setScreen] = useState('home');
    const [data, setData] = useState(null);
    const [online, setOnline] = useState(false);
    const [contrast, setContrast] = useState(false);
    const [fontSize, setFontSize] = useState(1);
    const [reduceMotion, setReduceMotion] = useState(false);
    const [systemMotion, setSystemMotion] = useState(true);
    const [search, setSearch] = useState('');
    const [protocolCode, setProtocolCode] = useState('SUS-4092');
    const [trackedCode, setTrackedCode] = useState('');
    const [protocol, setProtocol] = useState(null);
    const [selectedSpecialty, setSelectedSpecialty] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [withdraw, setWithdraw] = useState(false);

    const animation = useRef(new Animated.Value(1)).current;
    const scrollRef = useRef(null);
    const lock = useRef(false);
    const protocolRevision = useRef(0);
    const stateRevision = useRef(0);

    const colors = {
        background: contrast ? '#000000' : '#F3F6F5',
        surface: contrast ? '#151515' : '#FFFFFF',
        text: contrast ? '#FFFFFF' : '#17352F',
        muted: contrast ? '#EEEEEE' : '#50645F',
        primary: contrast ? '#FFE477' : '#075C46',
        light: contrast ? '#242424' : '#E5F1EA',
        border: contrast ? '#FFFFFF' : '#D5E2DB',
        buttonText: contrast ? '#000000' : '#FFFFFF'
    };

    const themeProps = {
        theme: colors,
        scale: fontSize
    };

    const unit = data?.unit;
    const doctor = data?.doctor;
    const code = protocolCode.trim().toUpperCase();

    const position = protocol?.posicao;
    const ahead = protocol?.pessoasNaFrente;

    useEffect(() => {
        AccessibilityInfo.isReduceMotionEnabled()
            .then(setSystemMotion)
            .catch(() => {});

        const subscription =
            AccessibilityInfo.addEventListener(
                'reduceMotionChanged',
                setSystemMotion
            );

        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (!API) return;

        let active = true;
        let timer;
        let controller;

        async function update() {
            controller = new AbortController();

            const revision = stateRevision.current;

            const timeout = setTimeout(
                () => controller.abort(),
                5000
            );

            try {
                const result = await request(
                    '/state',
                    undefined,
                    controller.signal
                );

                if (
                    active &&
                    !lock.current &&
                    revision === stateRevision.current
                ) {
                    setData(result);
                    setOnline(true);
                }
            } catch {
                if (active) setOnline(false);
            } finally {
                clearTimeout(timeout);

                if (active) {
                    timer = setTimeout(update, 1500);
                }
            }
        }

        update();

        return () => {
            active = false;
            clearTimeout(timer);
            controller?.abort();
        };
    }, []);

    useEffect(() => {
        if (!trackedCode || screen !== 'queue') return;

        let active = true;
        let timer;
        let controller;

        async function updateProtocol() {
            if (lock.current) {
                timer = setTimeout(updateProtocol, 2000);
                return;
            }

            controller = new AbortController();

            const revision = protocolRevision.current;

            const timeout = setTimeout(
                () => controller.abort(),
                5000
            );

            try {
                const result = await request(
                    '/protocolo',
                    { codigo: trackedCode },
                    controller.signal
                );

                if (
                    active &&
                    !lock.current &&
                    revision === protocolRevision.current
                ) {
                    setProtocol(result.protocolo);
                }
            } catch {
                if (
                    active &&
                    revision === protocolRevision.current
                ) {
                    setMessage(
                        'Não foi possível atualizar sua posição. Confira a conexão ou consulte novamente.'
                    );
                }
            } finally {
                clearTimeout(timeout);

                if (active) {
                    timer = setTimeout(updateProtocol, 2000);
                }
            }
        }

        updateProtocol();

        return () => {
            active = false;
            clearTimeout(timer);
            controller?.abort();
        };
    }, [trackedCode, screen]);

    function navigate(next) {
        Speech.stop();
        setMessage('');
        setWithdraw(false);
        setScreen(next);

        scrollRef.current?.scrollTo({
            y: 0,
            animated: false
        });

        if (!reduceMotion && !systemMotion) {
            animation.setValue(0);

            Animated.timing(animation, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true
            }).start();
        }
    }

    function speak(text) {
        Speech.stop();

        Speech.speak(text, {
            language: 'pt-BR',
            rate: 0.85
        });
    }

    function notify(text) {
        setMessage(text);
        AccessibilityInfo.announceForAccessibility(text);
    }

    async function send(path, body, confirmation) {
        if (lock.current) return null;

        lock.current = true;
        protocolRevision.current++;
        stateRevision.current++;
        setBusy(true);
        setMessage('');

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

            setData(result);
            setOnline(true);

            if (result.protocolo) {
                setProtocol(result.protocolo);

                if (result.protocolo.codigo) {
                    setProtocolCode(result.protocolo.codigo);
                    setTrackedCode(result.protocolo.codigo);
                }
            }

            if (confirmation) {
                notify(confirmation);

                Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                ).catch(() => {});
            }

            return result;
        } catch (error) {
            notify(
                error.name === 'AbortError'
                    ? 'O servidor demorou para responder. Consulte novamente antes de repetir a operação.'
                    : error.message
            );

            return null;
        } finally {
            clearTimeout(timeout);
            lock.current = false;
            protocolRevision.current++;
            stateRevision.current++;
            setBusy(false);
        }
    }

    async function joinQueue() {
        if (!selectedSpecialty) return;

        const result = await send(
            '/entrar-fila',
            { especialidade: selectedSpecialty },
            'Você entrou na fila de espera.'
        );

        if (result?.protocolo) {
            const item = result.protocolo;

            speak(
                `Você entrou na fila de ${item.especialidade}. Sua posição é ${item.posicao}. Existem ${item.pessoasNaFrente} pessoas à sua frente. Seu protocolo é ${item.codigo.split('').join(' ')}.`
            );

            setSelectedSpecialty('');
        }
    }

    async function consultProtocol() {
        setProtocol(null);
        setTrackedCode('');

        await send(
            '/protocolo',
            { codigo: code }
        );
    }

    async function leaveQueue() {
        const result = await send(
            '/retirar-fila',
            { codigo: protocol.codigo },
            'Você saiu da fila de espera.'
        );

        if (result) {
            setWithdraw(false);
        }
    }

    function renderHome() {
        return (
            <>
                <View
                    style={[
                        styles.hero,
                        { backgroundColor: colors.primary }
                    ]}
                >
                    <Txt
                        {...themeProps}
                        color={colors.buttonText}
                        size={30}
                        bold
                        heading
                    >
                        Como podemos ajudar você hoje?
                    </Txt>

                    <Txt
                        {...themeProps}
                        color={colors.buttonText}
                    >
                        Acompanhe seu atendimento e encontre os serviços da sua unidade de saúde.
                    </Txt>

                    <Button
                        {...themeProps}
                        title="Ouvir esta tela"
                        secondary
                        onPress={() =>
                            speak(
                                'Bem-vindo ao PostoVivo. Você pode marcar uma consulta com a Agendinha, encontrar unidades de saúde e acompanhar sua posição na fila.'
                            )
                        }
                    />
                </View>

                {data?.offer && (
                    <Card theme={colors} highlight>
                        <Txt {...themeProps} size={22} bold>
                            Nova vaga de cardiologia
                        </Txt>

                        <Txt {...themeProps}>
                            Consulte seu protocolo. A vaga está disponível para o primeiro cidadão da fila de cardiologia.
                        </Txt>

                        <Button
                            {...themeProps}
                            title="Consultar minha fila"
                            onPress={() => navigate('queue')}
                        />
                    </Card>
                )}

                <Card theme={colors} highlight>
                    <Txt {...themeProps} size={25} bold>
                        Conheça a Agendinha
                    </Txt>

                    <Txt {...themeProps}>
                        Sua assistente por voz ajuda você a encontrar especialistas e marcar consultas.
                    </Txt>

                    <Button
                        {...themeProps}
                        title="Conversar com a Agendinha"
                        onPress={() => navigate('agendinha')}
                    />
                </Card>

                <Txt {...themeProps} size={22} bold heading>
                    O que você precisa?
                </Txt>

                <Action
                    {...themeProps}
                    icon="+"
                    title="Encontrar uma unidade"
                    description="Endereço, funcionamento e movimento."
                    onPress={() => navigate('units')}
                />

                <Action
                    {...themeProps}
                    icon="≡"
                    title="Minha fila e consultas"
                    description="Acompanhe sua posição e seus agendamentos."
                    onPress={() => navigate('queue')}
                />

                <Action
                    {...themeProps}
                    icon="♡"
                    title="Consultar especialistas"
                    description="Confira a disponibilidade dos profissionais."
                    onPress={() => navigate('units')}
                />

                <Action
                    {...themeProps}
                    icon="?"
                    title="Preciso de ajuda"
                    description="Acessibilidade e orientações."
                    onPress={() => navigate('accessibility')}
                />
            </>
        );
    }

    function renderUnits() {
        const matches =
            unit &&
            `${unit.nome} ${unit.bairro} ${doctor?.especialidade}`
                .toLowerCase()
                .includes(search.toLowerCase().trim());

        return (
            <>
                <Txt {...themeProps} size={28} bold heading>
                    Unidades de saúde
                </Txt>

                <TextInput
                    accessibilityLabel="Buscar unidade de saúde"
                    placeholder="Unidade, bairro ou especialidade"
                    placeholderTextColor={colors.muted}
                    value={search}
                    onChangeText={setSearch}
                    style={[
                        styles.input,
                        {
                            color: colors.text,
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            fontSize: 16 * fontSize
                        }
                    ]}
                />

                {matches ? (
                    <Card theme={colors}>
                        <Txt {...themeProps} size={24} bold>
                            {unit.nome}
                        </Txt>

                        <Txt {...themeProps}>{unit.bairro}</Txt>
                        <Txt {...themeProps}>{unit.horario}</Txt>

                        <Txt {...themeProps} bold>
                            {loads[unit.lotacao]}
                        </Txt>

                        <Txt {...themeProps} muted size={13}>
                            Atualizado em {formatTime(unit.atualizado)}
                        </Txt>

                        <Button
                            {...themeProps}
                            title="Ver detalhes da unidade"
                            onPress={() => navigate('details')}
                        />
                    </Card>
                ) : (
                    <Card theme={colors}>
                        <Txt {...themeProps}>
                            {unit
                                ? 'Nenhuma unidade encontrada.'
                                : 'Aguardando informações da unidade.'}
                        </Txt>
                    </Card>
                )}
            </>
        );
    }

    function renderDetails() {
        if (!unit || !doctor) return null;

        return (
            <>
                <Button
                    {...themeProps}
                    title="Voltar para unidades"
                    secondary
                    onPress={() => navigate('units')}
                />

                <Txt {...themeProps} size={28} bold heading>
                    {unit.nome}
                </Txt>

                <Card theme={colors}>
                    <Txt {...themeProps} size={21} bold>
                        Endereço e horário
                    </Txt>

                    <Txt {...themeProps}>{unit.endereco}</Txt>
                    <Txt {...themeProps}>{unit.bairro}</Txt>
                    <Txt {...themeProps}>{unit.horario}</Txt>

                    <Button
                        {...themeProps}
                        title="Ouvir endereço"
                        secondary
                        onPress={() =>
                            speak(`${unit.nome}. ${unit.endereco}. ${unit.horario}.`)
                        }
                    />
                </Card>

                <Card theme={colors}>
                    <Txt {...themeProps} size={21} bold>
                        Especialista monitorado
                    </Txt>

                    <Txt {...themeProps} bold>
                        {doctor.especialidade}
                    </Txt>

                    <Txt {...themeProps}>{doctor.nome}</Txt>
                    <Txt {...themeProps}>{doctor.dias}</Txt>

                    <Txt {...themeProps} bold>
                        {doctor.presente
                            ? 'Presença informada pela recepção'
                            : 'Ausência informada pela recepção'}
                    </Txt>

                    <Txt {...themeProps} muted size={13}>
                        Atualizado em {formatTime(doctor.atualizado)}
                    </Txt>

                    <Txt {...themeProps} muted size={14}>
                        A presença do especialista não garante atendimento sem agendamento.
                    </Txt>

                    <Button
                        {...themeProps}
                        title="Marcar consulta"
                        onPress={() => navigate('agendinha')}
                    />
                </Card>

                <Card theme={colors}>
                    <Txt {...themeProps} size={21} bold>
                        Documentos necessários
                    </Txt>

                    <Txt {...themeProps}>{documents}</Txt>

                    <Button
                        {...themeProps}
                        title="Ouvir orientações"
                        secondary
                        onPress={() => speak(documents)}
                    />
                </Card>

                <Card theme={colors}>
                    <Txt {...themeProps} size={21} bold>
                        Estou na unidade
                    </Txt>

                    <Txt {...themeProps}>
                        Como está o movimento neste momento?
                    </Txt>

                    {Object.entries(loads).map(([value, label]) => (
                        <Button
                            {...themeProps}
                            key={value}
                            title={label}
                            secondary
                            disabled={busy || !online}
                            onPress={() =>
                                send(
                                    '/checkin',
                                    { lotacao: value },
                                    'Informação enviada à unidade.'
                                )
                            }
                        />
                    ))}
                </Card>
            </>
        );
    }

    function renderQueue() {
        return (
            <>
                <Txt {...themeProps} size={28} bold heading>
                    Minha fila
                </Txt>

                <Txt {...themeProps} muted>
                    Consulte sua posição na fila de espera por uma vaga ou os detalhes de uma consulta confirmada.
                </Txt>

                <Card theme={colors}>
                    <Txt {...themeProps} bold>
                        Código do protocolo
                    </Txt>

                    <TextInput
                        accessibilityLabel="Código do protocolo"
                        value={protocolCode}
                        editable={!busy}
                        onChangeText={value => {
                            protocolRevision.current++;
                            setProtocolCode(value);
                            setTrackedCode('');
                            setProtocol(null);
                            setMessage('');
                            setWithdraw(false);
                        }}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border,
                                fontSize: 17 * fontSize
                            }
                        ]}
                    />

                    <Button
                        {...themeProps}
                        title={busy ? 'Consultando...' : 'Consultar protocolo'}
                        disabled={busy || !online || !code}
                        onPress={consultProtocol}
                    />
                </Card>

                {protocol && (
                    <Card theme={colors}>
                        <Txt {...themeProps} muted size={13}>
                            MEU ATENDIMENTO
                        </Txt>

                        <Txt {...themeProps} size={23} bold>
                            {protocol.especialidade || 'Consulta'}
                        </Txt>

                        <Txt {...themeProps} bold>
                            {statuses[protocol.status] || protocol.status}
                        </Txt>

                        <Text
                            selectable
                            style={{
                                color: colors.text,
                                fontSize: 15 * fontSize
                            }}
                        >
                            Protocolo: {protocol.codigo || code}
                        </Text>

                        {protocol.status === 'aguardando' &&
                            Number.isInteger(position) && (
                                <View
                                    style={[
                                        styles.positionCard,
                                        { backgroundColor: colors.light }
                                    ]}
                                >
                                    <Txt {...themeProps} size={15}>
                                        SUA POSIÇÃO NA FILA
                                    </Txt>

                                    <Txt
                                        {...themeProps}
                                        size={54}
                                        bold
                                        color={colors.primary}
                                    >
                                        {position}º
                                    </Txt>

                                    <Txt {...themeProps} size={18} bold>
                                        {ahead === 0
                                            ? 'Você é o próximo da fila.'
                                            : ahead === 1
                                                ? 'Existe 1 pessoa à sua frente.'
                                                : `Existem ${ahead} pessoas à sua frente.`}
                                    </Txt>

                                    <Txt {...themeProps} muted size={13}>
                                        {online
                                            ? 'Atualização automática a cada 2 segundos'
                                            : 'Sem conexão. Última posição conhecida.'}
                                    </Txt>

                                    <Button
                                        {...themeProps}
                                        title="Ouvir minha posição"
                                        secondary
                                        onPress={() =>
                                            speak(
                                                `Você está na posição ${position} da fila de ${protocol.especialidade}. ${
                                                    ahead === 0
                                                        ? 'Você é o próximo da fila.'
                                                        : `Existem ${ahead} pessoas à sua frente.`
                                                }`
                                            )
                                        }
                                    />
                                </View>
                            )}

                        {protocol.status === 'aguardando' &&
                            !Number.isInteger(position) && (
                                <Txt {...themeProps} muted>
                                    Este protocolo não possui posição na fila de espera.
                                </Txt>
                            )}

                        {protocol.consulta && (
                            <>
                                <Txt {...themeProps} bold size={20}>
                                    Dados da consulta
                                </Txt>

                                <Txt {...themeProps}>
                                    {protocol.consulta.especialista}
                                </Txt>

                                <Txt {...themeProps}>
                                    {protocol.consulta.dia}, {formatDate(protocol.consulta.data)}
                                </Txt>

                                <Txt {...themeProps} size={24} bold>
                                    Às {protocol.consulta.horario}
                                </Txt>

                                <Txt {...themeProps}>
                                    {protocol.consulta.unidade}
                                </Txt>

                                <Txt {...themeProps}>
                                    {protocol.consulta.endereco}
                                </Txt>

                                <Button
                                    {...themeProps}
                                    title="Ouvir detalhes da consulta"
                                    secondary
                                    onPress={() =>
                                        speak(
                                            `Consulta de ${protocol.consulta.especialidade}, com ${protocol.consulta.especialista}, em ${formatDate(protocol.consulta.data)}, às ${protocol.consulta.horario}, na ${protocol.consulta.unidade}, endereço ${protocol.consulta.endereco}.`
                                        )
                                    }
                                />
                            </>
                        )}

                        {data?.offer &&
                            protocol.status === 'aguardando' &&
                            protocol.especialidade === 'Cardiologia' &&
                            position === 1 && (
                                <Card theme={colors} highlight>
                                    <Txt {...themeProps} size={21} bold>
                                        Uma vaga está disponível para você!
                                    </Txt>

                                    <Button
                                        {...themeProps}
                                        title="Aceitar encaixe"
                                        disabled={busy || !online}
                                        onPress={() =>
                                            send(
                                                '/encaixe',
                                                { codigo: protocol.codigo },
                                                'Encaixe confirmado.'
                                            )
                                        }
                                    />
                                </Card>
                            )}

                        {protocol.status === 'aguardando' &&
                            protocol.canal === 'app' && (
                                <>
                                    {!withdraw ? (
                                        <Button
                                            {...themeProps}
                                            title="Sair da fila"
                                            secondary
                                            disabled={busy || !online}
                                            onPress={() => setWithdraw(true)}
                                        />
                                    ) : (
                                        <>
                                            <Txt {...themeProps} bold>
                                                Tem certeza de que deseja sair da fila?
                                            </Txt>

                                            <Button
                                                {...themeProps}
                                                title="Confirmar saída da fila"
                                                disabled={busy || !online}
                                                onPress={leaveQueue}
                                            />

                                            <Button
                                                {...themeProps}
                                                title="Continuar na fila"
                                                secondary
                                                onPress={() => setWithdraw(false)}
                                            />
                                        </>
                                    )}
                                </>
                            )}
                    </Card>
                )}

                {!(protocol?.status === 'aguardando' &&
                    protocol?.canal === 'app') && (
                    <Card theme={colors}>
                        <Txt {...themeProps} size={22} bold>
                            Entrar na fila de espera
                        </Txt>

                        <Txt {...themeProps}>
                            Escolha a especialidade desejada.
                        </Txt>

                        {specialties.map(item => (
                            <Button
                                {...themeProps}
                                key={item}
                                title={item}
                                secondary
                                selected={selectedSpecialty === item}
                                disabled={busy}
                                onPress={() =>
                                    setSelectedSpecialty(item)
                                }
                            />
                        ))}

                        <Button
                            {...themeProps}
                            title="Confirmar entrada na fila"
                            disabled={!online || busy || !selectedSpecialty}
                            onPress={joinQueue}
                        />
                    </Card>
                )}

                <Button
                    {...themeProps}
                    title="Marcar consulta com a Agendinha"
                    secondary
                    onPress={() => navigate('agendinha')}
                />

                <Txt {...themeProps} muted size={13}>
                    Fila acadêmica demonstrativa, organizada por ordem de entrada em cada especialidade. Não representa classificação de risco ou prioridade clínica.
                </Txt>
            </>
        );
    }

    function renderAccessibility() {
        return (
            <>
                <Txt {...themeProps} size={28} bold heading>
                    Acessibilidade e ajuda
                </Txt>

                <Card theme={colors}>
                    <Txt {...themeProps} size={22} bold>
                        Tamanho dos textos
                    </Txt>

                    {[
                        ['Tamanho padrão', 1],
                        ['Texto ampliado', 1.25],
                        ['Texto muito grande', 1.5]
                    ].map(([label, value]) => (
                        <Button
                            {...themeProps}
                            key={label}
                            title={label}
                            secondary
                            selected={fontSize === value}
                            onPress={() => setFontSize(value)}
                        />
                    ))}
                </Card>

                <Card theme={colors}>
                    <Txt {...themeProps} size={22} bold>
                        Alto contraste
                    </Txt>

                    <Button
                        {...themeProps}
                        title={contrast
                            ? 'Desativar alto contraste'
                            : 'Ativar alto contraste'}
                        selected={contrast}
                        onPress={() => setContrast(!contrast)}
                    />
                </Card>

                <Card theme={colors}>
                    <Txt {...themeProps} size={22} bold>
                        Animações
                    </Txt>

                    <Button
                        {...themeProps}
                        title={reduceMotion
                            ? 'Permitir animações'
                            : 'Reduzir animações'}
                        secondary
                        onPress={() =>
                            setReduceMotion(!reduceMotion)
                        }
                    />

                    <Txt {...themeProps} muted size={13}>
                        O aplicativo também respeita as preferências do seu celular.
                    </Txt>
                </Card>

                <Card theme={colors}>
                    <Txt {...themeProps} size={22} bold>
                        Atendimento por voz
                    </Txt>

                    <Txt {...themeProps}>
                        A Agendinha orienta o agendamento e lê os detalhes da consulta em voz alta.
                    </Txt>

                    <Button
                        {...themeProps}
                        title="Abrir Agendinha"
                        onPress={() => navigate('agendinha')}
                    />
                </Card>

                <Card theme={colors}>
                    <Txt {...themeProps} size={22} bold>
                        Preciso de orientação
                    </Txt>

                    <Txt {...themeProps}>
                        Se tiver dificuldades, procure a recepção da unidade de saúde.
                    </Txt>

                    <Button
                        {...themeProps}
                        title="Ouvir orientação"
                        secondary
                        onPress={() =>
                            speak('Se tiver dificuldades, procure a recepção da sua unidade de saúde.')
                        }
                    />
                </Card>
            </>
        );
    }

    const tabs = [
        { id: 'home', title: 'Início', icon: '⌂' },
        { id: 'units', title: 'Unidades', icon: '+' },
        { id: 'agendinha', title: 'Agendinha', icon: '♡' },
        { id: 'queue', title: 'Minha fila', icon: '≡' },
        { id: 'accessibility', title: 'Ajuda', icon: '?' }
    ];

    return (
        <SafeAreaView
            style={{
                flex: 1,
                backgroundColor: colors.background
            }}
        >
            <StatusBar
                barStyle={contrast ? 'light-content' : 'dark-content'}
            />

            <View
                style={[
                    styles.header,
                    { borderBottomColor: colors.border }
                ]}
            >
                <View style={{ flex: 1 }}>
                    <Txt {...themeProps} size={25} bold>
                        PostoVivo
                    </Txt>

                    <Txt {...themeProps} muted size={13}>
                        Saúde pública conectada
                    </Txt>
                </View>

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Abrir acessibilidade"
                    onPress={() => navigate('accessibility')}
                    style={[
                        styles.accessButton,
                        { backgroundColor: colors.light }
                    ]}
                >
                    <Txt {...themeProps} size={20} bold>
                        A+
                    </Txt>
                </Pressable>
            </View>

            <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}
            >
                <View
                    style={[
                        styles.connection,
                        { backgroundColor: colors.light }
                    ]}
                >
                    <Txt {...themeProps} size={13} bold>
                        {online
                            ? '● Conectado à unidade'
                            : data
                                ? 'Sem conexão · Últimos dados recebidos'
                                : 'Conectando ao servidor...'}
                    </Txt>
                </View>

                <Animated.View
                    style={{
                        opacity: animation,
                        gap: 16
                    }}
                >
                    {screen === 'home' && renderHome()}

                    {screen === 'units' && renderUnits()}

                    {screen === 'details' && renderDetails()}

                    {screen === 'queue' && renderQueue()}

                    {screen === 'accessibility' && renderAccessibility()}

                    {screen === 'agendinha' && (
                        <Agendinha
                            colors={colors}
                            fontSize={fontSize}
                            onBack={() => navigate('home')}
                        />
                    )}

                    {!!message && (
                        <View
                            accessibilityLiveRegion="polite"
                            style={[
                                styles.notice,
                                { backgroundColor: colors.light }
                            ]}
                        >
                            <Txt {...themeProps} bold>
                                {message}
                            </Txt>
                        </View>
                    )}

                    <Txt {...themeProps} muted size={12}>
                        Projeto acadêmico. Dados demonstrativos.
                    </Txt>
                </Animated.View>
            </ScrollView>

            <View
                style={[
                    styles.navigation,
                    {
                        backgroundColor: colors.surface,
                        borderTopColor: colors.border
                    }
                ]}
            >
                {tabs.map(tab => {
                    const selected =
                        screen === tab.id ||
                        (screen === 'details' && tab.id === 'units');

                    return (
                        <Pressable
                            key={tab.id}
                            accessibilityRole="tab"
                            accessibilityLabel={tab.title}
                            accessibilityState={{ selected }}
                            onPress={() => navigate(tab.id)}
                            style={[
                                styles.tab,
                                selected && {
                                    backgroundColor: colors.light
                                }
                            ]}
                        >
                            <Txt
                                theme={colors}
                                color={colors.primary}
                                size={23}
                                bold
                            >
                                {tab.icon}
                            </Txt>

                            <Text
                                style={{
                                    color: colors.text,
                                    fontSize: 11 * fontSize,
                                    fontWeight: selected ? '700' : '400',
                                    textAlign: 'center'
                                }}
                            >
                                {tab.title}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 22,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1
    },
    content: {
        padding: 20,
        paddingBottom: 32,
        gap: 16
    },
    hero: {
        borderRadius: 24,
        padding: 24,
        gap: 14
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        gap: 12
    },
    positionCard: {
        borderRadius: 18,
        padding: 20,
        gap: 12
    },
    button: {
        minHeight: 52,
        minWidth: 48,
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        justifyContent: 'center',
        alignItems: 'center'
    },
    action: {
        minHeight: 92,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 15,
        minHeight: 54
    },
    notice: {
        padding: 16,
        borderRadius: 12
    },
    connection: {
        padding: 12,
        borderRadius: 10
    },
    accessButton: {
        minWidth: 48,
        minHeight: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center'
    },
    navigation: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderTopWidth: 1,
        padding: 8,
        gap: 4
    },
    tab: {
        flex: 1,
        minWidth: 58,
        minHeight: 60,
        padding: 6,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    }
});