## 🧾 **README.md**

# 🎧 Syncify — Real-Time Music Sync App

**Syncify** lets you host a music room and sync playback across multiple devices — in real time.  
Built for fun, simplicity, and zero installs.  

🚀 **Built with:** Next.js • Supabase Realtime • Tailwind CSS • Vanta.js  
🔗 Live demo: https://syncifybeat.vercel.app/

---

## 🖤 Overview

Syncify allows an admin to stream YouTube audio to multiple listeners — perfectly synchronized.  
All in the browser, no downloads, no setup.

### ✨ Core Features
- 🧠 **Realtime Music Sync:** Everyone hears the same thing at the same time.
- ⚡ **Low Latency:** Supabase Realtime channels handle precise broadcast control.
- 🔗 **Instant Rooms:** Generate a room ID instantly and share it with friends.
- 🎵 **YouTube Integration:** Paste any video link; it auto-fetches and converts to audio.
- 📱 **Responsive UI:** Optimized for both mobile and desktop layouts.
- 🌈 **Vanta Backgrounds:** Smooth animated visuals for an immersive vibe.
- 🔒 **No Login Required:** Just share a room and listen together.

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | [Next.js](https://nextjs.org/) |
| Database / Realtime | [Supabase](https://supabase.com/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Animation | [Vanta.js (HALO)](https://www.vantajs.com/) |
| Icons | [Lucide React](https://lucide.dev/) |

---

## ⚙️ Setup

### 1️⃣ Clone the repository
```bash
git clone https://github.com/<your-username>/syncify.git
cd syncify
````

### 2️⃣ Install dependencies

```bash
npm install
# or
yarn install
```

### 3️⃣ Configure environment variables

Create a `.env.local` file in the root directory and add:

```env
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
NEXT_PUBLIC_API_KEY=<your_yt_api_key>
NEXT_PUBLIC_API_HOST=<your_yt_api_host>
```

> 🔒 Keep your API keys private — don’t commit them.

---

## ▶️ Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 🧩 Folder Structure

```
syncify/
│
├── app/
│   ├── page.tsx            # Home page
│   ├── admin/page.tsx      # Admin page (host control)
│   ├── room/[roomId]/page.tsx  # Listener page
│
├── components/
│   └── VantaBackground.tsx # Halo animation background
│
├── public/
│
├── styles/
│   └── globals.css
│
└── README.md
```

---

## 🧠 How It Works

1. **Admin** enters a YouTube URL and starts a session.
2. **Supabase** creates a real-time channel (`room-XXXXXX`) for all clients.
3. **Listeners** join via room link and auto-download the audio.
4. **Admin controls playback** (play/pause/seek), syncing all connected clients.

---
## 💡 Roadmap

* 🔊 Add live waveform visualization
* 👥 Add user avatars and reactions
* 💬 Add chat in room
* 🪄 Multi-track playlist sync

---

## 🤝 Contributing

Pull requests are welcome!
For major changes, please open an issue first to discuss what you’d like to change.

---

## 📜 License

This project is licensed under the **MIT License**
---

> *"Built for fun. Shared in sync."*
