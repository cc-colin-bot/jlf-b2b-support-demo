/** CSS-isolated demo embed. It is not a B2B authentication or conversation API. */
export function mountB2BSupport({ container = document.body, src = new URL('./index.html', import.meta.url).href, onStateChange = () => {} } = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('A mount container is required.');
  const url = new URL(src, location.href);
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('Widget must be served over HTTP(S).');
  url.searchParams.set('embed', '1'); url.searchParams.set('parentOrigin', location.origin); url.searchParams.set('v', '0.4.0');
  const root = document.createElement('div'); root.dataset.jlfSupportWidget = 'demo-v02';
  Object.assign(root.style, { position: 'fixed', right: '16px', bottom: '16px', zIndex: '9999', width: '180px', height: '84px', maxWidth: '100vw' });
  const iframe = document.createElement('iframe'); iframe.title = '联合利丰智能客服（模拟原型）'; iframe.src = url.href;
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  Object.assign(iframe.style, { display: 'block', width: '100%', height: '100%', border: '0', borderRadius: '12px', background: 'transparent' });
  root.append(iframe); container.append(root);
  let destroyed = false, open = false, expanded = false, ready = false, pendingCommand = null;
  function resize() {
    const mobile = window.innerWidth <= 760;
    const height = window.visualViewport?.height || innerHeight;
    Object.assign(root.style, open ? {
      right: mobile ? '0' : '16px', bottom: mobile ? `${Math.max(0, innerHeight - height - (window.visualViewport?.offsetTop || 0))}px` : '16px',
      width: mobile ? '100vw' : `${Math.min(expanded ? 820 : 470, innerWidth - 32)}px`,
      height: mobile ? `${height}px` : `${Math.min(790, height - 32)}px`,
    } : { right: '16px', bottom: '16px', width: '180px', height: '84px' });
    iframe.style.borderRadius = open && mobile ? '0' : '12px';
  }
  function receive(event) {
    if (destroyed || event.source !== iframe.contentWindow || event.origin !== url.origin || event.data?.channel !== 'jlf-support-demo-v1' || event.data.type !== 'state' || typeof event.data.open !== 'boolean') return;
    open = event.data.open; expanded = event.data.expanded === true; resize();
    ready = true;
    if (pendingCommand) { const type = pendingCommand; pendingCommand = null; post(type); }
    onStateChange({ open, expanded, unread: Number.isInteger(event.data.unread) ? Math.max(0, event.data.unread) : 0 });
  }
  function post(type) {
    if (destroyed) return;
    if (!ready) { pendingCommand = type; return; }
    iframe.contentWindow?.postMessage({ channel: 'jlf-support-demo-v1', type }, url.origin);
  }
  window.addEventListener('message', receive); window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
  return {
    element: root,
    open() { post('open'); },
    minimize() { post('minimize'); },
    destroy() {
      if (destroyed) return; destroyed = true;
      window.removeEventListener('message', receive); window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); root.remove();
    },
  };
}
