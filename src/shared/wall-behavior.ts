// What the wall does when you use it: arrows, "Read more", "Show more", autoplay, and a letters fallback when a
// photo fails to load. Used by the site widget and the dashboard preview. Attaches to a shadow root once; the
// handlers are delegated, so they keep working when the wall is redrawn. Returns a function that removes them.

import { MAX_DOTS } from './wall-render';

const AUTOPLAY_MS = 6000;

export function wireWall(root: ShadowRoot): () => void {
  const track = () => root.querySelector('.track') as HTMLElement | null;

  function updateNav() {
    const t = track();
    const prev = root.querySelector('.prev') as HTMLButtonElement | null;
    const next = root.querySelector('.next') as HTMLButtonElement | null;
    if (!t || !prev || !next) return;
    const scrolls = t.scrollWidth > t.clientWidth + 2;
    prev.hidden = next.hidden = !scrolls;
    prev.disabled = t.scrollLeft <= 2;
    next.disabled = t.scrollLeft + t.clientWidth >= t.scrollWidth - 2;
  }

  // The dots: one per screenful, the current one marked. Left out when there would be too many.
  function updateDots() {
    const t = track();
    const dots = root.querySelector('.dots') as HTMLElement | null;
    if (!t || !dots) return;
    const pages = Math.max(1, Math.ceil((t.scrollWidth - 2) / t.clientWidth));
    const span = t.scrollWidth - t.clientWidth;
    const current = span <= 0 ? 0 : Math.round((t.scrollLeft / span) * (pages - 1));
    if (pages <= 1 || pages > MAX_DOTS) {
      dots.hidden = true;
      return;
    }
    dots.hidden = false;
    if (dots.children.length !== pages) {
      dots.innerHTML = '';
      for (let i = 0; i < pages; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dot';
        b.setAttribute('data-dot', String(i));
        b.setAttribute('aria-label', String(i + 1));
        dots.append(b);
      }
    }
    Array.from(dots.children).forEach((d, i) => d.setAttribute('aria-current', String(i === current)));
  }

  const onClick = (e: Event) => {
    const target = e.target as Element | null;
    const nav = target?.closest('[data-dir]');
    if (nav) {
      const t = track();
      t?.scrollBy({ left: Number(nav.getAttribute('data-dir')) * t.clientWidth * 0.9 });
      return;
    }
    const dot = target?.closest('[data-dot]');
    if (dot) {
      const t = track();
      const pages = root.querySelectorAll('.dot').length;
      if (t && pages > 1) t.scrollTo({ left: ((t.scrollWidth - t.clientWidth) * Number(dot.getAttribute('data-dot'))) / (pages - 1) });
      return;
    }
    const more = target?.closest('[data-more]');
    if (more) {
      const card = more.closest('.card');
      const open = !card?.classList.contains('open');
      card?.classList.toggle('open', open);
      // While a card is open it grows alone; the others keep their own height instead of stretching to match.
      const t = track();
      t?.classList.toggle('has-open', !!t.querySelector('.card.open'));
      more.setAttribute('aria-expanded', String(open));
      more.textContent = more.getAttribute(open ? 'data-less-label' : 'data-more-label');
      return;
    }
    if (target?.closest('[data-showmore]')) {
      const hidden = Array.from(root.querySelectorAll('[data-extra][hidden]')).slice(0, 6);
      hidden.forEach((el) => el.removeAttribute('hidden'));
      if (!root.querySelector('[data-extra][hidden]')) (target.closest('[data-showmore]') as HTMLElement).hidden = true;
    }
  };

  // Image errors and scrolls do not bubble, so they are caught on the way down.
  const onError = (e: Event) => {
    const img = e.target as HTMLElement | null;
    if (img?.tagName !== 'IMG') return;
    if (img.classList.contains('pimg')) {
      img.remove(); // a business photo that fails to load is simply left out
      return;
    }
    const av = img.closest('.av') as HTMLElement | null;
    if (!av) return;
    av.classList.add('ini');
    av.textContent = av.getAttribute('data-ini') ?? '?';
  };
  const onScroll = () => {
    updateNav();
    updateDots();
  };

  root.addEventListener('click', onClick);
  root.addEventListener('error', onError, true);
  root.addEventListener('scroll', onScroll, true);

  const timer = setInterval(() => {
    const wall = root.querySelector('.gr[data-autoplay]');
    const t = track();
    if (!wall || !t || document.hidden) return;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const host = root.host as HTMLElement;
    if (host.matches(':hover') || root.activeElement) return;
    if (t.scrollWidth <= t.clientWidth + 2) return;
    const atEnd = t.scrollLeft + t.clientWidth >= t.scrollWidth - 2;
    if (atEnd) t.scrollTo({ left: 0 });
    else t.scrollBy({ left: t.clientWidth * 0.9 });
  }, AUTOPLAY_MS);

  // Call after each redraw so the arrows reflect the new content.
  const refresh = () => requestAnimationFrame(() => {
    updateNav();
    updateDots();
  });
  const observer = new MutationObserver((records) => {
    // Our own dots change the tree too; only a redraw of the wall needs the arrows and dots recomputed.
    if (records.some((r) => !(r.target as Element).classList?.contains('dots'))) refresh();
  });
  observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', refresh);
  refresh();

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('error', onError, true);
    root.removeEventListener('scroll', onScroll, true);
    clearInterval(timer);
    observer.disconnect();
    window.removeEventListener('resize', refresh);
  };
}
