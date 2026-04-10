/* 
   MorphCore v2.3.1
   Uso: MorphCore.init({ gsap: gsap });
*/
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
        w: 360, h: 300, pos: 'center', dur: 0.65, ease: 'expo.out',
        stackOffset: 20, pad: 15
    };

    let _gsap = null, _config = Object.assign({}, DEFAULTS);
    const _stack = [], _events = {};
    let _scrollLocked = false;

    // --- SISTEMA DE PERSISTENCIA ---
    function syncState(source, dest) {
        const s = source.querySelectorAll('input, select, textarea');
        const d = dest.querySelectorAll('input, select, textarea');
        s.forEach((el, i) => {
            if (!d[i]) return;
            if (el.type === 'checkbox' || el.type === 'radio') d[i].checked = el.checked;
            else d[i].value = el.value;
        });
    }

    // --- SISTEMA DE BLOQUEO DE SCROLL ---
    function lockScroll() {
        if (_scrollLocked) return;
        const sw = window.innerWidth - document.documentElement.clientWidth;
        if (sw > 0) {
            document.body.style.paddingRight = sw + 'px';
            document.querySelectorAll('[data-morph-fixed]').forEach(el => {
                const s = window.getComputedStyle(el);
                el.dataset.prevPad = s.paddingRight;
                el.style.paddingRight = `calc(${s.paddingRight} + ${sw}px)`;
            });
        }
        document.body.style.overflow = 'hidden';
        _scrollLocked = true;
    }

    function unlockScroll() {
        if (!_scrollLocked) return;
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.querySelectorAll('[data-morph-fixed]').forEach(el => {
            el.style.paddingRight = el.dataset.prevPad || '';
            delete el.dataset.prevPad;
        });
        _scrollLocked = false;
    }

    // --- CÁLCULO DE POSICIÓN ---
    function calcPos(r, w, h, m) {
        const pad = parseFloat(m.dataset.pad || _config.pad);
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const off = _stack.length * _config.stackOffset;
        const pos = m.dataset.pos || _config.pos;

        const cx = Math.max(pad, Math.min(vw - w - pad, (vw - w) / 2 + off));
        const cy = Math.max(pad, Math.min(vh - h - pad, (vh - h) / 2 - off));

        const coords = {
            'center': { top: cy, left: cx },
            'top-left': { top: pad, left: pad },
            'top-right': { top: pad, left: vw - w - pad },
            'bottom-left': { top: vh - h - pad, left: pad },
            'bottom-right': { top: vh - h - pad, left: vw - w - pad }
        };
        return coords[pos] || coords['center'];
    }

    // --- APERTURA ---
    function open(m) {
        m = (typeof m === 'string') ? document.getElementById(m) : m;
        if (!m || _stack.some(e => e.modal === m && !e._closing)) return;

        const contentOrig = m.querySelector('.modal-content');
        if (!contentOrig) return;

        if (_stack.length === 0) lockScroll();

        const r = m.getBoundingClientRect();
        const s = window.getComputedStyle(m);

        const clone = document.createElement('div');
        clone.className = 'morph-clone';
        
        Object.assign(clone.style, {
            position: 'fixed', top: r.top + 'px', left: r.left + 'px',
            width: r.width + 'px', height: r.height + 'px',
            background: s.backgroundColor, borderRadius: s.borderRadius,
            border: s.border, boxShadow: s.boxShadow, boxSizing: 'border-box',
            zIndex: 1000 + (_stack.length * 2), overflow: 'hidden', pointerEvents: 'all'
        });

        m.style.opacity = '0';
        m.style.pointerEvents = 'none';
        m.style.visibility = 'hidden';

        const ct = contentOrig.cloneNode(true);
        ct.style.display = 'flex'; 
        ct.style.flexDirection = 'column';
        ct.style.opacity = '0';
        ct.style.height = '100%';
        ct.querySelectorAll('[id]').forEach(el => el.id = 'clone-' + el.id);
        
        syncState(contentOrig, ct);

        clone.appendChild(ct);
        document.body.appendChild(clone);

        const w = parseFloat(m.dataset.w || _config.w);
        const h = parseFloat(m.dataset.h || _config.h);
        const dest = calcPos(r, w, h, m);
        const dur = _config.dur;

        _stack.push({ modal: m, clone, _closing: false });

        _gsap.to(clone, {
            top: dest.top, left: dest.left, width: w, height: h,
            duration: dur, ease: 'power4.out'
        });

        _gsap.to(ct, { 
            opacity: 1, duration: dur * 0.6, delay: 0.2, ease: "power2.out" 
        });
        
        clone.addEventListener('click', (e) => {
            if (e.target.closest('[data-close]')) close();
        });
    }

    // --- CIERRE ---
    function close() {
        if (!_stack.length) return;
        const entry = _stack.pop();
        if (entry._closing) return;
        entry._closing = true;

        const { modal, clone } = entry;
        const ct = clone.querySelector('.modal-content');
        const contentOrig = modal.querySelector('.modal-content');

        if (ct && contentOrig) syncState(ct, contentOrig);

        const rect = modal.getBoundingClientRect();
        const style = window.getComputedStyle(modal);
        const dur = 0.55;

        _gsap.to(ct, { opacity: 0, duration: dur * 0.3, ease: "power2.in" });

        _gsap.to(clone, {
            top: rect.top, left: rect.left, width: rect.width, height: rect.height,
            borderRadius: style.borderRadius, borderWidth: style.borderWidth,
            duration: dur, ease: 'power4.inOut',
            onComplete: () => {
                modal.style.visibility = '';
                modal.style.pointerEvents = '';
                _gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'none' });
                _gsap.to(clone, { 
                    opacity: 0, duration: 0.2, 
                    onComplete: () => {
                        clone.remove();
                        if (_stack.length === 0) unlockScroll();
                        if (_events['close']) _events['close'](modal);
                    }
                });
            }
        });
    }

    return {
        init: (opts = {}) => {
            _gsap = opts.gsap || window.gsap;
            if (!_gsap) {
                console.error('[MorphCore] GSAP no encontrado. Se requiere GSAP 3.x');
                return;
            }
            Object.assign(_config, opts.config || {});
            document.querySelectorAll('.modal').forEach(m => {
                m.addEventListener('click', (e) => {
                    if (!e.target.closest('[data-close]')) open(m);
                });
            });
            window.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
        },
        open, close, on: (ev, fn) => { _events[ev] = fn; }
    };
}));
