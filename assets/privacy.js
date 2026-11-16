/* Реальный выбор для необязательных функций; без аналитики и рекламных cookies. */
'use strict';
(() => {
  const key = 'forma-privacy-v1';
  const version = 'cookies-2026-11-15-v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  function parse(value) {
    try {
      const data = JSON.parse(value);
      return data?.version === version && typeof data.saveCart === 'boolean' && typeof data.externalMap === 'boolean' && Number.isFinite(data.expiresAt) && data.expiresAt > Date.now() ? data : null;
    } catch (_) { return null; }
  }
  let preferences = null;
  try { preferences = parse(localStorage.getItem(key)); } catch (_) { /* Выбор продолжит работать в этой вкладке. */ }
  const container = document.createElement('div');
  container.innerHTML = `<section class="privacy-banner" aria-label="Cookies и данные браузера" hidden><div><strong>Cookies и данные браузера</strong><p>Мы запоминаем ваш выбор настроек. Входа в аккаунт в этой версии нет. Сохранение корзины на устройстве и внешняя карта включаются по вашему выбору. <a href="cookies.html">Подробнее</a></p></div><div class="privacy-banner-actions"><button type="button" class="privacy-button" data-privacy-essential>Только необходимые</button><button type="button" class="privacy-button" data-privacy-cart>Сохранять корзину</button><button type="button" class="privacy-text-button" data-cookie-settings>Настроить</button></div></section><dialog class="privacy-dialog" aria-labelledby="privacy-title"><form class="privacy-form"><button type="button" class="privacy-close" aria-label="Закрыть настройки">×</button><p class="eyebrow">ВАШ ВЫБОР</p><h2 id="privacy-title">Настройки cookies</h2><p>Это статическая демонстрация без входа в аккаунт. Приложение запоминает выбор настроек. Рекламная аналитика на сайте не подключена.</p><label class="privacy-option"><input type="checkbox" checked disabled><span><strong>Необходимые технологии</strong><small>Запоминание выбранных настроек.</small></span></label><label class="privacy-option"><input type="checkbox" name="saveCart"><span><strong>Сохранение корзины</strong><small>Запоминать только модели и количество между посещениями. Имя, телефон и адрес в браузере не сохраняются.</small></span></label><label class="privacy-option"><input type="checkbox" name="externalMap"><span><strong>Карта OpenStreetMap</strong><small>Загружать внешнюю карту. При загрузке её сервер получает IP-адрес и технические сведения браузера.</small></span></label><p class="privacy-note">Выбор можно изменить в подвале сайта. Отключение сохранения удалит сохранённую корзину с устройства; в текущей вкладке она останется. Это не отменяет уже отправленные заявки.</p><div class="privacy-dialog-actions"><button type="button" class="privacy-button" data-privacy-essential>Только необходимые</button><button type="submit" class="privacy-button privacy-button--dark">Сохранить выбор</button></div><a href="cookies.html" class="privacy-details-link">Политика cookies и данных браузера</a></form></dialog>`;
  document.body.append(container);
  const banner = container.querySelector('.privacy-banner');
  const dialog = container.querySelector('dialog');
  const form = container.querySelector('form');
  function updateMaps() {
    document.querySelectorAll('[data-map-src]').forEach(frame => {
      const allowed = preferences?.externalMap === true;
      if (allowed && frame.getAttribute('src') !== frame.dataset.mapSrc) frame.setAttribute('src', frame.dataset.mapSrc);
      if (!allowed) frame.removeAttribute('src');
      frame.hidden = !allowed;
    });
    document.querySelectorAll('[data-map-placeholder]').forEach(node => { node.hidden = preferences?.externalMap === true; });
  }
  function update() {
    banner.hidden = preferences !== null;
    updateMaps();
  }
  function setPreferences(value) {
    preferences = { version, saveCart: value.saveCart === true, externalMap: value.externalMap === true, savedAt: Date.now(), expiresAt: Date.now() + lifetime };
    try { localStorage.setItem(key, JSON.stringify(preferences)); if (!preferences.saveCart) localStorage.removeItem('forma-cart-v1'); } catch (_) { /* Без доступа к хранилищу выбор действует в этой вкладке. */ }
    update();
    window.dispatchEvent(new CustomEvent('forma:privacy', { detail: { ...preferences } }));
    if (dialog.open) dialog.close();
    return { ...preferences };
  }
  function openSettings() {
    form.elements.saveCart.checked = preferences?.saveCart === true;
    form.elements.externalMap.checked = preferences?.externalMap === true;
    if (!dialog.open) dialog.showModal();
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-cookie-settings]')) openSettings();
    if (event.target.closest('[data-privacy-essential]')) setPreferences({ saveCart: false, externalMap: false });
    if (event.target.closest('[data-privacy-cart]')) setPreferences({ saveCart: true, externalMap: false });
    if (event.target.closest('[data-enable-map]')) setPreferences({ saveCart: preferences?.saveCart === true, externalMap: true });
  });
  form.addEventListener('submit', event => { event.preventDefault(); setPreferences({ saveCart: form.elements.saveCart.checked, externalMap: form.elements.externalMap.checked }); });
  container.querySelector('.privacy-close').addEventListener('click', () => dialog.close());
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    preferences = parse(event.newValue);
    update();
    window.dispatchEvent(new CustomEvent('forma:privacy', { detail: preferences ? { ...preferences } : null }));
  });
  document.addEventListener('click', event => { if (event.target.closest('[data-print-document]')) window.print(); });
  window.FormaPrivacy = { get: () => preferences ? { ...preferences } : null, set: setPreferences, open: openSettings };
  update();
})();
