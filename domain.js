export const ACCOUNTS = [
  { id: 'demo-user-a', companyId: 'demo-company-a', company: '星海电子有限公司', contact: '张经理' },
  { id: 'demo-user-b', companyId: 'demo-company-b', company: '远辰科技有限公司', contact: '李经理' },
];

export const ORDERS = [
  { id: 'B2B-DEMO-001', companyId: 'demo-company-a', goods: '电子元器件', detail: '集成电路 · 2,400 件', status: '运输中', stage: 3, business: '进口报关', updated: '11-20 09:30', nodes: ['订单已提交', '香港仓已收货', '已完成报关', '运输中', '待签收'], note: '演示节点：已发车，正在运输。暂无已确认的送达时间。' },
  { id: 'B2B-DEMO-002', companyId: 'demo-company-a', goods: '精密连接器', detail: '连接器 · 800 件', status: '待入仓', stage: 1, business: '进口报关', updated: '11-19 16:20', nodes: ['订单已提交', '待入仓', '待报关', '待运输', '待签收'], note: '演示节点：订单已提交，尚无仓库收货记录。' },
  { id: 'B2B-DEMO-003', companyId: 'demo-company-a', goods: '传感器模组', detail: '传感器 · 600 件', status: '已签收', stage: 4, business: '一般贸易', updated: '11-18 14:10', nodes: ['订单已提交', '仓库已收货', '已完成报关', '运输已完成', '已签收'], note: '演示节点：已签收。实际签收凭证需以正式接口为准。' },
  { id: 'B2B-DEMO-101', companyId: 'demo-company-b', goods: '电源管理芯片', detail: '集成电路 · 1,200 件', status: '待报关', stage: 2, business: '进口报关', updated: '11-20 08:45', nodes: ['订单已提交', '香港仓已收货', '待报关', '待运输', '待签收'], note: '演示节点：仓库已收货，等待报关处理。' },
];

export const KNOWLEDGE = [
  { id: 'KB-DEMO-01', title: '如何在平台提交订单', match: /如何下单|怎么下单|下单流程|提交订单/, answer: '演示操作指引：进入「订单列表」查看现有订单；正式下单请使用原 B2B 平台的下单入口，并按页面要求填写资料。客服不会代您创建或修改订单。' },
  { id: 'KB-DEMO-02', title: '订单状态说明', match: /状态.*(含义|意思|说明)|什么是待入仓|什么是待报关/, answer: '演示状态说明：「待入仓」表示尚无收货节点；「待报关」表示等待报关处理；「运输中」表示已有运输节点；「已签收」表示存在签收节点。具体订单的实际进展需单独查询，不能仅凭通用说明推断。' },
  { id: 'KB-DEMO-03', title: '查询订单需要哪些信息', match: /查询.*(资料|信息)|查单.*需要/, answer: '请提供订单编号，也可以先查询「我的最近订单」，再选择要了解的一笔。本原型只使用 B2B-DEMO 开头的虚构订单，不需要提交真实手机号、身份证或业务单据。' },
];

export const MODE_LABELS = { ai: 'AI 助手接待中', waiting: '等待人工接入', human: '商务接待中', closed: '本次会话已结束' };
export function visibleOrders(account) { return ORDERS.filter(order => order.companyId === account.companyId); }
export function isHandoffRequest(text) { return /^(我要|请|帮我|想|需要)?(找|转|联系|接入)?(人工|商务|人工客服|人工服务)[！!。.\s]*$/.test(text.trim()); }

export function answerQuestion(question, account, selectedOrderId = null) {
  const text = question.trim();
  const orders = visibleOrders(account);
  const explicit = text.toUpperCase().match(/B2B-DEMO-\d+/)?.[0];
  if (explicit && !orders.some(order => order.id === explicit)) {
    return { kind: 'denied', text: '未找到当前演示账号有权查看的该订单。请核对订单编号；不能据此确认其他公司的订单是否存在。' };
  }
  if (/远辰/.test(text) && account.companyId !== 'demo-company-b' || /星海/.test(text) && account.companyId !== 'demo-company-a') {
    return { kind: 'denied', text: '当前会话仅能查询本公司授权范围内的演示订单，不能切换到其他公司的数据。' };
  }
  if (/(取消|修改|删除|创建|新增|帮我下|代我下).*(订单|这单|那单)|付款|退款|付汇|转账/.test(text)) {
    return { kind: 'boundary', text: '我只能查询授权订单和回答知识库已覆盖的问题，不能执行下单、改单、取消订单或资金操作。正式办理请使用原平台，或转人工咨询。' };
  }
  const knowledge = KNOWLEDGE.find(entry => entry.match.test(text));
  if (knowledge) return { kind: 'knowledge', text: knowledge.answer, source: knowledge.title, sourceId: knowledge.id };
  if (explicit) return { kind: 'order', text: '为您查到以下演示进度。数据全部虚构，不代表真实业务状态。', order: orders.find(order => order.id === explicit) };
  if (/订单|查单|到哪|物流|进度|到货|签收|这票|这单|那单/.test(text)) {
    const selected = orders.find(order => order.id === selectedOrderId);
    if (selected && /到哪|物流|进度|到货|签收|这票|这单|那单/.test(text)) return { kind: 'order', text: '这笔演示订单的当前进度如下。送达时间没有确认数据时，不作承诺。', order: selected };
    return { kind: 'orders', text: '以下是当前演示账号的订单。请选择一笔查看进度，也可以发送订单编号。', orders };
  }
  if (/^(你好|您好|hello|hi|谢谢|感谢)[！!。.\s]*$/i.test(text)) return { kind: 'scope', text: '您好，我可以帮您查询授权订单，或回答知识库中的平台操作问题。也可以随时转人工。' };
  return { kind: 'out-of-scope', text: '这个问题暂不在已接入的订单查询和演示知识库范围内，我不能给出可靠答案。您可以换个问题，或转人工咨询。' };
}

