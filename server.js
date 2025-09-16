// Updated backend/server.js configuration
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// CORS Configuration for separate frontend deployment
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:8000', 
    'https://webscoketscalablefrontend.vercel.app' // Your Vercel frontend
  ],
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Socket.io configuration with CORS
const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:8000',
      'https://webscoketscalablefrontend.vercel.app'
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e8,
  transports: ['websocket', 'polling']
});

// REMOVE FRONTEND STATIC FILE SERVING - NOT NEEDED FOR SEPARATE DEPLOYMENT
// DON'T INCLUDE: app.use(express.static(...))
// DON'T INCLUDE: app.get('/', ...)

// API Routes only (keep these)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root route for backend-only deployment
app.get('/', (req, res) => {
  res.json({
    message: 'WebRTC Virtual Classroom Backend API',
    status: 'running',
    frontend: 'https://webscoketscalablefrontend.vercel.app',
    timestamp: new Date().toISOString()
  });
});

// Keep all your existing API routes and WebRTC logic...
// (rest of your server.js code remains the same)
