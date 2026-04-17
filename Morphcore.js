/*! MorphModaL 2.0
Autor: Lucho
Last update: 16/04/2026
MorphCore.init({ gsap }); */
window.MorphCore = (() => {
  let _gsap = null;
  let _active = null;
  let _scrollPos = 0;
  let _animating = false;
  const lockScroll = (lock) => {
    if (lock) {
      _scrollPos = window.pageYOffset;
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.scrollbarGutter = "stable";
    } else {
      document.documentElement.style.overflow = "";
      document.documentElement.style.scrollbarGutter = "";
    }
  };

  // ── Persistencia de inputs ───────────────────────────────────
  const syncState = (from, to) => {
    const f = from.querySelectorAll("input, textarea, select");
    const t = to.querySelectorAll("input, textarea, select");
    f.forEach((el, i) => {
      if (!t[i]) return;
      if (el.type === "checkbox" || el.type === "radio") {
        t[i].checked = el.checked;
      } else {
        t[i].value = el.value;
      }
    });
  };

  // ── CLOSE ────────────────────────────────────────────────────
  const close = () => {
    if (!_active || _animating) return;
    const { m, clone, r, ct, source } = _active;

    syncState(ct, source);

    _animating = true;
    const dur = parseFloat(m.dataset.dur) || 0.7;
    const tl = _gsap.timeline({
      onComplete: () => {
        _gsap.set(m, { clearProps: "opacity,visibility" });
        clone.remove();
        lockScroll(false);
        _active = null;
        _animating = false;
      },
    });
    const children = Array.from(ct.children);
    if (children.length) {
      tl.fromTo(
        children,
        { y: 0, opacity: 1 },
        { y: 14, opacity: 0, duration: 0.38, stagger: 0.07, ease: "power2.in" },
        0,
      );
    }

    tl.to(ct, { opacity: 0, filter: "blur(10px)", duration: dur, ease: "power1.in" }, 0);

    tl.to(clone, {
      borderRadius: getComputedStyle(m).borderRadius,
      duration: 0.4,
      ease: "power2.inOut"
    }, 0);
    tl.to(
      clone,
      {
        x: 0,
        y: 0,
        width: r.width,
        height: r.height,
        borderRadius: getComputedStyle(m).borderRadius,
        duration: dur,
        ease: "expo.inOut",
        roundProps: "x,y,width,height",
      },
      0,
    );

    tl.to(m, { opacity: 1, duration: 0.3 }, "-=0.3");
    tl.to(clone, { opacity: 0, duration: 0.3 }, "-=0.3");

    const mo = document.getElementById("mo");
    if (mo) tl.to(mo, { opacity: 0, pointerEvents: "none", duration: 0.5 }, 0);
  };
  const open = (m) => {
    if (_active || _animating || !m) return;
    const contentSource = m.querySelector(".modal-content");
    if (!contentSource) return;

    const r = m.getBoundingClientRect();
    const cs = getComputedStyle(m);
    lockScroll(true);
    const clone = document.createElement("div");
    clone.className = "morph-clone";

    let bgColor = cs.backgroundColor;
    if (bgColor === "rgba(0, 0, 0, 0)" || bgColor === "transparent")
      bgColor = "#151820";
    Object.assign(clone.style, {
      position: "fixed",
      top: r.top + "px",
      left: r.left + "px",
      width: r.width + "px",
      height: r.height + "px",
      zIndex: "1000",
      overflow: "hidden",
      borderRadius: cs.borderRadius,
      transition: "none",
    });

    clone.style.setProperty("background-color", bgColor, "important");
    clone.style.setProperty("background-image", "none", "important");
    clone.style.setProperty("border", cs.border, "important");
    clone.style.boxShadow =
      "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)";

    document.body.appendChild(clone);
    const ct = contentSource.cloneNode(true);
    ct.style.cssText = "";
    ct.style.width = "100%";
    ct.style.height = "100%";
    ct.style.opacity = "0";
    ct.style.filter = "blur(10px)";
    ct.style.background = "transparent";
    ct.classList.add("is-open");

    syncState(contentSource, ct);
    clone.appendChild(ct);
    const w = parseFloat(m.dataset.w) || 400;
    const h = parseFloat(m.dataset.h) || 400;
    const pos = m.dataset.pos || "center";
    let dest;
    if (pos === "origin") {
      dest = {
        x: r.left,
        y: r.top,
      };
    } else if (pos === "custom") {
      const xPercent = parseFloat(m.dataset.x) || 50;
      const yPercent = parseFloat(m.dataset.y) || 50;
      dest = {
        x: (window.innerWidth - w) * (xPercent / 100),
        y: (window.innerHeight - h) * (yPercent / 100),
      };
    } else {
      dest = {
        x: (window.innerWidth - w) / 2,
        y: (window.innerHeight - h) / 2,
      };
    }
    const dur = parseFloat(m.dataset.dur) || 0.9;

    _animating = true;
    const tl = _gsap.timeline({
      onComplete: () => (_animating = false),
    });
    tl.set(m, { opacity: 0 }, 0);

    const mo = document.getElementById("mo");
    if (mo) tl.to(mo, { opacity: 1, pointerEvents: "all", duration: 0.45 }, 0);

    tl.to(clone, {
      borderRadius: m.dataset.radius || "",
      duration: 0.2,
      ease: "power4.out" 
    }, 0);

    tl.to(clone, {
      x: dest.x - r.left,
      y: dest.y - r.top,
      width: w,
      height: h,
      duration: dur,
      ease: "expo.out",
      roundProps: "x,y,width,height",
    }, 0);


    tl.to(ct, { opacity: 1, filter: "blur(0px)", duration: dur - 0.25, ease: "power2.out" }, 0);

    const children = Array.from(ct.children);
    if (children.length) {
      tl.fromTo(
        children,
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.38, stagger: 0.07, ease: "power2.out" },
        0,
      );
    }

    _active = { m, clone, r, ct, source: contentSource };
    ct.querySelectorAll("[data-close]").forEach((b) =>
      b.addEventListener("pointerdown", close),
    );
  };

  return {
    init: (config = {}) => {
      _gsap = config.gsap || window.gsap;
      if (!_gsap) return console.error("MorphCore: GSAP no encontrado.");

      const setup = () => {
        document.querySelectorAll(".modal-trigger").forEach((m) => {
          m.addEventListener("pointerdown", () => open(m));
        });

        const mo = document.getElementById("mo");
        if (mo) mo.addEventListener("pointerdown", close);

        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") close();
        });
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setup);
      } else {
        setup();
      }
    },
    open,
    close,
  };
})();
