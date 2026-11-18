/* 浏览器端运行时：把 WXML AST + 小程序 Page 逻辑跑在普通 DOM 上 */
(function () {
  var AST = window.__AST__ || [];
  var TEMPLATES = window.__TEMPLATES__ || {};
  var ASSETS = window.__ASSETS__ || {};

  var TAG_MAP = { view: 'div', text: 'span', image: 'img', 'scroll-view': 'div' };
  var BOOL_ATTRS = { disabled: 1 };

  /* ---------- 表达式求值 ---------- */
  var FN_CACHE = Object.create(null);
  function evalExpr(expr, scope) {
    var fn = FN_CACHE[expr];
    if (!fn) {
      try {
        // eslint-disable-next-line no-new-func
        fn = new Function('__scope__', 'with(__scope__){ return (' + expr + '); }');
      } catch (e) {
        fn = function () { return undefined; };
      }
      FN_CACHE[expr] = fn;
    }
    try { return fn(scope); } catch (e) { return undefined; }
  }

  function interpolate(str, scope) {
    if (!str || str.indexOf('{{') === -1) return str;
    return str.replace(/\{\{([\s\S]*?)\}\}/g, function (_, expr) {
      var v = evalExpr(expr.trim(), scope);
      return v === undefined || v === null ? '' : String(v);
    });
  }

  function evalAttr(str, scope) {
    if (str === undefined || str === null) return undefined;
    var m = /^\s*\{\{([\s\S]*)\}\}\s*$/.exec(str);
    return m ? evalExpr(m[1].trim(), scope) : interpolate(str, scope);
  }

  function truthy(v) { return !!v; }

  /* ---------- 转义 ---------- */
  function escText(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return escText(s).replace(/"/g, '&quot;');
  }

  function mapSrc(src) {
    if (typeof src === 'string' && ASSETS[src]) return ASSETS[src];
    return src;
  }

  /* ---------- 模板数据 ---------- */
  function hasTopLevelColon(expr) {
    var depth = 0, quote = null;
    for (var i = 0; i < expr.length; i++) {
      var ch = expr[i];
      if (quote) {
        if (ch === '\\') { i++; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') { depth++; continue; }
      if (ch === ')' || ch === ']' || ch === '}') { depth--; continue; }
      if (ch === ':' && depth === 0) return true;
    }
    return false;
  }

  function evalTemplateData(expr, scope) {
    if (!expr) return {};
    var v = hasTopLevelColon(expr)
      ? evalExpr('({' + expr + '})', scope)
      : evalExpr(expr, scope);
    return v || {};
  }

  /* ---------- 渲染 ---------- */
  function renderChildren(children, scope) {
    var out = '';
    var chain = null;

    for (var i = 0; i < children.length; i++) {
      var node = children[i];

      if (node.type === 'text') {
        if (!node.text || !node.text.trim()) continue;
        out += escText(interpolate(node.text, scope));
        chain = null;
        continue;
      }

      var a = node.attrs || {};

      if (a['wx:for'] !== undefined) {
        out += renderFor(node, scope);
        chain = null;
        continue;
      }

      if (a['wx:if'] !== undefined) {
        chain = { matched: truthy(evalAttr(a['wx:if'], scope)) };
        if (chain.matched) out += renderEl(node, scope);
        continue;
      }

      if (a['wx:elif'] !== undefined) {
        if (!chain) continue;
        if (!chain.matched && truthy(evalAttr(a['wx:elif'], scope))) {
          out += renderEl(node, scope);
          chain.matched = true;
        }
        continue;
      }

      if (a['wx:else'] !== undefined) {
        if (!chain) continue;
        if (!chain.matched) {
          out += renderEl(node, scope);
          chain.matched = true;
        }
        continue;
      }

      chain = null;
      out += renderEl(node, scope);
    }

    return out;
  }

  function renderFor(node, scope) {
    var list = evalAttr(node.attrs['wx:for'], scope);
    if (list === undefined || list === null) return '';
    if (!Array.isArray(list)) {
      if (typeof list === 'string') list = list.split('');
      else if (typeof list === 'object') {
        var arr = [];
        for (var k in list) { if (Object.prototype.hasOwnProperty.call(list, k)) arr.push(list[k]); }
        list = arr;
      } else return '';
    }

    var itemName = node.attrs['wx:for-item'] || 'item';
    var indexName = node.attrs['wx:for-index'] || 'index';
    var keyExpr = node.attrs['wx:key'];
    var loopId = node.loopId || 0;

    var out = '';
    var used = Object.create(null);

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var childScope = Object.create(scope);
      childScope[itemName] = item;
      childScope[indexName] = i;

      var vkey;
      if (keyExpr) {
        var kv;
        if (keyExpr === '*this') kv = item;
        else if (item !== null && typeof item === 'object') kv = item[keyExpr];
        else kv = undefined;
        if (kv === undefined || kv === null) kv = i;
        vkey = 'l' + loopId + ':' + String(kv);
        if (used[vkey]) vkey = vkey + '#' + i;
        used[vkey] = 1;
      }

      out += renderEl(node, childScope, vkey);
    }
    return out;
  }

  function renderEl(node, scope, vkey) {
    var tag = node.tag;
    var a = node.attrs || {};

    if (tag === 'template') {
      if (a.is === undefined) return ''; // 模板定义本身不渲染
      var tpl = TEMPLATES[a.is];
      if (!tpl) return '';
      var dataExpr = a.data === undefined ? '' :
        String(a.data).trim().replace(/^\{\{/, '').replace(/\}\}$/, '').trim();
      return renderChildren(tpl.children, evalTemplateData(dataExpr, scope));
    }

    if (tag === 'block') return renderChildren(node.children, scope);

    var htmlTag = TAG_MAP[tag] || tag;
    var attrs = '';
    var textareaValue = null;

    if (vkey !== undefined) attrs += ' data-vkey="' + escAttr(vkey) + '"';

    for (var name in a) {
      if (name.indexOf('wx:') === 0) continue;
      if (name === 'is' || name === 'data') continue;

      var raw = a[name];

      if (name.indexOf('bind') === 0 || name.indexOf('catch') === 0) {
        var evt = name.replace(/^(bind|catch)/, '');
        attrs += ' data-on-' + evt + '="' + escAttr(raw) + '"';
        continue;
      }

      if (name === 'mode' && tag === 'image') {
        attrs += ' data-mode="' + escAttr(interpolate(raw, scope)) + '"';
        continue;
      }

      if (BOOL_ATTRS[name]) {
        var isOn;
        if (raw === '') isOn = true;
        else {
          var bm = /^\s*\{\{([\s\S]*)\}\}\s*$/.exec(raw);
          isOn = bm ? truthy(evalExpr(bm[1].trim(), scope)) : true;
        }
        if (isOn) attrs += ' ' + name;
        continue;
      }

      if (name === 'value' && tag === 'textarea') {
        textareaValue = evalAttr(raw, scope);
        continue;
      }

      var val = interpolate(raw, scope);
      if (name === 'src') val = mapSrc(val);
      attrs += ' ' + name + '="' + escAttr(val) + '"';
    }

    if (tag === 'image' || tag === 'input') return '<' + htmlTag + attrs + '>';

    var inner = textareaValue !== null
      ? escText(textareaValue === undefined || textareaValue === null ? '' : textareaValue)
      : renderChildren(node.children, scope);

    return '<' + htmlTag + attrs + '>' + inner + '</' + htmlTag + '>';
  }

  function renderApp(data) {
    return renderChildren(AST, data);
  }

  /* ---------- wx API 垫片 ---------- */
  var noop = function () {};
  window.wx = {
    getWindowInfo: function () {
      return {
        statusBarHeight: 12,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: window.innerHeight,
        screenWidth: window.screen ? window.screen.width : document.documentElement.clientWidth,
        screenHeight: window.screen ? window.screen.height : window.innerHeight,
        pixelRatio: window.devicePixelRatio || 1
      };
    },
    getSystemInfoSync: function () { return window.wx.getWindowInfo(); },
    /* ── 订阅消息：预览环境自动视为同意（真实小程序里弹系统授权框） ── */
    requestSubscribeMessage: function (opts) {
      opts = opts || {};
      setTimeout(function () {
        var res = {};
        (opts.tmplIds || []).forEach(function (id) { res[id] = 'accept'; });
        if (opts.success) opts.success(res);
        if (opts.complete) opts.complete(res);
      }, 350);
    },
    pageScrollTo: function (o) {
      o = o || {};
      try {
        window.scrollTo({
          top: o.scrollTop || 0,
          behavior: o.duration ? 'smooth' : 'auto'
        });
      } catch (e) { window.scrollTo(0, o.scrollTop || 0); }
    },
    chooseMedia: function (opts) {
      opts = opts || {};
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        document.body.removeChild(input);
        if (!file) { if (opts.fail) opts.fail({ errMsg: 'chooseMedia:fail cancel' }); return; }
        var reader = new FileReader();
        reader.onload = function () {
          if (opts.success) opts.success({
            tempFiles: [{ tempFilePath: reader.result, size: file.size }],
            type: 'image'
          });
        };
        reader.readAsDataURL(file);
      });
      input.click();
    },
    /* ── posterKit：浏览器端 Canvas 垫片 ── */
    createOffscreenCanvas: function (opts) {
      var c = document.createElement('canvas');
      c.width = (opts && opts.width) || 300;
      c.height = (opts && opts.height) || 150;
      c.createImage = function () { return new Image(); };
      return c;
    },
    canvasToTempFilePath: function (opts) {
      opts = opts || {};
      try {
        var type = opts.fileType === 'jpg' ? 'image/jpeg' : 'image/png';
        var url = opts.canvas.toDataURL(type, opts.quality);
        setTimeout(function () {
          if (opts.success) opts.success({ tempFilePath: url });
        }, 0);
      } catch (e) {
        if (opts.fail) opts.fail({ errMsg: 'canvasToTempFilePath:fail ' + e.message });
      }
    },
    saveImageToPhotosAlbum: function (opts) {
      opts = opts || {};
      try {
        var a = document.createElement('a');
        a.href = opts.filePath;
        a.download = 'weekly-poster-' + Date.now() + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (opts.success) opts.success({});
      } catch (e) {
        if (opts.fail) opts.fail({ errMsg: 'saveImageToPhotosAlbum:fail' });
      }
    },
    getImageInfo: function (opts) {
      opts = opts || {};
      if (opts.success) opts.success({ path: opts.src, width: 0, height: 0, orientation: 'up' });
    },
    loadFontFace: function (opts) {
      opts = opts || {};
      if (opts.success) opts.success({});
    },
    showLoading: noop,
    hideLoading: noop,
    nextTick: function (cb) {
      if (typeof cb !== 'function') return;
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(cb);
        });
      } else {
        setTimeout(cb, 30);
      }
    },
    createIntersectionObserver: function () {
      var items = [];
      var api = {
        relativeTo: function () { return api; },
        relativeToViewport: function () { return api; },
        observe: function (selector, cb) {
          // 旧浏览器 / jsdom 等无 IntersectionObserver 的环境：静默降级（不显示浮层）
          if (typeof window.IntersectionObserver === 'undefined') return api;
          var el = document.querySelector(selector);
          if (!el) return api;
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (typeof cb === 'function') {
                cb({
                  boundingClientRect: en.boundingClientRect,
                  intersectionRatio: en.intersectionRatio,
                  intersectionRect: en.intersectionRect,
                  relativeRect: en.intersectionRect,
                  time: en.time
                });
              }
            });
          }, { threshold: [0, 0.01, 0.1, 0.5, 1] });
          io.observe(el);
          items.push(io);
          return api;
        },
        disconnect: function () {
          items.forEach(function (io) { io.disconnect(); });
          items = [];
        }
      };
      return api;
    },
    showActionSheet: function (opts) {
      opts = opts || {};
      var list = opts.itemList || [];
      var mask = document.createElement('div');
      mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;' +
        'display:flex;align-items:flex-end;justify-content:center;';
      var sheet = document.createElement('div');
      sheet.style.cssText = 'width:100%;max-width:390px;background:#fff;border-radius:16px 16px 0 0;' +
        'padding:8px 12px 16px;box-shadow:0 -8px 30px rgba(0,0,0,.15);';
      var done = false;
      function close() {
        done = true;
        if (mask.parentNode) mask.parentNode.removeChild(mask);
      }
      list.forEach(function (label, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.style.cssText = 'display:block;width:100%;height:50px;border:none;border-bottom:1px solid #eee;' +
          'background:transparent;font-size:15px;color:#1D1D1F;cursor:pointer;font-family:inherit;';
        b.onclick = function () {
          close();
          if (opts.success) opts.success({ tapIndex: i });
        };
        sheet.appendChild(b);
      });
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '取消';
      cancel.style.cssText = 'display:block;width:100%;height:50px;border:none;background:transparent;' +
        'font-size:15px;color:#A1A1A6;cursor:pointer;font-family:inherit;';
      cancel.onclick = function () {
        close();
        if (opts.fail) opts.fail({ errMsg: 'showActionSheet:fail cancel' });
      };
      sheet.appendChild(cancel);
      mask.appendChild(sheet);
      mask.addEventListener('click', function (e) {
        if (e.target === mask) cancel.onclick();
      });
      document.body.appendChild(mask);
    },
    showModal: function (opts) {
      opts = opts || {};
      if (opts.success) opts.success({ confirm: true, cancel: false });
    },
    openSetting: function (opts) {
      opts = opts || {};
      if (opts.success) opts.success({ authSetting: { 'scope.writePhotosAlbum': true } });
    },
    showToast: noop,
    hideToast: noop,
    stopPullDownRefresh: noop
  };

  /* ---------- Page / setData ---------- */
  var pageReady = false;
  var scheduled = false;
  var raf = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : function (fn) { return setTimeout(fn, 16); };

  window.Page = function (opts) {
    window.__PAGE_OPTS__ = opts;
  };

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    raf(function () {
      scheduled = false;
      doRender();
    });
  }

  var pageInstance = null;

  function doRender() {
    if (!pageInstance) return;
    var app = document.getElementById('app');
    if (!app) return;

    var html = renderApp(pageInstance.data);
    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    window.morphdom(app, wrapper, {
      childrenOnly: true,
      getNodeKey: function (node) {
        return node.getAttribute ? (node.getAttribute('data-vkey') || null) : null;
      },
      onBeforeElUpdated: function (fromEl, toEl) {
        if (fromEl === document.activeElement &&
            (fromEl.tagName === 'INPUT' || fromEl.tagName === 'TEXTAREA')) return false;
        if (fromEl.isEqualNode && fromEl.isEqualNode(toEl)) return false;
        return true;
      }
    });
  }

  /* ---------- 事件委托 ---------- */
  function runHandler(el, type, detail, targetEl) {
    var name = el.getAttribute('data-on-' + type);
    if (!name || !pageInstance || typeof pageInstance[name] !== 'function') return;

    var dataset = {};
    for (var k in el.dataset) dataset[k] = el.dataset[k];

    var targetDataset = {};
    var tEl = targetEl || el;
    if (tEl.dataset) for (var t in tEl.dataset) targetDataset[t] = tEl.dataset[t];

    pageInstance[name]({
      type: type,
      timeStamp: Date.now(),
      currentTarget: { id: el.id || '', dataset: dataset },
      target: { id: tEl.id || '', dataset: targetDataset },
      detail: detail || {}
    });
  }

  var suppressClick = false;

  function onTap(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-on-tap]') : null;
    if (!el || !document.getElementById('app').contains(el)) return;

    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    runHandler(el, 'tap', {}, e.target);
  }

  function onInput(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-on-input]') : null;
    if (!el) return;
    runHandler(el, 'input', { value: e.target.value }, e.target);
  }

  var lpTimer = null;
  function clearLongPress() {
    if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
  }

  function onPointerDown(e) {
    suppressClick = false;
    var el = e.target && e.target.closest ? e.target.closest('[data-on-longpress]') : null;
    if (!el) return;
    clearLongPress();
    lpTimer = setTimeout(function () {
      lpTimer = null;
      suppressClick = true;
      runHandler(el, 'longpress', {}, e.target);
    }, 380);
  }

  function onPointerUp() { clearLongPress(); }

  document.addEventListener('click', onTap);
  document.addEventListener('input', onInput);
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('pointerleave', onPointerUp);
  document.addEventListener('pointermove', function (e) {
    // 长按过程中如果移动明显，取消
    if (e.movementX || e.movementY) clearLongPress();
  });
  window.addEventListener('scroll', function () {
    if (!pageInstance || typeof pageInstance.onPageScroll !== 'function') return;
    var top = window.scrollY ||
      (document.documentElement && document.documentElement.scrollTop) ||
      (document.body && document.body.scrollTop) || 0;
    pageInstance.onPageScroll({ scrollTop: top });
  }, { passive: true });

  /* ---------- 启动 ---------- */
  function deepClone(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }

  window.__boot = function () {
    if (pageReady) return;
    pageReady = true;

    var opts = window.__PAGE_OPTS__;
    if (!opts) throw new Error('Page() 未被调用');

    var inst = Object.create(opts);
    inst.data = deepClone(opts.data || {});
    inst.setData = function (patch, cb) {
      if (patch) {
        Object.keys(patch).forEach(function (key) {
          var val = patch[key];
          if (key.indexOf('.') !== -1) {
            var parts = key.split('.');
            var obj = inst.data;
            for (var i = 0; i < parts.length - 1; i++) {
              obj = obj[parts[i]];
              if (!obj) return;
            }
            obj[parts[parts.length - 1]] = val;
          } else {
            inst.data[key] = val;
          }
        });
      }
      scheduleRender();
      if (typeof cb === 'function') setTimeout(cb, 0);
    };

    pageInstance = inst;
    window.__page = inst;

    inst.onLoad && inst.onLoad();
    // 浏览器里没有状态栏和胶囊按钮：只留 12px 呼吸空间
    inst.setData({ statusBarHeight: 12, navTop: 12 });
    inst.onReady && inst.onReady();

    doRender();
  };

  // 调试用
  window.__renderApp = renderApp;
})();
