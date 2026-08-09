(function () {
  'use strict';

  if (window.__AGRODOMINIUM_OFFLINE_V2__) return;
  window.__AGRODOMINIUM_OFFLINE_V2__ = true;

  var Native = window.AgroDominiumOffline;
  if (!Native) return;

  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  var syncing = false;
  var brandTimer = null;

  function isOnline() {
    try {
      return !!Native.isOnline() && navigator.onLine !== false;
    } catch (e) {
      return navigator.onLine !== false;
    }
  }

  function absoluteUrl(value) {
    try {
      return new URL(value || location.href, location.href).href;
    } catch (e) {
      return String(value || location.href);
    }
  }

  function safeCount() {
    try {
      return Number(Native.count()) || 0;
    } catch (e) {
      return 0;
    }
  }

  function ensureIndicator() {
    var el = document.getElementById('agrodominium-offline-indicator');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'agrodominium-offline-indicator';
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:92px',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'padding:8px 13px',
      'border-radius:999px',
      'font:600 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif',
      'box-shadow:0 4px 18px rgba(0,0,0,.16)',
      'pointer-events:none',
      'display:none',
      'max-width:86vw',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis'
    ].join(';');
    document.documentElement.appendChild(el);
    return el;
  }

  function updateIndicator() {
    var el = ensureIndicator();
    var count = safeCount();

    if (!isOnline()) {
      el.style.display = 'block';
      el.style.background = '#123f31';
      el.style.color = '#ffffff';
      el.textContent = count > 0
        ? 'Offline • ' + count + ' coleta(s) aguardando sincronização'
        : 'Offline • coletas serão salvas no aparelho';
      return;
    }

    if (count > 0) {
      el.style.display = 'block';
      el.style.background = '#e6f6ee';
      el.style.color = '#0b6f4c';
      el.textContent = syncing
        ? 'Sincronizando ' + count + ' coleta(s)…'
        : count + ' coleta(s) pendente(s)';
      return;
    }

    el.style.display = 'none';
  }

  window.AgroOfflineStatus = updateIndicator;

  function applyBrand() {
    try {
      if (document.title) {
        document.title = document.title
          .replace(/PAF\s+Campo/gi, 'AgroDominium')
          .replace(/^PAF\s*[-|·:]?/i, 'AgroDominium ');
      }

      if (!document.body) return;
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      var node;
      var tinyBrandChanges = 0;

      while ((node = walker.nextNode())) {
        var raw = node.nodeValue || '';
        var trimmed = raw.trim();
        if (!trimmed) continue;

        if (/^PAF\s+Campo$/i.test(trimmed)) {
          node.nodeValue = raw.replace(/PAF\s+Campo/i, 'AgroDominium');
          continue;
        }

        if (/^PAF\s+Gest[aã]o\s+Operacional$/i.test(trimmed)) {
          node.nodeValue = raw.replace(/PAF\s+Gest[aã]o\s+Operacional/i, 'AgroDominium');
          continue;
        }

        if (trimmed === 'PAF' && tinyBrandChanges < 3) {
          var parent = node.parentElement;
          var rect = parent && parent.getBoundingClientRect ? parent.getBoundingClientRect() : null;
          if (!rect || rect.top < 180) {
            node.nodeValue = raw.replace(/PAF/, 'AD');
            tinyBrandChanges++;
          }
        }
      }
    } catch (e) {
      // Branding is cosmetic; never block the operational page.
    }
  }

  function scheduleBrand() {
    clearTimeout(brandTimer);
    brandTimer = setTimeout(applyBrand, 80);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyBrand();
      updateIndicator();
    }, { once: true });
  } else {
    applyBrand();
    updateIndicator();
  }

  try {
    new MutationObserver(scheduleBrand).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  } catch (e) {}

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function serializeFormData(formData) {
    var entries = [];
    var iterator = formData.entries();
    var next;

    while (!(next = iterator.next()).done) {
      var name = next.value[0];
      var value = next.value[1];

      if (value instanceof File) {
        entries.push({
          name: name,
          kind: 'file',
          fileName: value.name || 'arquivo',
          mimeType: value.type || 'application/octet-stream',
          data: await fileToDataUrl(value)
        });
      } else {
        entries.push({
          name: name,
          kind: 'text',
          value: String(value == null ? '' : value)
        });
      }
    }

    return { kind: 'formdata', entries: entries };
  }

  async function serializeBody(body) {
    if (body == null) return { kind: 'none' };

    if (body instanceof FormData) {
      return await serializeFormData(body);
    }

    if (body instanceof URLSearchParams) {
      return {
        kind: 'text',
        value: body.toString(),
        contentType: 'application/x-www-form-urlencoded;charset=UTF-8'
      };
    }

    if (typeof body === 'string') {
      return { kind: 'text', value: body };
    }

    if (body instanceof Blob) {
      return {
        kind: 'blob',
        mimeType: body.type || 'application/octet-stream',
        data: await fileToDataUrl(body)
      };
    }

    try {
      return { kind: 'text', value: JSON.stringify(body), contentType: 'application/json' };
    } catch (e) {
      return { kind: 'text', value: String(body) };
    }
  }

  function headersToObject(headers) {
    var out = {};
    try {
      if (!headers) return out;
      new Headers(headers).forEach(function (value, key) {
        out[key] = value;
      });
    } catch (e) {}
    return out;
  }

  function isSensitiveEndpoint(url) {
    var value = String(url || '').toLowerCase();
    return /login|logout|signin|signout|autentica|authentication|password|senha/.test(value);
  }

  function looksLikeWriteEndpoint(url, body) {
    var value = String(url || '').toLowerCase();
    if (/salvar|save|store|create|insert|update|upload|checklist|produtor|atividade|coleta|rota|ponto|registro|sync/.test(value)) {
      return true;
    }

    var text = '';
    try {
      if (typeof body === 'string') text = body.toLowerCase();
      else if (body instanceof URLSearchParams) text = body.toString().toLowerCase();
    } catch (e) {}

    return /salvar|save|insert|update|checklist|produtor|atividade|coleta|rota|ponto/.test(text);
  }

  async function queuePayload(payload) {
    try {
      var id = Native.queue(JSON.stringify(payload));
      updateIndicator();
      return id;
    } catch (e) {
      try { Native.toast('Não foi possível salvar a coleta offline.'); } catch (ignore) {}
      return -1;
    }
  }

  function offlineResponse() {
    try {
      return new Response(JSON.stringify({
        success: true,
        offline: true,
        queued: true,
        message: 'Salvo no aparelho para sincronização.'
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' }
      });
    } catch (e) {
      return Promise.resolve({
        ok: true,
        status: 202,
        json: function () { return Promise.resolve({ success: true, offline: true, queued: true }); },
        text: function () { return Promise.resolve('{"success":true,"offline":true,"queued":true}'); }
      });
    }
  }

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (isOnline()) return;
    if (form.querySelector('input[type="password"]')) return;

    var action = absoluteUrl(form.getAttribute('action') || location.href);
    if (isSensitiveEndpoint(action)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    (async function () {
      var formData = new FormData(form);
      var payload = {
        version: 2,
        source: 'form',
        url: action,
        method: String(form.getAttribute('method') || 'POST').toUpperCase(),
        headers: {},
        body: await serializeFormData(formData),
        pageUrl: location.href,
        createdAt: Date.now()
      };
      await queuePayload(payload);
    })();
  }, true);

  if (originalFetch) {
    window.fetch = async function (input, init) {
      init = init || {};
      var url = absoluteUrl(typeof input === 'string' || input instanceof URL ? input : input.url);
      var method = String(init.method || (input && input.method) || 'GET').toUpperCase();
      var body = Object.prototype.hasOwnProperty.call(init, 'body') ? init.body : null;

      var shouldQueue = method !== 'GET'
        && method !== 'HEAD'
        && !isSensitiveEndpoint(url)
        && looksLikeWriteEndpoint(url, body);

      if (!shouldQueue) {
        return originalFetch(input, init);
      }

      if (!isOnline()) {
        await queuePayload({
          version: 2,
          source: 'fetch',
          url: url,
          method: method,
          headers: headersToObject(init.headers || (input && input.headers)),
          body: await serializeBody(body),
          pageUrl: location.href,
          createdAt: Date.now()
        });
        return offlineResponse();
      }

      try {
        return await originalFetch(input, init);
      } catch (error) {
        if (!isOnline()) {
          await queuePayload({
            version: 2,
            source: 'fetch-fallback',
            url: url,
            method: method,
            headers: headersToObject(init.headers || (input && input.headers)),
            body: await serializeBody(body),
            pageUrl: location.href,
            createdAt: Date.now()
          });
          return offlineResponse();
        }
        throw error;
      }
    };
  }

  function dataUrlToBlob(dataUrl, fallbackType) {
    var parts = String(dataUrl || '').split(',');
    var meta = parts[0] || '';
    var encoded = parts.slice(1).join(',');
    var match = meta.match(/data:([^;]+)/i);
    var type = (match && match[1]) || fallbackType || 'application/octet-stream';
    var binary = atob(encoded);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: type });
  }

  function restoreBody(body, headers) {
    if (!body || body.kind === 'none') return null;

    if (body.kind === 'formdata') {
      var fd = new FormData();
      (body.entries || []).forEach(function (entry) {
        if (entry.kind === 'file') {
          fd.append(entry.name,
            dataUrlToBlob(entry.data, entry.mimeType),
            entry.fileName || 'arquivo');
        } else {
          fd.append(entry.name, entry.value == null ? '' : String(entry.value));
        }
      });
      Object.keys(headers).forEach(function (key) {
        if (key.toLowerCase() === 'content-type') delete headers[key];
      });
      return fd;
    }

    if (body.kind === 'blob') {
      return dataUrlToBlob(body.data, body.mimeType);
    }

    if (body.kind === 'text') {
      if (body.contentType && !Object.keys(headers).some(function (key) {
        return key.toLowerCase() === 'content-type';
      })) {
        headers['Content-Type'] = body.contentType;
      }
      return body.value == null ? '' : String(body.value);
    }

    return null;
  }

  async function syncNow() {
    if (syncing || !isOnline() || !originalFetch) {
      updateIndicator();
      return;
    }

    var rows;
    try {
      rows = JSON.parse(Native.getAll() || '[]');
    } catch (e) {
      rows = [];
    }

    if (!rows.length) {
      updateIndicator();
      return;
    }

    syncing = true;
    updateIndicator();
    var synced = 0;

    for (var i = 0; i < rows.length; i++) {
      if (!isOnline()) break;

      var row = rows[i];
      var payload;
      try {
        payload = JSON.parse(row.payload);
      } catch (e) {
        continue;
      }

      try {
        var headers = Object.assign({}, payload.headers || {});
        var response = await originalFetch(payload.url, {
          method: payload.method || 'POST',
          headers: headers,
          body: restoreBody(payload.body, headers),
          credentials: 'include',
          redirect: 'follow',
          cache: 'no-store'
        });

        if (response && response.ok) {
          Native.remove(Number(row.id));
          synced++;
          updateIndicator();
        }
      } catch (e) {
        break;
      }
    }

    syncing = false;
    updateIndicator();
    if (synced > 0) {
      try { Native.toast(synced + ' coleta(s) sincronizada(s).'); } catch (e) {}
    }
  }

  window.AgroSyncNow = syncNow;
  window.addEventListener('online', function () {
    updateIndicator();
    setTimeout(syncNow, 700);
  });
  window.addEventListener('offline', updateIndicator);

  setTimeout(function () {
    updateIndicator();
    if (isOnline()) syncNow();
  }, 900);

  setInterval(function () {
    updateIndicator();
    if (isOnline() && safeCount() > 0) syncNow();
  }, 30000);
})();
