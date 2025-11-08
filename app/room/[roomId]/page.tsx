"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";
import { Music, Users, Clock } from "lucide-react";

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ListenerPage() {
	const { roomId } = useParams();
	const [audioUrl, setAudioUrl] = useState("");
	const [unlocked, setUnlocked] = useState(false);
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
					console.log(data);
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
		<div
			style={{
				minHeight: "100vh",
				background:
					"linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "20px",
				fontFamily:
					'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
			}}
		>
			<div style={{ width: "100%", maxWidth: "480px" }}>
				{/* Main Card */}
				<div
					style={{
						background: "rgba(255, 255, 255, 0.95)",
						backdropFilter: "blur(20px)",
						borderRadius: "32px",
						boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
						overflow: "hidden",
					}}
				>
					{/* Header */}
					<div
						style={{
							background:
								"linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
							padding: "32px 24px",
							color: "white",
							textAlign: "center",
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "12px",
								marginBottom: "12px",
							}}
						>
							<Music size={32} />
							<h1
								style={{
									fontSize: "28px",
									fontWeight: "bold",
									margin: 0,
								}}
							>
								Music Sync
							</h1>
						</div>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "8px",
								fontSize: "14px",
								opacity: 0.95,
							}}
						>
							<div
								style={{
									width: "8px",
									height: "8px",
									borderRadius: "50%",
									background:
										status === "Connected"
											? "#86efac"
											: "#fde047",
									animation:
										"pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
								}}
							></div>
							<span>{status}</span>
						</div>
					</div>

					{/* Content */}
					<div style={{ padding: "32px 24px" }}>
						{/* Now Playing */}
						{title && (
							<div
								style={{
									textAlign: "center",
									marginBottom: "32px",
								}}
							>
								<div
									style={{
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										width: "80px",
										height: "80px",
										background:
											"linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
										borderRadius: "50%",
										marginBottom: "16px",
										boxShadow:
											"0 10px 25px -5px rgba(129, 140, 248, 0.5)",
									}}
								>
									<Music size={40} color="white" />
								</div>
								<h2
									style={{
										fontSize: "24px",
										fontWeight: "600",
										color: "#1f2937",
										margin: "0 0 8px 0",
									}}
								>
									{title}
								</h2>
								<p
									style={{
										fontSize: "14px",
										color: "#6b7280",
										margin: 0,
									}}
								>
									Now Playing
								</p>
							</div>
						)}

						{/* Stats */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: "16px",
								marginBottom: "32px",
							}}
						>
							<div
								style={{
									background:
										"linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)",
									borderRadius: "20px",
									padding: "24px 16px",
									textAlign: "center",
								}}
							>
								<Clock
									size={24}
									color="#6366f1"
									style={{ margin: "0 auto 12px" }}
								/>
								<div
									style={{
										fontSize: "28px",
										fontWeight: "bold",
										color: "#1f2937",
									}}
								>
									{msDelay.toFixed(1)}
								</div>
								<div
									style={{
										fontSize: "12px",
										color: "#6b7280",
										marginTop: "4px",
									}}
								>
									Avg Delay (ms)
								</div>
							</div>
							<div
								style={{
									background:
										"linear-gradient(135deg, #fae8ff 0%, #fce7f3 100%)",
									borderRadius: "20px",
									padding: "24px 16px",
									textAlign: "center",
								}}
							>
								<Users
									size={24}
									color="#a855f7"
									style={{ margin: "0 auto 12px" }}
								/>
								<div
									style={{
										fontSize: "28px",
										fontWeight: "bold",
										color: "#1f2937",
									}}
								>
									Live
								</div>
								<div
									style={{
										fontSize: "12px",
										color: "#6b7280",
										marginTop: "4px",
									}}
								>
									Sync Mode
								</div>
							</div>
						</div>

						{/* Audio Section */}
						{!audioUrl ? (
							<div
								style={{
									textAlign: "center",
									padding: "32px 0",
								}}
							>
								<div
									style={{
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										width: "64px",
										height: "64px",
										background: "#f3f4f6",
										borderRadius: "50%",
										marginBottom: "16px",
									}}
								>
									<Music size={32} color="#9ca3af" />
								</div>
								<p
									style={{
										color: "#6b7280",
										margin: 0,
									}}
								>
									Waiting for admin to start...
								</p>
							</div>
						) : (
							<div>
								{/* Audio Element - No Controls */}
								<audio
									ref={audioRef}
									src={audioUrl}
									preload="auto"
									style={{ display: "none" }}
								/>

								{/* Listening Indicator */}
								<div
									style={{
										background:
											"linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)",
										borderRadius: "20px",
										padding: "32px 24px",
										textAlign: "center",
									}}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											gap: "12px",
											marginBottom: "16px",
										}}
									>
										<div
											style={{
												width: "12px",
												height: "12px",
												background: "#22c55e",
												borderRadius: "50%",
												animation:
													"pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
											}}
										></div>
										<div
											style={{
												width: "8px",
												height: "8px",
												background: "#4ade80",
												borderRadius: "50%",
												animation:
													"pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
												animationDelay: "0.2s",
											}}
										></div>
										<div
											style={{
												width: "8px",
												height: "8px",
												background: "#86efac",
												borderRadius: "50%",
												animation:
													"pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
												animationDelay: "0.4s",
											}}
										></div>
									</div>
									<p
										style={{
											color: "#374151",
											fontWeight: "500",
											margin: "0 0 8px 0",
											fontSize: "16px",
										}}
									>
										Listening in sync
									</p>
									<p
										style={{
											fontSize: "12px",
											color: "#6b7280",
											margin: 0,
										}}
									>
										Audio controlled by admin
									</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Footer Info */}
				<div
					style={{
						textAlign: "center",
						marginTop: "20px",
						fontSize: "14px",
						color: "rgba(255, 255, 255, 0.9)",
					}}
				>
					<p style={{ margin: 0 }}>Synced playback • Low latency</p>
				</div>
			</div>

			{/* Unlock Overlay */}
			{audioUrl && !unlocked && (
				<div
					style={{
						position: "fixed",
						inset: 0,
						background: "rgba(0, 0, 0, 0.92)",
						backdropFilter: "blur(8px)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						zIndex: 9999,
						padding: "20px",
					}}
				>
					<div
						style={{
							textAlign: "center",
							maxWidth: "400px",
						}}
					>
						<div
							style={{
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								width: "80px",
								height: "80px",
								background:
									"linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								borderRadius: "50%",
								marginBottom: "24px",
								boxShadow:
									"0 20px 40px -10px rgba(102, 126, 234, 0.6)",
							}}
						>
							<Music size={40} color="white" />
						</div>
						<h2
							style={{
								fontSize: "32px",
								fontWeight: "bold",
								color: "white",
								margin: "0 0 16px 0",
							}}
						>
							Ready to Listen?
						</h2>
						<p
							style={{
								color: "#d1d5db",
								fontSize: "18px",
								margin: "0 0 32px 0",
							}}
						>
							Tap below to enable audio playback
						</p>
						<button
							onClick={() => setUnlocked(true)}
							style={{
								width: "100%",
								maxWidth: "320px",
								background:
									"linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
								color: "white",
								fontWeight: "600",
								padding: "18px 32px",
								borderRadius: "50px",
								border: "none",
								fontSize: "16px",
								cursor: "pointer",
								boxShadow:
									"0 20px 40px -10px rgba(102, 126, 234, 0.6)",
								transition: "transform 0.2s, box-shadow 0.2s",
							}}
							onMouseEnter={(e) => {
								e.target.style.transform = "scale(1.05)";
								e.target.style.boxShadow =
									"0 25px 50px -10px rgba(102, 126, 234, 0.8)";
							}}
							onMouseLeave={(e) => {
								e.target.style.transform = "scale(1)";
								e.target.style.boxShadow =
									"0 20px 40px -10px rgba(102, 126, 234, 0.6)";
							}}
						>
							Enable Audio 🎵
						</button>
					</div>
				</div>
			)}

			<style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .5;
          }
        }
      `}</style>
		</div>
	);
}