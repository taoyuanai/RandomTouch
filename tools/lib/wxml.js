'use strict';

// 极简 WXML 解析器：只覆盖本项目用到的语法（WXML 不是 XML，不能直接用浏览器的 DOMParser）。
// 输出 AST：{ type:'el', tag, attrs, children } / { type:'text', text }

const VOID_TAGS = new Set(['image', 'input']);

function parseWXML(src) {
  const root = { type: 'el', tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const n = src.length;
  let i = 0;

  while (i < n) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }

    if (src[i] === '<') {
      // 闭合标签
      if (src[i + 1] === '/') {
        const end = src.indexOf('>', i);
        const name = src.slice(i + 2, end === -1 ? n : end).trim();
        i = end === -1 ? n : end + 1;
        for (let k = stack.length - 1; k >= 1; k--) {
          if (stack[k].tag === name) { stack.length = k; break; }
        }
        continue;
      }

      // 开始标签
      let j = i + 1;
      let name = '';
      while (j < n && /[A-Za-z0-9\-_:]/.test(src[j])) { name += src[j]; j++; }

      if (!name) { // 孤立的 '<'
        stack[stack.length - 1].children.push({ type: 'text', text: '<' });
        i++;
        continue;
      }

      const attrs = {};
      let selfClose = false;

      while (j < n) {
        while (j < n && /\s/.test(src[j])) j++;
        if (j >= n) break;
        if (src[j] === '>') { j++; break; }
        if (src[j] === '/' && src[j + 1] === '>') { selfClose = true; j += 2; break; }

        let attrName = '';
        while (j < n && !/[\s=\/>]/.test(src[j])) { attrName += src[j]; j++; }
        while (j < n && /\s/.test(src[j])) j++;

        let attrValue = '';
        if (src[j] === '=') {
          j++;
          while (j < n && /\s/.test(src[j])) j++;
          const quote = src[j];
          if (quote === '"' || quote === "'") {
            j++;
            const start = j;
            while (j < n && src[j] !== quote) j++;
            attrValue = src.slice(start, j);
            j++;
          } else {
            const start = j;
            while (j < n && !/[\s>]/.test(src[j])) j++;
            attrValue = src.slice(start, j);
          }
        }
        if (attrName) attrs[attrName] = attrValue;
      }

      const node = { type: 'el', tag: name, attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!selfClose && !VOID_TAGS.has(name)) stack.push(node);
      i = j;
    } else {
      let next = src.indexOf('<', i);
      if (next === -1) next = n;
      stack[stack.length - 1].children.push({ type: 'text', text: src.slice(i, next) });
      i = next;
    }
  }

  return root.children;
}

function collectTemplates(ast) {
  const templates = {};
  (function walk(list) {
    for (const node of list) {
      if (node.type !== 'el') continue;
      if (node.tag === 'template' && node.attrs.name) templates[node.attrs.name] = node;
      if (node.children) walk(node.children);
    }
  })(ast);
  return templates;
}

// 给每个 wx:for 分配稳定 ID，供浏览器端 vkey 使用（避免不同列表 key 冲突）
function annotateLoops(ast) {
  let id = 0;
  (function walk(list) {
    for (const node of list) {
      if (node.type !== 'el') continue;
      if (node.attrs['wx:for'] !== undefined) node.loopId = ++id;
      if (node.children) walk(node.children);
    }
  })(ast);
}

module.exports = { parseWXML, collectTemplates, annotateLoops };
