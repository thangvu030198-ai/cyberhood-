/* CYBERHOOD motion layer: smooth scroll, line reveals, 3D card entrances, tilt + glare, scrubbed depth.
   Runs after site.js (all grids rendered). Needs gsap + ScrollTrigger + SplitText; Lenis optional. */
(() => {
  const { gsap, ScrollTrigger, SplitText } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []));
  // One signature ease shared with CSS --ease (.16,1,.3,1)
  gsap.defaults({ ease: 'expo.out', duration: 0.6 });
  ScrollTrigger.config({ ignoreMobileResize: true });
  document.documentElement.classList.add('mo');

  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const mm = gsap.matchMedia();

  mm.add(
    { desktop: '(min-width: 800px)', mobile: '(max-width: 799px)', fine: '(hover: hover) and (pointer: fine)', reduce: '(prefers-reduced-motion: reduce)' },
    (ctx) => {
      const { desktop, fine, reduce } = ctx.conditions;
      const k = desktop ? 1 : 0.8; // mobile: shorter, smaller moves

      /* ---------- Reduced motion: opacity only ---------- */
      if (reduce) {
        ScrollTrigger.batch('.mo-in', { once: true, onEnter: (b) => gsap.from(b, { autoAlpha: 0, duration: 0.4, ease: 'none' }) });
        return;
      }

      /* ---------- Smooth scroll (desktop pointer only) ---------- */
      let lenis = null;
      if (fine && window.Lenis) {
        lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
        window.__lenis = lenis;
        lenis.on('scroll', ScrollTrigger.update);
        const raf = (t) => lenis.raf(t * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);
        // In-page nav links glide instead of jumping
        const onNav = (e) => {
          const a = e.target.closest('a[href^="#"]');
          if (!a || a.getAttribute('href').length < 2) return;
          const t = document.querySelector(a.getAttribute('href'));
          if (!t) return;
          e.preventDefault();
          lenis.scrollTo(t, { offset: -64, duration: 1.4 });
        };
        document.addEventListener('click', onNav);
        ctx.add(() => () => { gsap.ticker.remove(raf); document.removeEventListener('click', onNav); lenis.destroy(); window.__lenis = null; });
      }

      /* ---------- Hero: intro, then sinks into depth as you scroll ---------- */
      const hero = document.querySelector('.hero');
      if (hero) {
        const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
        intro
          .from('.hero .eyebrow', { autoAlpha: 0, y: 16, duration: 0.5 })
          .from('.hero h1 > span', { autoAlpha: 0, yPercent: 60, rotateX: -50, transformOrigin: '50% 100%', stagger: 0.09, duration: 0.9 }, '<0.1')
          .from('.hero p.sub', { autoAlpha: 0, y: 18, duration: 0.6 }, '<0.35')
          .from('.hero .ctas > *', { autoAlpha: 0, y: 14, stagger: 0.07, duration: 0.5 }, '<0.15')
          .from('.hero .facts > div', { autoAlpha: 0, y: 12, stagger: 0.06, duration: 0.45 }, '<0.1');
        gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: lenis ? true : 0.3 } })
          .to('.hero .wrap', { yPercent: 18 * k, z: -120, rotateX: 8, autoAlpha: 0.15, ease: 'none' }, 0)
          .to('#holo', { yPercent: 10 * k, scale: 0.92, ease: 'none' }, 0)
          .to('.hero .bgimg', { yPercent: 14 * k, scale: 1.08, ease: 'none' }, 0);
      }

      /* ---------- Section beats: neon wipe + eyebrow + headline lines rise from a mask ---------- */
      $$('.blk').forEach((sec) => {
        const head = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 78%', once: true } });
        const wipe = document.createElement('i');
        wipe.className = 'mo-wipe';
        sec.prepend(wipe);
        head.fromTo(wipe, { scaleX: 0, autoAlpha: 1 }, { scaleX: 1, duration: 0.7, ease: 'expo.inOut' })
          .to(wipe, { autoAlpha: 0, duration: 0.5, ease: 'power1.in' }, '>-0.1');
        const eb = sec.querySelector('.eyebrow');
        if (eb) head.from(eb, { autoAlpha: 0, x: -18, duration: 0.5 }, 0.15);
        const h2 = sec.querySelector('h2.sec');
        if (h2 && SplitText) {
          const split = SplitText.create(h2, { type: 'lines', mask: 'lines', autoSplit: true });
          head.from(split.lines, { yPercent: 105, rotate: 2, stagger: 0.07, duration: 0.8 }, 0.2);
          ctx.add(() => () => split.revert());
        } else if (h2) head.from(h2, { autoAlpha: 0, y: 24 }, 0.2);
        const lede = sec.querySelector('.lede');
        if (lede) head.from(lede, { autoAlpha: 0, y: 16, duration: 0.6 }, 0.45);
      });

      /* ---------- Cinematic reel: tilted screen stands up as it scrolls in ---------- */
      const reel = document.querySelector('.reel');
      if (reel) {
        gsap.fromTo(reel, { rotateX: 24 * k, scale: 0.86, y: 60 * k, autoAlpha: 0.4, transformOrigin: '50% 100%' },
          { rotateX: 0, scale: 1, y: 0, autoAlpha: 1, ease: 'none', scrollTrigger: { trigger: reel, start: 'top 95%', end: 'top 30%', scrub: lenis ? true : 0.3 } });
        gsap.to('.reel video', { yPercent: -6, scale: 1.08, ease: 'none', scrollTrigger: { trigger: reel, start: 'top bottom', end: 'bottom top', scrub: true } });
      }

      /* ---------- 3D card entrances (cards swing up out of the floor) ---------- */
      const flipIn = (sel, from) => ScrollTrigger.batch(sel, {
        start: 'top 88%', once: true, interval: 0.1, batchMax: 6,
        onEnter: (b) => gsap.from(b, { ...from, autoAlpha: 0, stagger: 0.07, duration: 0.9, clearProps: 'transform,opacity,visibility' }),
      });
      flipIn('.step', { y: 40 * k, rotateX: -30, transformOrigin: '50% 0%' });
      flipIn('#modeGrid .mode', { y: 70 * k, z: -160, rotateX: 28, transformOrigin: '50% 100%' });
      flipIn('#chaps .chap', { x: 40 * k, rotateY: -38, z: -80, transformOrigin: '0% 50%' });
      flipIn('#stats > div', { y: 20, rotateX: -60, transformOrigin: '50% 0%' });
      flipIn('#grid .card', { y: 50 * k, rotateY: 24, rotateX: 10, z: -120, transformOrigin: '50% 100%' });
      flipIn('.faq details', { y: 24, rotateX: -24, transformOrigin: '50% 0%' });
      flipIn('.rewards > div', { x: -24, autoAlpha: 0 });

      /* Season art drifts slower than its card: parallax depth inside each poster */
      $$('#chaps .chap .pic img').forEach((img) => {
        gsap.fromTo(img, { yPercent: -6, scale: 1.12 }, { yPercent: 6, scale: 1.12, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true } });
      });

      /* Filters re-render the NFT grid: give fresh cards a quick flip */
      const grid = document.querySelector('#grid');
      if (grid) {
        const mo = new MutationObserver(() => {
          gsap.from('#grid .card', { autoAlpha: 0, rotateY: 30, y: 20, z: -80, stagger: 0.025, duration: 0.5, clearProps: 'transform,opacity,visibility' });
        });
        mo.observe(grid, { childList: true });
        ctx.add(() => () => mo.disconnect());
      }

      /* ---------- Tilt + glare on hover (fine pointers only) ---------- */
      if (fine) {
        const tilt = (sel, max = 8) => {
          const onMove = (e) => {
            const el = e.target.closest(sel);
            if (!el) return;
            if (!el._t) {
              el._t = { rx: gsap.quickTo(el, 'rotationX', { duration: 0.4, ease: 'power3' }), ry: gsap.quickTo(el, 'rotationY', { duration: 0.4, ease: 'power3' }) };
              gsap.set(el, { transformPerspective: 900 });
              const g = document.createElement('i'); g.className = 'mo-glare'; el.append(g);
            }
            const r = el.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
            el._t.ry((px - 0.5) * 2 * max);
            el._t.rx(-(py - 0.5) * 2 * max);
            el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
            el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
            el.classList.add('glare');
          };
          const onOut = (e) => {
            const el = e.target.closest(sel);
            if (!el || el.contains(e.relatedTarget)) return;
            el._t && (el._t.rx(0), el._t.ry(0));
            el.classList.remove('glare');
          };
          document.addEventListener('pointermove', onMove);
          document.addEventListener('pointerout', onOut);
          ctx.add(() => () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerout', onOut); });
        };
        tilt('#modeGrid .mode', 6);
        tilt('#chaps .chap', 8);
        tilt('#grid .card', 10);
        tilt('.step', 5);
      }
    },
  );

  /* Late content (fonts, images, hologram) shifts layout: re-measure once it settles */
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
})();
