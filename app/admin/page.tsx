"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { set } from "idb-keyval";
import {
	Play,
	Pause,
	RotateCcw,
	RotateCw,
	Users as UsersIcon,
	CloudDownload,
	Download,
	Copy,
} from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// --- Universal YouTube ID extractor ---
function extractYouTubeId(url) {
	try {
		if (!url || typeof url !== "string") return null;

		// if only ID passed directly
		if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

		const parsed = new URL(url);
		let host = parsed.hostname.replace("www.", "").replace("m.", "");
		let videoId = null;

		if (host === "youtu.be") {
			videoId = parsed.pathname.split("/")[1];
		} else if (host.includes("youtube")) {
			if (parsed.searchParams.has("v")) {
				videoId = parsed.searchParams.get("v");
			} else if (parsed.pathname.startsWith("/embed/")) {
				videoId = parsed.pathname.split("/embed/")[1];
			} else if (parsed.pathname.startsWith("/shorts/")) {
				videoId = parsed.pathname.split("/shorts/")[1];
			}
		}

		// fallback regex
		if (!videoId) {
			const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&]|$)/);
			videoId = match ? match[1] : null;
		}

		return videoId || null;
	} catch {
		return null;
	}
}

export default function AdminPage() {
	const [videoId, setVideoId] = useState("");
	const [audioUrl, setAudioUrl] = useState("");
	const [title, setTitle] = useState("");
	const [downloadUrl, setDownloadUrl] = useState("");
	const [roomId, setRoomId] = useState(null);
	const [channel, setChannel] = useState(null);
	const [loading, setLoading] = useState(false);
	const [status, setStatus] = useState("");
	const [activeUsers, setActiveUsers] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);

	const audioRef = useRef(null);
	const clients = useRef(new Set());
	const infoRef = useRef({ title: "", downloadUrl: "" });

	useEffect(() => {
		infoRef.current = { title, downloadUrl };
	}, [title, downloadUrl]);

	const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
	const API_HOST = process.env.NEXT_PUBLIC_API_HOST;

	const handleFetch = async () => {
		const id = extractYouTubeId(videoId.trim());

		if (!id) {
			setStatus("Invalid URL");
			return;
		}

		setLoading(true);
		setStatus("Fetching audio...");

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

			// Create room id (kept your sample id behavior)
			const id4 = crypto.randomUUID().split("-")[0].toUpperCase();
			setRoomId(id4);

			// Create supabase realtime channel
			const ch = supabase.channel(`room-${id4}`, {
				config: { broadcast: { self: true } },
			});
			setChannel(ch);
			setStatus("");

			// Handle incoming ping (new clients)
			ch.on("broadcast", { event: "ping" }, (payload) => {
				const { sentAt, clientId } = payload.payload;

				if (!clients.current.has(clientId)) {
					clients.current.add(clientId);
					setActiveUsers(clients.current.size);
					const { title: t, downloadUrl: d } = infoRef.current;

					// init -> send specifically to that client
					ch.send({
						type: "broadcast",
						event: "sync",
						payload: {
							clientId,
							type: "init",
							title: t,
							downloadUrl: d,
							currentTime: audioRef.current?.currentTime || 0,
							sentAt: Date.now(),
						},
					});
				}

				// always reply with pong
				ch.send({
					type: "broadcast",
					event: "pong",
					payload: { clientId, sentAt, serverTime: Date.now() },
				});
			});

			// Handle leave
			ch.on("broadcast", { event: "leave" }, (payload) => {
				const { clientId } = payload.payload;
				if (clients.current.has(clientId)) {
					clients.current.delete(clientId);
					setActiveUsers(clients.current.size);
				}
			});

			ch.subscribe((s) => {
				if (s === "SUBSCRIBED") {
					console.log("✅ Admin subscribed to room", id4);
					setStatus(`Room created: ${id4}`);
				}
			});
		} catch (err) {
			console.error(err);
			setStatus(err.message || "Failed to fetch audio");
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

	// keep periodic sync running while channel exists
	useEffect(() => {
		if (!channel) return;
		const interval = setInterval(
			() => broadcast("sync", { isPlaying: !audioRef.current?.paused }),
			2000
		);
		return () => clearInterval(interval);
	}, [channel]);

	// update isPlaying based on audio element events
	useEffect(() => {
		const aud = audioRef.current;
		if (!aud) return;

		const onPlay = () => setIsPlaying(true);
		const onPause = () => setIsPlaying(false);
		const onEnded = () => setIsPlaying(false);

		aud.addEventListener("play", onPlay);
		aud.addEventListener("pause", onPause);
		aud.addEventListener("ended", onEnded);

		return () => {
			aud.removeEventListener("play", onPlay);
			aud.removeEventListener("pause", onPause);
			aud.removeEventListener("ended", onEnded);
		};
	}, [audioUrl]);

	const togglePlay = async () => {
		if (!audioRef.current) return;
		try {
			if (audioRef.current.paused) {
				await audioRef.current.play();
				broadcast("play");
			} else {
				audioRef.current.pause();
				broadcast("pause");
			}
		} catch (err) {
			console.warn("Playback blocked or failed", err);

			setStatus(" Playback failed. User gesture may be required.");
		}
	};

	const handleSeek = (offset) => {
		if (!audioRef.current) return;
		audioRef.current.currentTime = Math.max(
			0,
			(audioRef.current.currentTime || 0) + offset
		);
		broadcast("seek");
	};

	return (
		<div className="min-h-screen w-full flex flex-col lg:flex-row items-start lg:items-center justify-start lg:justify-between  bg-black/40">
			{/* LEFT: Controls (60%) */}
			<div className="w-full lg:w-3/5 px-4 sm:px-8 py-6 sm:py-12 flex flex-col justify-start">
				<div className="max-w-2xl">
					{/* Header + floating badge */}
					<div className="relative mb-6">
						<h2 className="text-3xl font-semibold text-white">
							🎧 Syncify Admin Panel
						</h2>

						{/* floating badge */}
						<div className="absolute right-0 top-0 flex items-center gap-2">
							<div
								className="inline-flex items-center gap-2 bg-white/6 backdrop-blur-sm border border-white/8 text-sm px-3 py-1 rounded-full"
								title="Active listeners"
							>
								<UsersIcon className="w-4 h-4 text-white" />
								<span className="text-white">
									{activeUsers}
								</span>
							</div>
						</div>
					</div>

					{/* Input row */}
					{!audioUrl && (
						<div className="flex flex-col sm:flex-row gap-3 items-center">
							<input
								className="flex-1 bg-white/6 border border-white/6 text-white placeholder:text-white/60 px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
								type="text"
								placeholder="Enter YouTube link or video ID"
								value={videoId}
								onChange={(e) => setVideoId(e.target.value)}
							/>
							<button
								onClick={handleFetch}
								disabled={loading}
								className="inline-flex items-center gap-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white px-4 py-3 rounded-md"
							>
								<CloudDownload className="w-4 h-4" />
								<span>
									{loading ? "Fetching..." : "Fetch Audio"}
								</span>
							</button>
						</div>
					)}

					{/* status */}
					{status && (
						<div
							className={`mt-4 px-4 py-3 rounded-md text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition-all duration-300 ${
								status.toLowerCase().includes("failed") ||
								status.toLowerCase().includes("error")
									? "bg-red-500/20 text-red-200 border-red-500/30"
									: status.toLowerCase().includes("copied")
									? "bg-green-500/20 text-green-200 border-green-500/30"
									: "bg-white/10 text-white border-white/10"
							}`}
						>
							{/* If room is created, show share + reload */}
							{roomId &&
							status.toLowerCase().includes("room created") ? (
								<div className="flex flex-wrap items-center justify-between w-full gap-2">
									<div className="flex items-center gap-2">
										<p className="text-xs sm:text-sm text-white/70 break-all">
											Room created:&nbsp;
											<span className="font-semibold text-white">
												{`${window.location.origin}/room/${roomId}`}
											</span>
										</p>

										{/* Copy Button */}

										<Copy
											onClick={() => {
												const link = `${window.location.origin}/room/${roomId}`;
												const prev = status;

												const copyText = async (
													text
												) => {
													try {
														// Try modern clipboard API
														if (
															navigator.clipboard &&
															navigator.clipboard
																.writeText
														) {
															await navigator.clipboard.writeText(
																text
															);
														} else {
															// fallback for mobile / unsupported browsers
															const tempInput =
																document.createElement(
																	"textarea"
																);
															tempInput.value =
																text;
															tempInput.style.position =
																"fixed";
															tempInput.style.opacity =
																"0";
															document.body.appendChild(
																tempInput
															);
															tempInput.select();
															document.execCommand(
																"copy"
															);
															document.body.removeChild(
																tempInput
															);
														}

														setStatus(
															"Copied room link"
														);
														setTimeout(
															() =>
																setStatus(prev),
															2000
														);
													} catch (err) {
														console.error(
															"Clipboard error:",
															err
														);
														setStatus(
															"Failed to copy link"
														);
														setTimeout(
															() =>
																setStatus(prev),
															2000
														);
													}
												};

												copyText(link);
											}}
											className="w-4 h-4 text-white/80 hover:text-white cursor-pointer transition"
										/>
									</div>
									{/* Reload Button */}
									<button
										onClick={() => {
											if (!channel) return;
											const t = infoRef.current.title;
											const d =
												infoRef.current.downloadUrl;
											const payload = {
												clientId: "admin",
												type: "init",
												title: t,
												downloadUrl: d,
												currentTime:
													audioRef.current
														?.currentTime || 0,
												sentAt: Date.now(),
											};

											channel.send({
												type: "broadcast",
												event: "sync",
												payload,
											});

											const prev = status;
											setStatus("Reload signal sent");
											setTimeout(
												() => setStatus(prev),
												2000
											);
										}}
										className="flex items-center gap-2 bg-violet-600/20 hover:bg-violet-600/30 px-3 py-1 rounded-md text-white text-xs sm:text-sm font-medium transition-colors"
									>
										<RotateCw className="w-4 h-4" />
										Reload
									</button>
								</div>
							) : (
								// otherwise show normal status message
								<div className="flex items-center gap-2">
									<span>{status}</span>
								</div>
							)}
						</div>
					)}

					{/* Audio area */}
					{audioUrl && (
						<div className="mt-8 bg-white/4 border border-white/6 p-6 rounded-lg">
							<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
								<div>
									<h3 className="text-xl text-white font-medium leading-snug">
										<span className="inline break-words align-middle">
											{title}
										</span>
										<Download
											onClick={() => {
												if (!downloadUrl) return;
												try {
													const a =
														document.createElement(
															"a"
														);
													a.href = downloadUrl;
													a.download =
														title || "audio.mp3";
													document.body.appendChild(
														a
													);
													a.click();
													document.body.removeChild(
														a
													);
												} catch (err) {
													console.error(err);
												}
											}}
											className="inline-block w-4 h-4 ml-2 text-white/80 hover:text-white cursor-pointer align-middle transition"
										/>
									</h3>
								</div>
							</div>
							{/* native audio element (hidden controls visually, we use our own buttons) */}
							<audio
								ref={audioRef}
								src={audioUrl}
								hidden={true}
								className="w-full mt-4"
								controls
							/>
							{/* controls */}
							<div className="mt-4 flex items-center gap-4">
								{/* toggle play/pause */}
								<button
									onClick={togglePlay}
									className="flex items-center gap-2 px-4 py-2 rounded-md bg-white/6 hover:bg-white/8 text-white"
								>
									{isPlaying ? (
										<Pause className="w-5 h-5" />
									) : (
										<Play className="w-5 h-5" />
									)}
									<span className="text-sm">
										{isPlaying ? "Pause" : "Play"}
									</span>
								</button>

								{/* seek -10 */}
								<button
									onClick={() => handleSeek(-10)}
									className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/6 hover:bg-white/8 text-white"
								>
									<RotateCcw className="w-4 h-4" />
									<span className="text-sm">-10s</span>
								</button>

								{/* seek +10 */}
								<button
									onClick={() => handleSeek(10)}
									className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/6 hover:bg-white/8 text-white"
								>
									<RotateCw className="w-4 h-4" />
									<span className="text-sm">+10s</span>
								</button>

								{/* small status */}
								<div className="ml-auto text-sm text-white/70">
									{channel ? (
										<span>Syncing</span>
									) : (
										<span>Not connected</span>
									)}
								</div>
							</div>
						</div>
					)}

					{/* small footer note */}
					<p className="mt-6 text-xs text-white/60">
						It may take 10 seconds to sync properly just wait.
					</p>
				</div>
			</div>

			{/* RIGHT: reserved for background animation (unchanged) */}
			<div className="block lg:hidden w-full mt-10" aria-hidden="true" />
		</div>
	);
}
