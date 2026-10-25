import { useEffect, useRef, type FC } from 'react';
import { selectForDisplay } from '../../../../shared/review-filter';
import type { Plan } from '../../../../shared/plan';
import type { Settings } from '../../../../shared/settings';
import { wireWall } from '../../../../shared/wall-behavior';
import { buildWall, type WallData } from '../../../../shared/wall-render';

/** The same renderer and behaviour as the live site, inside a shadow root, so what you see here is what visitors get. */
export const Preview: FC<{ data: WallData; settings: Settings; plan: Plan; lang: string }> = ({ data, settings, plan, lang }) => {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const root = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
    return wireWall(root);
  }, []);

  useEffect(() => {
    const el = host.current;
    const root = el?.shadowRoot;
    if (!root) return;
    const shown = selectForDisplay(data.reviews, settings, plan);
    const { html, css } = buildWall({ ...data, reviews: shown }, settings, lang);
    root.innerHTML = `<style></style>${shown.length ? html : '<p class="empty"></p>'}`;
    (root.querySelector('style') as HTMLStyleElement).textContent = css + '.empty{padding:24px;text-align:center;color:#71717a;font:14px system-ui}';
    const empty = root.querySelector('.empty');
    if (empty) empty.textContent = 'No reviews match these filters.';
  }, [data, settings, plan, lang]);

  return <div ref={host} />;
};
