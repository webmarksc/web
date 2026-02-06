

(() => {
	'use strict';

	const hexToRgb = (hex) => {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
		if (!result) return [0.0, 0.137, 0.4];
		return [
			parseInt(result[1], 16) / 255,
			parseInt(result[2], 16) / 255,
			parseInt(result[3], 16) / 255
		];
	};

	const vertexShaderSource = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4(position, 0.0, 1.0);
}
`;

	const fragmentShaderSource = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uCustomColor;
uniform float uUseCustomColor;
uniform float uSpeed;
uniform float uDirection;
uniform float uScale;
uniform float uOpacity;
uniform vec2 uMouse;
uniform float uMouseInteractive;
uniform float uColorBoost;
out vec4 fragColor;

void mainImage(out vec4 o, vec2 C) {
	vec2 center = iResolution.xy * 0.5;
	C = (C - center) / uScale + center;

	vec2 mouseOffset = (uMouse - center) * 0.0002;
	C += mouseOffset * length(C - center) * step(0.5, uMouseInteractive);

	float i = 0.0;
	float d = 0.0;
	float z = 0.0;
	float T = iTime * uSpeed * uDirection;
	vec3 O = vec3(0.0);
	vec3 p;
	vec3 S;

	for (vec2 r = iResolution.xy, Q; ++i < 54.0; O += o.w / max(d, 1e-4) * o.xyz) {
		p = z * normalize(vec3(C - 0.5 * r, r.y));
		p.z -= 4.0;
		S = p;
		d = p.y - T;

		p.x += 0.4 * (1.0 + p.y) * sin(d + p.x * 0.1) * cos(0.34 * d + p.x * 0.05);
		Q = p.xz *= mat2(cos(p.y + vec4(0.0, 11.0, 33.0, 0.0) - T));
		z += d = abs(sqrt(length(Q * Q)) - 0.25 * (5.0 + S.y)) / 3.0 + 8e-4;
		o = 1.0 + sin(S.y + p.z * 0.5 + S.z - length(S - p) + vec4(2.0, 1.0, 0.0, 8.0));
	}

	o.xyz = tanh(O / 1e4);
}

void main() {
	vec4 o = vec4(0.0);
	mainImage(o, gl_FragCoord.xy);

	// NaN-safe clamp (NaN check: x != x)
	vec3 rgb = o.rgb;
	if (rgb.r != rgb.r || rgb.g != rgb.g || rgb.b != rgb.b) {
		rgb = vec3(0.0);
	}
	rgb = clamp(rgb, 0.0, 1.0);

	float intensity = (rgb.r + rgb.g + rgb.b) / 3.0;
	vec3 customColor = intensity * uCustomColor * uColorBoost;
	vec3 finalColor = mix(rgb, customColor, step(0.5, uUseCustomColor));

	float alpha = clamp(length(rgb) * uOpacity, 0.0, 1.0);
	fragColor = vec4(finalColor, alpha);
}
`;

	class Plasma {
		constructor(container, options = {}) {
			this.container = container;
			this.options = {
				color: options.color || '#002366',
				speed: typeof options.speed === 'number' ? options.speed : 1,
				direction: options.direction || 'forward',
				scale: typeof options.scale === 'number' ? options.scale : 1,
				opacity: typeof options.opacity === 'number' ? options.opacity : 0.65,
				mouseInteractive: options.mouseInteractive === true,
				colorBoost: typeof options.colorBoost === 'number' ? options.colorBoost : 2.35
			};

			this.mousePos = { x: 0, y: 0 };
			this.raf = 0;
			this.visible = true;
			this.init();
		}

		createShader(gl, type, source) {
			const shader = gl.createShader(type);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				console.error('Plasma shader error:', gl.getShaderInfoLog(shader));
				gl.deleteShader(shader);
				return null;
			}

			return shader;
		}

		init() {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });

			if (!gl) {
				// Graceful fallback: keep CSS background.
				this.container.setAttribute('data-plasma', 'unsupported');
				return;
			}

			this.gl = gl;
			this.canvas = canvas;
			canvas.style.display = 'block';
			canvas.style.width = '100%';
			canvas.style.height = '100%';
			this.container.appendChild(canvas);

			const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
			const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
			if (!vertexShader || !fragmentShader) return;

			this.program = gl.createProgram();
			gl.attachShader(this.program, vertexShader);
			gl.attachShader(this.program, fragmentShader);
			gl.linkProgram(this.program);

			if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
				console.error('Plasma link error:', gl.getProgramInfoLog(this.program));
				return;
			}

			gl.useProgram(this.program);

			// Fullscreen triangle
			const positions = new Float32Array([
				-1, -1,
				-1, 4,
				4, -1
			]);

			const uvs = new Float32Array([
				0, 0,
				0, 2,
				2, 0
			]);

			const positionBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

			const positionLoc = gl.getAttribLocation(this.program, 'position');
			gl.enableVertexAttribArray(positionLoc);
			gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

			const uvBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

			const uvLoc = gl.getAttribLocation(this.program, 'uv');
			if (uvLoc >= 0) {
				gl.enableVertexAttribArray(uvLoc);
				gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
			}

			const useCustomColor = this.options.color ? 1.0 : 0.0;
			const customColorRgb = this.options.color ? hexToRgb(this.options.color) : [1, 1, 1];
			const directionMultiplier = this.options.direction === 'reverse' ? -1.0 : 1.0;

			this.uniforms = {
				iTime: gl.getUniformLocation(this.program, 'iTime'),
				iResolution: gl.getUniformLocation(this.program, 'iResolution'),
				uCustomColor: gl.getUniformLocation(this.program, 'uCustomColor'),
				uUseCustomColor: gl.getUniformLocation(this.program, 'uUseCustomColor'),
				uSpeed: gl.getUniformLocation(this.program, 'uSpeed'),
				uDirection: gl.getUniformLocation(this.program, 'uDirection'),
				uScale: gl.getUniformLocation(this.program, 'uScale'),
				uOpacity: gl.getUniformLocation(this.program, 'uOpacity'),
				uMouse: gl.getUniformLocation(this.program, 'uMouse'),
				uMouseInteractive: gl.getUniformLocation(this.program, 'uMouseInteractive'),
				uColorBoost: gl.getUniformLocation(this.program, 'uColorBoost')
			};

			gl.uniform3f(this.uniforms.uCustomColor, ...customColorRgb);
			gl.uniform1f(this.uniforms.uUseCustomColor, useCustomColor);
			gl.uniform1f(this.uniforms.uSpeed, this.options.speed * 0.4);
			gl.uniform1f(this.uniforms.uDirection, directionMultiplier);
			gl.uniform1f(this.uniforms.uScale, this.options.scale);
			gl.uniform1f(this.uniforms.uOpacity, this.options.opacity);
			gl.uniform1f(this.uniforms.uColorBoost, this.options.colorBoost);
			gl.uniform2f(this.uniforms.uMouse, 0, 0);
			gl.uniform1f(this.uniforms.uMouseInteractive, this.options.mouseInteractive ? 1.0 : 0.0);

			if (this.options.mouseInteractive) {
				this.handleMouseMove = (e) => {
					const rect = this.container.getBoundingClientRect();
					this.mousePos.x = e.clientX - rect.left;
					this.mousePos.y = e.clientY - rect.top;
					gl.uniform2f(this.uniforms.uMouse, this.mousePos.x, this.mousePos.y);
				};
				this.container.addEventListener('mousemove', this.handleMouseMove);
			}

			this.setSize();
			this.resizeObserver = new ResizeObserver(() => this.setSize());
			this.resizeObserver.observe(this.container);

			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

			this.t0 = performance.now();
			this.start();
		}

		setSize() {
			if (!this.gl || !this.canvas || !this.uniforms) return;
			const rect = this.container.getBoundingClientRect();
			const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
			const width = Math.max(1, Math.floor(rect.width * dpr));
			const height = Math.max(1, Math.floor(rect.height * dpr));

			this.canvas.width = width;
			this.canvas.height = height;
			this.gl.viewport(0, 0, width, height);
			this.gl.uniform2f(this.uniforms.iResolution, width, height);
		}

		start() {
			if (!this.gl || this.raf) return;
			this.raf = requestAnimationFrame(() => this.animate());
		}

		stop() {
			if (this.raf) {
				cancelAnimationFrame(this.raf);
				this.raf = 0;
			}
		}

		animate() {
			this.raf = 0;
			if (!this.gl || !this.uniforms || !this.visible) return;

			const t = performance.now();
			const timeValue = (t - this.t0) * 0.001;
			this.gl.uniform1f(this.uniforms.iTime, timeValue);

			this.gl.clearColor(0, 0, 0, 0);
			this.gl.clear(this.gl.COLOR_BUFFER_BIT);
			this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);

			this.raf = requestAnimationFrame(() => this.animate());
		}

		setVisible(isVisible) {
			this.visible = Boolean(isVisible);
			if (this.visible) this.start();
			else this.stop();
		}

		dispose() {
			this.stop();
			this.resizeObserver?.disconnect();
			if (this.options.mouseInteractive && this.handleMouseMove) {
				this.container.removeEventListener('mousemove', this.handleMouseMove);
			}
			try {
				if (this.canvas && this.canvas.parentElement === this.container) {
					this.container.removeChild(this.canvas);
				}
			} catch {
				// ignore
			}
		}
	}

	const initBannerPlasma = () => {
		const container = document.getElementById('wm-plasma');
		if (!container) return;

		if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			container.setAttribute('data-plasma', 'reduced-motion');
			return;
		}

		const plasma = new Plasma(container, {
			color: '#002366',
			speed: 1,
			direction: 'forward',
			scale: 1,
			opacity: 0.55,
			mouseInteractive: false,
			colorBoost: 2.5
		});

		// Pause rendering when banner is out of view.
		if ('IntersectionObserver' in window) {
			const io = new IntersectionObserver((entries) => {
				for (const entry of entries) {
					plasma.setVisible(entry.isIntersecting);
				}
			}, { threshold: 0.05 });
			io.observe(container);
		}

		window.WebmarkPlasma = plasma;
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initBannerPlasma);
	} else {
		initBannerPlasma();
	}
})();
