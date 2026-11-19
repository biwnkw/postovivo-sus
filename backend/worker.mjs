import assets from './assets.mjs';

const initial = () => {
  const updated = new Date().toISOString();
  return {
    unit: {id:'DEMO-01',nome:'UBS Jardim Aurora',bairro:'Jardim Aurora',endereco:'Rua das Acácias, 120',horario:'Seg a sex, 7h às 19h',lotacao:'tranquila',atualizado:updated},
    doctor: {nome:'Dra. Helena Duarte',especialidade:'Cardiologia',crm:'DEMO 1001',rqe:'DEMO 201',dias:'Segundas e quintas',presente:false,atualizado:updated},
    protocols: {'SUS-4092':{status:'aguardando',posicao:1,canal:'app'}},
    reports: [],
    offer: false,
  };
};
const recent = state => state.reports.filter(time => Date.now()-time < 1800000);
const publicState = ({unit,doctor,offer,reports}) => ({unit,doctor,offer,relatos:recent({reports}).length});
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const failure = (message,status=409) => json({erro:message},status);

function update(state,path,body) {
  const {codigo,presente,lotacao,telefone,tecla} = body;
  const protocol = /^SUS-[A-Z0-9]{4,16}$/.test(codigo) ? state.protocols[codigo] : undefined;
  const updated = new Date().toISOString();
  switch (path) {
    case '/presenca':
      if (typeof presente !== 'boolean') return failure('Presença inválida.');
      Object.assign(state.doctor,{presente,atualizado:updated});
      break;
    case '/lotacao':
    case '/checkin':
      if (!['tranquila','moderada','lotada'].includes(lotacao)) return failure('Lotação inválida.');
      Object.assign(state.unit,{lotacao,atualizado:updated});
      if (path === '/checkin') state.reports = [...recent(state).slice(-999),Date.now()];
      break;
    case '/cadastro':
      if (!/^SUS-[A-Z0-9]{4,16}$/.test(codigo) || protocol || !/^[1-9]{2}0{8,9}$/.test(telefone)) return failure('Use um protocolo novo e um telefone fictício, como 11000000000.');
      if (Object.keys(state.protocols).length >= 50) return failure('Abra outra sessão de demonstração.');
      state.protocols[codigo] = {status:'aguardando',posicao:1,canal:'telefone_voz'};
      break;
    case '/chamar':
      if (protocol?.canal !== 'telefone_voz' || protocol.status !== 'aguardando' || state.offer) return failure('A chamada ou a vaga está indisponível.');
      protocol.status = 'chamado';
      break;
    case '/responder':
      if (protocol?.status !== 'chamado' || ![1,2].includes(tecla) || (tecla === 2 && state.offer)) return failure('A ligação ou a vaga está indisponível.');
      protocol.status = tecla === 1 ? 'confirmado' : 'cancelado_vaga_liberada';
      if (tecla === 2) state.offer = true;
      break;
    case '/encaixe':
      if (!state.offer || protocol?.canal !== 'app' || protocol.status !== 'aguardando') return failure('Encaixe indisponível para esse protocolo.');
      protocol.status = 'confirmado';
      state.offer = false;
      break;
    case '/protocolo':
      if (!protocol) return failure('Protocolo não encontrado.',404);
      break;
    default:
      return failure('Ação inexistente.',404);
  }
  const item = state.protocols[codigo];
  return json({...publicState(state),protocolo:item && {status:item.status,posicao:item.posicao}});
}

export default {
  async fetch(request,env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'GET' && Object.hasOwn(assets,path)) {
      const asset=assets[path];
      return new Response(asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache'}});
    }
    if ((path !== '/state' || request.method !== 'GET') && request.method !== 'POST') return failure('Rota inexistente.',404);
    const room = request.headers.get('X-Demo-Room') || 'demo';
    if (!/^[a-zA-Z0-9-]{3,48}$/.test(room)) return failure('Sessão de demonstração inválida.',400);
    let body = {};
    if (request.method === 'POST') {
      const raw = await request.text();
      if (raw.length > 4096) return failure('Requisição muito grande.',413);
      try { body = JSON.parse(raw); } catch { return failure('Dados inválidos.',400); }
      if (!body || typeof body !== 'object') return failure('Dados inválidos.',400);
    }
    for (let attempt=0;attempt<6;attempt++) {
      const row = await env.DB.prepare('SELECT revision, payload FROM demo_rooms WHERE id = ?').bind(room).first();
      const state = row ? JSON.parse(row.payload) : initial();
      if (request.method === 'GET') return json(publicState(state));
      const response = update(state,path,body);
      if (!response.ok || path === '/protocolo') return response;
      const payload = JSON.stringify(state);
      const result = row
        ? await env.DB.prepare('UPDATE demo_rooms SET payload = ?, revision = revision + 1 WHERE id = ? AND revision = ?').bind(payload,room,row.revision).run()
        : await env.DB.prepare('INSERT OR IGNORE INTO demo_rooms (id, payload) VALUES (?, ?)').bind(room,payload).run();
      if (result.meta.changes === 1) return response;
    }
    return failure('A sessão está ocupada. Tente novamente.');
  }
};
