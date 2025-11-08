"use client";

import { useState, useEffect } from "react";
import { set, get } from "idb-keyval";

export default function YouTubeMP3Player() {
	const [videoId, setVideoId] = useState("");
	const [audioUrl, setAudioUrl] = useState("");
	const [title, setTitle] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	
	const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
	const API_HOST = process.env.NEXT_PUBLIC_API_HOST;

	// Load previously saved song
	useEffect(() => {
		(async () => {
			const saved = await get("lastSong");
			if (saved) {
				setAudioUrl(saved.audioUrl);
				setTitle(saved.title);
			}
		})();
	}, []);

	const handleFetch = async () => {
		if (!videoId.trim()) {
			setError("Please enter a valid YouTube link or video ID");
			return;
		}

		setError("");
		setLoading(true);
		setAudioUrl("");

		let id = videoId.trim();
		const match = id.match(/v=([^&]+)/);
		if (match) id = match[1];

		try {
			const res = await fetch(`https://${API_HOST}/dl?id=${id}`, {
				method: "GET",
				headers: {
					"x-rapidapi-key": API_KEY,
					"x-rapidapi-host": API_HOST,
				},
			});

			if (!res.ok) throw new Error("API request failed");
			const data = await res.json();

			if (data.status !== "ok" || !data.link)
				throw new Error("Conversion failed or unavailable");

			setTitle(data.title);

			// Fetch the audio as blob to store locally
			const audioRes = await fetch(data.link);
			const blob = await audioRes.blob();

			const blobUrl = URL.createObjectURL(blob);
			setAudioUrl(blobUrl);

			// Save in IndexedDB for reuse
			await set("lastSong", {
				title: data.title,
				audioUrl: blobUrl,
			});

			console.log("Song saved locally in IndexedDB");
		} catch (err) {
			console.error(err);
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{ textAlign: "center", padding: 30 }}>
			<h2>🎶 YouTube MP3 Player (Offline Ready)</h2>

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
				{loading ? "Fetching..." : "Fetch & Play"}
			</button>

			{error && <p style={{ color: "red" }}>{error}</p>}

			{title && (
				<div style={{ marginTop: 20 }}>
					<h4>{title}</h4>
					{audioUrl ? (
						<audio
							controls
							src={audioUrl}
							style={{ width: "80%", marginTop: 10 }}
						/>
					) : (
						<p>Loading audio...</p>
					)}
				</div>
			)}
		</div>
	);
}
