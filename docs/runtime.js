(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BuyunluRuntime = factory();
})(typeof window === 'object' ? window : globalThis, function() {
  'use strict';
  const expressions = new Map();
  function expression(source, scope) {
    if (!expressions.has(source)) expressions.set(source, new Function('scope', `with (scope) { return (${source}); }`));
    return expressions.get(source)(scope);
  }
  function value(text, scope) {
    const exact = text.match(/^\{\{([\s\S]*?)\}\}$/);
    if (exact) return expression(exact[1], scope);
    return text.replace(/\{\{([\s\S]*?)\}\}/g, (_, source) => String(expression(source, scope) ?? ''));
  }
  function setPath(data, key, next) {
    const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
    let target = data;
    while (parts.length > 1) { const part = parts.shift(); if (target[part] == null) target[part] = {}; target = target[part]; }
    target[parts[0]] = next;
  }

  function virtualNodes(nodes, scope, prefix) {
    let branchMatched = false;
    const out = [];
    nodes.forEach((node, index) => {
      const key = `${prefix}.${index}`;
      if (node.text != null) { out.push({ text: String(value(node.text, scope) ?? ''), key }); return; }
      const attrs = node.attrs;
      if (attrs['wx:if'] != null) { branchMatched = !!value(attrs['wx:if'], scope); if (!branchMatched) return; }
      else if (attrs['wx:elif'] != null) { if (branchMatched) return; branchMatched = !!value(attrs['wx:elif'], scope); if (!branchMatched) return; }
      else if (attrs['wx:else'] != null) { if (branchMatched) return; branchMatched = true; }
      else branchMatched = false;
      if (attrs['wx:for'] != null) {
        const values = value(attrs['wx:for'], scope) || [];
        const itemName = attrs['wx:for-item'] || 'item';
        const indexName = attrs['wx:for-index'] || 'index';
        Object.keys(values).forEach((loopIndex, i) => {
          const local = Object.create(scope);
          local[itemName] = values[loopIndex]; local[indexName] = Array.isArray(values) ? i : loopIndex;
          out.push(...virtualNodes([{ ...node, attrs: Object.fromEntries(Object.entries(attrs).filter(([name]) => !name.startsWith('wx:for') && !['wx:if', 'wx:elif', 'wx:else'].includes(name))) }], local, `${key}:${loopIndex}`));
        });
        return;
      }
      if (node.tag === 'block') { out.push(...virtualNodes(node.children, scope, key)); return; }
      const props = {}; const events = {};
      for (const [name, raw] of Object.entries(attrs)) {
        if (name.startsWith('wx:') || name.startsWith('hover-') || ['enhanced', 'mode', 'confirm-type', 'placeholder-class', 'scroll-with-animation', 'show-scrollbar'].includes(name)) continue;
        if (/^(bind|catch)/.test(name)) { events[name] = raw; continue; }
        props[name] = value(raw, scope);
      }
      let tag = ({ view: 'div', text: 'span', 'scroll-view': 'div', image: 'img', picker: 'div' })[node.tag] || node.tag;
      if (node.tag === 'scroll-view') props['data-scroll'] = 'true';
      const children = virtualNodes(node.children, scope, key);
      if (node.tag === 'picker') {
        props.class = `${props.class || ''} mobile-picker`;
        const options = (value(attrs.range || '{{[]}}', scope) || []).map((item, i) => ({ tag: 'option', key: `${key}:option:${i}`, props: { value: String(i) }, events: {}, children: [{ text: String(item), key: `${key}:label:${i}` }] }));
        children.push({ tag: 'select', key: `${key}:select`, props: { class: 'mobile-picker-select', value: String(props.value || 0), 'aria-label': '选择姓氏' }, events, children: options });
        delete props.value; delete props.range;
      }
      if (node.tag === 'input') { props.inputmode = props.type === 'number' ? 'numeric' : 'text'; props['aria-label'] = scope.dialog?.inputLabel || '支出金额'; }
      if (tag === 'button') props.type = 'button';
      out.push({ tag, key, props, events: node.tag === 'picker' ? {} : events, children });
    });
    return out;
  }

  function patchElement(element, vnode, page) {
    const old = element.__props || {};
    for (const name of Object.keys(old)) if (!(name in vnode.props)) element.removeAttribute(name);
    for (const [name, raw] of Object.entries(vnode.props)) {
      if (name === 'scroll-y' || name === 'scroll-into-view') continue;
      if (name === 'value') { const next = String(raw ?? ''); if (element.value !== next) element.value = next; continue; }
      if (name === 'disabled') { element.disabled = !!raw; if (raw) element.setAttribute(name, ''); else element.removeAttribute(name); continue; }
      element.setAttribute(name, raw == null ? '' : raw);
    }
    element.__props = vnode.props;
    element.__bindings = vnode.events;
    element.__listeners = element.__listeners || {};
    for (const binding of Object.keys(vnode.events)) {
      const domEvent = ({ tap: 'click', touchmove: 'touchmove' })[binding.replace(/^(bind|catch):?/, '')] || binding.replace(/^(bind|catch):?/, '');
      if (element.__listeners[binding]) continue;
      element.__listeners[binding] = true;
      element.addEventListener(domEvent, event => {
        const handler = element.__bindings[binding];
        if (!handler) return;
        if (binding.startsWith('catch')) { event.stopPropagation(); if (domEvent === 'touchmove') event.preventDefault(); }
        if (typeof page[handler] === 'function') page[handler]({ currentTarget: { dataset: element.dataset }, target: { dataset: event.target.dataset || {} }, detail: { value: event.target.value } });
      });
    }
  }

  function reconcile(parent, vnodes, page, document) {
    vnodes.forEach((vnode, index) => {
      let element = parent.childNodes[index];
      const isText = vnode.text != null;
      if (!element || element.__key !== vnode.key || (isText ? element.nodeType !== 3 : element.tagName !== vnode.tag.toUpperCase())) {
        const next = isText ? document.createTextNode(vnode.text) : document.createElement(vnode.tag);
        next.__key = vnode.key;
        if (element) parent.replaceChild(next, element); else parent.appendChild(next);
        element = next;
      }
      if (isText) { if (element.nodeValue !== vnode.text) element.nodeValue = vnode.text; }
      else { patchElement(element, vnode, page); reconcile(element, vnode.children, page, document); if (vnode.tag === 'select') element.value = String(vnode.props.value); }
    });
    while (parent.childNodes.length > vnodes.length) parent.removeChild(parent.childNodes[parent.childNodes.length - 1]);
  }

  function attachPage(page, options) {
    const render = () => {
      reconcile(options.root, virtualNodes(options.template, page.data, 'root'), page, options.document);
      if (options.afterRender) options.afterRender();
    };
    page.setData = (patch, callback) => { for (const [key, next] of Object.entries(patch)) setPath(page.data, key, next); render(); if (callback) callback.call(page); };
    render();
    return page;
  }

  function createWx(host) {
    let toastTimer;
    return {
      getStorageSync(key) { const item = host.localStorage.getItem(key); return item ? JSON.parse(item) : ''; },
      setStorageSync(key, data) { host.localStorage.setItem(key, JSON.stringify(data)); },
      removeStorageSync(key) { host.localStorage.removeItem(key); },
      nextTick(callback) { callback(); },
      showToast(options) { const toast = host.document.getElementById('toast'); if (toast) { toast.textContent = options.title || ''; toast.className = 'mobile-toast-visible'; host.clearTimeout(toastTimer); toastTimer = host.setTimeout(() => { toast.className = ''; }, 2600); } },
      showLoading(options) { this.showToast(options); }, hideLoading() {},
    };
  }

  function moduleLoader(modules) {
    const cache = {};
    function load(id) {
      if (cache[id]) return cache[id].exports;
      if (!modules[id]) throw new Error(`Unknown bundled module: ${id}`);
      const module = { exports: {} }; cache[id] = module;
      modules[id](module, module.exports, request => {
        const parts = request.startsWith('.') ? `${id.slice(0, id.lastIndexOf('/') + 1)}${request}`.split('/') : request.split('/');
        const normalized = [];
        for (const part of parts) { if (part === '..') normalized.pop(); else if (part && part !== '.') normalized.push(part); }
        return load(normalized.join('/').replace(/\.js$/, ''));
      });
      return module.exports;
    }
    return load;
  }

  function updateAccessibility(page, document) {
    if (!document.querySelectorAll) return;
    const cards = [...document.querySelectorAll('.dialog-card,.burst-card,.nameselect-card')];
    let active;
    for (const card of cards) {
      const open = /(?:dialog|burst|nameselect)-mask-open/.test(card.parentNode.className);
      card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
      card.parentNode.setAttribute('aria-hidden', String(!open));
      const priority = item => item.classList?.contains('burst-card') ? 3 : item.classList?.contains('nameselect-card') ? 2 : 1;
      if (open && (!active || priority(card) > priority(active))) active = card;
    }
    const scroll = document.querySelector?.('.page-shell > .scroll');
    if (scroll) scroll.inert = !!active;
    if (active && active !== document.__activeDialog) {
      document.__returnFocus = document.activeElement;
      active.querySelector?.('button,select,input')?.focus();
    } else if (!active && document.__activeDialog) document.__returnFocus?.focus?.();
    document.__activeDialog = active;
  }
  function trapFocus(event, document) {
    const modal = document.__activeDialog;
    if (!modal) return;
    const controls = [...modal.querySelectorAll('button:not([disabled]),input,select,[tabindex="0"]')];
    const first = controls[0]; const last = controls[controls.length - 1];
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return { attachPage, virtualNodes, createWx, moduleLoader, updateAccessibility, trapFocus };
});
