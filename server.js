const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure Socket.io with performance optimizations
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e8, // 100MB for file sharing
  transports: ['websocket', 'polling'],
  // Performance optimizations
  perMessageDeflate: {
    threshold: 1024,
    concurrencyLimit: 10,
    memLevel: 8
  }
});

// Update CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8000',
    'https://webscoketscalablefrontend.vercel.app',  // Your Vercel frontend
    'https://web-scoketscalable.onrender.com'        // Your Render backend
  ],
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Also update Socket.io CORS (find this section)
// (Removed duplicate io declaration to prevent redeclaration error)

app.use(express.json({ limit: '10mb' }));

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Room management
const rooms = new Map();
const userRooms = new Map();

class Room {
  constructor(roomId, hostId) {
    this.id = roomId;
    this.hostId = hostId;
    this.participants = new Map();
    this.createdAt = Date.now();
    this.maxParticipants = 100;
    this.chatHistory = [];
    this.activeStreams = new Set();
  }

  addParticipant(socketId, userData) {
    if (this.participants.size >= this.maxParticipants) {
      return { success: false, error: 'Room is full' };
    }

    this.participants.set(socketId, {
      id: socketId,
      ...userData,
      joinedAt: Date.now(),
      isHost: socketId === this.hostId,
      hasVideo: false,
      hasAudio: false,
      isScreenSharing: false
    });

    return { success: true };
  }

  removeParticipant(socketId) {
    this.participants.delete(socketId);
    this.activeStreams.delete(socketId);
  }

  getParticipantsList() {
    return Array.from(this.participants.values());
  }

  addChatMessage(message) {
    this.chatHistory.push({
      id: uuidv4(),
      ...message,
      timestamp: Date.now()
    });

    // Keep only last 500 messages to prevent memory issues
    if (this.chatHistory.length > 500) {
      this.chatHistory = this.chatHistory.slice(-500);
    }
  }
}

// WebRTC Signaling Handler
class WebRTCSignaling {
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Join room
      socket.on('join-room', (data, callback) => {
        this.handleJoinRoom(socket, data, callback);
      });

      // Leave room
      socket.on('leave-room', () => {
        this.handleLeaveRoom(socket);
      });

      // WebRTC signaling events
      socket.on('offer', (data) => {
        this.handleOffer(socket, data);
      });

      socket.on('answer', (data) => {
        this.handleAnswer(socket, data);
      });

      socket.on('ice-candidate', (data) => {
        this.handleIceCandidate(socket, data);
      });

      // Media control events
      socket.on('toggle-video', (data) => {
        this.handleToggleVideo(socket, data);
      });

      socket.on('toggle-audio', (data) => {
        this.handleToggleAudio(socket, data);
      });

      socket.on('screen-share', (data) => {
        this.handleScreenShare(socket, data);
      });

      // Chat events
      socket.on('send-message', (data) => {
        this.handleChatMessage(socket, data);
      });

      socket.on('send-private-message', (data) => {
        this.handlePrivateMessage(socket, data);
      });

