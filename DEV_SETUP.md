# Takhrij Frontend Dev Setup

## Run the app locally

1. Install dependencies:

```powershell
npm install
```

2. Copy the local env example:

```powershell
Copy-Item .env.local.example .env.local
```

3. Edit `.env.local` and set your backend URL:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:3000
```

Use your computer's LAN IP when testing on a phone. `localhost` usually points to the phone itself, not your computer.

4. Start Expo:

```powershell
npm start
```

## Switch between local and production

For local backend testing, keep `.env.local` with your LAN IP:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:3000
```

For production testing, either delete `.env.local` or set:

```env
EXPO_PUBLIC_API_BASE_URL=https://takhrij-backend.onrender.com
```

The app falls back to `https://takhrij-backend.onrender.com` when `EXPO_PUBLIC_API_BASE_URL` is not set.
