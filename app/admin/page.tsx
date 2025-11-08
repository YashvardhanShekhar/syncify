"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { set } from "idb-keyval";

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminPage() {
	const [videoId, setVideoId] = useState("");
	const [audioUrl, setAudioUrl] = useState("");
	const [title, setTitle] = useState("");
	const [downloadUrl,setDownloadUrl] = useState("")
	const [roomId, setRoomId] = useState(null);
	const [channel, setChannel] = useState(null);
	const [loading, setLoading] = useState(false);
	const [status, setStatus] = useState("");
	const [activeUsers, setActiveUsers] = useState(0);
	const audioRef = useRef(null);
	const clients = useRef(new Set()); // track unique clients
	const infoRef = useRef({ title: "", downloadUrl: "" });

	// whenever these values change:
	useEffect(() => {
		infoRef.current = { title, downloadUrl };
	}, [title, downloadUrl]);

	const API_KEY = "a6389cf97dmsh7a0cc967f520fc9p1458d3jsn8dfc2d9e88a7";
	const API_HOST = "youtube-mp36.p.rapidapi.com";

	const handleFetch = async () => {
		if (!videoId.trim()) return alert("Enter YouTube link or video ID");

		setLoading(true);
		setStatus("Fetching audio...");

		let id = videoId.trim();
		const match = id.match(/v=([^&]+)/);
		if (match) id = match[1];

		try {
			const res = await fetch(`https://${API_HOST}/dl?id=${id}`, {
				headers: {
					"x-rapidapi-key": API_KEY,
					"x-rapidapi-host": API_HOST,
				},
			});
			const data = await res.json();
			if (data.status !== "ok" || !data.link)
				throw new Error("Conversion failed");

			setTitle(data.title);
			setDownloadUrl(data.link);
			setStatus("Downloading audio...");
			const audioRes = await fetch(data.link);

			const blob = await audioRes.blob();
			const blobUrl = URL.createObjectURL(blob);
			setAudioUrl(blobUrl);
			await set("lastSong", { title: data.title, audioUrl: blobUrl });

			const id4 = 2323;
			setRoomId(id4);
			const ch = supabase.channel(`room-${id4}`, {
				config: { broadcast: { self: true } },
			});
			setChannel(ch);
			setStatus("");
			// --- Handle pings ---
			ch.on("broadcast", { event: "ping" }, (payload) => {
				const { sentAt, clientId } = payload.payload;

				// 🧠 Register new client
				if (!clients.current.has(clientId)) {
					clients.current.add(clientId);
					setActiveUsers(clients.current.size);
					console.log("👤 New client joined:", clientId);
					const { title, downloadUrl } = infoRef.current;

					// Send init payload specifically to that client
					ch.send({
						type: "broadcast",
						event: "sync",
						payload: {
							clientId,
							type: "init",
							title: title,
							downloadUrl: downloadUrl,
							currentTime: audioRef.current?.currentTime || 0,
							sentAt: Date.now(),
						},
					});
				}

				// Always reply with pong
				ch.send({
					type: "broadcast",
					event: "pong",
					payload: { clientId, sentAt, serverTime: Date.now() },
				});
			});

			// 🟢 Handle leaves
			ch.on("broadcast", { event: "leave" }, (payload) => {
				const { clientId } = payload.payload;
				if (clients.current.has(clientId)) {
					clients.current.delete(clientId);
					setActiveUsers(clients.current.size);
					console.log("🚪 Client left:", clientId);
				}
			});

			ch.subscribe((status) => {
				if (status === "SUBSCRIBED") {
					console.log("✅ Admin subscribed to room", id4);
					setStatus(`Room created: ${id4}`);
				}
			});
		} catch (err) {
			console.error(err);
			alert(err.message);
		} finally {
			setLoading(false);
		}
	};

	const broadcast = (type, extra = {}) => {
		if (!channel) return;
		channel.send({
			type: "broadcast",
			event: "sync",
			payload: {
				type,
				currentTime: audioRef.current?.currentTime || 0,
				sentAt: Date.now(),
				...extra,
			},
		});
	};

	useEffect(() => {
		if (!channel) return;
		const interval = setInterval(
			() => broadcast("sync", { isPlaying: !audioRef.current?.paused }),
			2000
		);
		return () => clearInterval(interval);
	}, [channel]);

	const handlePlay = () => {
		audioRef.current.play();
		broadcast("play");
	};
	const handlePause = () => {
		audioRef.current.pause();
		broadcast("pause");
	};
	const handleSeek = (offset) => {
		audioRef.current.currentTime += offset;
		broadcast("seek");
	};

	return (
		<div style={{ padding: "30px", textAlign: "center" }}>
			<h2>🎧 Music Sync Admin Panel</h2>

			{!audioUrl && (
				<div style={{ marginTop: 20 }}>
					<input
						type="text"
						placeholder="Enter YouTube link or video ID"
						value={videoId}
						onChange={(e) => setVideoId(e.target.value)}
						style={{
							width: "60%",
							padding: "10px",
							borderRadius: "8px",
							border: "1px solid #ccc",
						}}
					/>
					<button
						onClick={handleFetch}
						disabled={loading}
						style={{
							marginLeft: 10,
							padding: "10px 20px",
							borderRadius: "8px",
							border: "none",
							background: "#0070f3",
							color: "white",
							cursor: "pointer",
						}}
					>
						{loading ? "Fetching..." : "Fetch Audio"}
					</button>
				</div>
			)}

			{status && <p style={{ marginTop: 10 }}>{status}</p>}
			{activeUsers > 0 && (
				<p style={{ marginTop: 5, color: "limegreen" }}>
					👥 Active Listeners: {activeUsers}
				</p>
			)}

			{audioUrl && (
				<div style={{ marginTop: 30 }}>
					<h3>{title}</h3>
					{roomId && (
						<p>
							🔗 Share link:{" "}
							<strong>localhost:3000/{roomId}</strong>
						</p>
					)}

					<audio
						ref={audioRef}
						controls
						src={audioUrl}
						style={{ width: "80%", marginTop: 20 }}
					/>

					<div style={{ marginTop: 20 }}>
						<button onClick={handlePlay} style={btn}>
							▶️ Play
						</button>
						<button onClick={handlePause} style={btn}>
							⏸ Pause
						</button>
						<button onClick={() => handleSeek(-10)} style={btn}>
							⏪ -10s
						</button>
						<button onClick={() => handleSeek(10)} style={btn}>
							⏩ +10s
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

const btn = {
	margin: "0 10px",
	padding: "10px 20px",
	borderRadius: "8px",
	border: "none",
	background: "#333",
	color: "white",
	cursor: "pointer",
};
