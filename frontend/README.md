# Client Dashboard Frontend

A modern React frontend for the Client Dashboard application, built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Type Safety**: Full TypeScript support
- **Client Management**: View and manage client information
- **Session Tracking**: Track client sessions and appointments
- **Real-time Updates**: Live data from Supabase
- **Responsive Design**: Works on desktop and mobile devices
- **Direct Database Access**: No backend needed - connects directly to Supabase

## Tech Stack

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **React 18**: Latest React features and hooks
- **Supabase**: Backend-as-a-Service for database and authentication

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file in the frontend directory with:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

3. Get your Supabase credentials:
- Go to your Supabase project dashboard
- Navigate to Settings > API
- Copy the "Project URL" and "anon public" key
- Paste them in your `.env.local` file

4. Set up your Supabase database:
Make sure you have the following tables in your Supabase database:

**clients table:**
```sql
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospect')),
  needs_scheduling BOOLEAN DEFAULT false,
  last_session_date DATE,
  next_session_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**sessions table:**
```sql
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── clients/         # Client detail pages
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Dashboard page
├── components/          # Reusable React components
│   ├── ClientCard.tsx   # Client display card
│   └── StatsCard.tsx    # Statistics display
└── lib/                 # Utility functions and types
    ├── data.ts          # Supabase data operations
    ├── supabase.ts      # Supabase client configuration
    └── types.ts         # TypeScript type definitions
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set these in your deployment platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Features

### Dashboard
- Overview of all clients
- Statistics cards showing key metrics
- Quick access to client details

### Client Management
- View client information
- Edit client details
- Track client status and scheduling needs

### Session Tracking
- View client sessions
- Track session history
- Monitor upcoming appointments

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License. 