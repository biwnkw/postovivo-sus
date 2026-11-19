# PostoVivo SUS

Global Solution 2026 | CitizenTech | FIAP

## Integrante

Bianka Sousa Belmiro | RM 565906

## Sobre o projeto

O PostoVivo SUS é uma solução de tecnologia cidadã desenvolvida para facilitar o acesso às informações e aos serviços das unidades básicas de saúde.

A solução integra um aplicativo mobile destinado aos cidadãos e uma plataforma web administrativa destinada aos profissionais das unidades de saúde.

## Problema

A dificuldade de acesso às informações sobre especialistas, filas de espera e agendamentos prejudica a experiência dos usuários do SUS, especialmente idosos, pessoas com deficiência e cidadãos com pouca familiaridade com tecnologias digitais.

A falta de informações atualizadas também pode provocar deslocamentos desnecessários, perda de consultas e dificuldades no acompanhamento dos atendimentos.

## Solução

O PostoVivo SUS centraliza informações sobre as unidades de saúde, permitindo que o cidadão acompanhe sua posição na fila, consulte especialistas, realize agendamentos e receba orientações de maneira acessível.

A plataforma administrativa permite que os profissionais atualizem essas informações e acompanhem as solicitações realizadas pelos cidadãos.

## Público-alvo

- Usuários do Sistema Único de Saúde.
- Pessoas idosas.
- Pessoas com deficiência.
- Cidadãos com baixa familiaridade tecnológica.
- Profissionais das unidades básicas de saúde.

## Agendinha

A Agendinha é uma assistente virtual de agendamento desenvolvida para facilitar o acesso aos serviços de saúde.

Por meio de texto ou ditado do teclado, o cidadão pode solicitar uma consulta utilizando linguagem natural.

A assistente consulta os horários disponíveis no backend e apresenta as informações em texto e áudio, incluindo:

- Especialidade.
- Nome do profissional.
- Data da consulta.
- Horário disponível.
- Endereço da unidade.
- Documentos necessários.
- Protocolo de confirmação.

A reserva é realizada somente após a confirmação do cidadão. O backend impede que o mesmo horário seja reservado simultaneamente por dois usuários.

## Funcionalidades mobile

- Consulta de unidades de saúde.
- Consulta de disponibilidade de especialistas.
- Agendamento de consultas pela Agendinha.
- Interação por texto e ditado.
- Respostas por voz em português.
- Consulta de protocolos.
- Entrada e saída da fila de espera.
- Acompanhamento automático da posição na fila.
- Confirmação de encaixes.
- Registro colaborativo do movimento da unidade.
- Alto contraste.
- Ampliação de textos.
- Compatibilidade com recursos de acessibilidade.

## Funcionalidades web

- Painel administrativo responsivo.
- Indicadores de atendimento.
- Gerenciamento da disponibilidade de especialistas.
- Atualização do movimento da unidade.
- Gerenciamento da fila de espera.
- Consulta de posições por especialidade.
- Visualização dos agendamentos da Agendinha.
- Busca por protocolo.
- Filtros por especialidade.
- Simulação de atendimento telefônico.
- Indicadores de participação cidadã.
- Recursos de acessibilidade.

## Integração entre mobile e web

As duas plataformas utilizam uma API REST compartilhada, desenvolvida em Node.js e hospedada no Render.

A comunicação permite a atualização automática das informações entre o aplicativo e a plataforma administrativa.

Quando um cidadão realiza um agendamento pela Agendinha, a consulta aparece automaticamente no painel web.

Quando um protocolo é retirado da fila, o backend recalcula as posições dos demais cidadãos e disponibiliza as informações atualizadas no aplicativo.

A simulação de atendimento telefônico permite disponibilizar uma vaga cancelada ao primeiro cidadão da fila de cardiologia.

## Tecnologias utilizadas

### Mobile

- React Native
- Expo SDK 58
- JavaScript
- Expo Speech
- Expo Haptics

