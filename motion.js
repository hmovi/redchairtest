/* Red Chair Marketing: motion layer (no dependencies). */
(function(){
'use strict';
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
var root=document.documentElement;
var $=function(s,e){return (e||document).querySelector(s)};
var $$=function(s,e){return [].slice.call((e||document).querySelectorAll(s))};
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
if(!reduce)root.classList.add('rc-motion');

/* ---------- Scroll progress, header, hero parallax ---------- */
var bar=document.createElement('div');bar.id='rc-progress';bar.setAttribute('aria-hidden','true');document.body.appendChild(bar);
var ticking=false;
function onScroll(){
  if(ticking)return;ticking=true;
  requestAnimationFrame(function(){
    var y=window.scrollY||0,h=document.documentElement.scrollHeight-innerHeight;
    bar.style.setProperty('--sp',h>0?clamp(y/h,0,1).toFixed(4):0);
    var hd=$('header');if(hd)hd.classList.toggle('scrolled',y>12);
    if(!reduce){var hero=$('.hero');if(hero&&y<innerHeight*1.2)hero.style.setProperty('--py',(y*0.22).toFixed(1)+'px')}
    ticking=false;
  });
}
addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);onScroll();

/* ---------- Magnetic buttons + card spotlight ---------- */
if(matchMedia('(hover:hover)').matches){
  document.addEventListener('pointermove',function(e){
    var t=e.target.closest&&e.target.closest('.btn,.card');if(!t)return;
    var r=t.getBoundingClientRect();
    if(t.classList.contains('btn')&&!reduce){
      var dx=(e.clientX-(r.left+r.width/2))/r.width,dy=(e.clientY-(r.top+r.height/2))/r.height;
      t.style.setProperty('--mx',(dx*10).toFixed(1)+'px');t.style.setProperty('--my',(dy*8).toFixed(1)+'px');
    }else if(t.classList.contains('card')){
      t.style.setProperty('--cx',(e.clientX-r.left)+'px');t.style.setProperty('--cy',(e.clientY-r.top)+'px');
    }
  },{passive:true});
  document.addEventListener('pointerout',function(e){
    var t=e.target.closest&&e.target.closest('.btn');if(t&&!t.contains(e.relatedTarget)){t.style.removeProperty('--mx');t.style.removeProperty('--my')}
  });
}

/* ---------- Reveal on scroll ---------- */
var io=null;
function reveal(){
  if(reduce||!('IntersectionObserver' in window))return;
  if(io)io.disconnect();
  io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -5% 0px'});
  var sel='main section:not(.hero):not(.mq-sec) .w>*, main .g>*, main .split>*, main .ecom-grid>*';
  $$(sel).forEach(function(el,n){
    if(el.closest('.hero')||el.matches('.g,.split,.ecom-grid,.ec-grid'))return;
    var sib=el.parentNode?[].indexOf.call(el.parentNode.children,el):0;
    el.classList.add('rv');el.style.setProperty('--i',Math.min(sib,5));io.observe(el);
  });
}

/* ---------- Hero headline: word-by-word ---------- */
function splitHero(){
  var h=$('main .hero h1');if(!h||h.dataset.sp)return;h.dataset.sp='1';
  var n=0;
  (function walk(node){
    [].slice.call(node.childNodes).forEach(function(c){
      if(c.nodeType===3){
        var frag=document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(function(tok){
          if(!tok)return;
          if(/^\s+$/.test(tok)){frag.appendChild(document.createTextNode(' '));return}
          var w=document.createElement('span');w.className='wd';var i=document.createElement('span');i.textContent=tok;
          w.style.setProperty('--w',n++);w.appendChild(i);frag.appendChild(w);
        });
        c.parentNode.replaceChild(frag,c);
      }else if(c.nodeType===1)walk(c);
    });
  })(h);
}

/* ---------- E-commerce demo ---------- */
function initEcom(){
  var ec=$('#ec');if(!ec||ec.dataset.on)return;ec.dataset.on='1';
  var bar=$('#ecb'),txt=$('#ect'),steps=$$('#ecs li'),prods=$$('.ec-p',ec),cart=$('#ecc'),ord=$('#eco'),rev=$('#ecr'),toast=$('#ect2'),stats=$('.ec-stats',ec),sp=$('#ecpath'),visible=false,looping=false;
  var msgs=['Setting up your store','Adding your products','Connecting payments','Setting shipping and tax','Launching'];
  var money=function(n){return '$'+n.toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0})};
  function alive(){return document.body.contains(ec)}
  function reset(){ec.classList.remove('live');bar.style.transition='none';bar.style.width='0%';steps.forEach(function(s){s.classList.remove('on')});prods.forEach(function(p){p.classList.remove('in','add')});cart.textContent='0';ord.textContent='0';rev.textContent='$0';toast.classList.remove('show');stats.classList.remove('draw');txt.textContent=msgs[0]}
  function finalState(){ec.classList.add('live');prods.forEach(function(p){p.classList.add('in')});cart.textContent='3';ord.textContent='24';rev.textContent='$2,160';stats.classList.add('draw')}
  async function count(el,to,ms,fmt){var s=performance.now();await new Promise(function(r){(function f(n){var t=clamp((n-s)/ms,0,1);el.textContent=fmt(Math.round(to*(1-Math.pow(1-t,3))));if(t<1&&alive())requestAnimationFrame(f);else r()})(s)})}
  async function run(){
    if(looping)return;looping=true;
    while(alive()){
      if(!visible){await sleep(400);continue}
      reset();await sleep(500);
      void bar.offsetWidth;bar.style.transition='width 3.4s cubic-bezier(.4,.1,.2,1)';bar.style.width='100%';
      for(var i=0;i<steps.length&&alive();i++){txt.textContent=msgs[i];steps[i].classList.add('on');await sleep(700)}
      await sleep(350);if(!alive())break;
      ec.classList.add('live');await sleep(500);
      for(var p=0;p<prods.length;p++){prods[p].classList.add('in');await sleep(180)}
      await sleep(500);
      for(var a=0;a<3&&alive();a++){prods[a].classList.add('add');cart.textContent=String(a+1);cart.classList.add('pop');await sleep(260);cart.classList.remove('pop');await sleep(420);prods[a].classList.remove('add')}
      toast.classList.add('show');stats.classList.add('draw');
      await Promise.all([count(ord,24,1800,String),count(rev,2160,1800,money)]);
      await sleep(3200);toast.classList.remove('show');await sleep(500);
      ec.classList.remove('live');await sleep(700);
    }
    looping=false;
  }
  if(reduce){finalState();return}
  var vio=new IntersectionObserver(function(es){visible=es[0].isIntersecting},{threshold:.25});vio.observe(ec);
  run();
}

/* ---------- Mount on every route render ---------- */
var mo=null,lastHTML=null;
function mount(){
  var m=$('#m');if(!m)return;
  m.classList.remove('pg');void m.offsetWidth;if(!reduce)m.classList.add('pg');
  splitHero();reveal();initEcom();onScroll();
}
var m=$('#m');
if(m){
  mo=new MutationObserver(function(){
    // route renders replace #m contents in one go; debounce to the next frame
    if(mount.q)return;mount.q=requestAnimationFrame(function(){mount.q=0;mount()});
  });
  mo.observe(m,{childList:true});
}
mount();
})();
