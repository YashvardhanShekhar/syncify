"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function RealtimeDebug({ roomId = "5555" }) {
	const [logs, setLogs] = useState([]);
	const [presence, setPresence] = useState({});
	const channelRef = useRef(null);

	const pushLog = (obj) => {
		const t = new Date().toLocaleTimeString();
		setLogs((s) => [{ time: t, ...obj }, ...s].slice(0, 200));
		console.log(t, obj);
	};

	useEffect(() => {
		const ch = supabase.channel(`room-${roomId}`, {
			config: { broadcast: { self: true } },
		});
		channelRef.current = ch;

		// Broadcast messages
		ch.on("broadcast", { event: "*" }, (payload) => {
			pushLog({ type: "broadcast", payload });
		});

		// Presence state sync (initial)
		ch.on("presence", { event: "sync" }, async () => {
			const state = ch.presenceState();
			setPresence(state);
			pushLog({ type: "presence-sync", state });
		});

		// Presence diffs
		ch.on("presence", { event: "join" }, ({ key, newPresences }) => {
			pushLog({ type: "presence-join", key, newPresences });
			setPresence((p) => ({ ...p, [key]: ch.presenceState()[key] }));
		});
		ch.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
			pushLog({ type: "presence-leave", key, leftPresences });
			setPresence((p) => {
				const copy = { ...p };
				delete copy[key];
				return copy;
			});
		});

		// Subscribe
		ch.subscribe((status) => {
			pushLog({ type: "subscribe", status });
			if (status === "SUBSCRIBED") {
				// track yourself so presence shows up
				ch.track({
					clientAt: new Date().toISOString(),
					label: "debug-client",
				})
					.then(() => pushLog({ type: "track", ok: true }))
					.catch((e) =>
						pushLog({
							type: "track",
							ok: false,
							err: e?.message || e,
						})
					);
			}
		});

		return () => {
			if (channelRef.current) {
				channelRef.current.unsubscribe();
			}
		};
	}, [roomId]);

	const sendTest = async () => {
		const ch = channelRef.current;
		if (!ch) return;
		const payload = { msg: "hello from debug", ts: Date.now() };
		await ch.send({ type: "broadcast", event: "debug", payload });
		pushLog({ type: "sent-debug", payload });
	};

	const showPresence = () => {
		const ch = channelRef.current;
		if (!ch) return;
		const state = ch.presenceState();
		pushLog({ type: "presence-state-manual", state });
		setPresence(state);
	};

	return (
		<div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
			<h2>Supabase Realtime Debug — room-{roomId}</h2>
			<div style={{ marginBottom: 12 }}>
				<button onClick={sendTest} style={btn}>
					Send test broadcast
				</button>
				<button
					onClick={showPresence}
					style={{ ...btn, marginLeft: 8 }}
				>
					Refresh presence
				</button>
			</div>

			<div style={{ display: "flex", gap: 20 }}>
				<div style={{ flex: 1 }}>
					<h3>Live logs</h3>
					<div
						style={{
							height: 400,
							overflow: "auto",
							border: "1px solid #eee",
							padding: 8,
						}}
					>
						{logs.map((l, i) => (
							<div
								key={i}
								style={{ marginBottom: 6, fontSize: 12 }}
							>
								<strong>{l.time}</strong>{" "}
								<span style={{ color: "#555" }}>{l.type}</span>
								<pre
									style={{
										whiteSpace: "pre-wrap",
										margin: "4px 0",
									}}
								>
									{JSON.stringify(
										l.payload ?? l.state ?? l,
										null,
										2
									)}
								</pre>
							</div>
						))}
					</div>
				</div>

				<div style={{ width: 320 }}>
					<h3>Presence</h3>
					<div
						style={{
							border: "1px solid #eee",
							padding: 8,
							height: 400,
							overflow: "auto",
						}}
					>
						{Object.keys(presence).length === 0 && (
							<div style={{ color: "#999" }}>No presence</div>
						)}
						{Object.entries(presence).map(([key, arr]) => (
							<div key={key} style={{ marginBottom: 10 }}>
								<strong>{key}</strong>
								<div style={{ fontSize: 12, color: "#444" }}>
									{Array.isArray(arr)
										? arr.map((p, idx) => (
												<div key={idx}>
													{JSON.stringify(p)}
												</div>
										  ))
										: JSON.stringify(arr)}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

const btn = {
	padding: "8px 12px",
	borderRadius: 8,
	background: "#111",
	color: "#fff",
	border: "none",
	cursor: "pointer",
};
