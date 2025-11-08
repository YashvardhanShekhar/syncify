"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";
import { couldStartTrivia } from "typescript";

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ListenerPage() {
	const { roomId } = useParams();
	const [audioUrl, setAudioUrl] = useState("");
	const [title, setTitle] = useState("");
	const [status, setStatus] = useState("Waiting for admin...");
	const [channel, setChannel] = useState(null);
	const [msDelay, setMsDelay] = useState(0);
	const clientId = useRef(Math.random().toString(36).slice(2, 10));
	const audioRef = useRef(null);
	let clockOffset = useRef(0);

	useEffect(() => {
		if (!roomId) return;
		setStatus("Connecting...");

		const ch = supabase.channel(`room-${roomId}`, {
			config: { broadcast: { self: true } },
		});
		setChannel(ch);

		// --- Ping to measure offset ---
		const ping = () => {
			const sentAt = Date.now();
			ch.send({
				type: "broadcast",
				event: "ping",
				payload: { sentAt, clientId: clientId.current },
			});
		};

		ch.on("broadcast", { event: "pong" }, (payload) => {
			const { clientId: target, sentAt, serverTime } = payload.payload;
			if (target !== clientId.current) return;
			const now = Date.now();
			const rtt = now - sentAt;
			const offset = serverTime + rtt / 2 - now;
			clockOffset.current = offset;
			setMsDelay(rtt / 2);
		});

		const pingInterval = setInterval(ping, 2000);
		ping();

		ch.on("broadcast", { event: "sync" }, async (payload) => {
			const data = payload.payload;
			if (!data) return;

			const audio = audioRef.current;
			const correctedNow = Date.now() + clockOffset.current;
			const latency = (correctedNow - data.sentAt) / 1000;
			const targetTime = (data.currentTime || 0) + latency;

			// ✅ Only respond to this client’s init
			if (
				data.type === "init" &&
				data.clientId &&
				data.clientId !== clientId.current
			) {
				return;
			}

			if (data.type === "init") {
				setTitle(data.title);
				setStatus("Downloading...");
				try {
					const res = await fetch(data.downloadUrl);
					const blob = await res.blob();
					setAudioUrl(URL.createObjectURL(blob));
					setStatus("Ready 🎧");
					console.log( data)
				} catch {
					setStatus("Download failed ❌");
				}
				return;
			}

			if (!audio) return;

			if (data.type === "play") {
				audio.currentTime = targetTime;
				audio.play().catch(() => {});
			} else if (data.type === "pause") {
				audio.pause();
			} else if (data.type === "seek") {
				audio.currentTime = targetTime;
			}

			if (data.type === "sync" || data.type === "play") {
				if (data.isPlaying) {
					audio.play().catch(() => {});
				} else {
					audio.pause();
				}
				const diff = targetTime - audio.currentTime;
				if (Math.abs(diff) > 0.3) {
					audio.currentTime = targetTime;
				} else {
					audio.playbackRate = 1 + diff * 0.2;
					clearTimeout(audio._syncReset);
					audio._syncReset = setTimeout(
						() => (audio.playbackRate = 1),
						1000
					);
				}
			}
		});

		ch.subscribe((status) => {
			if (status === "SUBSCRIBED") {
				setStatus(`Connected to ${roomId}, waiting for admin...`);
				console.log("✅ Joined channel room-" + roomId);
			}
		});

		window.addEventListener("beforeunload", () => {
			ch.send({
				type: "broadcast",
				event: "leave",
				payload: { clientId: clientId.current },
			});
		});

		return () => {
			clearInterval(pingInterval);
			ch.send({
				type: "broadcast",
				event: "leave",
				payload: { clientId: clientId.current },
			});
			ch.unsubscribe();
		};
	}, [roomId]);

	return (
		<div style={{ padding: "30px", textAlign: "center" }}>
			<h2>🎧 Music Sync Listener</h2>
			<p>{status}</p>
			{title && <h3>{title}</h3>}
			<p>Avg Delay: {msDelay.toFixed(1)} ms</p>

			{!audioUrl ? (
				<p>Waiting for admin...</p>
			) : (
				<>
					{!window.unlocked && (
						<div
							style={{
								background: "rgba(0,0,0,0.8)",
								color: "white",
								position: "fixed",
								inset: 0,
								display: "flex",
								justifyContent: "center",
								alignItems: "center",
								flexDirection: "column",
								zIndex: 9999,
							}}
						>
							<p style={{ fontSize: 18, marginBottom: 10 }}>
								Tap below to enable audio 🎵
							</p>
							<button
								onClick={() => {
									const audio = audioRef.current;
									audio
										.play()
										.then(() => {
											audio.pause();
											window.unlocked = true;
											document.querySelector(
												"#unlock-overlay"
											).style.display = "none";
											console.log(
												"✅ Audio context unlocked"
											);
										})
										.catch((e) =>
											console.warn("⚠️ Unlock failed", e)
										);
								}}
								id="unlock-overlay"
								style={{
									background: "#0070f3",
									border: "none",
									color: "white",
									padding: "12px 24px",
									fontSize: "16px",
									borderRadius: "8px",
									cursor: "pointer",
								}}
							>
								Enable Audio
							</button>
						</div>
					)}

					<audio
						ref={audioRef}
						controls={false}
						preload="auto"
						src={audioUrl}
						style={{ width: "80%", marginTop: 20 }}
					/>
				</>
			)}
		</div>
	);

}
