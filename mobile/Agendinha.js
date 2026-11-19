import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  AccessibilityInfo,
  Keyboard
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

const API = process.env.EXPO_PUBLIC_API_URL;
const ROOM = process.env.EXPO_PUBLIC_DEMO_ROOM || 'demo';

const normalize = text =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const formatDate = date =>
  date.split('-').reverse().join('/');

const formatHour = hour => {
  const [hours, minutes] = hour.split(':');

  return minutes === '00'
    ? `${Number(hours)} horas`
    : `${Number(hours)} horas e ${Number(minutes)} minutos`;
};

function describe(slot) {
  return `Consulta de ${slot.especialidade}, com ${slot.especialista}, ${slot.dia}, dia ${formatDate(slot.data)}, às ${formatHour(slot.horario)}, na ${slot.unidade}, endereço ${slot.endereco}.`;
}

export default function Agendinha({
  onBack,
  colors,
  fontSize = 1
}) {
  const theme = colors || {
    text: '#17352F',
    muted: '#50645F',
    primary: '#075C46',
    surface: '#FFFFFF',
    light: '#E5F1EA',
    border: '#D5E2DB',
    buttonText: '#FFFFFF'
  };

  const [messages, setMessages] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [input, setInput] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [step, setStep] = useState('specialty');

  const inputRef = useRef(null);
  const activeRef = useRef(true);
  const speechId = useRef(0);
  const requestLock = useRef(false);

  function speak(text, force = false) {
    if (!voice && !force) return;

    const id = ++speechId.current;

    Speech.stop();
    setSpeaking(true);

    const finish = () => {
      if (activeRef.current && speechId.current === id) {
        setSpeaking(false);
      }
    };

    Speech.speak(text, {
      language: 'pt-BR',
      rate: 0.85,
      pitch: 1.05,
      onDone: finish,
      onStopped: finish,
      onError: finish
    });
  }

  function stopSpeaking() {
    speechId.current++;
    Speech.stop();
    setSpeaking(false);
  }

  function addMessage(role, text) {
    setMessages(previous => [
      ...previous,
      {
        id: `${Date.now()}-${previous.length}`,
        role,
        text
      }
    ]);
  }

  function reply(text) {
    addMessage('assistant', text);
    speak(text);
  }

  async function fetchAgenda() {
    const response = await fetch(`${API}/agenda`, {
      headers: {
        'X-Demo-Room': ROOM
      }
    });

    if (!response.ok) {
      throw new Error(
        'Não consegui consultar os horários disponíveis.'
      );
    }

    const result = await response.json();

    if (!Array.isArray(result)) {
      throw new Error('Horários indisponíveis.');
    }

    if (activeRef.current) {
      setAgenda(result);
    }

    return result;
  }

  async function initialize() {
    setLoading(true);

    try {
      const result = await fetchAgenda();

      if (!activeRef.current) return;

      if (result.length === 0) {
        reply(
          'Olá! Eu sou a Agendinha. Infelizmente, não temos horários disponíveis neste momento. Você pode consultar novamente mais tarde.'
        );
        return;
      }

      reply(
        'Olá! Eu sou a Agendinha, sua assistente de saúde. Vou ajudar você a marcar uma consulta. Você pode escrever sua mensagem ou utilizar o microfone do teclado do celular. Qual especialista você precisa?'
      );
    } catch {
      if (activeRef.current) {
        reply(
          'Não consegui acessar a agenda. Verifique sua conexão e tente novamente.'
        );
      }
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    activeRef.current = true;
    initialize();

    return () => {
      activeRef.current = false;
      speechId.current++;
      Speech.stop();
    };
  }, []);

  function findSpecialty(text) {
    if (/(cardio|coracao)/.test(text)) {
      return 'Cardiologia';
    }

    if (/(oftalmo|olhos|vista|visao|oculista)/.test(text)) {
      return 'Oftalmologia';
    }

    if (/(clinico|clinica|medico geral|consulta geral)/.test(text)) {
      return 'Clínica Geral';
    }

    return null;
  }

  function describeOptions(slots) {
    return slots
      .map(
        (slot, index) =>
          `Opção ${index + 1}: ${slot.dia}, dia ${formatDate(
            slot.data
          )}, às ${formatHour(slot.horario)}, com ${slot.especialista}.`
      )
      .join('\n\n');
  }

  function showOptions(slots, chosenSpecialty) {
    setSpecialty(chosenSpecialty);
    setOptions(slots);
    setSelected(null);
    setStep('schedule');

    if (slots.length === 0) {
      reply(
        'Não encontrei horários que correspondam ao seu pedido. Você pode escolher outro dia, período ou especialista.'
      );
      return;
    }

    reply(
      `Encontrei ${slots.length} ${
        slots.length === 1
          ? 'horário disponível'
          : 'horários disponíveis'
      } para ${chosenSpecialty}.\n\n${describeOptions(
        slots
      )}\n\nQual opção você prefere?`
    );
  }

  function chooseSchedule(slot) {
    setSelected(slot);
    setStep('confirm');

    reply(
      `${describe(slot)}\n\nDeseja confirmar esse agendamento?`
    );
  }

  async function confirmBooking() {
    if (!selected || requestLock.current) return;

    requestLock.current = true;
    setBusy(true);

    try {
      const response = await fetch(`${API}/agendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Demo-Room': ROOM
        },
        body: JSON.stringify({
          horarioId: selected.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.erro || 'Não foi possível confirmar a consulta.'
        );
      }

      if (!activeRef.current) return;

      setBooking(result.agendamento);
      setAgenda(result.agenda || []);
      setOptions([]);
      setSelected(null);
      setStep('success');

      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      reply(
        `Pronto! Sua consulta foi confirmada com sucesso.\n\n${describe(
          result.agendamento
        )}\n\nSeu protocolo é ${result.agendamento.protocolo}.\n\nLeve um documento com foto, seu Cartão SUS e o encaminhamento, caso solicitado.`
      );

      AccessibilityInfo.announceForAccessibility(
        'Consulta confirmada.'
      );
    } catch (error) {
      if (activeRef.current) {
        reply(
          `${error.message} Consulte os horários novamente antes de realizar outra tentativa.`
        );

        setSelected(null);
        setOptions([]);
        setStep('specialty');
      }
    } finally {
      requestLock.current = false;

      if (activeRef.current) {
        setBusy(false);
      }
    }
  }

  async function handleMessage(value) {
    const original = value.trim();

    if (!original || busy || loading || requestLock.current) {
      return;
    }

    setInput('');
    Keyboard.dismiss();
    stopSpeaking();

    addMessage('user', original);

    const text = normalize(original);

    if (/(repete|repetir|nao entendi)/.test(text)) {
      const lastMessage = [...messages]
        .reverse()
        .find(message => message.role === 'assistant');

      if (lastMessage) {
        reply(lastMessage.text);
      }

      return;
    }

    if (/(documento|cartao sus|encaminhamento)/.test(text)) {
      reply(
        'No dia da consulta, leve um documento com foto, seu Cartão SUS e o encaminhamento, caso tenha sido solicitado pela unidade.'
      );

      return;
    }

    if (/(endereco|onde fica|localizacao)/.test(text)) {
      const appointment =
        selected || booking || options[0] || agenda[0];

      if (appointment) {
        reply(
          `O atendimento será na ${appointment.unidade}, localizada em ${appointment.endereco}.`
        );
      } else {
        reply(
          'Escolha uma especialidade para consultarmos o local de atendimento.'
        );
      }

      return;
    }

    if (/(protocolo|meu agendamento|minha consulta)/.test(text) && booking) {
      reply(
        `Seu protocolo é ${booking.protocolo}. ${describe(booking)}`
      );

      return;
    }

    if (
      /^(nao|nao quero|nao confirmar|outro horario|voltar)$/.test(text)
    ) {
      setSelected(null);

      if (specialty && options.length > 0) {
        showOptions(options, specialty);
      } else {
        setStep('specialty');
        reply('Tudo bem. Qual especialista você precisa?');
      }

      return;
    }

    if (
      /^(sim|confirmar|confirmo|pode confirmar|pode marcar|quero confirmar|pode agendar)$/.test(text)
    ) {
      if (step === 'confirm' && selected) {
        await confirmBooking();
      } else {
        reply(
          'Para confirmar uma consulta, primeiro precisamos escolher um especialista e um horário.'
        );
      }

      return;
    }

    if (/(cancelar consulta|desmarcar consulta)/.test(text)) {
      reply(
        'Para cancelar uma consulta já confirmada, procure a recepção da unidade de saúde.'
      );

      return;
    }

    if (step === 'schedule') {
      const numbers = {
        '1': 0,
        'primeira': 0,
        'primeiro': 0,
        'opcao 1': 0,
        '2': 1,
        'segunda opcao': 1,
        'segundo horario': 1,
        'opcao 2': 1,
        '3': 2,
        'terceira': 2,
        'opcao 3': 2
      };

      const index = numbers[text];

      if (index !== undefined && options[index]) {
        chooseSchedule(options[index]);
        return;
      }
    }

    const chosenSpecialty =
      findSpecialty(text) || specialty;

    if (chosenSpecialty) {
      try {
        setBusy(true);

        const currentAgenda = await fetchAgenda();

        if (!activeRef.current) return;

        let slots = currentAgenda.filter(
          slot => slot.especialidade === chosenSpecialty
        );

        const weekdays = [
          'segunda',
          'terca',
          'quarta',
          'quinta',
          'sexta',
          'sabado',
          'domingo'
        ];

        const weekday = weekdays.find(
          day => text.includes(day)
        );

        if (weekday) {
          slots = slots.filter(slot =>
            normalize(slot.dia).includes(weekday)
          );
        }

        if (/(de manha|pela manha|matutino)/.test(text)) {
          slots = slots.filter(
            slot => Number(slot.horario.split(':')[0]) < 12
          );
        }

        if (/(de tarde|a tarde|pela tarde|vespertino)/.test(text)) {
          slots = slots.filter(
            slot => Number(slot.horario.split(':')[0]) >= 12
          );
        }

        const time = text.match(
          /\b(\d{1,2})(?:h|:)(\d{2})?\b/
        );

        if (time) {
          const hour = time[1].padStart(2, '0');

          slots = slots.filter(slot =>
            time[2]
              ? slot.horario === `${hour}:${time[2]}`
              : slot.horario.startsWith(`${hour}:`)
          );
        }

        showOptions(slots, chosenSpecialty);
      } catch {
        reply(
          'Não consegui atualizar os horários. Verifique sua conexão e tente novamente.'
        );
      } finally {
        if (activeRef.current) setBusy(false);
      }

      return;
    }

    if (/(ola|oi|bom dia|boa tarde|boa noite)/.test(text)) {
      reply(
        'Olá! Estou aqui para ajudar você. Precisa de cardiologia, clínica geral ou oftalmologia?'
      );

      return;
    }

    reply(
      'Não consegui entender sua solicitação. Você pode me dizer qual especialista precisa ou escolher uma das opções abaixo.'
    );
  }

  const specialties = [
    ...new Set(agenda.map(slot => slot.especialidade))
  ];

  function renderButton(
    title,
    action,
    secondary = false,
    disabled = false
  ) {
    return (
      <Pressable
        key={title}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={action}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: secondary
              ? theme.surface
              : theme.primary,
            borderColor: theme.primary,
            opacity: disabled ? 0.5 : pressed ? 0.75 : 1
          }
        ]}
      >
        <Text
          style={{
            fontSize: 16 * fontSize,
            fontWeight: '600',
            color: secondary
              ? theme.primary
              : theme.buttonText,
            textAlign: 'center'
          }}
        >
          {title}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {renderButton(
        '‹ Voltar',
        () => {
          stopSpeaking();
          onBack();
        },
        true,
        busy
      )}

      <View
        style={[
          styles.hero,
          { backgroundColor: theme.primary }
        ]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>

        <Text
          accessibilityRole="header"
          style={{
            color: theme.buttonText,
            fontSize: 28 * fontSize,
            fontWeight: '700'
          }}
        >
          Agendinha
        </Text>

        <Text
          style={{
            color: theme.buttonText,
            fontSize: 16 * fontSize,
            textAlign: 'center'
          }}
        >
          Sua assistente de saúde
        </Text>

        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: theme.buttonText,
            fontSize: 14 * fontSize
          }}
        >
          {speaking
            ? '● Agendinha está falando'
            : busy
              ? 'Consultando informações...'
              : 'Pronta para ajudar'}
        </Text>
      </View>

      <View style={styles.voiceControls}>

        {renderButton(
          voice ? 'Desativar voz' : 'Ativar voz',
          () => {
            setVoice(!voice);

            if (voice) {
              stopSpeaking();
            } else {
              speak('Assistente por voz ativada.', true);
            }
          },
          true
        )}

        {speaking &&
          renderButton(
            'Parar áudio',
            stopSpeaking,
            true
          )}

      </View>

      {loading && (
        <ActivityIndicator
          size="large"
          color={theme.primary}
        />
      )}

      <View style={styles.chat}>

        {messages.map(message => {
          const assistant = message.role === 'assistant';

          return (
            <View
              key={message.id}
              style={[
                styles.bubble,
                {
                  alignSelf: assistant
                    ? 'flex-start'
                    : 'flex-end',
                  backgroundColor: assistant
                    ? theme.surface
                    : theme.primary,
                  borderColor: assistant
                    ? theme.border
                    : theme.primary
                }
              ]}
            >
              <Text
                style={{
                  color: assistant
                    ? theme.primary
                    : theme.buttonText,
                  fontSize: 13 * fontSize,
                  fontWeight: '700',
                  marginBottom: 6
                }}
              >
                {assistant ? 'Agendinha' : 'Você'}
              </Text>

              <Text
                style={{
                  color: assistant
                    ? theme.text
                    : theme.buttonText,
                  fontSize: 16 * fontSize,
                  lineHeight: 24 * fontSize
                }}
              >
                {message.text}
              </Text>

              {assistant && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ouvir esta mensagem"
                  onPress={() => speak(message.text, true)}
                  style={styles.listen}
                >
                  <Text
                    style={{
                      color: theme.primary,
                      fontSize: 14 * fontSize,
                      fontWeight: '600'
                    }}
                  >
                    Ouvir mensagem
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

      </View>

      {!loading && step === 'specialty' && (
        <View style={styles.options}>
          {specialties.map(item =>
            renderButton(
              item,
              () => handleMessage(item),
              true,
              busy
            )
          )}

          {renderButton(
            'Atualizar horários',
            initialize,
            true,
            busy
          )}
        </View>
      )}

      {!loading && step === 'schedule' && (
        <View style={styles.options}>
          {options.map((slot, index) =>
            renderButton(
              `${index + 1}. ${slot.dia} · ${slot.horario}`,
              () => {
                addMessage(
                  'user',
                  `Quero ${slot.dia}, às ${slot.horario}.`
                );

                chooseSchedule(slot);
              },
              true,
              busy
            )
          )}

          {renderButton(
            'Escolher outra especialidade',
            () => {
              setSpecialty('');
              setOptions([]);
              setSelected(null);
              setStep('specialty');

              reply(
                'Claro! Qual especialista você precisa?'
              );
            },
            true,
            busy
          )}
        </View>
      )}

      {step === 'confirm' && (
        <View style={styles.options}>
          {renderButton(
            busy ? 'Confirmando...' : 'Sim, confirmar consulta',
            () => handleMessage('Pode confirmar'),
            false,
            busy
          )}

          {renderButton(
            'Escolher outro horário',
            () => handleMessage('Outro horário'),
            true,
            busy
          )}
        </View>
      )}

      {step === 'success' && (
        <View
          style={[
            styles.success,
            { backgroundColor: theme.light }
          ]}
        >
          <Text
            style={{
              fontSize: 22 * fontSize,
              fontWeight: '700',
              color: theme.text
            }}
          >
            ✓ Consulta confirmada
          </Text>

          <Text
            selectable
            style={{
              fontSize: 17 * fontSize,
              color: theme.text
            }}
          >
            Protocolo: {booking?.protocolo}
          </Text>

          {renderButton(
            'Ouvir minha consulta',
            () =>
              speak(
                `${describe(booking)} Seu protocolo é ${booking.protocolo
                  .split('')
                  .join(' ')}.`,
                true
              ),
            true
          )}

          {renderButton(
            'Marcar outra consulta',
            () => {
              setSpecialty('');
              setSelected(null);
              setOptions([]);
              setStep('specialty');

              reply(
                'Vamos marcar outra consulta. Qual especialista você precisa?'
              );
            }
          )}
        </View>
      )}

      <View
        style={[
          styles.composer,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border
          }
        ]}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 17 * fontSize,
            fontWeight: '700'
          }}
        >
          Converse com a Agendinha
        </Text>

        <Text
          style={{
            color: theme.muted,
            fontSize: 14 * fontSize
          }}
        >
          Digite ou use o microfone do teclado para falar.
        </Text>

        <TextInput
          ref={inputRef}
          accessibilityLabel="Escreva ou dite sua mensagem"
          placeholder="Ex.: Quero um cardiologista"
          placeholderTextColor={theme.muted}
          value={input}
          onChangeText={setInput}
          editable={!busy && !loading}
          multiline
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: theme.border,
              fontSize: 17 * fontSize
            }
          ]}
        />

        {renderButton(
          'Falar pelo teclado',
          () => inputRef.current?.focus(),
          true,
          busy || loading
        )}

        {renderButton(
          'Enviar mensagem',
          () => handleMessage(input),
          false,
          !input.trim() || busy || loading
        )}
      </View>

      <Text
        style={{
          color: theme.muted,
          fontSize: 12 * fontSize,
          textAlign: 'center'
        }}
      >
        Projeto acadêmico. Agendamentos demonstrativos.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16
  },
  hero: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 10
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#075C46',
    fontSize: 36,
    fontWeight: '700'
  },
  voiceControls: {
    gap: 8
  },
  chat: {
    gap: 14
  },
  bubble: {
    maxWidth: '94%',
    borderWidth: 1,
    padding: 18,
    borderRadius: 20
  },
  listen: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 5
  },
  button: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  options: {
    gap: 10
  },
  composer: {
    padding: 18,
    borderWidth: 1,
    borderRadius: 20,
    gap: 12
  },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    textAlignVertical: 'top'
  },
  success: {
    padding: 20,
    borderRadius: 18,
    gap: 12
  }
});