/* 有限会社穂碩工業 サイトの動き
   - 動きは html.motion のときだけ（「動きを減らす」設定・データ節約の設定では付けない）
   - メニューの開け閉め、ヘッダーの影
   - フォームの確かめと送信（data-demo="1" の間は送らずに、送れたときの画面だけ見せる）
   - 計測：window.dataLayer に tel_click・form_error・form_submit を積む（解析のタグはまだ入れていない）
   - 動き（第4版）：最初の画面の写真のスライド、事業内容のスライド、流れる英字の帯、写真の幕
   - 最初に社名を出す幕（トップだけ。2026-11-17） */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  if (!reduce && !saveData) root.classList.add('motion');

  const dl = (window.dataLayer = window.dataLayer || []);
  const track = (event, data) => dl.push(Object.assign({ event }, data || {}));

  /* 1) ヘッダーの影 */
  const head = document.querySelector('.site-head');
  if (head) {
    const onScroll = () => head.classList.toggle('scrolled', window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* 2) メニュー（幅1100以下） */
  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('gnav');
  if (btn && nav) {
    const set = open => {
      /* 上の帯（dev-note）が見えている間もヘッダーの下から開くように、ヘッダーの下の位置を渡す */
      if (open && head) root.style.setProperty('--nav-top', Math.max(0, Math.round(head.getBoundingClientRect().bottom)) + 'px');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      root.classList.toggle('nav-open', open);
      document.querySelectorAll('main, .site-foot, .mbar').forEach(el => { el.inert = open; });
    };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && root.classList.contains('nav-open')) { set(false); btn.focus(); }
    });
    const wide = window.matchMedia('(min-width: 1101px)');
    const onWide = () => { if (wide.matches) set(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
  }

  /* 3) 電話を押した数 */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="tel:"]');
    if (a) track('tel_click', { place: a.dataset.place || '' });
  });

  /* 4) フォーム */
  const TEL = /^0\d{9,10}$/;
  const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const toHalf = s => s.replace(/[０-９＋－ー―‐（）]/g, c => '0123456789+-----()'['０１２３４５６７８９＋－ー―‐（）'.indexOf(c)] || c);

  document.querySelectorAll('form[data-form]').forEach(form => {
    const formName = form.getAttribute('name') || '';

    /* ご用件で、出す欄を切りかえる（例：法人のときだけ会社名） */
    const sync = () => {
      form.querySelectorAll('[data-show-when]').forEach(box => {
        const [key, val] = box.dataset.showWhen.split('=');
        const checked = form.querySelector(`input[name="${key}"]:checked`);
        const show = !!checked && checked.value === val;
        box.hidden = !show;
        box.querySelectorAll('input,textarea').forEach(el => { el.disabled = !show; });
      });
    };
    form.addEventListener('change', sync);
    sync();

    /* 用件を選んだ状態で開く：URL の ?kind=…、またはボタンの data-kind="…" */
    const pick = want => {
      const r = [...form.querySelectorAll('input[name="kind"]')].find(x => x.value === want);
      if (r) { r.checked = true; sync(); }
    };
    const want = new URLSearchParams(location.search).get('kind');
    if (want) pick(want);
    document.querySelectorAll('a[data-kind]').forEach(a => {
      if (a.getAttribute('href') === '#' + (form.closest('[id]') || {}).id) a.addEventListener('click', () => pick(a.dataset.kind));
    });

    const fieldOf = el => el.closest('.field');
    let errNo = 0;
    const setErr = (field, msg) => {
      field.classList.add('is-err');
      const p = field.querySelector('.err');
      if (p) {
        if (!p.id) p.id = `${formName || 'form'}-err-${++errNo}`;
        p.textContent = msg; p.hidden = false;
      }
      field.querySelectorAll('input,textarea').forEach(ctl => {
        ctl.setAttribute('aria-invalid', 'true');
        if (p) ctl.setAttribute('aria-describedby', p.id);
      });
    };
    const clearErr = field => {
      field.classList.remove('is-err');
      const p = field.querySelector('.err');
      if (p) { p.textContent = ''; p.hidden = true; }
      field.querySelectorAll('[aria-invalid],[aria-describedby]').forEach(el => { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); });
    };
    form.addEventListener('input', e => {
      const f = fieldOf(e.target);
      if (f && f.classList.contains('is-err')) clearErr(f);
    });
    form.addEventListener('change', e => {
      const f = fieldOf(e.target);
      if (f && f.classList.contains('is-err') && e.target.type === 'radio') clearErr(f);
    });

    form.addEventListener('submit', e => {
      const bad = [];
      form.querySelectorAll('.field').forEach(clearErr);

      form.querySelectorAll('[data-req]').forEach(el => {
        if (el.closest('[hidden]')) return;
        const field = fieldOf(el);
        const type = el.dataset.req;
        if (type === 'radio') {
          if (!field.querySelector('input:checked')) { setErr(field, el.dataset.msg || '1つ選んでください。'); bad.push(field.querySelector('input')); }
          return;
        }
        const v = el.value.trim();
        if (!v) { setErr(field, el.dataset.msg || '入力してください。'); bad.push(el); return; }
        if (type === 'tel') {
          const digits = toHalf(v).replace(/[^\d]/g, '');
          if (!TEL.test(digits)) { setErr(field, '電話番号は、0から始まる10けたか11けたで入れてください。'); bad.push(el); }
        }
      });
      form.querySelectorAll('input[type="email"]').forEach(el => {
        const v = el.value.trim();
        if (v && !el.disabled && !MAIL.test(v)) { setErr(fieldOf(el), 'メールアドレスの形を確かめてください（例：name@example.com）。'); bad.push(el); }
      });

      if (bad.length) {
        e.preventDefault();
        bad[0].focus();
        track('form_error', { form: formName, count: bad.length });
        return;
      }

      e.preventDefault();
      const done = form.parentElement.querySelector('.form-done');
      const fail = form.querySelector('.form-fail');
      const showDone = () => {
        if (!done) return;
        form.hidden = true;
        done.hidden = false;
        done.focus();
      };
      if (form.dataset.demo === '1') {
        /* 確認用：実際には送らない */
        if (done) {
          done.querySelector('h3').textContent += '（見本）';
          done.querySelector('p').textContent = '確認用のページなので、実際には届いていません。公開のときに、本当に届くようにします。';
        }
        showDone();
        track('form_submit', { form: formName, demo: true });
        return;
      }
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      if (fail) fail.hidden = true;
      fetch(form.getAttribute('action') || location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      }).then(r => {
        if (!r.ok) throw new Error(String(r.status));
        showDone();
        track('form_submit', { form: formName });
      }).catch(() => {
        if (submit) submit.disabled = false;
        if (fail) { fail.textContent = '送れませんでした。時間をおいてもう一度送るか、お電話（0467-76-2430）でご連絡ください。'; fail.hidden = false; fail.focus && fail.focus(); }
        track('form_error', { form: formName, reason: 'send' });
      });
    });
  });

  const motion = root.classList.contains('motion');

  /* 4.5) 最初に社名を出す幕（トップだけ。head の小さなスクリプトが html.has-intro を付けたときだけ）
          社名がぼんやり浮かび、ぼんやり消えて、ページにピントが合う（動きは CSS）。
          押す・キー・スクロールで、すぐに消す。消えてから、写真のスライドを動かし始める。 */
  const intro = document.querySelector('.intro');
  const introOn = !!intro && root.classList.contains('has-intro');
  const introDone = new Promise(done => {
    if (!introOn) { if (intro) intro.remove(); done(); return; }
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      evs.forEach(t => window.removeEventListener(t, skip, { passive: true }));
      intro.remove();
      done();
    };
    function skip() {
      if (intro.classList.contains('is-out') || intro.classList.contains('is-skip')) return;
      intro.classList.add('is-skip');
      root.classList.add('intro-skip');
    }
    evs.forEach(t => window.addEventListener(t, skip, { passive: true }));
    intro.addEventListener('animationstart', e => { if (e.target === intro && !e.pseudoElement && e.animationName === 'introVeil') intro.classList.add('is-out'); });
    intro.addEventListener('animationend', e => { if (e.target === intro && !e.pseudoElement && /^introVeilQ?$/.test(e.animationName)) end(); });
    setTimeout(end, 6000);   // 念のため（動きの知らせが来なくても消す）
  });

  /* 5) 最初の画面の写真のスライド（トップ）
        6秒ごとに重なって切りかわり、3周で止まる。「止める」ボタンと点で選べる。画面の外・裏のタブでは止まる。
        「動きを減らす」設定・データ節約の設定では自動で動かず、点で選ぶだけ。2枚目からは、ページを読み終えてから読む。 */
  const hero = document.querySelector('.hero');
  const hs = document.querySelector('[data-hero-slider]');
  if (hero && hs) {
    const slides = [...hs.querySelectorAll('.hs-slide')];
    const dots = [...hero.querySelectorAll('.hs-dot')];
    const cap = hero.querySelector('.hs-cap');
    const pauseBtn = hero.querySelector('.hs-pause');
    const INT = 6000, LOOPS = 3;
    hero.style.setProperty('--hs-int', INT / 1000 + 's');
    let cur = 0, timer = 0, steps = 0, paused = !motion, inView = true, introWait = introOn;
    const load = s => {
      if (!s) return;
      s.querySelectorAll('[data-srcset]').forEach(el => { el.setAttribute('srcset', el.dataset.srcset); el.removeAttribute('data-srcset'); });
      s.querySelectorAll('img[data-src]').forEach(el => { el.src = el.dataset.src; el.removeAttribute('data-src'); });
    };
    let focusIn = false;   // キーボードで操作の所に来ている間は止めておく（マウスを乗せたときは止めない）
    const running = () => !introWait && !paused && !focusIn && inView && !document.hidden;
    const restartBar = () => {
      hero.classList.remove('is-playing');
      void hero.offsetWidth;   // 進みぐあいの線を、はじめから動かし直す
      if (running()) hero.classList.add('is-playing');
    };
    const show = n => {
      n = (n + slides.length) % slides.length;
      if (n === cur) return;
      load(slides[n]);
      slides[cur].classList.remove('is-on');
      slides[cur].setAttribute('aria-hidden', 'true');
      if (dots[cur]) dots[cur].removeAttribute('aria-current');
      cur = n;
      slides[cur].classList.add('is-on');
      slides[cur].removeAttribute('aria-hidden');
      if (dots[cur]) dots[cur].setAttribute('aria-current', 'true');
      if (cap) cap.textContent = slides[cur].dataset.cap || '';
      load(slides[(cur + 1) % slides.length]);   // 次の写真を先に読んでおく
    };
    const setPauseUi = () => {
      if (!pauseBtn) return;
      pauseBtn.classList.toggle('is-paused', paused);
      pauseBtn.querySelector('.hs-pause-t').textContent = paused ? '動かす' : '止める';
    };
    const stop = () => { clearInterval(timer); timer = 0; hero.classList.remove('is-playing'); };
    const start = () => {
      stop();
      if (!running()) return;
      timer = setInterval(() => {
        if (++steps >= slides.length * LOOPS) { paused = true; setPauseUi(); stop(); return; }
        show(cur + 1);
        restartBar();
      }, INT);
      restartBar();
    };
    dots.forEach((d, i) => d.addEventListener('click', () => { show(i); start(); }));
    const ctrl = hero.querySelector('.hs-ctrl');
    if (ctrl) {
      // キーボードで来たときだけ止める（マウスで押したときは :focus-visible にならない）
      const byKey = el => { try { return el.matches(':focus-visible'); } catch (e) { return false; } };
      ctrl.addEventListener('focusin', e => { if (byKey(e.target)) { focusIn = true; start(); } });
      ctrl.addEventListener('focusout', e => { if (!ctrl.contains(e.relatedTarget)) { focusIn = false; start(); } });
    }
    if (pauseBtn) pauseBtn.addEventListener('click', () => { paused = !paused; if (!paused) { steps = 0; focusIn = false; } setPauseUi(); start(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { inView = es[0].isIntersecting; start(); }, { threshold: 0.2 }).observe(hero);
    document.addEventListener('visibilitychange', start);
    if (document.readyState === 'complete') load(slides[1]); else window.addEventListener('load', () => load(slides[1]));
    setPauseUi();
    start();
    introDone.then(() => { if (introWait) { introWait = false; start(); } });   // 社名の幕が消えてから動かし始める
  }

  /* 6) 事業内容のスライド：矢印で1枚ずつ送る（スマホは指で横に送る）。端ではボタンを止める */
  document.querySelectorAll('[data-gallery]').forEach(g => {
    const track = g.querySelector('.gal-track');
    const sec = g.closest('section');
    const prev = sec && sec.querySelector('.gal-btn.prev');
    const next = sec && sec.querySelector('.gal-btn.next');
    if (!track) return;
    const step = () => {
      const it = track.children[0];
      return it ? it.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0) : track.clientWidth;
    };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
    };
    if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step() }));
    if (next) next.addEventListener('click', () => track.scrollBy({ left: step() }));
    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();

    /* 6.5) 自動で送る（トップ。data-auto。2026-11-17、依頼主の「自動のスライドにする」から）
            4.5秒ごとに1枚。端まで来たら最初へ戻り、2周で止まる。画面に半分以上見えている間だけ動き、裏のタブでは止まる。
            指やマウスで送った・矢印を押したら自動はやめる（「動かす」で再開）。マウスを乗せている間と、キーボードで中に来ている間は止まる。
            「動きを減らす」設定・データ節約の設定では動かさない（ボタンも出さない）。 */
    const pauseBtn = sec && sec.querySelector('.gal-pause');
    if (!motion || !g.hasAttribute('data-auto') || !pauseBtn) return;
    const INT = 4500, LOOPS = 2;
    let timer = 0, paused = false, hover = false, focusIn = false, inView = false, rounds = 0;
    const atEnd = () => track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    const running = () => !paused && !hover && !focusIn && inView && !document.hidden;
    const setUi = () => {
      pauseBtn.classList.toggle('is-paused', paused);
      pauseBtn.querySelector('.gal-pause-t').textContent = paused ? '動かす' : '止める';
    };
    const stop = () => { clearInterval(timer); timer = 0; };
    const tick = () => {
      if (atEnd()) {
        if (++rounds >= LOOPS) { paused = true; setUi(); stop(); return; }
        track.scrollTo({ left: 0 });
      } else {
        track.scrollBy({ left: step() });
      }
    };
    const start = () => { stop(); if (running()) timer = setInterval(tick, INT); };
    const takeOver = () => { if (!paused) { paused = true; setUi(); stop(); } };   // 自分で送ったら、自動はやめる
    track.addEventListener('pointerdown', takeOver, { passive: true });
    track.addEventListener('touchstart', takeOver, { passive: true });
    track.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) takeOver(); }, { passive: true });
    [prev, next].forEach(b => b && b.addEventListener('click', takeOver));
    g.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hover = true; stop(); } });
    g.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hover = false; start(); } });
    const byKey = el => { try { return el.matches(':focus-visible'); } catch (e) { return false; } };
    g.addEventListener('focusin', e => { if (byKey(e.target)) { focusIn = true; stop(); } });
    g.addEventListener('focusout', e => { if (!g.contains(e.relatedTarget)) { focusIn = false; start(); } });
    pauseBtn.addEventListener('click', () => { paused = !paused; if (!paused) { rounds = 0; hover = false; } setUi(); start(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { inView = es[0].isIntersecting; start(); }, { threshold: 0.5 }).observe(g);
    else { inView = true; start(); }
    document.addEventListener('visibilitychange', start);
    setUi();
  });

  /* 7) 流れる英字の帯：スクロールに合わせて横に動く（自分では動かない） */
  const bands = [...document.querySelectorAll('.mq')];
  if (bands.length && motion) {
    let raf = 0;
    const move = () => {
      raf = 0;
      const vh = window.innerHeight;
      bands.forEach(m => {
        const r = m.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const p = (vh - r.top) / (vh + r.height);
        const inner = m.firstElementChild;
        inner.style.setProperty('--mx', (-p * inner.scrollWidth * 0.3).toFixed(1) + 'px');
      });
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(move); }, { passive: true });
    move();
  }

  /* 8) 写真の幕：最初の画面より下にある写真だけ幕を閉じておき、画面に入ったら横に開く */
  if (motion && 'IntersectionObserver' in window) {
    const els = [...document.querySelectorAll('.rv')].filter(el => el.getBoundingClientRect().top > window.innerHeight);
    els.forEach(el => el.classList.add('rv-wait'));
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.remove('rv-wait'); io.unobserve(e.target); }
    }), { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
  }
})();
