# WebRTC Virtual Classroom - Backend

A scalable Node.js backend for WebRTC-based virtual classroom with Socket.io signaling server.

## Features

- **WebRTC Signaling Server**: Complete signaling implementation for video calls
- **Socket.io Integration**: Real-time communication for up to 100 participants
- **Built-in Chat System**: Text messaging, private messages, and file sharing
- **Room Management**: Create/join rooms with host controls
- **Performance Optimized**: Clustering support and memory management
- **TURN/STUN Server**: CoTURN integration for NAT traversal

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Start Production Server

```bash
npm start
```

### 4. Start with Clustering (Production)

```bash
npm run cluster
```

## Installation Guide

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Ubuntu/Debian server (for CoTURN)

### Step 1: Install Node.js Dependencies

```bash
# Install all required packages
npm install

# Or install individually
npm install express socket.io cors uuid compression helmet
npm install @socket.io/redis-adapter redis
npm install --save-dev nodemon jest
```

### Step 2: Install CoTURN Server (Optional but Recommended)

For production deployment with NAT traversal:

```bash
# Make the script executable
chmod +x install-coturn.sh

# Run the installation script
sudo ./install-coturn.sh
```

### Step 3: Configure Environment

Create a `.env` file:

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# Redis Configuration (for clustering)
REDIS_URL=redis://localhost:6379

# TURN Server Configuration
TURN_SERVER_URL=turn:your-server-ip:3478
TURN_USERNAME=classroom
TURN_PASSWORD=classroom123
```

## Configuration

### Server Configuration

Edit `server.js` to modify:

- **Room size limit**: Change `maxParticipants` in Room class
- **File upload limit**: Modify `maxHttpBufferSize` in Socket.io config
- **CORS settings**: Update `cors.origin` for your domain

### Performance Configuration

For high-load scenarios (100+ concurrent users):

1. **Enable Clustering**:
   ```bash
   npm run cluster
   ```

2. **Configure Redis** (for multiple server instances):
   ```bash
   # Install Redis
   sudo apt-get install redis-server

   # Start Redis
   sudo systemctl start redis
   sudo systemctl enable redis
   ```

3. **Memory Optimization**:
   - The server automatically manages memory usage
   - Garbage collection runs every 30 seconds
   - Room cleanup happens every 30 seconds

## API Endpoints

### Room Information

```
GET /api/rooms/:roomId/info
```

Response:
```json
{
  "id": "room123",
  "participantCount": 5,
  "maxParticipants": 100,
  "createdAt": 1234567890
}
```

### Server Statistics

```
GET /api/server/stats
```

Response:
```json
{
  "totalRooms": 10,
  "totalParticipants": 45,
  "memoryUsage": {
    "rss": 50331648,
    "heapTotal": 20971520,
    "heapUsed": 15728640
  }
}
```

## Socket.io Events

### Client to Server Events

| Event | Data | Description |
|-------|------|-------------|
| `join-room` | `{roomId, userData}` | Join a room |
| `leave-room` | - | Leave current room |
| `offer` | `{targetId, offer, streamType}` | Send WebRTC offer |
| `answer` | `{targetId, answer, streamType}` | Send WebRTC answer |
| `ice-candidate` | `{targetId, candidate}` | Send ICE candidate |
| `toggle-video` | `{hasVideo}` | Toggle video stream |
| `toggle-audio` | `{hasAudio}` | Toggle audio stream |
| `screen-share` | `{isSharing}` | Start/stop screen sharing |
| `send-message` | `{message, type}` | Send chat message |
| `send-private-message` | `{targetId, message}` | Send private message |
| `share-file` | `{fileName, fileData, fileType, fileSize}` | Share file |

### Server to Client Events

| Event | Data | Description |
|-------|------|-------------|
| `room-joined` | `{roomId, participants, chatHistory, isHost}` | Room join confirmation |
| `participant-joined` | `{participant}` | New participant joined |
| `participant-left` | `{participantId}` | Participant left |
| `offer` | `{fromId, offer, streamType}` | Received WebRTC offer |
| `answer` | `{fromId, answer, streamType}` | Received WebRTC answer |
| `ice-candidate` | `{fromId, candidate}` | Received ICE candidate |
| `new-message` | `{senderId, senderName, message, timestamp}` | New chat message |
| `private-message` | `{senderId, senderName, message, isPrivate}` | Private message |
| `file-shared` | `{senderId, senderName, fileName, fileData}` | File shared |
| `kicked` | - | User was kicked from room |
| `force-mute` | `{muted}` | Host muted participant |

## Deployment

### Development

```bash
npm run dev
```

### Production (Single Instance)

```bash
npm start
```

### Production (Clustered)

```bash
npm run cluster
```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t webrtc-classroom-backend .
docker run -p 3001:3001 webrtc-classroom-backend
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**:
   ```bash
   # Find process using port 3001
   lsof -i :3001

   # Kill the process
   kill -9 <PID>
   ```

2. **WebRTC Connection Failed**:
   - Ensure CoTURN server is running
   - Check firewall settings
   - Verify TURN server credentials

3. **High Memory Usage**:
   - Enable clustering: `npm run cluster`
   - Monitor with: `node --inspect server.js`
   - Check Redis connection if using multiple instances

4. **Socket.io Connection Issues**:
   - Check CORS configuration
   - Verify client/server Socket.io versions match
   - Check network connectivity

### Logs

- Application logs: Console output
- CoTURN logs: `/var/log/turnserver.log`
- System logs: `journalctl -u coturn`

## Performance Tips

1. **For 50+ Users**:
   - Use clustering: `npm run cluster`
   - Install Redis for session storage

2. **For 100+ Users**:
   - Use multiple server instances with load balancer
   - Configure Redis cluster
   - Monitor memory usage regularly

3. **Network Optimization**:
   - Use CDN for static files
   - Enable gzip compression
   - Configure proper STUN/TURN servers

## Security

- Change default TURN server credentials
- Use HTTPS in production
- Configure proper CORS origins
- Implement rate limiting for API endpoints
- Regular security updates

## License

MIT License - see LICENSE file for details.
"# web-scoketscalable" 
