#!/bin/bash

# WebRTC Virtual Classroom - CoTURN Installation Script
# This script installs and configures CoTURN server for WebRTC TURN functionality

echo "=== CoTURN Installation Script ==="
echo "This will install and configure CoTURN server for WebRTC"
echo ""

# Update system
echo "Updating system packages..."
sudo apt-get update -y

# Install CoTURN
echo "Installing CoTURN..."
sudo apt-get install -y coturn

# Enable CoTURN
echo "Enabling CoTURN service..."
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn

# Get server IP
SERVER_IP=$(curl -s http://checkip.amazonaws.com/ || curl -s http://whatismyip.akamai.com/)
echo "Detected server IP: $SERVER_IP"

# Create configuration
echo "Creating CoTURN configuration..."
sudo tee /etc/turnserver.conf > /dev/null << EOF
# WebRTC Virtual Classroom TURN Server Configuration

# Listen on all interfaces
listening-ip=0.0.0.0

# External IP (replace with your server's public IP)
external-ip=$SERVER_IP

# TURN server realm
realm=webrtc-classroom.local

# TURN server ports
listening-port=3478
tls-listening-port=5349

# Use fingerprints in TURN
fingerprint

# Use long-term credentials
lt-cred-mech

# Create user accounts (username:password)
user=classroom:classroom123
user=student:student123
user=teacher:teacher123

# Allow relay to any IP
relay-ip=$SERVER_IP

# Enable both UDP and TCP relay
udp-port-range=10000-20000
tcp-relay-ip=$SERVER_IP

# Certificate paths (for TLS)
cert=/etc/ssl/certs/turn-server.crt
pkey=/etc/ssl/private/turn-server.key

# Additional security
no-loopback-peers
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=172.16.0.0-172.31.255.255

# Logging
verbose
log-file=/var/log/turnserver.log

# Mobility with ICE
mobility

# Bandwidth limits (bytes per second)
max-bps=2000000

# Connection limits
total-quota=100
user-quota=50

# Process limits
proc-user=turnserver
proc-group=turnserver
EOF

# Create SSL certificate (self-signed for testing)
echo "Creating SSL certificates..."
sudo openssl req -x509 -newkey rsa:4096 -keyout /etc/ssl/private/turn-server.key -out /etc/ssl/certs/turn-server.crt -days 365 -nodes -subj "/CN=webrtc-classroom.local/O=WebRTC Classroom/C=US"

# Set permissions
sudo chown turnserver:turnserver /etc/ssl/private/turn-server.key
sudo chown turnserver:turnserver /etc/ssl/certs/turn-server.crt
sudo chmod 600 /etc/ssl/private/turn-server.key

# Configure firewall (if ufw is installed)
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    sudo ufw allow 3478/tcp
    sudo ufw allow 3478/udp
    sudo ufw allow 5349/tcp
    sudo ufw allow 5349/udp
    sudo ufw allow 10000:20000/udp
fi

# Start and enable CoTURN
echo "Starting CoTURN service..."
sudo systemctl start coturn
sudo systemctl enable coturn

# Check status
echo ""
echo "=== Installation Complete ==="
echo ""
echo "CoTURN Status:"
sudo systemctl status coturn --no-pager -l

echo ""
echo "TURN Server Configuration:"
echo "Server IP: $SERVER_IP"
echo "TURN Port: 3478"
echo "TLS Port: 5349"
echo "Username: classroom"
echo "Password: classroom123"
echo ""
echo "Add this configuration to your WebRTC client:"
echo "{"
echo '  urls: "turn:'$SERVER_IP':3478",'
echo '  username: "classroom",'
echo '  credential: "classroom123"'
echo "}"
echo ""
echo "Logs can be found at: /var/log/turnserver.log"
echo ""
echo "IMPORTANT:"
echo "1. Replace the self-signed certificate with a valid SSL certificate for production"
echo "2. Change default passwords in /etc/turnserver.conf"
echo "3. Configure your domain DNS to point to this server"
echo "4. Test the TURN server using: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