      // File sharing
      socket.on('share-file', (data) => {
        this.handleFileShare(socket, data);
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Room management for hosts
      socket.on('kick-participant', (data) => {
        this.handleKickParticipant(socket, data);
      });

      socket.on('mute-participant', (data) => {
        this.handleMuteParticipant(socket, data);
      });
    });
  }

  handleJoinRoom(socket, data, callback) {
    const { roomId, userData } = data;

    try {
      let room = rooms.get(roomId);

      // Create room if it doesn't exist
      if (!room) {
        room = new Room(roomId, socket.id);
        rooms.set(roomId, room);
      }

      // Add participant to room
      const result = room.addParticipant(socket.id, userData);

      if (!result.success) {
        callback({ success: false, error: result.error });
        return;
      }

      // Join socket room
      socket.join(roomId);
      userRooms.set(socket.id, roomId);

      // Send room info to new participant
      socket.emit('room-joined', {
        roomId,
        participants: room.getParticipantsList(),
        chatHistory: room.chatHistory,
        isHost: socket.id === room.hostId
      });

      // Notify other participants
      socket.to(roomId).emit('participant-joined', {
        participant: room.participants.get(socket.id)
      });

      // Send current active streams info
      socket.emit('active-streams', Array.from(room.activeStreams));

      callback({ success: true, roomId });

      console.log(`User ${socket.id} joined room ${roomId}. Total participants: ${room.participants.size}`);

    } catch (error) {
      console.error('Error joining room:', error);
      callback({ success: false, error: 'Failed to join room' });
    }
  }

  handleLeaveRoom(socket) {
    const roomId = userRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room) {
      room.removeParticipant(socket.id);

      // Notify other participants
      socket.to(roomId).emit('participant-left', {
        participantId: socket.id
      });

      // If host left, assign new host or close room
      if (socket.id === room.hostId && room.participants.size > 0) {
        const newHost = room.participants.values().next().value;
        room.hostId = newHost.id;
        newHost.isHost = true;

        this.io.to(roomId).emit('new-host', {
          hostId: newHost.id
        });
      }

      // Clean up empty rooms
      if (room.participants.size === 0) {
        rooms.delete(roomId);
      }
    }

    socket.leave(roomId);
    userRooms.delete(socket.id);
  }

  handleOffer(socket, data) {
    const { targetId, offer, streamType } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId) {
      socket.to(targetId).emit('offer', {
        fromId: socket.id,
        offer,
        streamType
      });
    }
  }

  handleAnswer(socket, data) {
    const { targetId, answer, streamType } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId) {
      socket.to(targetId).emit('answer', {
        fromId: socket.id,
        answer,
        streamType
      });
    }
  }

  handleIceCandidate(socket, data) {
    const { targetId, candidate } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId) {
      socket.to(targetId).emit('ice-candidate', {
        fromId: socket.id,
        candidate
      });
    }
  }

  handleToggleVideo(socket, data) {
    const { hasVideo } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId) {
      const room = rooms.get(roomId);
      if (room && room.participants.has(socket.id)) {
        room.participants.get(socket.id).hasVideo = hasVideo;

        socket.to(roomId).emit('participant-video-toggle', {
          participantId: socket.id,
          hasVideo
        });
      }
    }
  }

  handleToggleAudio(socket, data) {
    const { hasAudio } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId) {
      const room = rooms.get(roomId);
      if (room && room.participants.has(socket.id)) {
        room.participants.get(socket.id).hasAudio = hasAudio;

        socket.to(roomId).emit('participant-audio-toggle', {
          participantId: socket.id,
          hasAudio
        });
      }
    }
  }

  handleScreenShare(socket, data) {
    const { isSharing } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId) {
      const room = rooms.get(roomId);
      if (room && room.participants.has(socket.id)) {
        room.participants.get(socket.id).isScreenSharing = isSharing;

        if (isSharing) {
          room.activeStreams.add(socket.id);
        } else {
          room.activeStreams.delete(socket.id);
        }

        socket.to(roomId).emit('participant-screen-share', {
          participantId: socket.id,
          isSharing
        });
      }
    }
  }

  handleChatMessage(socket, data) {
    const { message, type = 'text' } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId) {
      const room = rooms.get(roomId);
      if (room && room.participants.has(socket.id)) {
        const participant = room.participants.get(socket.id);

        const chatMessage = {
          senderId: socket.id,
          senderName: participant.name,
          senderAvatar: participant.avatar,
          message,
          type,
          isPrivate: false
        };

        room.addChatMessage(chatMessage);

        // Broadcast to all participants in room
        this.io.to(roomId).emit('new-message', chatMessage);
      }
    }
  }

  handlePrivateMessage(socket, data) {
    const { targetId, message } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId) {
      const room = rooms.get(roomId);
      if (room && room.participants.has(socket.id)) {
        const participant = room.participants.get(socket.id);

        const privateMessage = {
          senderId: socket.id,
          senderName: participant.name,
          targetId,
          message,
          type: 'text',
          isPrivate: true
        };

        // Send to both sender and recipient
        socket.emit('private-message', privateMessage);
        socket.to(targetId).emit('private-message', privateMessage);
      }
    }
  }

  handleFileShare(socket, data) {
    const { fileName, fileData, fileType, fileSize } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId && fileSize < 10 * 1024 * 1024) { // 10MB limit
      const room = rooms.get(roomId);
      if (room && room.participants.has(socket.id)) {
        const participant = room.participants.get(socket.id);

        const fileMessage = {
          senderId: socket.id,
          senderName: participant.name,
          fileName,
          fileData,
          fileType,
          fileSize,
          type: 'file',
          isPrivate: false
        };

        room.addChatMessage(fileMessage);
        this.io.to(roomId).emit('file-shared', fileMessage);
      }
    }
  }

  handleKickParticipant(socket, data) {
    const { participantId } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId) {
      const room = rooms.get(roomId);
      if (room && socket.id === room.hostId) {
        // Only host can kick participants
        this.io.to(participantId).emit('kicked');
        const targetSocket = this.io.sockets.sockets.get(participantId);
        if (targetSocket) {
          this.handleLeaveRoom(targetSocket);
        }
      }
    }
  }

  handleMuteParticipant(socket, data) {
    const { participantId, muted } = data;
    const roomId = userRooms.get(socket.id);

    if (roomId) {
      const room = rooms.get(roomId);
      if (room && socket.id === room.hostId) {
        socket.to(participantId).emit('force-mute', { muted });
      }
    }
  }

  handleDisconnect(socket) {
    console.log(`User disconnected: ${socket.id}`);
    this.handleLeaveRoom(socket);
  }
}

// Initialize signaling
const signaling = new WebRTCSignaling(io);

// API endpoints
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/api/rooms/:roomId/info', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);

  if (room) {
    res.json({
      id: room.id,
      participantCount: room.participants.size,
      maxParticipants: room.maxParticipants,
      createdAt: room.createdAt
    });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

app.get('/api/server/stats', (req, res) => {
  const stats = {
    totalRooms: rooms.size,
    totalParticipants: Array.from(rooms.values())
      .reduce((total, room) => total + room.participants.size, 0),
    memoryUsage: process.memoryUsage()
  };

  res.json(stats);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to access the application`);
});

// Performance monitoring and cleanup
setInterval(() => {
  // Clean up empty rooms
  for (const [roomId, room] of rooms) {
    if (room.participants.size === 0) {
      rooms.delete(roomId);
    }
  }

  // Log memory usage
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    console.warn('High memory usage detected:', memUsage);
  }
}, 30000);

module.exports = { app, server, io };
