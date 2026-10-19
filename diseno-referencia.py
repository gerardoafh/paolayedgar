from pathlib import Path
import re

p=Path('index.html')
h=p.read_text(encoding='utf-8')
sections=re.findall(r'<section\b[^>]*>.*?</section>',h,re.S)
assert len(sections)==12
scripts=re.findall(r'<script>.*?</script>',h,re.S)
first=scripts[0]
start=first.index("  var target=")
first='<script>\n(function(){\n'+first[start:]
dialog=re.search(r'<dialog\b.*?</dialog>',h,re.S).group()
branch='''<svg class="ramito" viewBox="0 0 130 145" aria-hidden="true"><g fill="none" stroke="#7e8b5f" stroke-width="1.5"><path d="M64 140Q45 70 80 10M60 112Q22 82 22 48M59 94Q103 69 110 34"/></g><g fill="#99a47a"><ellipse cx="71" cy="28" rx="7" ry="16" transform="rotate(26 71 28)"/><ellipse cx="57" cy="52" rx="7" ry="17" transform="rotate(-32 57 52)"/><ellipse cx="73" cy="72" rx="7" ry="17" transform="rotate(45 73 72)"/><ellipse cx="36" cy="80" rx="7" ry="17" transform="rotate(-48 36 80)"/><ellipse cx="95" cy="61" rx="6" ry="14" transform="rotate(35 95 61)"/></g><g fill="#d9b4af"><ellipse cx="54" cy="99" rx="12" ry="20" transform="rotate(-25 54 99)"/><ellipse cx="62" cy="98" rx="12" ry="20" transform="rotate(25 62 98)"/><ellipse cx="58" cy="101" rx="20" ry="11"/><circle cx="58" cy="101" r="5" fill="#faf2db"/></g></svg>'''
hero='''<section id="portada"><div class="portada-papel">
<svg class="titulo-curvo" viewBox="0 0 400 125" role="img" aria-label="Nuestra boda"><defs><path id="arco-titulo" d="M30 120 Q200 -35 370 120"/></defs><text><textPath href="#arco-titulo" startOffset="50%" text-anchor="middle">NUESTRA BODA</textPath></text></svg>
<h1>Paola y Edgar</h1>
<img class="foto-principal" src="assets/foto-1.webp" width="1600" height="1066" fetchpriority="high" alt="Paola y Edgar tomados de la mano en un paisaje natural">
<div class="fecha-portada"><strong>29</strong><span>NOVIEMBRE<br>2026</span></div><p class="dia-portada">DOMINGO · 5:00 P. M.</p>
</div></section>'''
welcome='''<section class="bienvenida">'''+branch+'''<p class="verse">“Y sobre todas estas cosas, vestíos de amor, que es el vínculo perfecto.”<b>Colosenses 3:14</b></p><p>Con la bendición de Dios y el amor de nuestras familias, nos llena de alegría invitarte a celebrar el inicio de esta nueva etapa juntos.</p></section>'''
def klass(s,name): return re.sub(r'<section\b[^>]*>', '<section class="'+name+' reveal">',s,count=1)
families=klass(sections[1],'familias').replace('<h2>Nuestras familias</h2>','<p class="intro-padres">Con la bendición, amor<br>y apoyo de nuestros</p><h2>Padres</h2>')
church='''<svg class="venue-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M8 57h48M15 56V28l17-13 17 13v28M27 56V42a5 5 0 0 1 10 0v14M32 3v12M27 8h10M8 57V35l7-6M56 57V35l-7-6"/><circle cx="32" cy="28" r="4"/></svg>'''
glasses='''<svg class="venue-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m13 6 17 5-7 21c-4 10-18 5-14-5ZM21 36l-5 18M8 52l16 5M51 6l-17 5 7 21c4 10 18 5 14-5ZM43 36l5 18M40 57l16-5M13 20l13 4M38 24l13-4M32 2v4M27 2l-2 4M37 2l2 4"/></svg>'''
venues=[]
for s,icon in zip(sections[2:4],[church,glasses]):
    s=re.sub(r'<section\b[^>]*>','<article class="venue">'+icon,s,count=1).replace('</section>','</article>')
    venues.append(s)
places='<section class="lugares reveal"><span class="eyebrow">El día que soñamos</span><h2>Ven a celebrar</h2><div class="venue-grid">'+''.join(venues)+'</div></section>'
classes=['itinerario','vestimenta','regalos','galeria','cuenta','adultos','confirmar','despedida']
rest=[klass(s,c) for s,c in zip(sections[4:],classes)]
rest[-1]=rest[-1].replace('>\n  <p>','>\n'+branch+'<p>',1)
rest[0]=rest[0].replace('<h2>Nuestro itinerario</h2>','<span class="eyebrow">Cada momento, contigo</span><h2>Itinerario</h2>')
rest[3]=rest[3].replace('<h2>Nuestra galería</h2>','<h2>Nuestra historia</h2>')
doc='''<!DOCTYPE html><html lang="es" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#69734c"><meta name="description" content="Paola y Edgar · Nuestra boda · 29 de noviembre de 2026. Acompáñanos a celebrar y confirma tu asistencia."><title>Paola &amp; Edgar · Nuestra boda</title><link rel="stylesheet" href="invitacion.css"></head><body><main>'''+hero+welcome+families+places+''.join(rest)+'</main>'+first+dialog+scripts[1]+'</body></html>'
p.write_text(doc,encoding='utf-8')
print('Invitación reconstruida según la referencia floral.')
