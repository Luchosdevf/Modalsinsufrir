/**
 * MorphCore v1.2.0
 * Autor: Lucho
 * Estructura: MorphCore.init({ gsap: gsap });
 */
window.MorphCore = (() => {
    let _gsap = null;
    let _active = null;
    let _scrollPos = 0;

    // PARCHE: Bloqueo de Scroll Profesional (Cero saltos de contenido)
    const lockScroll = (lock) => {
        if (lock) {
            _scrollPos = window.pageYOffset;
            const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = `${scrollBarWidth}px`;
        } else {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }
    };

    // PARCHE: Persistencia de datos dinámicos (Inputs, Textareas, Selects)
    const syncState = (from, to) => {
        const f = from.querySelectorAll('input, textarea, select');
        const t = to.querySelectorAll('input, textarea, select');
        f.forEach((el, i) => {
            if (!t[i]) return;
            if (el.type === 'checkbox' || el.type === 'radio') {
                t[i].checked = el.checked;
            } else {
                t[i].value = el.value;
            }
        });
    };

    const close = () => {
        if (!_active) return;
        const { m, clone, r, ct, source } = _active;
        
        syncState(ct, source); // Guardar estado antes de destruir el clon

        const tl = _gsap.timeline({
            onComplete: () => {
                _gsap.set(m, { visibility: 'visible', opacity: 1 });
                clone.remove();
                lockScroll(false);
                _active = null;
            }
        });

        tl.to(ct, { opacity: 0, duration: 0.2 }, 0);
        
        tl.to(clone, {
            x: 0, 
            y: 0, 
            width: r.width, 
            height: r.height,
            borderRadius: getComputedStyle(m).borderRadius,
            duration: 0.7,
            ease: "expo.inOut",
            roundProps: "x,y,width,height" // PARCHE: Evita ghosting por sub-píxeles
        }, 0);

        // Aterrizaje suave (Handoff de opacidad)
        tl.to(m, { opacity: 1, duration: 0.3 }, "-=0.3");
        tl.to(clone, { opacity: 0, duration: 0.3 }, "-=0.3");

        const mo = document.getElementById('mo');
        if (mo) tl.to(mo, { opacity: 0, pointerEvents: 'none', duration: 0.5 }, 0);
    };

    const open = (m) => {
        if (_active || !m) return;
        const contentSource = m.querySelector('.modal-content');
        if (!contentSource) return;

        const r = m.getBoundingClientRect();
        const cs = getComputedStyle(m);

        lockScroll(true);
        _gsap.to(m, { opacity: 0, duration: 0.2 });

        const clone = document.createElement('div');
        clone.className = 'morph-clone';
        Object.assign(clone.style, {
            position: 'fixed', 
            top: r.top + 'px', 
            left: r.left + 'px',
            width: r.width + 'px', 
            height: r.height + 'px',
            borderRadius: cs.borderRadius, 
            background: cs.backgroundColor,
            border: cs.border, 
            color: cs.color, 
            zIndex: 1000, 
            overflow: 'hidden'
        });
        document.body.appendChild(clone);

        const ct = contentSource.cloneNode(true);
        ct.style.display = 'block'; 
        ct.style.opacity = '0';
        syncState(contentSource, ct); // Traer estado actual al clon
        clone.appendChild(ct);

        const w = parseFloat(m.dataset.w) || 400;
        const h = parseFloat(m.dataset.h) || 400;
        const dest = { 
            x: (window.innerWidth - w) / 2, 
            y: (window.innerHeight - h) / 2 
        };

        const tl = _gsap.timeline();
        const mo = document.getElementById('mo');
        if (mo) tl.to(mo, { opacity: 1, pointerEvents: 'all', duration: 0.5 }, 0);

        tl.to(clone, {
            x: dest.x - r.left, 
            y: dest.y - r.top,
            width: w, 
            height: h,
            borderRadius: m.dataset.radius || '24px',
            duration: 0.7,
            ease: "expo.out",
            roundProps: "x,y,width,height" // PARCHE: Anti-blur
        }, 0);

        tl.to(ct, { opacity: 1, duration: 0.3 }, 0.2);
        tl.fromTo(ct.children, 
            { y: 20, opacity: 0 }, 
            { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: "power2.out" }, 
            0.25
        );

        _active = { m, clone, r, ct, source: contentSource };
        
        // Eventos de cierre dentro del clon
        ct.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    };

    return {
        init: (config = {}) => {
            _gsap = config.gsap || window.gsap;
            if (!_gsap) return console.error("MorphCore: GSAP no encontrado.");

            const setup = () => {
                document.querySelectorAll('.modal-trigger').forEach(m => {
                    m.onclick = () => open(m);
                });

                const mo = document.getElementById('mo');
                if (mo) mo.onclick = close;

                document.addEventListener('keydown', e => {
                    if (e.key === 'Escape') close();
                });
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', setup);
            } else {
                setup();
            }
        },
        open,
        close
    };
})();
