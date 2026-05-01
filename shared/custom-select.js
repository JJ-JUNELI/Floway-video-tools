/**
 * Floway Tools — 自定义下拉框组件
 *
 * 将原生 <select> 增强为完全可定制的下拉组件
 * 用法: import { enhanceSelect, enhanceAllSelects } from '../shared/custom-select.js';
 *       enhanceAllSelects();  // 自动增强页面所有 select
 *       enhanceSelect(document.getElementById('MySelect'));
 */

// ========== 工具函数 ==========

/** 从 inline style 中只提取布局属性（flex, width, min/max-width, margin） */
function extractLayoutStyle(style) {
    const allowed = /^(flex|flex-|width|min-width|max-width|margin|display)/;
    return style.split(';')
        .map(s => s.trim())
        .filter(s => allowed.test(s))
        .join('; ');
}

// ========== 增强单个 select ==========

export function enhanceSelect(selectEl) {
    if (selectEl._fsEnhanced) return;
    selectEl._fsEnhanced = true;

    // 只提取布局属性给 wrapper（去掉 padding/border/background 等装饰属性）
    const layoutStyle = extractLayoutStyle(selectEl.getAttribute('style') || '');

    // 容器
    const wrapper = document.createElement('div');
    wrapper.className = 'floway-select';
    wrapper.setAttribute('style', layoutStyle);

    // 触发器按钮
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'fs-trigger';

    // 下拉面板
    const dropdown = document.createElement('div');
    dropdown.className = 'fs-dropdown';

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);

    // 隐藏原生 select，插入自定义组件
    selectEl.style.display = 'none';
    selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);

    // ---- 同步渲染 ----

    function syncFromNative() {
        const options = selectEl.querySelectorAll('option');
        const selectedOpt = selectEl.options[selectEl.selectedIndex];

        // 更新触发器文本
        trigger.innerHTML = `<span class="fs-text">${selectedOpt ? selectedOpt.textContent : ''}</span>` + arrowSVG();
        if (selectEl.disabled) wrapper.classList.add('fs-wrapper-disabled');
        else wrapper.classList.remove('fs-wrapper-disabled');

        // 重建选项
        dropdown.innerHTML = '';
        for (const opt of options) {
            if (opt.disabled && !opt.value) continue;
            const el = document.createElement('div');
            el.className = 'fs-option';
            if (opt.disabled) el.classList.add('fs-disabled');
            if (opt.selected) el.classList.add('fs-selected');
            el.dataset.value = opt.value;
            el.textContent = opt.textContent;
            dropdown.appendChild(el);
        }
    }

    function syncSelected() {
        const val = selectEl.value;
        const selOpt = selectEl.options[selectEl.selectedIndex];
        trigger.querySelector('.fs-text').textContent = selOpt ? selOpt.textContent : '';
        dropdown.querySelectorAll('.fs-option').forEach(el => {
            el.classList.toggle('fs-selected', el.dataset.value === val);
        });
    }

    function arrowSVG() {
        return `<svg class="fs-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    // 初次同步
    syncFromNative();

    // ---- 事件 ----

    let isOpen = false;
    const uid = Math.random().toString(36).slice(2);

    function open() {
        if (isOpen) return;
        // 关闭其他已打开的下拉
        document.dispatchEvent(new CustomEvent('fs-close-all', { detail: { except: uid } }));
        isOpen = true;
        dropdown.classList.add('fs-open');
        trigger.classList.add('fs-active');
        positionDropdown();
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        dropdown.classList.remove('fs-open');
        trigger.classList.remove('fs-active');
    }

    function positionDropdown() {
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 200 && spaceAbove > spaceBelow) {
            dropdown.style.bottom = '100%';
            dropdown.style.top = 'auto';
            dropdown.style.marginBottom = '4px';
            dropdown.style.marginTop = '0';
        } else {
            dropdown.style.top = '100%';
            dropdown.style.bottom = 'auto';
            dropdown.style.marginTop = '4px';
            dropdown.style.marginBottom = '0';
        }
    }

    function selectOption(value, text) {
        selectEl.value = value;
        trigger.querySelector('.fs-text').textContent = text;
        dropdown.querySelectorAll('.fs-option').forEach(el => {
            el.classList.toggle('fs-selected', el.dataset.value === value);
        });
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        close();
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOpen) close(); else open();
    });

    dropdown.addEventListener('click', (e) => {
        const optEl = e.target.closest('.fs-option');
        if (!optEl || optEl.classList.contains('fs-disabled')) return;
        selectOption(optEl.dataset.value, optEl.textContent);
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) close();
    });
    document.addEventListener('fs-close-all', (e) => {
        if (e.detail.except !== uid) close();
    });

    // 键盘导航
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { close(); return; }
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (isOpen) close(); else open(); return; }
        if (!isOpen) return;

        const opts = [...dropdown.querySelectorAll('.fs-option:not(.fs-disabled)')];
        const curIdx = opts.findIndex(el => el.classList.contains('fs-kb-focus'));
        let nextIdx = -1;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            nextIdx = curIdx < opts.length - 1 ? curIdx + 1 : 0;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            nextIdx = curIdx > 0 ? curIdx - 1 : opts.length - 1;
        }

        if (nextIdx >= 0) {
            opts.forEach(el => el.classList.remove('fs-kb-focus'));
            opts[nextIdx].classList.add('fs-kb-focus');
            opts[nextIdx].scrollIntoView({ block: 'nearest' });
        }
    });

    // 监听原生 select 的子节点变化（动态添加 option 时同步）
    const childObserver = new MutationObserver(() => syncFromNative());
    childObserver.observe(selectEl, { childList: true, subtree: true });

    // 监听 value 属性变化
    const attrObserver = new MutationObserver(() => syncSelected());
    attrObserver.observe(selectEl, { attributes: true, attributeFilter: ['value'] });

    // 暴露 refresh 方法，供外部（如字体选择器）在 value 变更后手动调用
    selectEl._fsRefresh = syncFromNative;
}

// ========== 批量增强 ==========

export function enhanceAllSelects(root = document) {
    root.querySelectorAll('select').forEach(el => enhanceSelect(el));
}
