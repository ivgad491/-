/* Общая навигация, API-клиент и корзина. Пароли и контактные данные в браузере не хранятся. */
'use strict';

(() => {
  const page = location.pathname.split('/').pop() || 'index.html';
  const current = name => page === name ? ' aria-current="page"' : '';
  const brand = `<span class="brand"><svg class="brand-icon" viewBox="0 0 34 34" aria-hidden="true"><path d="M2 32V2h30v30H17V17H2M17 2v15h15"/></svg><span><span class="brand-name">Форма</span><span class="brand-caption">мебель для жизни</span></span></span>`;
  const cartIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.5 11h11L21 7H6M9 20h.01M18 20h.01"/></svg>`;
  const accountIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>`;
  const header = document.querySelector('[data-site-header]');
  if (header) header.innerHTML = `<header class="site-header"><div class="container header-inner"><a href="index.html" aria-label="Форма — главная страница">${brand}</a><nav class="desktop-nav" aria-label="Основная навигация"><a href="index.html#catalog">Каталог</a><a href="about.html"${current('about.html')}>О компании</a><a href="delivery.html"${current('delivery.html')}>Доставка</a><a href="contacts.html"${current('contacts.html')}>Контакты</a></nav><div class="header-actions shop-header-actions"><a class="header-icon-link" href="account.html"${current('account.html')} aria-label="Личный кабинет">${accountIcon}<span class="header-icon-text">Кабинет</span></a><a class="header-icon-link" href="cart.html"${current('cart.html')} aria-label="Корзина">${cartIcon}<span class="header-icon-text">Корзина</span><span class="cart-badge" data-cart-count>0</span></a></div><button class="menu-toggle" aria-label="Открыть меню" aria-expanded="false" aria-controls="mobile-nav"><span></span><span></span></button></div><nav id="mobile-nav" class="mobile-nav" aria-label="Мобильная навигация" hidden><a href="index.html#catalog">Каталог</a><a href="about.html"${current('about.html')}>О компании</a><a href="delivery.html"${current('delivery.html')}>Доставка</a><a href="contacts.html"${current('contacts.html')}>Контакты</a><a href="account.html"${current('account.html')}>Личный кабинет</a><a href="cart.html"${current('cart.html')}>Корзина</a></nav></header>`;
  const footer = document.querySelector('[data-site-footer]');
  if (footer) footer.innerHTML = `<footer class="site-footer"><div class="container"><div class="footer-top"><div class="footer-brand"><a href="index.html" aria-label="Форма — главная">${brand}</a><p>Простые вещи, которые делают дом вашим.</p></div><nav class="footer-col" aria-label="Категории каталога"><h3>Коллекции</h3><a href="index.html?category=kitchens#collection">Кухни</a><a href="index.html?category=wardrobes#collection">Шкафы</a><a href="index.html?category=living#collection">Гостиные</a></nav><nav class="footer-col" aria-label="Информация"><h3>Информация</h3><a href="about.html">О компании</a><a href="contacts.html">Контакты</a><a href="delivery.html">Доставка и получение</a><a href="account.html">Личный кабинет</a><a href="legal.html">Документы и соглашения</a><a href="privacy.html">Персональные данные</a><a href="cookies.html">Cookies и данные браузера</a><button type="button" class="privacy-settings-footer" data-cookie-settings>Настройки cookies</button><a href="city-directory.html">Справочник городов</a></nav><div class="footer-col"><h3>Контакты · пример</h3><p>+7 (000) 000-00-00</p><p>Краснодар</p><p>Пн–Сб, 10:00–19:00</p><small>Замените на реальные данные</small></div></div><div class="footer-bottom"><p>© ${new Date().getFullYear()} Форма · Тестовый магазин</p><p>Товары и цены — примеры. Статическая демонстрация. Заявки не отправляются.</p><a class="footer-info-link" href="privacy.html">О данных <span class="action-icon" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><path d="m8 5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></a></div></div></footer>`;

  const notice = document.createElement('p');
  notice.className = 'pages-preview-notice';
  notice.textContent = 'Демонстрационная версия для просмотра. Каталог, корзина и поиск городов работают; вход и отправка заявок требуют серверной части.';
  document.querySelector('[data-site-header]')?.after(notice);
  const storageKey = 'forma-cart-v1';
  const cartLimits = Object.freeze({ perProduct: 20, total: 50, distinct: 20 });
  // The same bounds are enforced by the server. Merge repeated local entries
  // so a damaged value or an older tab cannot bypass the visible cart limits.
  function normalizeCart(value) {
    if (!Array.isArray(value)) return [];
    const merged = new Map();
    let remaining = cartLimits.total;
    for (const item of value) {
      if (!item || typeof item.productId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(item.productId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) continue;
      if (!merged.has(item.productId) && merged.size >= cartLimits.distinct) continue;
      const previous = merged.get(item.productId) || 0;
      const extra = Math.min(item.quantity, cartLimits.perProduct - previous, remaining);
      if (extra > 0) { merged.set(item.productId, previous + extra); remaining -= extra; }
    }
    return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
  }
  let cart = [];
  let cartPersistence = window.FormaPrivacy?.get()?.saveCart === true;
  try {
    if (cartPersistence) cart = normalizeCart(JSON.parse(localStorage.getItem(storageKey) || '[]'));
  } catch (_) { /* Закрытый режим Safari не должен ломать страницу. */ }
  function writeCart() {
    try { if (cartPersistence) localStorage.setItem(storageKey, JSON.stringify(cart)); } catch (_) { /* Корзина продолжает работать в этой вкладке. */ }
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = String(count); });
    window.dispatchEvent(new CustomEvent('forma:cart', { detail: { count } }));
  }
  function setQuantity(productId, quantity) {
    if (typeof productId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(productId) || !Number.isFinite(Number(quantity))) return false;
    const item = cart.find(entry => entry.productId === productId);
    const previous = item?.quantity || 0;
    const otherCount = cart.reduce((sum, entry) => sum + (entry.productId === productId ? 0 : entry.quantity), 0);
    const requested = Math.max(0, Math.trunc(Number(quantity)));
    const next = Math.min(cartLimits.perProduct, cartLimits.total - otherCount, requested);
    if (!item && next && cart.length >= cartLimits.distinct) { notify('В одном заказе можно выбрать не более 20 разных моделей.'); return false; }
    if (item && next) item.quantity = next;
    else if (item) cart = cart.filter(entry => entry.productId !== productId);
    else if (next) cart.push({ productId, quantity: next });
    writeCart();
    if (requested > next) notify(next >= cartLimits.perProduct ? 'Не более 20 единиц одной модели в заказе.' : 'Не более 50 единиц мебели в одном заказе.');
    return previous !== next;
  }
  let me = null;
  let mePromise = null;
  async function api(path, options = {}, refreshedCsrf = false) {
    if (window.FormaPages) return window.FormaPages.api(path, options);
    const method = options.method || 'GET';
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      const identity = await getMe();
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = identity.csrfToken || '';
    }
    let response; let data;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      response = await fetch(path, { method, headers, credentials: 'same-origin', cache: 'no-store', signal: controller.signal, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
      try { data = await response.json(); } catch (_) { throw new Error('Сервис временно недоступен. Попробуйте позже.'); }
    } catch (error) {
      if (!response) throw new Error(controller.signal.aborted ? (path === '/api/orders' && method === 'POST' ? 'Сервер не ответил вовремя. Попробуйте отправить эту форму ещё раз без изменения данных.' : 'Сервер не ответил вовремя. Попробуйте ещё раз.') : 'Не удалось связаться с сервером. Проверьте интернет и повторите попытку.');
      throw error;
    } finally { clearTimeout(timeout); }
    if (!response.ok) {
      const error = new Error(data?.error?.message || 'Не удалось выполнить действие.');
      error.code = data?.error?.code; error.status = response.status;
      if (response.status === 401 || response.status === 403) { me = null; mePromise = null; }
      // CSRF rejection happens before a write. Refresh once and resend exactly
      // the same body, including its order idempotency key. Other failures are
      // shown to the visitor and are never automatically retried.
      if (method !== 'GET' && error.code === 'CSRF_REJECTED' && !refreshedCsrf) {
        await getMe(true);
        return api(path, options, true);
      }
      throw error;
    }
    return data;
  }
  function getMe(force = false) {
    if (force) { me = null; mePromise = null; }
    if (me) return Promise.resolve(me);
    if (!mePromise) mePromise = api('/api/me').then(data => { me = data; return data; }).catch(error => { mePromise = null; throw error; });
    return mePromise;
  }
  function notify(message) {
    let toast = document.querySelector('.shop-toast');
    if (!toast) { toast = document.createElement('p'); toast.className = 'shop-toast'; toast.setAttribute('role', 'status'); document.body.append(toast); }
    toast.textContent = message; toast.hidden = false;
    clearTimeout(notify.timer); notify.timer = setTimeout(() => { toast.hidden = true; }, 3500);
  }
  // Единый векторный значок для динамических кнопок и ссылок. Входные данные
  // не вставляются как HTML: создаются только известные SVG-элементы.
  function actionIcon() {
    const badge = document.createElement('span'); badge.className = 'action-icon'; badge.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20'); svg.setAttribute('fill', 'none'); svg.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm8 5 5 5-5 5'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
    svg.append(path); badge.append(svg); return badge;
  }
  function decorateAction(node) {
    node.classList.add('action-control');
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) walker.currentNode.textContent = walker.currentNode.textContent.replace(/\u2197/g, '').trimEnd();
    if (!node.querySelector('.action-icon')) node.append(actionIcon());
    return node;
  }
  window.Forma = {
    api, getMe, notify, actionIcon, decorateAction, cartLimits,
    getCart: () => cart.map(item => ({ ...item })),
    setQuantity,
    addToCart(productId) { const item = cart.find(entry => entry.productId === productId); const changed = setQuantity(productId, (item?.quantity || 0) + 1); if (changed) notify('Модель добавлена в корзину'); return changed; },
    clearCart() { cart = []; writeCart(); },
    money: amount => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: amount % 100 ? 2 : 0 }).format(amount / 100)
  };
  writeCart();
  window.addEventListener('forma:privacy', event => {
    const previous = cartPersistence;
    cartPersistence = event.detail?.saveCart === true;
    try {
      if (!cartPersistence) localStorage.removeItem(storageKey);
      else if (!previous && !cart.length) cart = normalizeCart(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch (_) { /* Отказ хранилища не прерывает текущую покупку. */ }
    writeCart();
  });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey || !cartPersistence) return;
    try { const saved = JSON.parse(event.newValue || '[]'); if (Array.isArray(saved)) { cart = normalizeCart(saved); writeCart(); } } catch (_) { /* Невалидное локальное значение игнорируется. */ }
  });

  const menuToggle = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  function closeMenu() { if (mobileNav) mobileNav.hidden = true; menuToggle?.setAttribute('aria-expanded', 'false'); menuToggle?.setAttribute('aria-label', 'Открыть меню'); }
  menuToggle?.addEventListener('click', () => {
    const opening = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(opening)); menuToggle.setAttribute('aria-label', opening ? 'Закрыть меню' : 'Открыть меню'); mobileNav.hidden = !opening;
  });
  mobileNav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);

  // Общая кнопка ведёт к реальному пути заказа вместо имитации отправки формы.
  const dialogRoot = document.querySelector('[data-request-dialog]');
  if (dialogRoot) dialogRoot.innerHTML = `<dialog class="request-dialog" aria-labelledby="request-title"><div class="dialog-inner"><button class="dialog-close" type="button" aria-label="Закрыть окно">×</button><p class="eyebrow">НАЧНЁМ С ВАШЕЙ ИДЕИ</p><h2 id="request-title">Выберите вашу мебель</h2><p class="dialog-intro">Добавьте модели в корзину и посмотрите варианты получения. В этой демонстрационной версии регистрация и отправка заявки недоступны.</p><p class="shop-notice">Пока это тестовый магазин: товары, цены и контакты — примеры. Используйте тестовые данные. Онлайн-оплата не подключена.</p><div class="dialog-actions"><a class="button" href="index.html#collection">Смотреть модели <span class="action-icon" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><path d="m8 5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></a><a class="button button--light" href="cart.html">Перейти в корзину</a></div></div></dialog>`;
  const dialog = document.querySelector('.request-dialog');
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-request]');
    if (!trigger || !dialog) return;
    closeMenu(); dialog.showModal(); document.body.classList.add('modal-open');
  });
  document.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => { const rect = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close(); });
  dialog?.addEventListener('close', () => document.body.classList.remove('modal-open'));
  document.querySelectorAll('.button, .text-link, .product-request').forEach(decorateAction);
  getMe().then(identity => {
    if (!identity.isAdmin) return;
    for (const nav of [document.querySelector('.desktop-nav'), mobileNav]) {
      if (!nav) continue;
      const link = document.createElement('a'); link.href = 'admin.html'; link.textContent = 'Управление'; if (page === 'admin.html') link.setAttribute('aria-current', 'page'); nav.append(link);
    }
  }).catch(() => { /* Ошибка API будет видна на страницах кабинета и заказа. */ });
})();
