// Litepaper page: highlight the current section in the table of contents
(() => {
  const links = [...document.querySelectorAll('.d-toc a')];
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const heads = [...map.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  if (!('IntersectionObserver' in window) || !heads.length) return;
  let cur = null;
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) cur = e.target.id; });
    links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + cur));
  }, { rootMargin: '-80px 0px -70% 0px' });
  heads.forEach((h) => io.observe(h));
})();
