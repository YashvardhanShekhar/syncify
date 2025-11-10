import "./globals.css";
import VantaBackground from "@/components/VantaBackground";

export const metadata = {
	title: "Music Sync",
	description: "Stay perfectly in sync",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body className="relative overflow-hidden min-h-screen flex items-center justify-center text-white font-inter">
				{/* Animated background — sits *behind* everything */}
				<div className="absolute inset-0 -z-10">
					<VantaBackground />
				</div>

				{/* Your app content */}
				<main className="z-10 w-full">{children}</main>
			</body>
		</html>
	);
}