### Web

- HTML5
- CSS3
- JavaScript
- Web Speech API

### Backend

- Node.js
- API REST
- JSON

### Hospedagem e versionamento

- Render
- GitHub

## Design e experiência do usuário

A identidade visual utiliza tons de verde e branco, associados à saúde, ao cuidado e à confiança.

A interface foi desenvolvida com foco na simplicidade, na organização das informações e na redução da complexidade das interações.

O aplicativo prioriza a autonomia do cidadão, enquanto a plataforma web atende às necessidades operacionais dos profissionais da unidade de saúde.

## Acessibilidade

O PostoVivo SUS considera diferentes necessidades de acesso por meio dos seguintes recursos:

- Alto contraste.
- Ampliação de fontes.
- Áreas de toque confortáveis.
- Linguagem simples e objetiva.
- Rótulos para leitores de tela.
- Navegação por teclado na web.
- Indicadores de foco visíveis.
- Informações independentes de cores.
- Orientações por áudio.
- Interação por ditado.
- Respeito às preferências de movimento reduzido.

## Motion design

O motion design foi aplicado para orientar a navegação, fornecer retorno visual sobre as interações e destacar novos agendamentos no painel administrativo.

As animações possuem função informativa e respeitam as preferências de redução de movimento dos usuários.

## Objetivos de Desenvolvimento Sustentável

### ODS 3 - Saúde e Bem-Estar

O projeto busca facilitar o acesso às informações e aos serviços de saúde pública, contribuindo para uma experiência de atendimento mais organizada e acessível.

### ODS 10 - Redução das Desigualdades

A solução busca reduzir barreiras digitais enfrentadas por idosos, pessoas com deficiência e cidadãos com pouca familiaridade tecnológica.

## Estrutura do projeto

    PostoVivo-SUS/
    ├── backend/
    │   └── server.mjs
    ├── mobile/
    │   ├── App.js
    │   ├── Agendinha.js
    │   ├── app.json
    │   ├── index.js
    │   ├── package.json
    │   └── .env.example
    ├── web/
    │   ├── index.html
    │   ├── style.css
    │   └── app.js
    └── README.md

## Como executar o aplicativo

Clone o repositório:

    git clone https://github.com/biwnkw/postovivo-sus.git

Acesse a pasta mobile:

    cd postovivo-sus/mobile

Instale as dependências:

    npm ci

Crie o arquivo de configuração:

    cp .env.example .env

Configure as variáveis de ambiente:

    EXPO_PUBLIC_API_URL=https://postovivo-sus.onrender.com
    EXPO_PUBLIC_DEMO_ROOM=demo

Inicie o aplicativo:

    npx expo start --go

Escaneie o QR Code utilizando uma versão compatível do Expo Go.

## Como executar o backend localmente

Na pasta principal do projeto, execute:

    node backend/server.mjs

A plataforma estará disponível em:

    http://localhost:8080

Para conectar o aplicativo ao backend local, configure o endereço IP do computador no arquivo .env e utilize a mesma rede Wi-Fi.

## Protocolos para demonstração

- SUS-4089
- SUS-4090
- SUS-4092
- SUS-4093

Os protocolos permitem demonstrar o funcionamento da fila dinâmica de cardiologia.

## Links do projeto

- GitHub: https://github.com/biwnkw/postovivo-sus
- Plataforma web: https://postovivo-sus.onrender.com
- Vídeo-pitch: em breve.

## Observações

O PostoVivo SUS foi desenvolvido para fins acadêmicos, utilizando dados fictícios.

O projeto não possui vínculo oficial com o Ministério da Saúde ou com o Sistema Único de Saúde.

A fila demonstrativa é organizada por especialidade e ordem de entrada, não representando classificação de risco clínico.

Na implementação atual, os dados são armazenados em memória e podem ser reiniciados quando o servidor é reiniciado.