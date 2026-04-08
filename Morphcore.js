/*Reading uh? */
;(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MorphCore = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    const DEFAULTS = {
        w: 360,
        h: 300,
        pos: 'center',
        dur: 0.55,
        ease: 'expo.out',
        closeOnOverlay: false,
        closeOnEscape: true,
        pad: 12,
        bg: '',
        radius: '6px',
        shadow: '',
        overlayId: 'mo',
        overlayAutoCreate: false,
        overlayColor: 'transparent',
        debug: false,
        stackOffset: 16,
    };
    let _gsap = null;
    let _config = Object.assign({}, DEFAULTS);
    let _initiated = false;
    let _listeners = [];
    const _stack = [];
    const _events = {};
    let _scrollY = 0;
    let _scrollLocked = false;
    let _resizeTimer = null;
    let _bodyStylesBackup = {};
    function log(...args) { if (_config.debug) console.log('[MorphCore]', ...args); }
    function warn(...args) { console.warn('[MorphCore]', ...args); }
    function on(event, handler) {
        if (typeof handler !== 'function') return;
        if (!_events[event]) _events[event] = [];
        _events[event].push(handler);
    }
    function off(event, handler) {
        if (!_events[event]) return;
        _events[event] = _events[event].filter(h => h !== handler);
    }
    function emit(event, ...args) {
        if (_events[event]) _events[event].forEach(h => {
            try { h(...args); } catch (e) { warn('Event handler error:', e); }
        });
    }
    function opt(m, k) {
        if (m.dataset[k] !== undefined) return m.dataset[k];
        const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (m.dataset[camel] !== undefined) return m.dataset[camel];
        return _config[camel] !== undefined ? _config[camel] : _config[k] !== undefined ? _config[k] : undefined;
    }
    function parseUnit(val, total) {
        if (val === undefined || val === null) return null;
        const s = String(val).trim();
        if (s.endsWith('%')) return (parseFloat(s) / 100) * total;
        return parseFloat(s);
    }
    function clamp(v, mn, mx) { return Math.max(mn, Math.min(v, mx)); }
    function calcPos(r, w, h, m) {
        const pad = +opt(m, 'pad');
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rawX = m.dataset.posX ?? m.dataset['pos-x'];
        const rawY = m.dataset.posY ?? m.dataset['pos-y'];

        if (rawX !== undefined || rawY !== undefined) {
            const left = rawX !== undefined ? clamp(parseUnit(rawX, vw), pad, vw - w - pad) : clamp((vw - w) / 2, pad, vw - w - pad);
            const top = rawY !== undefined ? clamp(parseUnit(rawY, vh), pad, vh - h - pad) : clamp((vh - h) / 2, pad, vh - h - pad);
            return { top, left };
        }

        const pos = opt(m, 'pos');
        const offset = _stack.length * _config.stackOffset;
        const cx = clamp((vw - w) / 2 + offset, pad, vw - w - pad);
        const cy = clamp((vh - h) / 2 - offset, pad, vh - h - pad);
        const T = pad, B = vh - h - pad, L = pad, R = vw - w - pad;

        switch (pos) {
            case 'top': return { top: T, left: cx };
            case 'bottom': return { top: B, left: cx };
            case 'left': return { top: cy, left: L };
            case 'right': return { top: cy, left: R };
            case 'top-left': return { top: T, left: L };
            case 'top-right': return { top: T, left: R };
            case 'bottom-left': return { top: B, left: L };
            case 'bottom-right': return { top: B, left: R };
            case 'origin': {
                let left = r.left + r.width + 8;
                if (left + w > vw - pad) left = r.left - w - 8;
                left = clamp(left, pad, vw - w - pad);
                let top = r.top;
                if (top + h > vh - pad) top = clamp(r.bottom - h, pad, vh - h - pad);
                return { top, left };
            }
            case 'origin-below': {
                const left = clamp(r.left, pad, vw - w - pad);
                let top = r.bottom + 6;
                if (top + h > vh - pad) top = r.top - h - 6;
                return { top: clamp(top, pad, vh - h - pad), left };
            }
            case 'origin-above': {
                const left = clamp(r.left, pad, vw - w - pad);
                return { top: clamp(r.top - h - 6, pad, vh - h - pad), left };
            }
            default: return { top: cy, left: cx };
        }
    }
    function lockScroll() {
    if (_scrollLocked) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    _scrollLocked = true;
}

function unlockScroll() {
    if (!_scrollLocked) return;
    
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    _scrollLocked = false;
}
    const FOCUSABLE = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])', '[data-close]'].join(', ');
    function trapFocus(container, e) {
        const els = [...container.querySelectorAll(FOCUSABLE)].filter(el => !el.closest('[hidden]'));
        if (!els.length) { e.preventDefault(); return; }
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
        else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    }
    function getOverlay() { return document.getElementById(_config.overlayId); }
    function ensureOverlay() {
        let mo = getOverlay();
        if (!mo && _config.overlayAutoCreate) {
            mo = document.createElement('div');
            mo.id = _config.overlayId;
            Object.assign(mo.style, { position: 'fixed', inset: '0', zIndex: '99', background: _config.overlayColor, opacity: '0', pointerEvents: 'none', transition: 'opacity 0.3s ease' });
            document.body.appendChild(mo);
        }
        return mo;
    }

    function resolveElement(m) {
        if (typeof m === 'string') return document.getElementById(m) || document.querySelector(m);
        return m;
    }
    function open(m, overrides) {
        const gsap = _gsap;
        m = resolveElement(m);
        if (!m) { warn('open(): Element not found.'); return; }
        const existingIndex = _stack.findIndex(e => e.modal === m);
        if (existingIndex > -1) {
            const entry = _stack[existingIndex];
            if (entry._closing) {
                gsap.killTweensOf(entry.clone);
                const ctOld = entry.clone.querySelector('.modal-content');
                if (ctOld) gsap.killTweensOf(ctOld);
                entry.clone.remove();
                _stack.splice(existingIndex, 1);
                log('Interrupting close to re-open:', m.id || m);
            } else {
                log('Modal already open, skipping.');
                return;
            }
        }

        const ov = overrides || {};
        const cs = getComputedStyle(m);
        const bg = cs.backgroundColor, br = cs.borderRadius, bs = cs.boxShadow;
        const prevFocus = document.activeElement;

        m.dataset.estado = 'abierto';
        m.style.visibility = 'hidden';
        m.style.opacity = '0';

        const r = m.getBoundingClientRect();
        const w = +(ov.w ?? opt(m, 'w')), h = +(ov.h ?? opt(m, 'h'));
        const dur = +(ov.dur ?? opt(m, 'dur')), ease = ov.ease ?? opt(m, 'ease');
        const closeOnOverlay = String(ov.closeOnOverlay ?? opt(m, 'closeOnOverlay')) === 'true';
        const dest = calcPos(r, w, h, m);
        const z = 100 + _stack.length * 2;

        const openBg = (ov.bg ?? opt(m, 'bg')) || '';
        const openRadius = (ov.radius ?? opt(m, 'radius')) || '6px';
        const openShadow = (ov.shadow ?? opt(m, 'shadow')) || `0 1px 0 rgba(0,0,0,.15), 0 ${16 + _stack.length * 4}px ${48 + _stack.length * 8}px rgba(0,0,0,.4)`;

        const clone = document.createElement('div');
        clone.className = 'morph-clone';
        clone.setAttribute('role', 'dialog');
        clone.setAttribute('aria-modal', 'true');
        Object.assign(clone.style, { position: 'fixed', top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: br, background: bg, boxShadow: bs, zIndex: z, pointerEvents: 'all' });
        clone.addEventListener('pointerdown', e => e.stopPropagation());
        document.body.appendChild(clone);

        const contentEl = m.querySelector('.modal-content');
        if (!contentEl) {
            warn('open(): No .modal-content found.');
            clone.remove(); m.style.visibility = ''; m.style.opacity = ''; m.dataset.estado = 'cerrado';
            return;
        }
        const ct = contentEl.cloneNode(true);
        Object.assign(ct.style, { display: 'flex', flexDirection: 'column', opacity: '0', height: '100%', boxSizing: 'border-box', overflowY: 'auto' });
        clone.appendChild(ct);

        const heading = ct.querySelector('h1,h2,h3,.mc-title');
        if (heading) { if (!heading.id) heading.id = `mc-t-${Date.now()}`; clone.setAttribute('aria-labelledby', heading.id); }

        ct.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); close(); }));
        ct.querySelectorAll('[data-morph-target]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); open(document.getElementById(btn.dataset.morphTarget)); }));

        const trapHandler = e => { if (e.key === 'Tab') trapFocus(clone, e); };
        clone.addEventListener('keydown', trapHandler);

        const entry = { modal: m, clone, opts: { w, h, dur, ease, br, bs, bg, closeOnOverlay }, rect: { top: r.top, left: r.left, w: r.width, h: r.height }, prevFocus, trapHandler, _closing: false };
        _stack.push(entry);

        if (_stack.length === 1) lockScroll();
        const mo = ensureOverlay();
        if (mo) { mo.style.opacity = '1'; mo.style.pointerEvents = _stack.length === 1 ? 'all' : 'none'; }

        const toProps = { top: dest.top, left: dest.left, width: w, height: h, borderRadius: openRadius, boxShadow: openShadow, duration: dur, ease };
        if (openBg) toProps.background = openBg;

        gsap.to(clone, toProps);
        gsap.to(ct, { opacity: 1, duration: 0.5, delay: 0.1, ease: 'power2.out', onComplete() {
            const first = clone.querySelector(FOCUSABLE);
            if (first) first.focus();
            emit('complete', m);
        }});

        emit('open', m);
    }
    function close() {
        if (!_stack.length) return;
        const entry = _stack[_stack.length - 1];
        if (entry._closing) return;
        entry._closing = true;

        const gsap = _gsap;
        const { modal: m, clone, opts, rect, prevFocus, trapHandler } = entry;
        const ct = clone.querySelector('.modal-content');

        clone.style.pointerEvents = 'none';
        clone.removeEventListener('keydown', trapHandler);
        gsap.killTweensOf(clone);
        if (ct) gsap.killTweensOf(ct);

        const dur = opts.dur * 0.85;

        if (ct) gsap.to(ct, { opacity: 0, duration: 0.13, ease: 'power1.in' });
        
        gsap.to(clone, {
            top: rect.top, left: rect.left, width: rect.w, height: rect.h,
            borderRadius: opts.br, background: opts.bg || undefined, boxShadow: opts.bs,
            duration: dur, ease: 'expo.inOut',
            onComplete() {
                m.style.visibility = '';
                m.dataset.estado = 'cerrado';
                gsap.fromTo(m, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'expo.out' });
                
                gsap.to(clone, {
                    opacity: 0, duration: 0.18, ease: 'power2.in',
                    onComplete() {
                        clone.remove();
                        const stackIndex = _stack.findIndex(e => e.clone === clone);
                        if (stackIndex > -1) _stack.splice(stackIndex, 1);

                        if (prevFocus?.focus) prevFocus.focus();
                        
                        if (_stack.length === 0) {
                            unlockScroll();
                            const mo = getOverlay();
                            if (mo) { mo.style.opacity = '0'; mo.style.pointerEvents = 'none'; }
                        }
                        emit('close', m);
                        log('Closed modal:', m.id || m);
                    }
                });
            }
        });
    }
    function closeAll() {
        while (_stack.length > 1) {
            const { modal: m, clone } = _stack.pop();
            clone.remove(); m.style.visibility = ''; m.style.opacity = ''; m.dataset.estado = 'cerrado';
        }
        if (_stack.length === 1) close();
    }

    function onResize() {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(() => {
            _stack.forEach(entry => {
                const r = entry.modal.getBoundingClientRect();
                entry.rect = { top: r.top, left: r.left, w: r.width, h: r.height };
                const dest = calcPos(r, entry.opts.w, entry.opts.h, entry.modal);
                _gsap.to(entry.clone, { top: dest.top, left: dest.left, duration: 0.3, ease: 'power2.out' });
            });
        }, 120);
    }

    function register(selector) {
        if (!_initiated) return;
        const elements = typeof selector === 'string' ? document.querySelectorAll(selector) : [selector];
        elements.forEach(m => {
            if (!m?.classList.contains('modal') || _listeners.some(l => l.el === m)) return;
            const h = (e) => open(e.currentTarget);
            m.addEventListener('pointerdown', h);
            _listeners.push({ el: m, event: 'pointerdown', fn: h });
        });
    }

    function configure(overrides) { Object.assign(_config, overrides); return _config; }
    function getState() { return { initiated: _initiated, stackLength: _stack.length, scrollLocked: _scrollLocked, openModals: _stack.map(e => e.modal.id || e.modal) }; }
    function isOpen(m) { return _stack.some(e => e.modal === resolveElement(m)); }

    function init(options) {
        if (_initiated) return;
        const opts = options || {};
        _gsap = opts.gsap || window.gsap;
        if (!_gsap) throw new Error('[MorphCore] GSAP required.');

        if (opts.onOpen) on('open', opts.onOpen);
        if (opts.onClose) on('close', opts.onClose);
        if (opts.config) configure(opts.config);

        const hCard = (e) => open(e.currentTarget);
        document.querySelectorAll('.modal').forEach(m => {
            m.addEventListener('pointerdown', hCard);
            _listeners.push({ el: m, event: 'pointerdown', fn: hCard });
        });

        const hKey = (e) => { if (e.key === 'Escape' && _config.closeOnEscape) close(); };
        document.addEventListener('keydown', hKey);
        _listeners.push({ el: document, event: 'keydown', fn: hKey });

        const mo = ensureOverlay();
        if (mo) {
            const hOv = (e) => { if (e.target === mo && _stack[_stack.length - 1]?.opts.closeOnOverlay) close(); };
            mo.addEventListener('pointerdown', hOv);
            _listeners.push({ el: mo, event: 'pointerdown', fn: hOv });
        }

        window.addEventListener('resize', onResize);
        _listeners.push({ el: window, event: 'resize', fn: onResize });
        _initiated = true;
    }

    function destroy() {
        if (_gsap) {
            _stack.forEach(({ modal: m, clone }) => {
                _gsap.killTweensOf(clone);
                _gsap.killTweensOf(m);
                const ct = clone.querySelector('.modal-content');
                if (ct) _gsap.killTweensOf(ct);
            });
        }
        _stack.forEach(({ modal: m, clone }) => {
            clone.remove(); m.style.visibility = ''; m.style.opacity = ''; m.dataset.estado = 'cerrado';
        });
        _stack.length = 0;
        unlockScroll();
        const mo = getOverlay();
        if (mo) { mo.style.opacity = '0'; mo.style.pointerEvents = 'none'; }
        _listeners.forEach(({ el, event, fn }) => el.removeEventListener(event, fn));
        _listeners.length = 0;
        _initiated = false;
        _gsap = null;
    }

    return { init, destroy, open, close, closeAll, configure, getState, isOpen, register, on, off, version: '2.1.0' };
})); 
/*reading uh?*/
