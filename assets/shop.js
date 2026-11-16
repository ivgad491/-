/* Корзина, профиль и управление. Все права, цены и переходы статусов проверяет сервер. */
'use strict';

(() => {
  const F = window.Forma;
  if (!F) return;
  const categories = { kitchens: 'Кухни', wardrobes: 'Шкафы', living: 'Гостиные' };
  const statuses = { new: 'Новая заявка', confirmed: 'Подтверждён', production: 'В работе', ready: 'Готов к получению', completed: 'Завершён', cancelled: 'Отменён' };
  const transitions = { new: ['confirmed', 'cancelled'], confirmed: ['production', 'cancelled'], production: ['ready'], ready: ['completed'], completed: [], cancelled: [] };
  const date = value => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const decorate = node => { if (/(?:^|\s)(?:button|text-link|product-request)(?:\s|$)/.test(node.className)) F.decorateAction?.(node); return node; };
  const setActionText = (node, text) => { node.textContent = text; return decorate(node); };
  const link = (text, href, className = 'text-link') => { const node = el('a', className, text); node.href = href; return decorate(node); };
  const button = (text, handler, className = 'button') => { const node = el('button', className, text); node.type = 'button'; if (handler) node.addEventListener('click', handler); return decorate(node); };
  const message = (text, className = 'shop-notice') => { const node = el('p', className, text); node.setAttribute('role', className.includes('error') ? 'alert' : 'status'); return node; };
  const errorText = error => error?.message || 'Что-то пошло не так. Повторите попытку позже.';
  const submitButton = text => { const node = button(text); node.type = 'submit'; return node; };
  function field(label, name, type = 'text', value = '') {
    const wrap = el('label', 'shop-field'); wrap.append(el('span', '', label));
    const input = el(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    input.name = name; input.value = value || ''; wrap.append(input);
    return { wrap, input };
  }
  function consent() {
    const wrap = el('label', 'shop-consent'); const input = el('input'); input.type = 'checkbox'; input.name = 'consent'; input.required = true;
    const text = el('span'); text.append('Согласен на обработку тестовых данных по отдельному ', link('согласию', 'consent.html', 'inline-link'), ' (проект). Ввожу только вымышленные имя, телефон и адрес.');
    wrap.append(input, text); return { wrap, input };
  }
  function termsConfirmation() {
    const wrap = el('label', 'shop-consent'); const input = el('input'); input.type = 'checkbox'; input.name = 'termsAccepted'; input.required = true;
    const text = el('span'); text.append('Отдельно ознакомлен с ', link('правилами тестовой заявки', 'terms.html', 'inline-link'), '. Это не покупка и не согласие на рекламу.');
    wrap.append(input, text); return { wrap, input };
  }
  function showFailure(root, error, retry) {
    root.replaceChildren(message(errorText(error), 'shop-error'));
    if (retry) root.append(button('Попробовать снова', retry, 'button button--light'));
  }
  function signInPanel(returnTo) {
    if (window.FormaPages) {
      const panel = el('section', 'paper-panel');
      panel.append(el('h2', '', 'Оформление недоступно в демонстрации'), el('p', 'muted-copy', 'В этой версии можно посмотреть мебель, изменить корзину и выбрать направление доставки. Регистрация, заказы и административное управление работают только с подключённым сервером.'), link('Посмотреть доставку', 'delivery.html', 'button button--light'));
      return panel;
    }
    const panel = el('section', 'paper-panel'); panel.append(el('h2', '', 'Войдите, чтобы продолжить'), el('p', 'muted-copy', 'Вход и подтверждение аккаунта проходят через ChatGPT. Затем вы заполните профиль покупателя. Магазин не запрашивает и не хранит ваш пароль.'));
    const signin = link('Войти / зарегистрироваться через ChatGPT', `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`, 'button'); signin.target = '_top'; panel.append(signin); return panel;
  }
  function signoutLink() { const out = link('Выйти из аккаунта', '/signout-with-chatgpt?return_to=%2F', 'small-link'); out.target = '_top'; return out; }
  function statusBadge(status) { return el('span', `order-status order-status--${status}`, statuses[status] || 'Уточняется'); }

  // Only public destination preferences travel between pages. Contact details,
  // address and comments never enter URLs or browser storage.
  const pagesCartPath = new URL('cart.html', document.baseURI).pathname;
  function cartPath(value = location.href) {
    try {
      const target = new URL(value, document.baseURI);
      if (target.origin !== location.origin || target.pathname !== pagesCartPath) return pagesCartPath;
      const query = new URLSearchParams();
      const cityId = target.searchParams.get('cityId');
      const method = target.searchParams.get('method');
      if (cityId && /^[a-zA-Z0-9-]{1,80}$/.test(cityId)) {
        query.set('cityId', cityId);
        if (['courier', 'terminal', 'pickup'].includes(method)) query.set('method', method);
      }
      const queryString = query.toString();
      return pagesCartPath + (queryString ? '?' + queryString : '');
    } catch (_) { return pagesCartPath; }
  }


  let cityPickerSequence = 0;
  // Полный справочник ищет сервер. В форме сохраняется ID выбранного варианта,
  // а не произвольный текст: одинаковые названия различаются по региону.
  function cityPicker(onSelect, onClear) {
    const sequence = ++cityPickerSequence;
    const root = el('div', 'city-picker');
    const city = field('Город получения *', 'city', 'search');
    const list = el('div', 'city-results');
    const help = el('p', 'small-copy city-search-hint', 'Начните вводить название города или региона — например, «М» или «Моск». Затем выберите подсказку.');
    const status = el('p', 'city-search-status');
    const retry = button('Повторить поиск', () => { input.focus(); search(); }, 'small-link city-search-retry'); retry.hidden = true;
    const input = city.input;
    input.required = true; input.maxLength = 80; input.autocomplete = 'off'; input.spellcheck = false;
    input.placeholder = 'Начните с первой буквы';
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', `city-results-${sequence}`);
    input.setAttribute('aria-describedby', `city-help-${sequence} city-status-${sequence}`);
    input.setCustomValidity('Выберите город из списка подсказок.');
    list.id = `city-results-${sequence}`; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Города и регионы'); list.hidden = true;
    help.id = `city-help-${sequence}`; status.id = `city-status-${sequence}`; status.setAttribute('aria-live', 'polite');
    const directoryLink = link('О справочнике городов', 'city-directory.html', 'small-link city-directory-link');
    root.append(city.wrap, list, help, status, retry, directoryLink);
    let matches = []; let activeIndex = -1; let queryGeneration = 0; let timer = null; let blurTimer = null; let selected = null;

    function close() {
      list.hidden = true; input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant'); activeIndex = -1;
      for (const option of list.children) option.setAttribute('aria-selected', 'false');
    }
    function setActive(index) {
      activeIndex = index;
      for (let i = 0; i < list.children.length; i++) list.children[i].setAttribute('aria-selected', String(i === index));
      const active = list.children[index];
      if (active) { input.setAttribute('aria-activedescendant', active.id); active.scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    function selectCity(candidate, notify = true) {
      clearTimeout(timer); queryGeneration++;
      selected = candidate; input.value = `${candidate.name}, ${candidate.region}`;
      input.setCustomValidity(''); close(); retry.hidden = true;
      status.textContent = `Выбран город: ${candidate.name}, ${candidate.region}.`;
      if (notify) onSelect(candidate);
    }
    async function search() {
      const query = input.value.trim(); const ownGeneration = ++queryGeneration;
      close(); retry.hidden = true;
      if (!query) { status.textContent = ''; return; }
      status.textContent = 'Ищем города…';
      try {
        const data = await F.api(`/api/cities?q=${encodeURIComponent(query)}`);
        if (ownGeneration !== queryGeneration || selected) return;
        matches = data.cities || []; list.replaceChildren(); activeIndex = -1;
        for (const [index, candidate] of matches.entries()) {
          const option = button('', () => selectCity(candidate), 'city-option');
          option.id = `city-option-${sequence}-${index}`; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false'); option.tabIndex = -1;
          option.append(el('strong', '', candidate.name), el('span', '', candidate.region));
          option.addEventListener('pointerdown', event => event.preventDefault());
          list.append(option);
        }
        if (!matches.length) { close(); status.textContent = 'Город не найден. Проверьте название или попробуйте указать регион.'; return; }
        list.hidden = false; input.setAttribute('aria-expanded', 'true');
        status.textContent = data.hasMore ? `Найдено ${data.total} городов. Показаны первые ${matches.length}; введите больше букв для уточнения.` : `Найдено городов: ${matches.length}. Выберите город и регион из списка.`;
      } catch (error) {
        if (ownGeneration !== queryGeneration) return;
        close(); status.textContent = errorText(error); retry.hidden = false;
      }
    }
    input.addEventListener('input', () => {
      clearTimeout(timer); queryGeneration++; selected = null; matches = []; close(); retry.hidden = true;
      input.setCustomValidity('Выберите город из списка подсказок.'); status.textContent = ''; onClear();
      if (input.value.trim()) timer = setTimeout(search, 180);
    });
    input.addEventListener('focus', () => {
      clearTimeout(blurTimer);
      if (!selected && matches.length) { list.hidden = false; input.setAttribute('aria-expanded', 'true'); }
    });
    input.addEventListener('blur', () => { blurTimer = setTimeout(close, 120); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { close(); return; }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && matches.length && !selected) {
        event.preventDefault(); list.hidden = false; input.setAttribute('aria-expanded', 'true');
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive(activeIndex < 0 ? (step > 0 ? 0 : matches.length - 1) : (activeIndex + step + matches.length) % matches.length);
      } else if (event.key === 'Enter' && !list.hidden) {
        event.preventDefault();
        if (activeIndex >= 0 && matches[activeIndex]) selectCity(matches[activeIndex]);
        else status.textContent = 'Выберите подходящий город из списка подсказок.';
      }
    });
    return { root, input, getSelected: () => selected, setSelected: candidate => selectCity(candidate, false) };
  }

  // Delivery can be explored before a customer profile is created. These are
  // request options, not a simulated carrier booking or a quoted tariff.
  function deliveryPage(root) {
    let generation = 0;
    const panel = el('section', 'paper-panel delivery-selector');
    panel.append(el('h2', '', 'Куда нужна мебель?'));
    const result = el('section', 'delivery-result');
    result.setAttribute('aria-live', 'polite');
    const initial = () => result.replaceChildren(message('Выберите город из подсказок — здесь появятся варианты получения.'));
    const picker = cityPicker(load, () => { generation++; initial(); });
    panel.append(picker.root);
    root.replaceChildren(panel, result);
    initial();
    async function load(candidate) {
      const requestGeneration = ++generation;
      result.replaceChildren(message('Проверяем способы получения…'));
      try {
        const data = await F.api(`/api/delivery-options?cityId=${encodeURIComponent(candidate.id)}`);
        if (requestGeneration !== generation) return;
        const heading = el('div', 'delivery-result-heading');
        heading.append(el('p', 'eyebrow', data.city.region), el('h2', '', data.city.name));
        const grid = el('div', 'delivery-option-grid');
        for (const option of data.options) {
          const card = el('article', 'paper-panel delivery-option-card');
          const query = new URLSearchParams({ cityId: data.city.id, method: option.id });
          card.append(el('span', 'delivery-option-label', 'Условия требуют подтверждения'), el('h3', '', option.label), el('p', '', option.description), link('Выбрать этот способ', cartPath(pagesCartPath + '?' + query), 'button button--light'));
          grid.append(card);
        }
        result.replaceChildren(heading, grid, el('p', 'small-copy', data.notice));
      } catch (error) {
        if (requestGeneration !== generation) return;
        showFailure(result, error, () => load(candidate));
      }
    }
  }

  // Карточки всегда получают актуальные данные с сервера. Примеры HTML остаются запасным содержимым.
  async function catalogPage() {
    const grid = document.querySelector('.product-grid'); if (!grid) return;
    let selected = new URLSearchParams(location.search).get('category') || 'all';
    const controls = [...document.querySelectorAll('[data-filter]')];
    const availableCategories = new Set(['all', ...Object.keys(categories)]); if (!availableCategories.has(selected)) selected = 'all';
    function filter() {
      let visible = 0;
      for (const card of grid.children) { card.hidden = selected !== 'all' && card.dataset.category !== selected; if (!card.hidden) visible++; }
      controls.forEach(control => { const active = control.dataset.filter === selected; control.classList.toggle('is-active', active); control.setAttribute('aria-pressed', String(active)); });
      const count = document.querySelector('.collection-count'); if (count) count.textContent = `${visible} ${visible === 1 ? 'модель' : visible > 1 && visible < 5 ? 'модели' : 'моделей'}`;
    }
    controls.forEach(control => control.addEventListener('click', () => { selected = control.dataset.filter; filter(); }));
    document.querySelectorAll('[data-category-link]').forEach(control => control.addEventListener('click', () => { selected = control.dataset.categoryLink; filter(); }));
    try {
      const data = await F.api('/api/catalog');
      grid.replaceChildren();
      const products = data.products.filter(product => product.active);
      for (const product of products) {
        const card = el('article', 'product-card'); card.dataset.category = product.category;
        const imageWrap = el('div', 'product-image'); const image = el('img'); image.src = product.image; image.alt = product.name; image.loading = 'lazy'; image.width = 900; image.height = 700;
        imageWrap.append(image, el('span', 'product-tag', categories[product.category] || 'Мебель'));
        const heading = el('div', 'product-heading'); heading.append(el('h3', '', product.name), el('span', '', F.money(product.price)));
        const actions = el('div', 'product-shop-actions');
        actions.append(button('В корзину +', () => F.addToCart(product.id), 'product-request product-add'), button('Оставить заявку', () => {
          const alreadySelected = F.getCart().some(item => item.productId === product.id);
          if (F.addToCart(product.id) || alreadySelected) location.href = 'cart.html';
        }, 'product-request'));
        card.append(imageWrap, heading, el('p', '', product.description), actions); grid.append(card);
      }
      const allCount = controls.find(control => control.dataset.filter === 'all')?.querySelector('span'); if (allCount) allCount.textContent = String(products.length).padStart(2, '0');
      if (!products.length) grid.append(message('В каталоге пока нет доступных моделей.'));
      filter();
    } catch (error) {
      // Не предлагаем заказывать по устаревшим HTML-ценам при недоступном каталоге.
      grid.querySelectorAll('button').forEach(control => { control.disabled = true; control.removeAttribute('data-request'); });
      grid.before(message(`${errorText(error)} Оформление станет доступно после загрузки каталога.`, 'shop-error'));
      filter();
    }
  }

  async function cartPage(root) {
    if (root.cartListener) window.removeEventListener('forma:cart', root.cartListener);
    try {
      const [catalog, identity] = await Promise.all([F.api('/api/catalog'), F.getMe()]);
      const products = new Map(catalog.products.map(product => [product.id, product]));
      const layout = el('div', 'cart-layout'); const listPanel = el('section', 'paper-panel cart-list-panel');
      const list = el('div', 'cart-lines'); const top = el('div', 'panel-heading');
      top.append(el('h2', '', 'Выбранные модели'), button('Очистить', () => { if (confirm('Убрать все модели из корзины?')) F.clearCart(); }, 'small-link'));
      listPanel.append(top, el('p', 'small-copy', 'В одном заказе — до 20 единиц одной модели и до 50 единиц мебели всего.'), list);
      const side = el('aside', 'paper-panel checkout-panel'); side.append(el('h2', '', 'Заявка на заказ'));
      const summary = el('div', 'cart-summary'); side.append(summary, el('p', 'small-copy', 'Итог предварительный. Стоимость и сроки доставки согласуются отдельно и в сумму не включены. Оплата на сайте не выполняется.'));
      layout.append(listPanel, side); root.replaceChildren(layout);
      let submit = null;
      let inFlight = false;
      let deliveryReady = () => true;
      let restoreDelivery = async () => {};
      const form = el('form', 'shop-form checkout-form'); const feedback = el('div', 'form-feedback'); feedback.setAttribute('aria-live', 'polite');
      const profilePath = 'account.html?return_to=' + encodeURIComponent(cartPath());
      if (!identity.user) side.append(signInPanel(cartPath()));
      else if (!identity.profile) {
        side.append(message('Для оформления заполните имя и телефон в профиле покупателя.'), link('Зарегистрировать профиль', profilePath, 'button'), link('Посмотреть доставку по городам', 'delivery.html', 'small-link'));
      } else {
        const contact = el('div', 'checkout-contact'); contact.append(el('h3', '', 'Получатель'), el('p', '', `${identity.profile.name} · ${identity.profile.phone}`), link('Изменить профиль', profilePath, 'small-link')); form.append(contact);
        let selectedCity = null; let deliveryOptions = []; let optionsGeneration = 0;
        const methodWrap = el('label', 'shop-field'); methodWrap.append(el('span', '', 'Способ получения *'));
        const method = el('select'); method.name = 'method'; method.required = true; method.disabled = true;
        const methodPlaceholder = () => { const option = el('option', '', 'Сначала выберите город'); option.value = ''; method.replaceChildren(option); };
        methodPlaceholder(); methodWrap.append(method);
        const address = field('Адрес курьерской доставки *', 'address', 'textarea'); address.wrap.hidden = true; address.input.required = false; address.input.minLength = 8; address.input.maxLength = 300; address.input.autocomplete = 'street-address'; address.input.rows = 3; address.input.placeholder = 'Улица, дом, квартира — в выбранном городе';
        const deliveryDescription = el('p', 'delivery-description'); deliveryDescription.hidden = true;
        const deliveryNotice = el('p', 'small-copy delivery-notice'); deliveryNotice.hidden = true; deliveryNotice.setAttribute('aria-live', 'polite');
        const deliveryRetry = button('Повторить загрузку способов получения', () => loadDeliveryOptions(selectedCity), 'small-link'); deliveryRetry.hidden = true;
        function refreshDeliveryView() {
          const option = deliveryOptions.find(candidate => candidate.id === method.value);
          address.wrap.hidden = !option?.requiresAddress; address.input.required = Boolean(option?.requiresAddress);
          deliveryDescription.textContent = option?.description || ''; deliveryDescription.hidden = !option;
          renderLines();
        }
        function updateDestinationUrl() {
          const query = new URLSearchParams();
          if (selectedCity) {
            query.set('cityId', selectedCity.id);
            if (deliveryReady()) query.set('method', method.value);
          }
          const queryString = query.toString();
          try { history.replaceState(null, '', pagesCartPath + (queryString ? '?' + queryString : '')); } catch (_) { /* Checkout still works when history is unavailable. */ }
        }
        async function loadDeliveryOptions(candidate, preferredMethod = '') {
          if (!candidate) return;
          const generation = ++optionsGeneration;
          deliveryOptions = []; method.disabled = true; methodPlaceholder(); deliveryRetry.hidden = true;
          deliveryNotice.hidden = false; deliveryNotice.textContent = 'Проверяем способы получения для выбранного города…'; refreshDeliveryView();
          try {
            const data = await F.api(`/api/delivery-options?cityId=${encodeURIComponent(candidate.id)}`);
            if (generation !== optionsGeneration || selectedCity?.id !== candidate.id) return;
            selectedCity = data.city;
            city.setSelected(data.city);
            deliveryOptions = data.options || [];
            method.replaceChildren();
            const placeholder = el('option', '', deliveryOptions.length ? 'Выберите способ получения' : 'Нет доступных способов'); placeholder.value = ''; method.append(placeholder);
            for (const candidate of deliveryOptions) { const option = el('option', '', candidate.label); option.value = candidate.id; method.append(option); }
            method.disabled = !deliveryOptions.length;
            if (deliveryOptions.some(option => option.id === preferredMethod)) method.value = preferredMethod;
            updateDestinationUrl();
            deliveryNotice.textContent = data.notice || 'Возможность перевозки, стоимость и сроки подтверждаются отдельно.'; refreshDeliveryView();
          } catch (error) {
            if (generation !== optionsGeneration) return;
            deliveryNotice.textContent = errorText(error); deliveryRetry.hidden = false; refreshDeliveryView();
          }
        }
        const city = cityPicker(candidate => {
          selectedCity = candidate; feedback.replaceChildren(); loadDeliveryOptions(candidate);
        }, () => {
          selectedCity = null; optionsGeneration++; deliveryOptions = []; method.disabled = true; methodPlaceholder();
          address.input.value = ''; deliveryNotice.hidden = true; deliveryRetry.hidden = true; updateDestinationUrl(); refreshDeliveryView();
        });
        deliveryReady = () => Boolean(selectedCity && deliveryOptions.some(option => option.id === method.value));
        method.addEventListener('change', () => { updateDestinationUrl(); refreshDeliveryView(); });
        restoreDelivery = async () => {
          const preference = new URL(cartPath(), document.baseURI);
          const id = preference.searchParams.get('cityId');
          if (!id) return;
          selectedCity = { id };
          await loadDeliveryOptions(selectedCity, preference.searchParams.get('method') || '');
        };
        const comment = field('Пожелания к заказу', 'comment', 'textarea'); comment.input.maxLength = 1000; comment.input.rows = 3; comment.input.placeholder = 'Размеры, материалы или другие детали';
        const approval = consent(); const terms = termsConfirmation(); submit = submitButton('Оставить тестовую заявку');
        form.append(city.root, methodWrap, address.wrap, deliveryDescription, deliveryNotice, deliveryRetry, comment.wrap, approval.wrap, terms.wrap, submit, feedback); side.append(form);
        let pendingKey = null; let previousFingerprint = null;
        form.addEventListener('submit', async event => {
          event.preventDefault();
          if (inFlight) return;
          feedback.replaceChildren();
          const items = F.getCart();
          if (!items.length || items.some(item => !products.get(item.productId)?.active)) { feedback.append(message('Проверьте корзину: в ней есть недоступные модели или она пуста.', 'shop-error')); return; }
          const selectedOption = deliveryOptions.find(option => option.id === method.value);
          if (!selectedCity || !selectedOption) { feedback.append(message('Выберите город из подсказок и способ получения.', 'shop-error')); city.input.focus(); return; }
          const expectedTotal = items.reduce((sum, item) => sum + products.get(item.productId).price * item.quantity, 0);
          const payload = { items, expectedTotal, delivery: { method: selectedOption.id, cityId: selectedCity.id, address: selectedOption.requiresAddress ? address.input.value.trim() : '' }, comment: comment.input.value.trim(), consent: approval.input.checked, consentVersion: identity.legal?.consentVersion, termsAccepted: terms.input.checked, termsVersion: identity.legal?.termsVersion };
          const fingerprint = JSON.stringify(payload);
          if (!pendingKey || fingerprint !== previousFingerprint) { pendingKey = crypto.randomUUID(); previousFingerprint = fingerprint; }
          inFlight = true; submit.disabled = true; setActionText(submit, 'Сохраняем заявку…');
          try {
            const data = await F.api('/api/orders', { method: 'POST', body: { ...payload, idempotencyKey: pendingKey } });
            window.removeEventListener('forma:cart', renderLines);
            F.clearCart();
            const success = el('section', 'paper-panel order-success');
            const title = el('h2', '', `Заявка № ${data.order.number} сохранена`); title.tabIndex = -1;
            success.append(el('p', 'eyebrow', 'ГОТОВО'), title, el('p', 'muted-copy', 'Это тестовая заявка без оплаты. Её состав и актуальный статус доступны в личном кабинете.'), orderCard(data.order), link('Перейти в личный кабинет', 'account.html', 'button'), link('Вернуться к каталогу', 'index.html#collection', 'text-link'));
            root.replaceChildren(success); title.focus();
          } catch (error) { feedback.append(message(errorText(error), 'shop-error')); if (error.code === 'PRICE_CHANGED') feedback.append(button('Обновить цены и проверить заявку', () => cartPage(root), 'button button--light')); inFlight = false; renderLines(); setActionText(submit, 'Повторить сохранение заявки'); }
        });
      }
      function renderLines() {
        list.replaceChildren(); const items = F.getCart();
        const quantityTotal = items.reduce((sum, item) => sum + item.quantity, 0);
        let total = 0; let invalid = false;
        for (const item of items) {
          const product = products.get(item.productId); const row = el('article', 'cart-line');
          if (product) { const img = el('img'); img.src = product.image; img.alt = product.name; img.width = 160; img.height = 140; row.append(img); }
          const details = el('div', 'cart-line-info'); details.append(el('h3', '', product?.name || 'Модель недоступна'));
          if (!product?.active) { invalid = true; details.append(el('p', 'unavailable-copy', 'Сейчас недоступно. Уберите модель для оформления.')); }
          else { details.append(el('p', 'muted-copy', `${F.money(product.price)} за единицу`)); total += product.price * item.quantity; }
          const bottom = el('div', 'cart-line-bottom');
          const stepper = el('div', 'quantity-control'); stepper.setAttribute('aria-label', 'Количество');
          const minus = button('−', () => F.setQuantity(item.productId, item.quantity - 1), 'quantity-button'); minus.setAttribute('aria-label', `Уменьшить количество: ${product?.name || 'модель'}`);
          const maximum = Math.min(F.cartLimits.perProduct, F.cartLimits.total - (quantityTotal - item.quantity));
          const quantity = el('input'); quantity.type = 'number'; quantity.min = '1'; quantity.max = String(maximum); quantity.step = '1'; quantity.inputMode = 'numeric'; quantity.value = String(item.quantity); quantity.setAttribute('aria-label', `Количество: ${product?.name || 'модель'}`);
          quantity.addEventListener('change', () => F.setQuantity(item.productId, quantity.value));
          const plus = button('+', () => F.setQuantity(item.productId, item.quantity + 1), 'quantity-button'); plus.disabled = item.quantity >= maximum; plus.setAttribute('aria-label', `Увеличить количество: ${product?.name || 'модель'}`);
          stepper.append(minus, quantity, plus); bottom.append(stepper, button('Убрать', () => F.setQuantity(item.productId, 0), 'small-link'));
          details.append(bottom); row.append(details); if (product?.active) row.append(el('strong', 'cart-line-total', F.money(product.price * item.quantity))); list.append(row);
        }
        if (!items.length) { const empty = el('div', 'empty-state'); empty.append(el('h3', '', 'Ваша корзина пока пуста'), el('p', 'muted-copy', 'Начните с модели, которая нравится.'), link('Выбрать мебель', 'index.html#collection', 'button button--light')); list.append(empty); }
        summary.replaceChildren(el('span', '', 'Предварительная сумма'), el('strong', '', F.money(total)));
        if (submit) submit.disabled = inFlight || !items.length || invalid || !deliveryReady();
      }
      renderLines(); root.cartListener = renderLines; window.addEventListener('forma:cart', renderLines);
      await restoreDelivery();
    } catch (error) { showFailure(root, error, () => cartPage(root)); }
  }

  function orderCard(order, admin = false) {
    const card = el('article', 'order-card'); const heading = el('div', 'order-card-heading'); const title = el('div'); title.append(el('h3', '', `Заявка № ${order.number}`), el('p', 'small-copy', date(order.createdAt))); heading.append(title, statusBadge(order.status));
    const total = el('div', 'order-total'); total.append(el('span', '', 'Предварительный итог'), el('strong', '', F.money(order.total)));
    const details = el('details', 'order-details'); details.append(el('summary', '', 'Состав и данные заявки'));
    const content = el('div', 'order-details-content');
    const items = el('ul', 'order-item-list'); for (const item of order.items) items.append(el('li', '', `${item.name} × ${item.quantity} — ${F.money(item.unitPrice * item.quantity)}`)); content.append(items);
    if (order.customer) content.append(el('p', '', `${order.customer.name} · ${order.customer.phone}`));
    if (admin && order.customer?.email) content.append(el('p', 'small-copy', order.customer.email));
    const delivery = order.delivery || {};
    if (delivery.city) content.append(el('p', 'order-delivery-city', `Город получения: ${delivery.city.name}, ${delivery.city.region}`));
    if (delivery.method === 'terminal') {
      content.append(el('p', '', 'Получение: грузовой терминал транспортной компании.'), el('p', 'small-copy', 'Перевозчик, адрес терминала, стоимость и сроки согласуются до подтверждения заявки. Доставка до двери не включена.'));
    } else if (delivery.method === 'pickup') {
      content.append(el('p', '', 'Получение: самовывоз в Краснодаре, место и время согласуются.'));
    } else {
      content.append(el('p', '', `Курьерская доставка: ${delivery.address || 'адрес уточняется'}`));
    }
    if (order.comment) content.append(el('p', 'order-comment', `Пожелания: ${order.comment}`));
    details.append(content); card.append(heading, total, details); return card;
  }

  async function accountPage(root) {
    try {
      const identity = await F.getMe(); root.replaceChildren();
      const destination = cartPath(new URLSearchParams(location.search).get('return_to') || pagesCartPath);
      const accountReturn = new URLSearchParams(location.search).has('return_to') ? '/account.html?return_to=' + encodeURIComponent(destination) : '/account.html';
      if (!identity.user) { root.append(signInPanel(accountReturn)); return; }
      const layout = el('div', 'account-layout');
      const profile = el('section', 'paper-panel'); profile.append(el('p', 'eyebrow', identity.profile ? 'ВАШ ПРОФИЛЬ' : 'РЕГИСТРАЦИЯ ПОКУПАТЕЛЯ'), el('h2', '', identity.profile ? 'Контактные данные' : 'Давайте познакомимся'), el('p', 'small-copy', `Аккаунт подтверждён через ChatGPT: ${identity.user.email}`));
      const initialName = identity.profile?.name || (identity.user.name === identity.user.email ? '' : identity.user.name);
      const form = el('form', 'shop-form'); const name = field('Ваше имя *', 'name', 'text', initialName); name.input.required = true; name.input.minLength = 2; name.input.maxLength = 80; name.input.autocomplete = 'given-name';
      const phone = field('Телефон *', 'phone', 'tel', identity.profile?.phone); phone.input.required = true; phone.input.maxLength = 25; phone.input.autocomplete = 'tel'; phone.input.inputMode = 'tel'; phone.input.placeholder = '+7 (___) ___-__-__';
      const approval = consent(); const submit = submitButton(identity.profile ? 'Сохранить изменения' : 'Создать профиль'); const feedback = el('div', 'form-feedback'); feedback.setAttribute('aria-live', 'polite');
      form.append(name.wrap, phone.wrap, el('p', 'small-copy', 'От 10 до 15 цифр. Для демонстрации используйте тестовые данные.'), approval.wrap, submit, feedback);
      form.addEventListener('submit', async event => {
        event.preventDefault(); feedback.replaceChildren(); submit.disabled = true;
        try {
          await F.api('/api/profile', { method: 'POST', body: { name: name.input.value.trim(), phone: phone.input.value.trim(), consent: approval.input.checked, consentVersion: identity.legal?.consentVersion } });
          await F.getMe(true); feedback.append(message('Профиль сохранён. Теперь можно оформлять тестовые заявки.'));
          setActionText(submit, 'Сохранить изменения');
          if (!feedback.querySelector('a')) feedback.append(link('Продолжить оформление в корзине', destination, 'button button--light'));
        } catch (error) { feedback.append(message(errorText(error), 'shop-error')); }
        finally { submit.disabled = false; }
      });
      profile.append(form, signoutLink()); if (identity.isAdmin) profile.append(link('Управление магазином', 'admin.html', 'text-link'));
      const history = el('section', 'account-history'); history.append(el('h2', '', 'Мои заявки'), el('p', 'small-copy', 'Здесь сохраняются состав и статус ваших заявок. Онлайн-оплата не подключена.'));
      layout.append(profile, history); root.append(layout);
      const historyItems = el('div', 'order-list'); historyItems.append(message('Загружаем историю…')); const historyPagination = el('div', 'admin-pagination'); history.append(historyItems, historyPagination);
      let historyCursor = null;
      async function loadHistory(append = false) {
        historyPagination.replaceChildren();
        try {
          const query = append && historyCursor ? `?cursor=${encodeURIComponent(historyCursor)}` : '';
          const data = await F.api(`/api/orders${query}`);
          if (!append) historyItems.replaceChildren();
          for (const order of data.orders) historyItems.append(orderCard(order));
          if (!data.orders.length && !append) {
            const empty = el('div', 'paper-panel empty-state');
            empty.append(el('h3', '', 'Пока ни одной заявки'), el('p', 'muted-copy', 'Добавьте понравившуюся мебель в корзину.'), link('Посмотреть коллекцию', 'index.html#collection', 'button button--light')); historyItems.append(empty);
          }
          historyCursor = data.nextCursor;
          if (data.hasMore && historyCursor) historyPagination.append(button('Показать ещё заявки', () => loadHistory(true), 'button button--light'));
        } catch (error) {
          if (append) historyPagination.append(message(errorText(error), 'shop-error'), button('Повторить загрузку', () => loadHistory(true), 'button button--light'));
          else showFailure(historyItems, error, () => loadHistory());
        }
      }
      await loadHistory();
    } catch (error) { showFailure(root, error, () => accountPage(root)); }
  }

  async function adminPage(root) {
    try {
      const identity = await F.getMe(); root.replaceChildren();
      if (!identity.user) { root.append(signInPanel('/admin.html')); return; }
      if (!identity.isAdmin) { root.append(message('Доступ к управлению предоставлен только владельцу магазина. Сервер не разрешает вашему аккаунту читать и менять заказы других покупателей.', 'shop-error'), link('Открыть личный кабинет', 'account.html', 'button button--light')); return; }
      const summary = el('div', 'admin-summary');
      async function loadSummary() { try { const data = await F.api('/api/admin/summary'); summary.replaceChildren(); for (const [label, value] of [['Новых заявок', data.newCount], ['Всего заявок', data.totalCount], ['Активных моделей', data.activeProducts]]) { const stat = el('div', 'paper-panel admin-stat'); stat.append(el('strong', '', String(value)), el('span', '', label)); summary.append(stat); } } catch (error) { summary.replaceChildren(message(errorText(error), 'shop-error')); } }
      root.append(summary); await loadSummary();
      const tabs = el('div', 'admin-tabs'); const ordersButton = button('Заявки', () => showOrders(), 'admin-tab is-active'); const catalogButton = button('Товары', () => showProducts(), 'admin-tab');
      tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Разделы управления'); tabs.append(ordersButton, catalogButton);
      const panel = el('section', 'admin-content-panel'); root.append(tabs, panel);
      function selectTab(active) { for (const tab of [ordersButton, catalogButton]) { const selected = tab === active; tab.classList.toggle('is-active', selected); tab.setAttribute('aria-pressed', String(selected)); } }
      async function showOrders() {
        selectTab(ordersButton); panel.replaceChildren();
        const toolbar = el('div', 'admin-toolbar'); toolbar.append(el('h2', '', 'Заявки покупателей'));
        const statusFilter = el('select'); statusFilter.setAttribute('aria-label', 'Фильтр по статусу');
        for (const [value, label] of [['', 'Все статусы'], ...Object.entries(statuses)]) { const option = el('option', '', label); option.value = value; statusFilter.append(option); }
        toolbar.append(statusFilter); const list = el('div', 'order-list admin-orders'); const pagination = el('div', 'admin-pagination'); panel.append(toolbar, list, pagination);
        let cursor = null; let generation = 0;
        async function load(append = false) {
          const ownGeneration = ++generation; pagination.replaceChildren(); if (!append) list.replaceChildren(message('Загружаем заявки…'));
          try {
            const query = new URLSearchParams(); if (statusFilter.value) query.set('status', statusFilter.value); if (append && cursor) query.set('cursor', cursor);
            const data = await F.api(`/api/admin/orders?${query}`); if (ownGeneration !== generation) return;
            if (!append) list.replaceChildren();
            for (const order of data.orders) list.append(adminOrderCard(order));
            if (!data.orders.length && !append) list.append(message('Заявок с таким статусом пока нет.'));
            cursor = data.nextCursor;
            if (data.hasMore && cursor) pagination.append(button('Показать ещё', () => load(true), 'button button--light'));
          } catch (error) { if (!append) showFailure(list, error, () => load()); else pagination.append(message(errorText(error), 'shop-error'), button('Повторить', () => load(true), 'button button--light')); }
        }
        statusFilter.addEventListener('change', () => { cursor = null; load(); }); await load();
      }
      function adminOrderCard(order) {
        const card = orderCard(order, true); const nextStates = transitions[order.status] || [];
        if (!nextStates.length) return card;
        const form = el('form', 'admin-status-form'); const select = el('select'); select.setAttribute('aria-label', `Новый статус заявки ${order.number}`);
        for (const value of nextStates) { const option = el('option', '', statuses[value]); option.value = value; select.append(option); }
        const save = submitButton('Изменить статус'); const feedback = el('div', 'form-feedback'); feedback.setAttribute('aria-live', 'polite'); form.append(select, save, feedback);
        form.addEventListener('submit', async event => {
          event.preventDefault(); feedback.replaceChildren();
          if (select.value === 'cancelled' && !confirm(`Отменить заявку № ${order.number}? Это конечный статус.`)) return;
          save.disabled = true;
          try { const data = await F.api(`/api/admin/orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: { status: select.value, version: order.version } }); card.replaceWith(adminOrderCard(data.order)); F.notify('Статус обновлён'); loadSummary(); }
          catch (error) { feedback.append(message(errorText(error), 'shop-error')); save.disabled = false; }
        }); card.append(form); return card;
      }
      async function showProducts() {
        selectTab(catalogButton); panel.replaceChildren(el('h2', '', 'Каталог мебели'), el('p', 'small-copy', 'Цена указывается в рублях. Изменения сохраняются на сервере и используются для новых заявок. В уже оформленных заявках состав и цены остаются прежними.'));
        const list = el('div', 'admin-product-list'); list.append(message('Загружаем модели…')); panel.append(list);
        try {
          const data = await F.api('/api/catalog'); list.replaceChildren();
          for (const product of data.products) {
            const card = el('details', 'paper-panel admin-product'); const summary = el('summary'); const thumb = el('img'); thumb.src = product.image; thumb.alt = ''; thumb.width = 80; thumb.height = 70;
            const summaryCopy = el('span', 'admin-product-summary'); const title = el('strong', '', product.name); const currentPrice = el('span', '', `${F.money(product.price)} · ${product.active ? 'В каталоге' : 'Скрыто'}`); summaryCopy.append(title, currentPrice); summary.append(thumb, summaryCopy); card.append(summary);
            const form = el('form', 'shop-form admin-product-form');
            const name = field('Название *', 'name', 'text', product.name); name.input.required = true; name.input.minLength = 2; name.input.maxLength = 120;
            const description = field('Описание *', 'description', 'textarea', product.description); description.input.required = true; description.input.minLength = 5; description.input.maxLength = 1000; description.input.rows = 3;
            const price = field('Цена, ₽ *', 'price', 'number', (product.price / 100).toFixed(2)); price.input.required = true; price.input.min = '1'; price.input.max = '10000000'; price.input.step = '0.01'; price.input.inputMode = 'decimal';
            const activeLabel = el('label', 'shop-consent'); const active = el('input'); active.type = 'checkbox'; active.checked = product.active; activeLabel.append(active, el('span', '', 'Показывать модель в каталоге и разрешать заказ'));
            const save = submitButton('Сохранить модель'); const feedback = el('div', 'form-feedback'); feedback.setAttribute('aria-live', 'polite'); form.append(name.wrap, description.wrap, price.wrap, activeLabel, save, feedback);
            form.addEventListener('submit', async event => {
              event.preventDefault(); feedback.replaceChildren(); save.disabled = true;
              try { const data = await F.api(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'PATCH', body: { name: name.input.value.trim(), description: description.input.value.trim(), price: Math.round(Number(price.input.value) * 100), active: active.checked } }); title.textContent = data.product.name; currentPrice.textContent = `${F.money(data.product.price)} · ${data.product.active ? 'В каталоге' : 'Скрыто'}`; feedback.append(message('Модель сохранена.')); loadSummary(); }
              catch (error) { feedback.append(message(errorText(error), 'shop-error')); }
              finally { save.disabled = false; }
            }); card.append(form); list.append(card);
          }
        } catch (error) { showFailure(list, error, showProducts); }
      }
      await showOrders();
    } catch (error) { showFailure(root, error, () => adminPage(root)); }
  }

  const cartRoot = document.querySelector('#cart-content'); const accountRoot = document.querySelector('#account-content'); const adminRoot = document.querySelector('#admin-content');
  if (cartRoot) cartPage(cartRoot);
  if (accountRoot) accountPage(accountRoot);
  if (adminRoot) adminPage(adminRoot);
  const deliveryRoot = document.querySelector('#delivery-content');
  if (deliveryRoot) deliveryPage(deliveryRoot);
  if (document.querySelector('.product-grid')) catalogPage();
})();
