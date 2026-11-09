"use strict";
/* =====================================================================
   MM IMPORTS - FUNCIONAMENTO DO SITE (script.js)
   Os PRODUTOS, FOTOS e PREÇOS ficam no index.html (nos blocos <article>).
   Este arquivo só lê esses dados e faz o carrinho, o WhatsApp e os feedbacks.
   ===================================================================== */

/* ---------- 1. DADOS DA LOJA ---------- */
/* Número do WhatsApp do proprietário (55 + DDD + número, sem espaços) */
const LOJA={wa:"5562986266467"};

/* ---------- 2. FUNÇÕES AUXILIARES ---------- */
/* Formata número como moeda brasileira: 199.9 vira "R$ 199,90" */
const brl=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
/* Atalho para buscar um elemento da página */
const $=s=>document.querySelector(s);
/* Nomes usados para guardar dados no navegador do cliente */
const KEY="mm_cart_v5",FBKEY="mm_feedbacks_v1";
/* Lê dados guardados no navegador (sem dar erro se estiver vazio) */
function ler(k,def){try{const v=JSON.parse(localStorage.getItem(k));return v==null?def:v}catch(e){return def}}
/* Grava dados no navegador */
function gravar(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
/* Cria um elemento HTML com classe e texto (seguro contra código malicioso) */
function el(t,c,txt){const e=document.createElement(t);if(c)e.className=c;if(txt!==undefined)e.textContent=txt;return e}
/* Ícone de óculos do espaço de foto vazio */
const GLASS='<svg viewBox="0 0 64 64"><circle cx="18" cy="34" r="12"/><circle cx="46" cy="34" r="12"/><path d="M30 33c1.5-2 3.5-2 5 0M6 30L3 22M58 30l3-8"/></svg>';

/* ---------- 3. LÊ OS PRODUTOS DO HTML ----------
   Cada <article class="card"> do index.html vira um produto.
   Campos lidos: data-id, data-nome, data-cor, data-estoque e o preço (texto de <div class="pr">). */
/* Converte um texto de preço ("R$ 1.299,90", "199,90", "199.9") em número */
function lerPreco(t){
 let x=String(t||"").replace(/[^\d.,]/g,"");
 if(!/\d/.test(x))return null;
 if(x.includes(","))x=x.replace(/\./g,"").replace(",",".");
 else if(/^\d{1,3}(\.\d{3})+$/.test(x))x=x.replace(/\./g,"");
 const v=parseFloat(x);
 return isFinite(v)&&v>=0?v:null;
}
const PRODUTOS=[];
document.querySelectorAll(".card[data-id]").forEach(card=>{
 const d=card.dataset;
 /* Preço: lido do texto de <div class="pr"> no HTML (ex.: "R$ 199,90").
    Se não for um número, o produto fica sem preço (null). */
 const n=lerPreco((card.querySelector(".pr")||{}).textContent);
 const p={
  id:d.id,
  nome:d.nome,
  preco:n,
  cores:String(d.cor||"Preto").split(",").map(x=>x.trim()).filter(Boolean),
  estoque:d.estoque!=="nao",
  img:card.querySelector(".ph img"),
  card
 };
 if(!p.cores.length)p.cores=["Preto"];
 PRODUTOS.push(p);
});
/* Procura um produto pelo id */
const find=id=>PRODUTOS.find(p=>p.id===id);
/* Produto pode ser comprado se estiver disponível (os escondidos nem aparecem) */
const comprar=p=>p&&p.estoque&&!p.card.hidden;

/* ---------- 4. PREPARA CADA CARD (preço, disponibilidade, cor, botões) ---------- */
PRODUTOS.forEach(p=>{
 const c=p.card;
 /* Preço mostrado no card (reescrito no formato R$ 0,00) */
 const pr=c.querySelector(".pr");
 pr.textContent=p.preco===null?"Preço sob consulta":brl(p.preco);
 if(p.preco===null)pr.classList.add("no");
 /* Disponibilidade */
 const av=c.querySelector(".av");
 av.textContent=p.estoque?"Disponível":"Indisponível";
 if(p.estoque)av.classList.add("on");
 /* Cor: se houver mais de uma, vira uma lista para o cliente escolher.
    Se houver só uma, não mostra nada no card (a cor continua sendo registrada no pedido). */
 const corBox=c.querySelector(".cor");
 let corVal;
 if(p.cores.length>1){
  const sel=el("select","cor");sel.setAttribute("aria-label","Cor de "+p.nome);
  p.cores.forEach(x=>{const o=el("option","",x);o.value=x;sel.append(o)});
  corBox.replaceWith(sel);corVal=()=>sel.value;
 }else{corBox.remove();corVal=()=>p.cores[0]}
 /* Botão "Adicionar ao carrinho": adiciona (com a cor) e abre o carrinho */
 const ad=c.querySelector(".add");
 if(!p.estoque){ad.textContent="Indisponível";ad.disabled=true}
 ad.onclick=()=>{add(p.id,corVal());abrirCarrinho(true)};
 /* Foto: se o arquivo não existir, mostra o espaço reservado */
 const im=p.img;
 if(im){
  const vazio=()=>{im.dataset.erro="1";const ph=im.parentNode;ph.textContent="";ph.innerHTML=GLASS;ph.append("Fotografia a ser enviada")};
  im.addEventListener("error",vazio);
  if(im.complete&&im.naturalWidth===0&&im.getAttribute("src"))vazio();   /* erro que já aconteceu */
 }
});

/* ---------- 5. CARRINHO (guardado no navegador de cada visitante) ---------- */
let cart=ler(KEY,{});
if(typeof cart!=="object"||Array.isArray(cart))cart={};
const save=()=>gravar(KEY,cart);
/* Cada linha do carrinho é identificada por produto + cor */
const chave=(id,cor)=>id+"|"+cor;
/* Adiciona 1 unidade (máximo 99) */
function add(id,cor){const p=find(id);if(!comprar(p))return;const k=chave(id,cor);
 cart[k]={id,cor,q:Math.min(((cart[k]&&cart[k].q)||0)+1,99)};save();draw()}
/* Altera a quantidade; zero ou menos remove o item */
function setq(k,q){if(q<=0)delete cart[k];else cart[k].q=Math.min(q,99);save();draw()}
/* Lista as linhas válidas do carrinho */
function linhas(){return Object.keys(cart).map(k=>({k,p:find(cart[k].id),q:cart[k].q,cor:cart[k].cor||"Preto"})).filter(x=>comprar(x.p))}
/* Soma o total (em centavos, para evitar erro de arredondamento). Itens sem preço não entram. */
function total(L){return L.reduce((s,x)=>s+(x.p.preco===null?0:Math.round(x.p.preco*100)*x.q),0)/100}
/* Verifica se há itens sem preço no carrinho */
const semPreco=L=>L.some(x=>x.p.preco===null);
/* Atualiza o painel do carrinho e o número do ícone */
function draw(){
 const L=linhas(),dl=$("#dl");dl.textContent="";
 $("#cnt").textContent=L.reduce((s,x)=>s+x.q,0);
 if(!L.length)dl.append(el("div","empty","Seu carrinho está vazio."));
 L.forEach(({k,p,q,cor})=>{
  const r=el("div","it");
  const t=el("div","");t.append(el("b","",p.nome),el("small","","Cor: "+cor));
  r.append(t,el("span","",p.preco===null?"Sob consulta":brl(p.preco*q)));
  const qq=el("div","q");
  const m=el("button","","-");m.setAttribute("aria-label","Diminuir");m.onclick=()=>setq(k,q-1);
  const pl=el("button","","+");pl.setAttribute("aria-label","Aumentar");pl.onclick=()=>setq(k,q+1);
  const rm=el("button","rm","Remover");rm.onclick=()=>setq(k,0);
  qq.append(m,el("span","",String(q)),pl,rm);r.append(qq);dl.append(r);
 });
 $("#tot").textContent=brl(total(L))+(semPreco(L)?" + itens sob consulta":"");
 $("#fin").disabled=!L.length;$("#clr").disabled=!L.length;
}
/* Fecha qualquer painel aberto */
function fechar(){$("#dr").classList.remove("on");$("#fb").classList.remove("on");$("#ov").classList.remove("on")}
/* Abre (true) ou fecha (false) o carrinho */
function abrirCarrinho(o){fechar();if(o){$("#dr").classList.add("on");$("#ov").classList.add("on")}}
/* Abre o painel de feedbacks */
function abrirFb(){fechar();$("#fb").classList.add("on");$("#ov").classList.add("on");listarFb()}

/* ---------- 6. FINALIZAR COMPRA (monta a mensagem e abre o WhatsApp) ---------- */
function finalizar(){
 const L=linhas();if(!L.length)return;
 /* Primeira linha da mensagem (para mudar o texto, edite aqui) */
 let m="Olá gostaria de realizar um pedido MM_imports\n\n";
 /* Uma linha para cada produto: nome, quantidade, cor e valor */
 L.forEach(({p,q,cor},i)=>{
  m+=(i+1)+". "+p.nome+"\nQuantidade: "+q+"\nCor: "+cor+"\n";
  m+=p.preco===null?"Valor: a confirmar\n\n":"Valor unitário: "+brl(p.preco)+"\nValor: "+brl(p.preco*q)+"\n\n";
 });
 m+="----------------------------\n\nTotal de unidades: "+L.reduce((s,x)=>s+x.q,0)+"\nValor total: "+brl(total(L))+(semPreco(L)?" (mais os itens com valor a confirmar)":"")+"\n\nAguardo atendimento!";
 /* Abre o WhatsApp com a mensagem pronta; o cliente confirma o envio lá */
 window.open("https://wa.me/"+LOJA.wa+"?text="+encodeURIComponent(m),"_blank","noopener");
}

/* ---------- 7. FEEDBACKS DOS CLIENTES ---------- */
/* Mostra a lista de feedbacks guardados neste aparelho */
function listarFb(){
 const box=$("#fbList");box.textContent="";
 const lista=ler(FBKEY,[]);
 if(!Array.isArray(lista)||!lista.length){box.append(el("div","empty","Nenhum feedback publicado ainda."));return}
 lista.slice().reverse().forEach(f=>{
  const r=el("div","rv");
  r.append(el("strong","",String(f.nome)),el("small","","Nota "+f.nota+" de 5"),el("p","",String(f.msg)));
  box.append(r);
 });
}
/* Lê e valida o formulário (nome e mensagem são obrigatórios) */
function lerForm(){
 const nome=$("#fbNome").value.trim().slice(0,60),msg=$("#fbMsg").value.trim().slice(0,500),nota=parseInt($("#fbNota").value,10)||5;
 return nome&&msg?{nome,msg,nota}:null;
}
/* Botão "Publicar": guarda o feedback neste aparelho */
$("#fbForm").onsubmit=e=>{
 e.preventDefault();const f=lerForm();if(!f)return;
 const l=ler(FBKEY,[]);l.push(f);gravar(FBKEY,l);
 $("#fbMsg").value="";listarFb();
};
/* Botão "Enviar por WhatsApp": manda o feedback ao proprietário */
$("#fbWa").onclick=()=>{
 const f=lerForm();if(!f){$("#fbForm").reportValidity();return}
 const m="Olá! Deixo meu feedback sobre a MM Imports.\n\nNome: "+f.nome+"\nNota: "+f.nota+" de 5\n\n"+f.msg;
 window.open("https://wa.me/"+LOJA.wa+"?text="+encodeURIComponent(m),"_blank","noopener");
};

/* ---------- 8. LIGA OS BOTÕES DA PÁGINA ---------- */
$("#cartBtn").onclick=()=>abrirCarrinho(true);            /* ícone do carrinho */
$("#closeCart").onclick=fechar;$("#closeFb").onclick=fechar;$("#ov").onclick=fechar;  /* fechar painéis */
$("#fbTab").onclick=abrirFb;                              /* aba de feedbacks */
$("#clr").onclick=()=>{cart={};save();draw()};            /* esvaziar carrinho */
$("#fin").onclick=finalizar;                              /* finalizar compra */
$("#waLink").href="https://wa.me/"+LOJA.wa;               /* link do WhatsApp da loja */
/* Menu do celular: abre e fecha */
$("#menuBtn").onclick=e=>{const o=$("#nav").classList.toggle("on");e.currentTarget.setAttribute("aria-expanded",o)};
$("#nav").onclick=()=>$("#nav").classList.remove("on");
/* Tecla Esc fecha os painéis */
document.addEventListener("keydown",e=>{if(e.key==="Escape")fechar()});

/* ---------- 9. INICIA O SITE ---------- */
draw();     /* desenha o carrinho */