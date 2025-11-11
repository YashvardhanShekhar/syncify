"use client";

import Link from "next/link";
import { Music, Play, Users, Link as LinkIcon } from "lucide-react";

export default function HomePage() {
	return (
		<div className="relative min-h-screen w-full overflow-x-hidden text-white  bg-black/40">
			{/* Content */}
			<main className="relative z-10 max-w-6xl mx-0 pl-10 pr-6 sm:pl-16 sm:pr-8 lg:pl-20 lg:pr-12 pt-16 lg:pt-20">
				{/* HERO SECTION */}
				<section className="flex flex-col items-start justify-start min-h-[60vh] w-full lg:w-4/5">
					<div className="max-w-3xl">
						<h1 className="text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight">
							Sync music across devices —{" "}
							<span className="text-violet-400">live.</span>
						</h1>
						<p className="mt-4 text-lg text-white/80 max-w-2xl">
							Host a room, share the link, and everyone listens
							together — perfectly synced. Low latency, no
							installs, instant connection.
						</p>

						<div className="mt-8 flex flex-wrap gap-4">
							<Link
								href="/admin"
								className="inline-flex items-center gap-3 bg-violet-600 hover:bg-violet-700 px-6 py-3 rounded-lg text-white font-semibold transition"
							>
								<Play className="w-5 h-5" />
								Start a Room
							</Link>
						</div>

						{/* Features quick cards */}
						<div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div className="bg-white/5 border border-white/10 p-5 rounded-lg">
								<div className="font-semibold">
									Instant Rooms
								</div>
								<div className="text-sm text-white/70 mt-1">
									Create shareable room links in seconds.
								</div>
							</div>
							<div className="bg-white/5 border border-white/10 p-5 rounded-lg">
								<div className="font-semibold">Low Latency</div>
								<div className="text-sm text-white/70 mt-1">
									Stay perfectly synced with ping-based
									timing.
								</div>
							</div>
							<div className="bg-white/5 border border-white/10 p-5 rounded-lg">
								<div className="font-semibold">
									Browser First
								</div>
								<div className="text-sm text-white/70 mt-1">
									No installs, no fuss — works instantly.
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* HOW IT WORKS */}
				<section id="how" className="">
					<h2 className="text-3xl font-semibold">How it works</h2>
					<p className="text-white/70 mt-2 mb-8">
						It only takes a few steps to get everyone jamming
						together.
					</p>

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
						<div className="p-6 bg-white/5 border border-white/10 rounded-xl">
							<div className="flex items-center gap-3 mb-2">
								<Play className="w-5 h-5 text-violet-400" />
								<h3 className="font-semibold text-lg">
									1. Start a room
								</h3>
							</div>
							<p className="text-white/70 text-sm">
								Open the Admin page, paste a YouTube link, and
								fetch the song.
							</p>
						</div>

						<div className="p-6 bg-white/5 border border-white/10 rounded-xl">
							<div className="flex items-center gap-3 mb-2">
								<Users className="w-5 h-5 text-violet-400" />
								<h3 className="font-semibold text-lg">
									2. Share & join
								</h3>
							</div>
							<p className="text-white/70 text-sm">
								Send the room link to friends — they’ll join and
								auto-download the track.
							</p>
						</div>

						<div className="p-6 bg-white/5 border border-white/10 rounded-xl">
							<div className="flex items-center gap-3 mb-2">
								<Music className="w-5 h-5 text-violet-400" />
								<h3 className="font-semibold text-lg">
									3. Play together
								</h3>
							</div>
							<p className="text-white/70 text-sm">
								Admin hits play — everyone listens in sync with
								minimal delay.
							</p>
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}
