# PostoVivo SUS

Global Solution CitizenTech | FIAP

## Integrante

- Bianka Sousa Belmiro - RM 565906

## Sobre o projeto

O PostoVivo SUS é uma solução de tecnologia cidadã desenvolvida para facilitar o acesso às informações e aos serviços das unidades básicas de saúde.

O projeto integra um aplicativo mobile destinado aos cidadãos e uma plataforma web administrativa destinada aos profissionais das unidades de saúde.

## Problema

A dificuldade de acesso às informações sobre disponibilidade de especialistas, filas de espera e agendamentos prejudica a experiência dos usuários do SUS, especialmente idosos e pessoas com pouca familiaridade com tecnologias digitais.

## Solução

O PostoVivo permite consultar informações da unidade, acompanhar posições na fila de espera, realizar agendamentos e verificar a disponibilidade dos profissionais de saúde.

A Agendinha, assistente virtual por voz, orienta os cidadãos durante o processo de agendamento, oferecendo uma experiência mais acessível e intuitiva.

## Funcionalidades mobile

- Consulta de unidades de saúde.
- Disponibilidade de especialistas.
- Agendamento de consultas pela Agendinha.
- Interação por texto e ditado do dispositivo.
- Respostas em voz alta.
- Consulta de protocolos.
- Acompanhamento da posição na fila.
- Confirmação de encaixes.
- Envio de informações sobre o movimento da unidade.
- Alto contraste e ampliação de textos.

## Funcionalidades web

- Painel administrativo responsivo.
- Gerenciamento da disponibilidade de especialistas.
- Atualização do movimento da unidade.
- Gerenciamento da fila de espera.
- Visualização dos agendamentos da Agendinha.
- Simulação de atendimento telefônico.
- Indicadores de participação cidadã.
- Recursos de acessibilidade.

## Integração entre mobile e web

As duas plataformas utilizam uma API compartilhada, desenvolvida em Node.js.

As informações são sincronizadas automaticamente. Quando um cidadão realiza um agendamento pelo aplicativo, a consulta aparece no painel administrativo.

Quando um protocolo é retirado da fila, as posições dos demais cidadãos são recalculadas pelo backend e atualizadas no aplicativo.

A simulação de atendimento telefônico também permite disponibilizar uma vaga ao primeiro cidadão da fila de cardiologia.

## Agendinha

A Agendinha é uma assistente virtual de agendamento que utiliza interpretação de comandos em linguagem natural e síntese de voz em português.

A assistente consulta os horários disponíveis no backend, informa o especialista, a data, o horário e o endereço da unidade, solicitando a confirmação do cidadão antes de registrar a consulta.

O sistema impede que um mesmo horário seja reservado simultaneamente por dois usuários.

## Tecnologias utilizadas

- React Native
- Expo SDK 58
- JavaScript
- HTML5
- CSS3
- Node.js
- Expo Speech
- Expo Haptics
- Web Speech API
- REST API

## Acessibilidade

O projeto considera diferentes necessidades de acesso por meio de:

- Alto contraste.
- Ampliação de fontes.
- Botões com áreas de interação confortáveis.
- Linguagem simples e objetiva.
- Rótulos para leitores de tela.
- Navegação por teclado na plataforma web.
- Indicadores de foco visíveis.
- Respostas e orientações por áudio.
- Respeito às preferências de movimento reduzido.

## Motion design

As animações foram aplicadas para orientar a navegação, fornecer retorno visual das interações e destacar novos agendamentos.

As plataformas respeitam as preferências de redução de movimento do usuário.

## Objetivos de Desenvolvimento Sustentável

### ODS 3 - Saúde e Bem-Estar

O projeto contribui para facilitar o acesso às informações e aos serviços de saúde pública.

### ODS 10 - Redução das Desigualdades

A solução busca reduzir barreiras digitais enfrentadas por idosos, pessoas com deficiência e cidadãos com baixa familiaridade tecnológica.

## Estrutura do projeto

    PostoVivo-SUS/
    ├── backend/
    │   └── server.mjs
    ├── mobile/
    │   ├── App.js
    │   ├── Agendinha.js
    │   ├── app.json
    │   └── package.json
    ├── web/
    │   ├── index.html
    │   ├── style.css
    │   └── app.js
    └── README.md

## Como executar o projeto

### Backend

Na pasta principal do projeto, execute:

    node backend/server.mjs

### Plataforma web

Acesse:

    http://localhost:8080

### Aplicativo mobile

Entre na pasta mobile:

    cd mobile

Instale as dependências:

    npm ci

Configure o arquivo .env com o endereço da API:

    EXPO_PUBLIC_API_URL=http://IP_DO_COMPUTADOR:8080
    EXPO_PUBLIC_DEMO_ROOM=demo

Inicie o Expo:

    npx expo start --go

Escaneie o QR Code utilizando o Expo Go.

Para testes locais, o computador e o celular devem estar conectados à mesma rede.

## Links

- Repositório GitHub: em breve.
- Deploy da plataforma web: em breve.
- Vídeo-pitch: em breve.

## Observações

Projeto desenvolvido para fins acadêmicos, com dados fictícios.

A solução não possui vínculo oficial com o Ministério da Saúde ou com o Sistema Único de Saúde.

A fila demonstrativa é organizada por especialidade e ordem de entrada, não representando classificação de risco clínico.

Na versão local, os dados são armazenados em memória durante a execução do servidor.