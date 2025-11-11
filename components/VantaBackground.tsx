"use client";

import { useEffect, useRef } from "react";

export default function VantaBackground() {
	const vantaRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let effect: any;

		const loadScript = (src: string) =>
			new Promise<void>((resolve, reject) => {
				const script = document.createElement("script");
				script.src = src;
				script.async = true;
				script.onload = () => resolve();
				script.onerror = () => reject(`Failed to load ${src}`);
				document.body.appendChild(script);
			});

		(async () => {
			try {
				await loadScript(
					"https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"
				);
				await loadScript(
					"https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.halo.min.js"
				);

				const initVanta = () => {
					// Check if mobile or desktop
					const isMobile = window.innerWidth < 768;

					const config = {
						el: vantaRef.current,
						mouseControls: true,
						touchControls: true,
						gyroControls: false,
						minHeight: 200.0,
						minWidth: 200.0,
						baseColor: 0x203357,
						backgroundColor: 0x80839,
						amplitudeFactor: isMobile ? 0.1 : 1.5,
						size: isMobile ? 0.7 : 1,
						xOffset: isMobile ? 0 : 0.2,
						yOffset: isMobile ? -0.12 : 0,
					};

					// @ts-ignore
					if (window.VANTA && window.VANTA.HALO && vantaRef.current) {
						// @ts-ignore
						effect = window.VANTA.HALO(config);
						if (isMobile && vantaRef.current) {
							vantaRef.current.style.opacity = "0.6";
						}
					} else {
						setTimeout(initVanta, 200);
					}
				};

				initVanta();
			} catch (err) {
				console.error(err);
			}
		})();

		return () => {
			if (effect) effect.destroy();
		};
	}, []);

	return <div ref={vantaRef} className="w-full h-screen transition-opacity duration-500 "/>;
}
