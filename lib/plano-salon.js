const puntos = [
  [36,22],[77,77],
  [10,15],[10,34],[10,53],[10,72],[10,90],
  [24,27],[24,46],[24,65],[24,84],[51,15],[51,32],
  [91,12],[91,24],[91,36],[91,68],[91,81],[91,94],[36,53],[36,72]
];
export const posicionesSalon = puntos.map(([x,y],i) => ({ numero:i+1, x, y }));

export function iniciarPlanoSalon({ raiz, obtenerPases, obtenerMesas, coincideFiltro = () => true, mover }) {
  const el = (tag, texto='', clase='') => {
    const n=document.createElement(tag); n.textContent=texto; n.className=clase; return n;
  };
  let seleccionada=null, elegido=null;
  const titulo=el('h3','Plano del salón');
  const nota=el('p','Distribución de referencia según tu plano. Conserva las 21 mesas y sus cupos actuales; la posición en el dibujo es aproximada.','nota-plano');
  const controles=el('div','','acciones-plano');
  const ayuda=el('p','Selecciona una mesa para ver sus invitados. Para moverlos, elige un grupo y luego una mesa de destino. También puedes arrastrar el grupo sobre una mesa.','nota-plano');
  const estado=el('p','','estado-plano'); estado.setAttribute('role','status');
  const layout=el('div','','layout-salon'), lienzo=el('div','','lienzo-salon');
  const dibujo=el('div','','dibujo-salon');
  dibujo.setAttribute('role','group'); dibujo.setAttribute('aria-label','Plano de mesas del salón');
  const pista=el('div','PISTA DE BAILE','pista-salon'), lobby=el('div','LOBBY','lobby-salon');
  dibujo.append(pista,lobby,el('div','ESCENARIO','escenario-salon'),el('span','ENTRADA','entrada-salon'));
  lienzo.append(dibujo);
  const lateral=el('aside','','lateral-salon');
  const encabezado=el('h4','Invitados del salón');
  const label=el('label','Buscar persona principal o acompañante');
  const buscar=el('input'); buscar.type='search'; buscar.id='buscar-plano'; buscar.placeholder='Nombre del invitado'; label.htmlFor=buscar.id;
  const scope=el('select'); scope.id='alcance-plano';
  const scopeLabel=el('label','Ver invitados'); scopeLabel.htmlFor=scope.id;
  for(const [value,text] of [['todos','Todos los grupos'],['mesa','Mesa seleccionada'],['pendientes','Sin mesa']]) {
    const opt=el('option',text); opt.value=value; scope.append(opt);
  }
  const modo=el('input'); modo.type='checkbox'; modo.checked=true;
  const modoLabel=el('label','','filtro-retirados'); modoLabel.append(modo,document.createTextNode('Mover al grupo completo'));
  const lista=el('div','','grupos-plano');
  const limpiar=el('button','Cancelar selección','salir'); limpiar.type='button';
  limpiar.addEventListener('click',()=>{elegido=null;estado.textContent='Selección cancelada.'; dibujar();});
  controles.append(limpiar);
  lateral.append(encabezado,label,buscar,scopeLabel,scope,modoLabel,lista);
  layout.append(lienzo,lateral);
  raiz.append(titulo,nota,ayuda,estado,controles,layout);
  const normal=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function abrirDestino(numero,id=elegido) {
    const p=obtenerPases().find(p=>p.id===id && p.activo!==false);
    if(p) {
      const destino=obtenerMesas().find(m=>m.numero===numero);
      const personas=obtenerPases().filter(x=>x.activo!==false && (modo.checked?x.confirmacionId===p.confirmacionId:x.id===p.id));
      const necesarios=personas.filter(x=>x.mesa!==numero).length;
      if(!necesarios){estado.textContent='La selección ya está en esa mesa.';return;}
      if(!destino || necesarios>destino.disponibles){
        estado.textContent='No hay espacio suficiente para esta selección en la mesa '+numero+'. Prueba otra mesa o mueve solo a una persona.';
        return;
      }
      mover(p,numero,modo.checked);
      return;
    }
    seleccionada=numero; scope.value='mesa'; dibujar(); mostrarGrupos();
  }
  function dibujar() {
    dibujo.querySelectorAll('.mesa-salon').forEach(n=>n.remove());
    const activos=obtenerPases().filter(p=>p.activo!==false);
    const hayFiltro=activos.some(p=>!coincideFiltro(p));
    for (const m of obtenerMesas()) {
      const pos=posicionesSalon.find(p=>p.numero===m.numero);
      if(!pos)continue;
      const n=el('button','','mesa-salon'+(m.capacidad===16?' imperial-salon':'')+(m.disponibles===0?' mesa-llena':'')+(seleccionada===m.numero?' mesa-seleccionada':''));
      n.type='button'; n.style.left=pos.x+'%'; n.style.top=pos.y+'%';
      n.dataset.numero=m.numero;
      n.setAttribute('aria-label',m.texto+', '+m.disponibles+' lugares libres de '+m.capacidad);
      n.setAttribute('aria-pressed',String(seleccionada===m.numero));
      n.append(el('strong',String(m.numero)),el('span',(m.capacidad-m.disponibles)+'/'+m.capacidad));
      n.title=m.texto+' · '+m.disponibles+' libres';
      const relevantes=activos.filter(p=>p.mesa===m.numero && coincideFiltro(p));
      const reservaCoincide=m.reservas?.length && coincideFiltro({relacion:m.numero===1?'Familiares de la novia':'Familiares del novio'});
      if(hayFiltro) n.classList.add(relevantes.length||reservaCoincide?'mesa-coincide-filtro':'mesa-fuera-filtro');
      n.addEventListener('click',()=>abrirDestino(m.numero));
      n.addEventListener('dragover',e=>{if(elegido){e.preventDefault();n.classList.add('mesa-destino');}});
      n.addEventListener('dragleave',()=>n.classList.remove('mesa-destino'));
      n.addEventListener('drop',e=>{e.preventDefault();n.classList.remove('mesa-destino');if(elegido)abrirDestino(m.numero);});
      dibujo.append(n);
    }
  }
  function mostrarGrupos() {
    lista.replaceChildren();
    const activos=obtenerPases().filter(p=>p.activo!==false), grupos=new Map();
    for(const p of activos){if(!grupos.has(p.confirmacionId))grupos.set(p.confirmacionId,[]);grupos.get(p.confirmacionId).push(p);}
    const q=normal(buscar.value.trim());
    encabezado.textContent=scope.value==='mesa' ? (obtenerMesas().find(m=>m.numero===seleccionada)?.texto || 'Selecciona una mesa') : scope.value==='pendientes'?'Invitados sin mesa':'Todos los grupos';
    if(scope.value==='mesa' && seleccionada) {
      const parentesco=seleccionada===1?'Familiares de la novia':'Familiares del novio';
      const reservas=coincideFiltro({relacion:parentesco}) ? obtenerMesas().find(m=>m.numero===seleccionada)?.reservas||[] : [];
      for(const nombre of reservas)lista.append(el('p',nombre+' · Lugar reservado','reserva-plano'));
    }
    for(const ps of grupos.values()) {
      if(!ps.some(coincideFiltro))continue;
      if(q && !ps.some(p=>normal(p.nombre).includes(q)))continue;
      if(scope.value==='mesa' && !ps.some(p=>p.mesa===seleccionada))continue;
      if(scope.value==='pendientes' && !ps.some(p=>!p.mesa))continue;
      const principal=ps[0], fila=el('article','','grupo-plano');
      fila.append(el('h5',principal.nombre+(ps.length>1?' + '+(ps.length-1)+' acompañantes':'')),el('p',principal.relacion));
      for(const p of ps) {
        const boton=el('button',p.nombre+' · '+(p.mesa? 'Mesa '+p.mesa:'Sin mesa'),'persona-plano'+(elegido===p.id?' persona-elegida':''));
        boton.type='button'; boton.draggable=true;
        const elegir=()=>{elegido=p.id;estado.textContent=(modo.checked?'Grupo de ':'')+p.nombre+': elige la mesa de destino en el plano.';mostrarGrupos();};
        boton.addEventListener('click',elegir);
        boton.addEventListener('dragstart',e=>{elegido=p.id;e.dataTransfer.setData('text/plain',p.id);e.dataTransfer.effectAllowed='move';estado.textContent='Suelta sobre una mesa para revisar el movimiento.';});
        boton.addEventListener('dragend',()=>dibujo.querySelectorAll('.mesa-destino').forEach(n=>n.classList.remove('mesa-destino')));
        fila.append(boton);
      }
      lista.append(fila);
    }
    if(!lista.children.length)lista.append(el('p','No hay invitados con esta selección.'));
  }
  buscar.addEventListener('input',mostrarGrupos); scope.addEventListener('change',mostrarGrupos);
  return { actualizar(){elegido=null;estado.textContent='';dibujar();mostrarGrupos();},
    limpiar(){elegido=seleccionada=null;buscar.value='';scope.value='todos';estado.textContent='';lista.replaceChildren();dibujo.querySelectorAll('.mesa-salon').forEach(n=>n.remove());} };
}
