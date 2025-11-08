"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";

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

		// Announce join
		ch.subscribe((status) => {
			if (status === "SUBSCRIBED") {
				setStatus(`Connected to ${roomId}, waiting for admin...`);
				ch.send({
					type: "broadcast",
					event: "join",
					payload: { clientId: clientId.current },
				});
				console.log("✅ Joined as", clientId.current);
			}
		});

		// Announce leave
		window.addEventListener("beforeunload", () => {
			ch.send({
				type: "broadcast",
				event: "leave",
				payload: { clientId: clientId.current },
			});
		});

		// --- Ping every 2s to measure offset ---
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
			console.log(`RTT=${rtt}ms | Offset=${offset.toFixed(2)}ms`);
		});

		const pingInterval = setInterval(ping, 2000);
		ping();

		// --- Handle sync events ---
		ch.on("broadcast", { event: "sync" }, async (payload) => {
			const data = payload.payload;
			if (!data) return;
			const audio = audioRef.current;
			const correctedNow = Date.now() + clockOffset.current;
			const latency = (correctedNow - data.sentAt) / 1000;
			const targetTime = (data.currentTime || 0) + latency;

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

			{audioUrl && (
				<audio
					ref={audioRef}
					controls
					src={audioUrl}
					style={{ width: "80%", marginTop: 20 }}
				/>
			)}
		</div>
	);
}
