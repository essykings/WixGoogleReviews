import type { FC } from 'react';
import { dashboard } from '@wix/dashboard';
import { REVIEW_URL } from '../../../../shared/review-prompt';
import config from './rate-google-reviews-carousel.config.ts';

// Deliberately has no Wix Design System: it makes a modal load slowly. Wix's modal frame is see-through, so this paints
// its own white background. The App Market page opens in a new tab, because Wix pages refuse to be shown inside a frame.
const STAR = 'M7.5,0l-2,5h-5l4,3.5l-2,6l5-3.5l5,3.5l-2-6l4-3.5h-5L7.5,0z';

const css = `
html, body { margin: 0; background: #fff; }
.rp { box-sizing: border-box; min-height: 100vh; padding: 28px 28px 24px; background: #fff; color: #212121; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; }
.rp h1 { margin: 6px 0 0; font-size: 20px; line-height: 1.3; letter-spacing: -0.01em; }
.rp p { margin: 0; font-size: 14px; line-height: 1.55; color: #52525b; max-width: 360px; }
.rp .stars { display: flex; gap: 4px; margin-top: 4px; }
.rp .stars svg { width: 30px; height: 30px; fill: #ff8a00; stroke: #ff8a00; stroke-width: 0.8; stroke-linejoin: round; }
.rp .row { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; justify-content: center; }
.rp button { font: inherit; font-weight: 600; font-size: 14px; height: 40px; padding: 0 20px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
.rp .primary { background: #18181b; color: #fafafa; }
.rp .primary:hover { opacity: 0.9; }
.rp .ghost { background: #fff; color: #18181b; border-color: #d4d4d8; }
.rp .ghost:hover { background: #f4f4f5; }
.rp button:focus-visible { outline: 2px solid #71717a; outline-offset: 2px; }
`;

const Modal: FC = () => {
  const review = () => {
    window.open(REVIEW_URL, '_blank', 'noopener,noreferrer');
    dashboard.closeModal({ action: 'review' });
  };
  return (
    <>
      <style>{css}</style>
      <div className="rp" role="dialog" aria-label={config.title}>
        <div className="stars" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <svg key={i} viewBox="-0.7 -0.7 15.4 15.4"><path d={STAR} /></svg>
          ))}
        </div>
        <h1>Your reviews are connected</h1>
        <p>Enjoying Google Reviews Carousel? A quick review on the Wix App Market takes a minute and helps other business owners find it.</p>
        <div className="row">
          <button type="button" className="primary" onClick={review}>Leave a review</button>
          <button type="button" className="ghost" onClick={() => dashboard.closeModal({ action: 'later' })}>Maybe later</button>
        </div>
      </div>
    </>
  );
};

export default Modal;
