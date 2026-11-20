import { ACCOUNTS, KNOWLEDGE, HOME_FAQS, publishedFaqs, sampleFaqs, MODE_LABELS, DemoConversationAdapter, visibleOrders } from './domain.js?v=0.4.0';

const $ = id => document.getElementById(id);
const adapter = new DemoConversationAdapter();
let state, lastState, isOpen = false, unread = 0, dialogKind = null, currentView = 'home', toastTimer;
let clientSequence = 0, forceScroll = false, newMessageCount = 0, waitTimer;
let faqBatch = [], faqCount = 0;
const params = new URLSearchParams(location.search);
const embedded = params.get('embed') === '1';
document.body.classList.toggle('embedded', embedded);
document.documentElement.classList.toggle('embedded-document', embedded);
let parentOrigin = null;
try { if (embedded && params.get('parentOrigin')) parentOrigin = new URL(params.get('parentOrigin')).origin; } catch { /* Invalid parent is not trusted. */ }
const icon = (name, small = false) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `icon${small ? ' small' : ''}`); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`); svg.append(use); return svg;
};
function el(tag, className = '', text) {
  const node = document.createElement(tag); if (className) node.className = className;
  if (text !== undefined) node.textContent = text; return node;
}
function button(text, className, handler) {
  const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', handler); return node;
}
function toast(text) {
  $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').hidden = true, 4200);
}
function status(order) {
  return el('span', `status-tag ${order.status === '运输中' ? 'transit' : order.status === '已签收' ? 'done' : 'wait'}`, order.status);
}
function showChat(open = true) {
  const wasOpen = isOpen;
  isOpen = open; $('supportPanel').hidden = !open; $('chatLauncher').hidden = open;
  $('chatLauncher').setAttribute('aria-expanded', String(open)); document.body.classList.toggle('chat-open', open);
  if (open) {
    unread = 0; $('unreadBadge').hidden = true;
    if (!wasOpen && state.messages.length === 1 && state.mode === 'ai') requestAnimationFrame(() => $('messages').scrollTop = 0);
    if (!wasOpen && matchMedia('(hover: hover)').matches) requestAnimationFrame(() => $('messageInput').focus({ preventScroll: true }));
  }
  else $('chatLauncher').focus();
  notifyParent();
}
function scrollMessages() { requestAnimationFrame(() => { $('messages').scrollTop = $('messages').scrollHeight; clearNewMessages(); }); }
function clearNewMessages() { newMessageCount = 0; $('newMessages').hidden = true; }
function notifyParent() {
  if (embedded && parentOrigin && parent !== window) parent.postMessage({ channel: 'jlf-support-demo-v1', type: 'state', open: isOpen, expanded: $('supportPanel').classList.contains('expanded'), unread }, parentOrigin);
}
function timeLabel(time) { return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(time); }
function receiveParent(event) {
  if (!embedded || event.source !== parent || event.origin !== parentOrigin || event.data?.channel !== 'jlf-support-demo-v1') return;
  if (event.data.type === 'open') showChat();
  if (event.data.type === 'minimize') showChat(false);
}
window.addEventListener('message', receiveParent);

function renderDashboard() {
  const account = state.account, orders = visibleOrders(account);
  $('profileName').textContent = account.contact;
  document.querySelector('.profile-avatar').textContent = account.contact[0];
  $('dashboardCompany').textContent = account.company;
  $('dashboardTitle').textContent = currentView === 'home' ? `您好，${account.contact}` : '我的订单';
  $('breadcrumbTitle').textContent = currentView === 'home' ? '工作台首页' : '我的订单';
  $('ordersTitle').textContent = currentView === 'home' ? '最近订单' : '我的订单';
  $('statsGrid').hidden = currentView !== 'home'; $('dashboardBottom').hidden = currentView !== 'home';
  $('navOrderCount').textContent = orders.length;
  $('statActive').replaceChildren(document.createTextNode(orders.filter(o => o.status !== '已签收').length), el('span', '', '单'));
  $('statWaiting').replaceChildren(document.createTextNode(orders.filter(o => o.status === '待入仓').length), el('span', '', '单'));
  $('statDone').replaceChildren(document.createTextNode(orders.filter(o => o.status === '已签收').length), el('span', '', '单'));
  const query = $('orderSearch').value.trim().toLowerCase();
  const filtered = orders.filter(o => `${o.id} ${o.goods} ${o.status}`.toLowerCase().includes(query));
  $('orderRows').replaceChildren();
  for (const order of filtered) {
    const row = el('tr'), info = el('td');
    info.append(el('span', 'order-id', order.id), el('span', 'order-goods', `${order.goods} · ${order.detail.split(' · ')[1]}`));
    const stateCell = el('td'); stateCell.append(status(order));
    const action = el('td'); action.append(button('咨询进度', 'text-button', () => askOrder(order.id)));
    row.append(info, el('td', 'muted', order.business), stateCell, el('td', 'muted', order.updated), action); $('orderRows').append(row);
  }
  if (!filtered.length) { const row = el('tr'), cell = el('td', 'empty-result', '没有匹配的演示订单，请更换搜索条件。'); cell.colSpan = 5; row.append(cell); $('orderRows').append(row); }
  $('orderCount').textContent = query ? `匹配 ${filtered.length} 笔 / 共 ${orders.length} 笔演示订单` : `共 ${orders.length} 笔演示订单`;
}

function renderWelcome() {
  const welcome = el('section', 'welcome');
  welcome.append(el('h3', '', '需要什么帮助？'), el('p', '', '查订单、问业务流程，直接告诉我。'));
  return welcome;
}
function renderHomeFaqs(reset = false) {
  const isHome = state.messages.length === 1 && state.mode === 'ai';
  $('homeFaqs').hidden = !isHome;
  if (!isHome) return;
  const viewportHeight = window.visualViewport?.height || innerHeight;
  const availableHeight = innerWidth <= 760 || embedded ? viewportHeight : Math.min(710, viewportHeight - 108);
  const count = availableHeight < 700 ? 2 : 4;
  const entries = publishedFaqs(HOME_FAQS);
  if (reset || !faqBatch.length || count !== faqCount) {
    faqBatch = sampleFaqs(entries, count, reset ? [] : faqBatch.map(e => e.id)); faqCount = count;
    $('faqList').replaceChildren();
    for (const faq of faqBatch) {
      const row = button(faq.question, 'faq-item', () => chooseFaq(faq.id)); row.dataset.faqId = faq.id;
      $('faqList').append(row);
    }
  }
  $('refreshFaqs').hidden = entries.length <= count;
  $('homeFaqs').hidden = !entries.length;
}
function chooseFaq(id) {
  if (state.mode !== 'ai' || state.busy) { toast('请先结束当前处理，再选择常见问题。'); return; }
  forceScroll = true;
  try { adapter.answerFaq(id, `faq-click-${++clientSequence}`); }
  catch { forceScroll = false; toast('这条问题暂不可用，请重新选择或联系人工。'); }
}
function orderResult(order, queriedAt) {
  const card = el('section', 'order-result'), head = el('div', 'order-result-head');
  card.setAttribute('aria-label', `${order.id} 演示订单进度`);
  head.append(el('strong', '', order.id), status(order));
  card.append(head, el('p', 'order-result-desc', order.detail));
  card.append(el('p', 'data-freshness', `演示数据更新：${order.updated} · 本次查询：${timeLabel(queriedAt)}`));
  const timeline = el('ol', 'timeline');
  order.nodes.forEach((node, index) => timeline.append(el('li', index < order.stage ? 'complete' : index === order.stage ? 'current' : '', node)));
  card.append(timeline, el('p', 'order-note', order.note));
  const actions = el('div', 'order-result-actions');
  actions.append(button('查看演示订单详情', 'text-button', () => showOrderDetails(order, queriedAt)));
  card.append(actions); return card;
}
function renderMessage(message) {
  const wrapper = el('article', `message ${message.role}`);
  wrapper.dataset.messageId = message.id;
  if (message.role === 'system') {
    wrapper.textContent = message.text;
    // The footer and About dialog keep the demo warning visible without a wall of onboarding text.
    wrapper.hidden = message.text.startsWith('B2B 演示会话已建立');
    return wrapper;
  }
  const sender = el('div', 'message-sender');
  if (message.role !== 'customer') sender.append(el('span', 'mini-avatar', message.role === 'staff' ? '人' : '智'));
  sender.append(document.createTextNode(message.role === 'customer' ? state.account.contact : message.role === 'staff' ? message.name : message.role === 'error' ? '模拟服务提示' : message.answer?.origin === 'faq' ? '标准答复 · 演示' : 'AI 助手 · 模拟'));
  const time = el('time', '', new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(message.time));
  time.dateTime = new Date(message.time).toISOString(); sender.append(time);
  const bubble = el('div', 'bubble', message.text);
  const answer = message.answer;
  if (answer?.kind === 'orders') {
    const orders = el('div', 'inline-orders');
    for (const order of answer.orders) {
      const b = button('', 'inline-order', () => askOrder(order.id)), copy = el('span'); b.dataset.orderId = order.id;
      copy.append(el('span', 'order-id', order.id), el('span', 'order-goods', order.goods));
      b.append(icon('box', true), copy, status(order)); b.disabled = state.mode === 'closed' || state.busy; orders.append(b);
    }
    bubble.append(orders);
  }
  if (answer?.kind === 'order') bubble.append(orderResult(answer.order, message.queriedAt || message.time));
  if (answer?.kind === 'order' || answer?.kind === 'orders') {
    const source = el('div', 'message-source'); source.append(icon('shield', true), document.createTextNode(`来源：本地虚构订单 · 非 ERP 实时数据 · 查询于 ${timeLabel(message.queriedAt || message.time)}`)); bubble.append(source);
  }
  if (answer?.kind === 'knowledge') {
    const source = el('div', 'message-source'); source.append(icon('book', true), button(`查看依据：${answer.source}（${answer.sourceId}）`, 'text-button knowledge-source', () => showKnowledge(answer.sourceId))); bubble.append(source);
  }
  if (message.role === 'error') bubble.append(button('重试这次查询', 'text-button', () => send(message.retryText)));
  wrapper.append(sender, bubble); return wrapper;
}
function updateComposer() {
  const disabled = !state || state.mode === 'closed' || state.busy;
  $('sendButton').disabled = disabled || !$('messageInput').value.trim();
  $('messageInput').disabled = state?.mode === 'closed';
}
function renderConversation(next) {
  const previous = lastState; state = next;
  const messages = $('messages');
  const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 90;
  const oldScrollTop = messages.scrollTop, reset = previous?.id !== state.id;
  const added = reset ? state.messages : state.messages.slice(previous.messages.length);
  $('supportPanel').classList.toggle('is-empty', state.messages.length === 1 && state.mode === 'ai');
  $('supportPanel').classList.toggle('manual-mode', state.mode === 'human' || state.mode === 'waiting');
  $('chatCompany').textContent = state.account.company;
  $('modeLabel').textContent = state.mode === 'human' ? `${state.agent} · 人工接待中` : MODE_LABELS[state.mode];
  $('modeBanner').hidden = state.mode === 'ai';
  $('modeBanner').classList.toggle('human', state.mode === 'human');
  $('modeBannerText').textContent = state.mode === 'waiting' ? (state.waitReason === 'offline' ? '模拟当前无人可接待，可留言或返回 AI。' : state.waitReason === 'timeout' ? '模拟等待较久，可继续等待、留言或返回 AI。' : '等待人工接入。可继续补充问题，或返回 AI。') : state.mode === 'human' ? '当前由模拟商务接待，AI 不会自动回复。' : '本次会话已结束，可以发起新会话。';
  $('waitActions').hidden = state.mode !== 'waiting';
  $('waitDetail').textContent = state.followupSaved ? '留言已在本页模拟记录，未通知真实商务。' : '当前仅模拟等待，不承诺实际接入时间。';
  $('cancelWaiting').hidden = state.mode !== 'waiting';
  $('handoffButton').disabled = state.mode !== 'ai';
  $('handoffButton').replaceChildren(icon('headset', true), el('span', '', state.mode === 'human' ? '人工接待' : state.mode === 'waiting' ? '等待接入' : '人工服务'));
  $('selectedContext').hidden = !state.selectedOrderId;
  $('selectedContextText').textContent = `当前订单：${state.selectedOrderId || ''}`;
  $('composerHint').textContent = state.mode === 'human' ? '消息将进入模拟人工会话' : state.mode === 'waiting' ? '可补充问题，等待模拟商务接入' : 'Enter 发送 · Shift + Enter 换行';
  $('messageInput').placeholder = state.mode === 'human' ? '向模拟商务发送消息…' : state.mode === 'waiting' ? '补充您希望人工处理的问题…' : '输入订单号，或直接描述您的问题…';
  $('messageForm').hidden = state.mode === 'closed'; $('closedActions').hidden = state.mode !== 'closed';
  document.querySelectorAll('.chat-actions [data-question]').forEach(b => b.disabled = state.mode === 'closed' || state.busy);
  const manual = state.mode === 'human' || state.mode === 'waiting';
  $('knowledgeAction').hidden = manual;
  $('ordersAction').querySelector('span').textContent = manual ? '发订单给商务' : '查订单';
  $('ordersAction').disabled = state.mode === 'closed' || state.busy;
  if (reset) { messages.replaceChildren(); clearNewMessages(); }
  if (state.messages.length === 1 && state.mode === 'ai' && !messages.querySelector('.welcome')) messages.prepend(renderWelcome());
  if (state.messages.length > 1) messages.querySelector('.welcome')?.remove();
  messages.querySelector('.typing')?.remove();
  added.forEach(message => messages.append(renderMessage(message)));
  messages.querySelectorAll('.inline-order').forEach(b => {
    b.disabled = state.mode === 'closed' || state.busy;
    b.querySelector('.order-goods').textContent = manual ? '将此订单编号发送给商务' : visibleOrders(state.account).find(o => o.id === b.dataset.orderId)?.goods || '';
    b.setAttribute('aria-label', `${manual ? '发送订单给商务' : '查询订单'} ${b.dataset.orderId}`);
  });
  if (state.busy) { const typing = el('div', 'typing'); typing.setAttribute('role', 'status'); typing.append(el('span'), el('span'), el('span'), el('em', '', '正在查询演示数据…')); messages.append(typing); }
  if (!isOpen && previous && previous.id === state.id) {
    unread += state.messages.slice(previous.messages.length).filter(m => m.role !== 'customer').length;
    $('unreadBadge').textContent = String(unread); $('unreadBadge').hidden = unread === 0;
  }
  updateComposer();
  if (reset) requestAnimationFrame(() => messages.scrollTop = 0);
  else if (forceScroll || (nearBottom && isOpen)) scrollMessages();
  else {
    messages.scrollTop = oldScrollTop;
    newMessageCount += added.filter(m => m.role !== 'customer').length;
    $('newMessages').hidden = !newMessageCount;
    $('newMessages').textContent = `${newMessageCount} 条新消息，点击查看`;
  }
  forceScroll = false;
  if (previous?.mode !== 'waiting' && state.mode === 'waiting') {
    clearTimeout(waitTimer); const conversation = state.id;
    waitTimer = setTimeout(() => { if (adapter.state.id === conversation && adapter.state.mode === 'waiting' && adapter.state.waitReason === 'queue') adapter.markWaitIssue('timeout'); }, 60000);
  }
  if (state.mode !== 'waiting') clearTimeout(waitTimer);
  if (dialogKind === 'controls' && $('demoDialog').open) renderControls();
  renderHomeFaqs(reset);
  notifyParent();
  lastState = structuredClone(state);
}
async function send(text, { fromComposer = false } = {}) {
  text = text.trim(); if (!text) return;
  showChat();
  if (state.mode === 'closed') { toast('会话已结束，请先发起新会话。'); return; }
  if (state.busy) { toast('正在处理上一条问题，请稍候；也可以直接转人工。'); return; }
  const submittedDraft = fromComposer ? $('messageInput').value : null;
  if (fromComposer) $('messageInput').value = '';
  forceScroll = true; updateComposer();
  try {
    await adapter.send(text, `client-${++clientSequence}`);
    if (state.mode === 'waiting') toast('当前为模拟人工等待，可使用「演示控制」继续体验。');
  }
  catch { if (fromComposer && !$('messageInput').value) $('messageInput').value = submittedDraft; forceScroll = false; toast('消息未发送，请重试；原草稿已保留。'); updateComposer(); }
}
function askOrder(id) {
  if (state.mode === 'closed') { showChat(); toast('请先发起新会话，再查询订单。'); return; }
  if (state.busy) { showChat(); toast('正在处理上一条问题，请稍后选择订单。'); return; }
  adapter.setSelectedOrder(id);
  send(state.mode === 'human' || state.mode === 'waiting' ? `请商务协助核实订单 ${id}` : `查询订单 ${id} 的进度`);
}
function requestHuman() {
  showChat();
  if (state.mode === 'closed') { toast('请先发起新会话。'); return; }
  forceScroll = true;
  if (!adapter.requestHandoff()) { toast('该会话已在等待或接待中，不会重复创建任务。'); return; }
  toast('已模拟转人工；请在「演示控制」中模拟商务接单。');
}
function openDialog(kind) {
  closeMenu();
  dialogKind = kind;
  $('dialogContent').replaceChildren();
  if (kind === 'controls') renderControls();
  if (kind === 'account') renderAccounts();
  if (kind === 'about') renderAbout();
  if (!$('demoDialog').open) $('demoDialog').showModal();
}
function customDialog(title) {
  closeMenu();
  dialogKind = 'detail'; $('dialogTitle').textContent = title;
  $('dialogContent').replaceChildren();
  if (!$('demoDialog').open) $('demoDialog').showModal();
  return $('dialogContent');
}
function showOrderDetails(order, queriedAt) {
  const content = customDialog('演示订单详情');
  content.append(el('p', 'dialog-copy', `${order.id} · ${order.detail}`));
  const table = el('table', 'scope-table');
  for (const [label, value] of [['业务类型', order.business], ['快照状态', order.status], ['演示数据更新时间', order.updated], ['本次查询时间', timeLabel(queriedAt)]]) {
    const row = el('tr'); row.append(el('td', '', label), el('td', '', value)); table.append(row);
  }
  content.append(table, el('p', 'dialog-note', '这是聊天中该次查询的虚构快照，不代表实时状态，也不是正式订单详情页。正式接入后需通过带权限校验的 B2B 详情入口查看。'));
  const refresh = button(state.mode === 'ai' ? '重新查询此演示订单' : '把此订单发给商务', 'primary-button', () => { $('demoDialog').close(); askOrder(order.id); });
  refresh.disabled = state.mode === 'closed' || state.busy; content.append(refresh);
}
function showKnowledge(id) {
  const entry = KNOWLEDGE.find(item => item.id === id); if (!entry) return;
  const content = customDialog('回答依据 · 演示知识');
  content.append(el('h3', 'dialog-section-title', `${entry.id} · ${entry.title}`), el('p', 'dialog-copy', entry.answer), el('p', 'dialog-note', '本条为原型自带的示例内容，不是已审核的正式业务制度。尚未调用知识库 MCP；正式接入后需展示真实来源、版本和有效期。'));
}
function showOrderPicker() {
  if (state.mode === 'ai') { send('查询我的最近订单'); return; }
  if (state.mode === 'closed') return;
  const content = customDialog('选择订单发送给商务');
  content.append(el('p', 'dialog-copy', '选择后只会向当前人工会话发送订单编号，不会触发 AI 自动回复。您尚未发送的草稿将保留。'));
  for (const order of visibleOrders(state.account)) content.append(button(`${order.id} · ${order.goods}`, 'account-option', () => { $('demoDialog').close(); askOrder(order.id); }));
}
function showLeaveMessage() {
  if (state.mode !== 'waiting') return;
  const content = customDialog('补充留言 · 仅演示');
  content.append(el('p', 'dialog-copy', '不会创建真实工单或发送通知。请只填写虚构测试内容；刷新后此留言会清除。'));
  const form = el('form', 'staff-form'), input = el('textarea');
  input.id = 'leaveMessageInput'; input.maxLength = 1000; input.required = true; input.setAttribute('aria-label', '演示留言内容');
  const submit = el('button', 'primary-button', '记录演示留言'); submit.type = 'submit'; form.append(input, submit);
  form.addEventListener('submit', event => { event.preventDefault(); if (!input.value.trim() || state.mode !== 'waiting') return; forceScroll = true; adapter.leaveMessage(input.value); $('demoDialog').close(); }); content.append(form);
}
function renderControls() {
  $('dialogTitle').textContent = '模拟接待与异常场景';
  const content = $('dialogContent'); content.replaceChildren();
  const statusLine = el('p', 'status-line'); statusLine.append(document.createTextNode('当前接待状态'), el('strong', '', MODE_LABELS[state.mode]));
  content.append(el('p', 'dialog-copy', '此面板只用于体验前端交互，不是员工后台。不会发送企微通知、创建真实工单或授予实际权限。'), statusLine);
  const grid = el('div', 'control-grid');
  const controls = [
    ['模拟商务接单', state.mode !== 'waiting', () => adapter.claim()],
    ['模拟结束人工并转 AI', state.mode !== 'human', () => adapter.resumeAI()],
    ['模拟结束本次会话', state.mode === 'closed', () => adapter.close()],
    ['模拟下次查询失败', state.mode !== 'ai' || state.busy || adapter.failNext, () => { adapter.failNext = true; renderControls(); toast('下一次 AI 查询将模拟失败，便于测试重试。'); }],
    ['模拟等待超时', state.mode !== 'waiting', () => adapter.markWaitIssue('timeout')],
    ['模拟无人值守', state.mode !== 'waiting', () => adapter.markWaitIssue('offline')],
  ];
  controls.forEach(([label, disabled, action]) => { const b = button(label, '', action); b.disabled = disabled; grid.append(b); }); content.append(grid);
  if (state.mode === 'waiting') content.append(el('p', 'dialog-note', '转人工请求已经建立，但没有真实商务收到通知。点击「模拟商务接单」体验人工接入。'));
  if (adapter.failNext) content.append(el('p', 'dialog-note', '已设置一次模拟失败。关闭弹窗后发送订单问题，查看失败提示及重试。'));
  if (state.mode === 'human') {
    content.append(el('h3', 'dialog-section-title', '模拟商务回复'));
    const form = el('form', 'staff-form'), label = el('label', 'sr-only', '模拟商务回复内容'), textarea = el('textarea');
    textarea.id = 'staffReplyInput'; textarea.maxLength = 1000; label.htmlFor = textarea.id;
    textarea.value = '我已记录您的问题，将继续核实。此条是前端模拟人工回复，不代表真实业务处理结果。';
    const submit = el('button', 'primary-button', '发送模拟人工回复'); submit.type = 'submit';
    form.append(label, textarea, submit); form.addEventListener('submit', event => { event.preventDefault(); const text = textarea.value.trim(); if (!text) return; adapter.staffReply(text); $('demoDialog').close(); }); content.append(form);
  }
  content.append(button('返回客户对话', 'text-button dialog-return', () => $('demoDialog').close()));
  if (embedded) content.append(button('切换演示账号', 'text-button dialog-return', () => openDialog('account')));
}
function renderAccounts() {
  $('dialogTitle').textContent = '切换演示公司'; const content = $('dialogContent');
  content.append(el('p', 'dialog-copy', '仅模拟 B2B 登录后的公司上下文。切换会清空当前演示会话及草稿；不会改变任何真实账号权限。'));
  ACCOUNTS.forEach(account => {
    const selected = account.id === state.account.id;
    const b = button('', `account-option${selected ? ' selected' : ''}`, () => {
      if (selected) { $('demoDialog').close(); return; }
      $('messageInput').value = ''; $('orderSearch').value = ''; unread = 0;
      adapter.open(account); renderDashboard(); $('demoDialog').close(); showChat(); toast('已切换演示公司，旧会话与订单上下文已重置。');
    });
    const copy = el('span'); copy.append(el('strong', '', account.company), el('small', '', `${account.contact} · ${visibleOrders(account).length} 笔虚构订单`));
    b.append(icon('user'), copy); if (selected) b.append(icon('check')); content.append(b);
  });
  content.append(el('p', 'dialog-note', '正式环境必须由 B2B 服务端确认身份、公司和权限。此处的前端筛选不是安全授权措施。'));
}
function renderAbout() {
  $('dialogTitle').textContent = '本次原型的体验范围'; const content = $('dialogContent');
  content.append(el('p', 'dialog-copy', '本次交付是独立的 B2B 客服前端，用于确认交互与后续接口契约。不修改现有生产平台，也不连接真实业务系统。'));
  const table = el('table', 'scope-table');
  for (const [name, value] of [['B2B 身份与权限', '演示账号，未接入'], ['订单查询', '本地虚构订单'], ['知识库 MCP', '本地示例知识，未接入'], ['AI 模型', '规则模拟，未接入'], ['企微通知与人工服务', '手动模拟，未接入']]) {
    const row = el('tr'); row.append(el('td', '', name), el('td', '', value)); table.append(row);
  }
  content.append(table, el('p', 'dialog-copy', '可体验：订单卡片、知识来源、范围外提示、转人工等待、模拟接单与回复、返回 AI、结束会话、异常重试及公司切换。'), el('p', 'dialog-note', '只在当前页面内存中保留体验记录，刷新或切换演示公司后重置。请勿输入真实客户资料、订单、手机号、密码或密钥。'));
}

document.addEventListener('click', event => {
  const target = event.target.closest('button,a'); if (!target) return;
  if (target.id !== 'moreButton' && !target.closest('#supportMenu')) closeMenu();
  if (target.matches('.brand')) { event.preventDefault(); currentView = 'home'; renderDashboard(); return; }
  if (target.dataset.view) {
    currentView = target.dataset.view;
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b === target)); renderDashboard(); return;
  }
  if (target.dataset.question) { send(target.dataset.question); return; }
  switch (target.dataset.action) {
    case 'open-chat': showChat(); break;
    case 'controls': openDialog('controls'); break;
    case 'switch-account': openDialog('account'); break;
    case 'about': openDialog('about'); break;
    case 'orders-action': showOrderPicker(); break;
    case 'notice': toast('此为界面原型，未接入真实系统通知。'); break;
    case 'platform-feature': toast('该入口属于原 B2B 平台功能，本次原型不实现业务操作。'); break;
  }
});
$('messageForm').addEventListener('submit', event => { event.preventDefault(); send($('messageInput').value, { fromComposer: true }); });
$('messageInput').addEventListener('input', updateComposer);
$('messageInput').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !window.matchMedia('(pointer: coarse)').matches) { event.preventDefault(); if (!$('sendButton').disabled) send($('messageInput').value, { fromComposer: true }); }
});
$('handoffButton').addEventListener('click', requestHuman);
$('refreshFaqs').addEventListener('click', () => { faqCount = 0; renderHomeFaqs(); });
function closeMenu() { $('supportMenu').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); }
$('moreButton').addEventListener('click', () => {
  const open = $('supportMenu').hidden; $('supportMenu').hidden = !open; $('moreButton').setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('supportMenu').hidden) { closeMenu(); $('moreButton').focus(); } });
document.addEventListener('pointerdown', event => { if (!event.target.closest('#supportMenu') && !event.target.closest('#moreButton')) closeMenu(); });
$('cancelWaiting').addEventListener('click', () => adapter.cancelHandoff());
$('minimizeChat').addEventListener('click', () => showChat(false));
$('chatLauncher').addEventListener('click', () => showChat());
$('newMessages').addEventListener('click', scrollMessages);
$('messages').addEventListener('scroll', () => { const n = $('messages'); if (n.scrollHeight - n.scrollTop - n.clientHeight < 40) clearNewMessages(); });
$('leaveMessage').addEventListener('click', showLeaveMessage);
$('expandChat').addEventListener('click', () => {
  const expanded = $('supportPanel').classList.toggle('expanded');
  $('expandChat').setAttribute('aria-pressed', String(expanded)); $('expandChat').setAttribute('aria-label', expanded ? '还原客服窗口' : '展开客服窗口');
  notifyParent();
});
$('clearContext').addEventListener('click', () => adapter.setSelectedOrder(null));
$('newConversation').addEventListener('click', () => {
  $('messageInput').value = ''; adapter.open(state.account); showChat(); toast('已发起新的演示会话。');
});
$('orderSearch').addEventListener('input', renderDashboard);
$('closeDialog').addEventListener('click', () => $('demoDialog').close());
$('demoDialog').addEventListener('close', () => { dialogKind = null; });
$('demoDialog').addEventListener('click', event => {
  const box = $('demoDialog').getBoundingClientRect();
  if (event.target === $('demoDialog') && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) $('demoDialog').close();
});
function updateConnection() { $('connectionBanner').hidden = navigator.onLine; }
window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
function updateViewport() { document.documentElement.style.setProperty('--support-vh', `${window.visualViewport?.height || window.innerHeight}px`); if (state) renderHomeFaqs(); }
window.visualViewport?.addEventListener('resize', updateViewport); window.addEventListener('resize', updateViewport);
window.addEventListener('pagehide', () => { clearTimeout(waitTimer); clearTimeout(toastTimer); });
adapter.subscribe(renderConversation); adapter.open(); renderDashboard(); showChat(params.get('open') === '1'); updateConnection(); updateViewport();
