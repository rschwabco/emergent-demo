# Emergent Demo

A [Next.js](https://nextjs.org) application with Pinecone vector search integration.

## Prerequisites

- Node.js (v20 or later recommended)
- npm

## Getting Started

### Install dependencies

```bash
npm install
```

### Build the application

```bash
npm run build
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Run the production server

```bash
npm run build
npm run start
```

## Project Structure

- `/` - Main page
- `/trace/[traceId]` - Trace viewer page
- `/api/search` - Search API endpoint
- `/api/explore` - Explore API endpoint
- `/api/context` - Context API endpoint
- `/api/pinecone` - Pinecone API endpoint
- `/api/trace/[traceId]` - Trace API endpoint

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
