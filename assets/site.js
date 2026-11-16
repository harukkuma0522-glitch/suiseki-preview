/* 有限会社穂碩工業 サイトの動き
   - 動きは html.motion のときだけ（「動きを減らす」設定・データ節約の設定では付けない）
   - メニューの開け閉め、ヘッダーの影
   - フォームの確かめと送信（data-demo="1" の間は送らずに、送れたときの画面だけ見せる）
   - 計測：window.dataLayer に tel_click・form_error・form_submit を積む（解析のタグはまだ入れていない） */
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
})();
