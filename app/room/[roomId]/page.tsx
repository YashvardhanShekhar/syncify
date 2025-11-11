"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";
import { Music, Clock } from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function ListenerPage() {
	const { roomId } = useParams();
	const [audioUrl, setAudioUrl] = useState("");
	const [unlocked, setUnlocked] = useState(false);
	const [title, setTitle] = useState("");
	const [status, setStatus] = useState("Waiting for admin...");
	const [channel, setChannel] = useState<any>(null);
	const [msDelay, setMsDelay] = useState(0);

	const clientId = useRef(Math.random().toString(36).slice(2, 10));
	const audioRef = useRef<HTMLAudioElement>(null);
	let clockOffset = useRef(0);

	useEffect(() => {
		if (!roomId) return;
		setStatus("Connecting...");

		const ch = supabase.channel(`room-${roomId}`, {
			config: { broadcast: { self: true } },
		});
		setChannel(ch);

		// Ping to measure latency
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
			setMsDelay(Math.round(rtt / 2));
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

			if (
				data.type === "init" &&
				data.clientId &&
				data.clientId !== "admin" &&
				data.clientId !== clientId.current
			)
				return;

			if (data.type === "init") {
				setTitle(data.title);
				setStatus("Downloading...");
				try {
					const res = await fetch(data.downloadUrl);
					const blob = await res.blob();
					setAudioUrl(URL.createObjectURL(blob));
					setStatus("Ready 🎧");
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
				if (data.isPlaying) audio.play().catch(() => {});
				else audio.pause();

				const diff = targetTime - audio.currentTime;
				if (Math.abs(diff) > 0.3) {
					audio.currentTime = targetTime;
				} else {
					audio.playbackRate = 1 + diff * 0.2;
					clearTimeout((audio as any)._syncReset);
					(audio as any)._syncReset = setTimeout(
						() => (audio.playbackRate = 1),
						1000
					);
				}
			}
		});

		ch.subscribe((s) => {
			if (s === "SUBSCRIBED") {
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
		<div className="min-h-screen w-full flex flex-col lg:flex-row items-start lg:items-center justify-start lg:justify-between relative bg-black/40">
			{/* LEFT CONTENT */}
			<div className="w-full lg:w-3/5 px-4 sm:px-8 py-6 sm:py-12 flex flex-col justify-start">
				<div className="max-w-2xl relative">
					{/* Header + Latency Badge */}
					<div className="relative mb-6">
						<h2 className="text-3xl font-semibold text-white">
							🎵 Syncify Listener
						</h2>

						<div className="absolute right-0 top-0 flex items-center gap-2">
							<div
								className="inline-flex items-center gap-2 bg-white/6 backdrop-blur-sm border border-white/8 text-sm px-3 py-1 rounded-full"
								title="Average Latency"
							>
								<Clock className="w-4 h-4 text-white" />
								<span className="text-white">{msDelay} ms</span>
							</div>
						</div>
					</div>

					{/* Status */}
					{status && (
						<div
							className={`mt-4 px-4 py-3 rounded-md text-sm border transition-all duration-300 ${
								status.toLowerCase().includes("failed") ||
								status.toLowerCase().includes("error")
									? "bg-red-500/20 text-red-200 border-red-500/30"
									: "bg-white/10 text-white border-white/10"
							}`}
						>
							{status}
						</div>
					)}

					{/* Song + listening indicator */}
					{audioUrl && (
						<div className="mt-8 bg-white/4 border border-white/6 p-6 rounded-lg">
							<div className="flex flex-col gap-4 items-center text-center">
								<h3 className="text-xl text-white font-medium">
									{title || "Now Playing"}
								</h3>

								{/* Listening Indicator */}
								<div className="flex flex-col items-center justify-center mt-3">
									{/* Animated Equalizer Bars */}
									<div className="flex items-end justify-center gap-1 h-5 mb-1">
										<div className="w-1.5 h-2 bg-green-400 rounded-sm animate-[bounce_0.9s_ease-in-out_infinite]" />
										<div className="w-1.5 h-3 bg-green-300 rounded-sm animate-[bounce_0.8s_ease-in-out_infinite]" />
										<div className="w-1.5 h-4 bg-green-500 rounded-sm animate-[bounce_1s_ease-in-out_infinite]" />
										<div className="w-1.5 h-3 bg-green-400 rounded-sm animate-[bounce_1.1s_ease-in-out_infinite]" />
									</div>

									{/* Text */}
									<span className="text-white/70 text-sm tracking-wide">
										Listening in sync
									</span>
								</div>
							</div>

							<audio
								ref={audioRef}
								src={audioUrl}
								preload="auto"
								style={{ display: "none" }}
							/>
						</div>
					)}

					{!audioUrl && (
						<p className="mt-6 text-sm text-white/70">
							Waiting for admin to start playback...
						</p>
					)}

					<p className="mt-6 text-xs text-white/60">
						Audio syncs automatically with admin control.
					</p>
				</div>
			</div>

			{/* RIGHT SIDE animation */}
			<div
				className="block lg:w-2/5 lg:block w-full mt-10"
				aria-hidden="true"
			/>

			{/*  Unlock overlay */}
			{audioUrl && !unlocked && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
					<div className="bg-white/10 border border-white/20 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
						<div className="flex flex-col items-center gap-4">
							<div className="p-4 bg-violet-600/20 rounded-full">
								<Music className="w-8 h-8 text-violet-400" />
							</div>
							<h2 className="text-2xl font-semibold text-white">
								Enable Audio Playback
							</h2>
							<p className="text-white/70 text-sm">
								To sync with the admin’s music, allow playback
								on your device.
							</p>
							<button
								onClick={() => setUnlocked(true)}
								className="mt-4 px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-md text-white font-medium transition-colors"
							>
								Allow
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
