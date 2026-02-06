/* Webmark FAQ accordion animation (details/summary)
   - Smooth open/close with height + opacity
   - Optional: single-open behavior
*/

(() => {
	'use strict';

	const prefersReducedMotion = () =>
		window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
	const duration = 320;

	function getBody(details) {
		return details.querySelector('.wm-faq-body');
	}

	function stopAnimation(details) {
		const anim = details.__wmAnim;
		if (anim) {
			anim.cancel();
			details.__wmAnim = null;
		}
	}

	function animateOpen(details) {
		const body = getBody(details);
		if (!body) {
			details.open = true;
			return;
		}

		stopAnimation(details);
		details.open = true;

		if (prefersReducedMotion()) return;

		body.style.overflow = 'hidden';
		body.style.height = '0px';
		body.style.opacity = '0';
		body.style.transform = 'translateY(-6px)';

		// Force reflow
		body.getBoundingClientRect();

		const targetHeight = body.scrollHeight;
		const anim = body.animate(
			[
				{ height: '0px', opacity: 0, transform: 'translateY(-6px)' },
				{ height: targetHeight + 'px', opacity: 1, transform: 'translateY(0px)' }
			],
			{ duration, easing: ease }
		);

		details.__wmAnim = anim;
		anim.onfinish = () => {
			details.__wmAnim = null;
			body.style.overflow = '';
			body.style.height = '';
			body.style.opacity = '';
			body.style.transform = '';
		};
	}

	function animateClose(details) {
		const body = getBody(details);
		if (!body) {
			details.open = false;
			return;
		}

		stopAnimation(details);

		if (prefersReducedMotion()) {
			details.open = false;
			return;
		}

		const startHeight = body.getBoundingClientRect().height;
		body.style.overflow = 'hidden';
		body.style.height = startHeight + 'px';
		body.style.opacity = '1';
		body.style.transform = 'translateY(0px)';

		// Force reflow
		body.getBoundingClientRect();

		const anim = body.animate(
			[
				{ height: startHeight + 'px', opacity: 1, transform: 'translateY(0px)' },
				{ height: '0px', opacity: 0, transform: 'translateY(-6px)' }
			],
			{ duration: Math.max(220, Math.min(360, duration)), easing: ease }
		);

		details.__wmAnim = anim;
		anim.onfinish = () => {
			details.__wmAnim = null;
			details.open = false;
			body.style.overflow = '';
			body.style.height = '';
			body.style.opacity = '';
			body.style.transform = '';
		};
	}

	function closeOthers(current, all) {
		for (const d of all) {
			if (d !== current && d.open) animateClose(d);
		}
	}

	function initFaq() {
		const root = document.querySelector('.wm-faq');
		if (!root) return;

		const items = Array.from(root.querySelectorAll('details.wm-faq-item'));
		if (items.length === 0) return;

		for (const details of items) {
			const summary = details.querySelector('summary');
			if (!summary) continue;

			summary.addEventListener('click', (e) => {
				e.preventDefault();

				const willOpen = !details.open;
				if (willOpen) {
					closeOthers(details, items);
					animateOpen(details);
				} else {
					animateClose(details);
				}
			});

			summary.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					summary.click();
				}
			});
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initFaq);
	} else {
		initFaq();
	}
})();