// Prototype-only transport. This class is the single source of demo conversation state.
// Production must replace it with the existing authenticated conversation service.
export class DemoConversationAdapter {
  constructor({ delay = 750 } = {}) { this.delay = delay; this.listeners = new Set(); this.sequence = 0; this.generation = 0; this.failNext = false; }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  snapshot() { return structuredClone(this.state); }
  emit() { for (const listener of this.listeners) listener(this.snapshot()); }
  message(role, text, extra = {}) { this.state.messages.push({ id: `demo-message-${++this.sequence}`, role, text, time: Date.now(), ...extra }); }
  open(account = ACCOUNTS[0]) {
    this.generation++; this.failNext = false;
    this.state = { id: `demo-conversation-${this.generation}`, source: 'b2b', account: { ...account }, mode: 'ai', version: 1, busy: false, selectedOrderId: null, messages: [], seen: [], agent: null };
    this.message('system', 'B2B 演示会话已建立。公司、订单和回复均为虚构；请勿输入真实业务或个人信息。');
    this.emit(); return this.snapshot();
  }
  setSelectedOrder(id) {
    if (id !== null && !visibleOrders(this.state.account).some(order => order.id === id)) throw new Error('ORDER_NOT_IN_SCOPE');
    this.state.selectedOrderId = id; this.emit();
  }
  async send(text, clientMessageId) {
    if (this.state.mode === 'closed') throw new Error('CONVERSATION_CLOSED');
    if (this.state.busy) throw new Error('MESSAGE_IN_FLIGHT');
    if (this.state.seen.includes(clientMessageId)) return;
    this.state.seen.push(clientMessageId);
    const messageId = `request-${++this.sequence}`;
    this.message('customer', text, { requestId: messageId });
    if (this.state.mode === 'ai' && isHandoffRequest(text)) { this.requestHandoff(); return; }
    if (this.state.mode !== 'ai') { this.emit(); return; }
    const generation = this.generation, version = this.state.version;
    this.state.busy = true; this.emit();
    await new Promise(resolve => setTimeout(resolve, this.delay));
    if (generation !== this.generation || version !== this.state.version || this.state.mode !== 'ai') return;
    this.state.busy = false;
    if (this.failNext) {
      this.failNext = false;
      this.message('error', '模拟查询暂时不可用，尚未取得结果。可以重试；系统不会使用猜测的数据回答。', { retryText: text });
    } else {
      const answer = answerQuestion(text, this.state.account, this.state.selectedOrderId);
      this.message('assistant', answer.text, { answer });
    }
    this.emit();
  }
  requestHandoff() {
    if (this.state.mode === 'waiting' || this.state.mode === 'human') return false;
    if (this.state.mode === 'closed') throw new Error('CONVERSATION_CLOSED');
    this.state.version++; this.state.busy = false; this.state.mode = 'waiting';
    this.message('system', '已进入模拟人工等待队列。当前不会发送真实企微通知；请使用「演示控制」模拟商务接单。'); this.emit(); return true;
  }
  cancelHandoff() {
    if (this.state.mode !== 'waiting') throw new Error('NOT_WAITING');
    this.state.version++; this.state.mode = 'ai';
    this.message('system', '已取消等待，现由 AI 助手继续服务。'); this.emit();
  }
  claim() {
    if (this.state.mode !== 'waiting') throw new Error('NOT_WAITING');
    this.state.version++; this.state.mode = 'human'; this.state.agent = '陈商务（模拟）';
    this.message('system', '陈商务（模拟）已接入，AI 自动回复已暂停。');
    this.message('staff', '您好，我已看到前面的聊天记录。请告诉我您希望进一步核实的问题。', { name: this.state.agent }); this.emit();
  }
  staffReply(text) {
    if (this.state.mode !== 'human') throw new Error('NOT_HUMAN');
    this.message('staff', text, { name: this.state.agent }); this.emit();
  }
  resumeAI() {
    if (this.state.mode !== 'human') throw new Error('NOT_HUMAN');
    this.state.version++; this.state.mode = 'ai'; this.state.agent = null;
    this.message('system', '模拟商务已结束人工接待，现由 AI 助手继续服务。聊天记录已保留；这不代表业务问题已解决。'); this.emit();
  }
  close() {
    if (this.state.mode === 'closed') return;
    this.state.version++; this.state.busy = false; this.state.mode = 'closed'; this.state.agent = null;
    this.message('system', '本次演示会话已结束。您可以发起新会话继续体验。'); this.emit();
  }
}
