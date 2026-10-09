/**
 * Ванильный JS для страниц /auth: класс is-filled на полях и появление карточки.
 * Вешается на оболочку auth-shell; события всплывают из дочерних форм.
 * @param {HTMLElement} root
 * @returns {() => void}
 */
export function enhanceAuthPage(root) {
  if (!root) {
    return () => undefined;
  }

  function syncFilled(el) {
    if (!(el instanceof HTMLInputElement)) return;
    if (el.type === 'checkbox' || el.type === 'radio') return;
    el.classList.toggle('is-filled', el.value.trim().length > 0);
  }

  function onInput(event) {
    syncFilled(event.target);
  }

  root.classList.add('auth-shell--ready');
  root.addEventListener('input', onInput);
  root.querySelectorAll('input').forEach(syncFilled);

  return function teardown() {
    root.removeEventListener('input', onInput);
    root.classList.remove('auth-shell--ready');
  };
}
