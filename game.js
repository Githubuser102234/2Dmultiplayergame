import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push, remove } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.esm.js";
import nipplejs from "https://cdnjs.cloudflare.com/ajax/libs/nipplejs/0.7.1/nipplejs.min.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAy-mx305Zbi5gQ8fIqSI2OsuV61DRhqDM",
    authDomain: "dmultiplayergame-b444e.firebaseapp.com",
    projectId: "dmultiplayergame-b444e",
    storageBucket: "dmultiplayergame-b444e.firebasestorage.app",
    messagingSenderId: "318883314875",
    appId: "1:318883314875:web:6d31375135ea9b2efabd9e",
    measurementId: "G-895EVCR281"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Global variables for the game state
const players = {};
let player, cursors;
let joystick, joystickData = { x: 0, y: 0 };
let myPlayerId;
let playerSpeed = 300;
let jumpVelocity = 500;
let myPlayerName = "Player";
let chatOpen = false;

// Phaser Game Configuration
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 800 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let game;

// Wait for the DOM content to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-button');
    const nameInput = document.getElementById('name-input');
    const introUI = document.getElementById('intro-ui');
    const gameContainer = document.getElementById('game-container');

    startButton.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            myPlayerName = name;
            introUI.style.display = 'none';
            // Start the Phaser game here
            game = new Phaser.Game(config);
            // Show the game container and mobile UI after the game has started
            gameContainer.style.display = 'block';
            document.getElementById('mobile-ui').style.display = 'flex';
            setupChat();
        } else {
            alert("Please enter a name!");
        }
    });

    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startButton.click();
        }
    });
});

function preload() {
    // This is where you would load sprites, etc.
}

function create() {
    // BUG FIX: Ensure the physics world is aligned with the screen size
    this.physics.world.setBounds(0, 0, this.game.config.width, this.game.config.height);
    this.cameras.main.setBackgroundColor('#87ceeb');

    // Create static ground
    const ground = this.add.rectangle(this.game.config.width / 2, this.game.config.height - 50, this.game.config.width * 2, 100, 0x008000);
    this.physics.add.existing(ground, true);

    // Get a unique player ID
    myPlayerId = push(ref(db, 'players')).key;

    // Choose a random color for the player
    const myPlayerColor = Math.random() * 0xffffff;

    // Create the local player's block
    const myPlayerBlock = this.add.rectangle(Phaser.Math.Between(100, this.game.config.width - 100), 50, 40, 60, myPlayerColor);
    this.physics.add.existing(myPlayerBlock);
    myPlayerBlock.body.collideWorldBounds = true;
    myPlayerBlock.body.gravity.y = 800;
    player = myPlayerBlock;

    // Create the player's name label
    const myPlayerLabel = this.add.text(0, 0, myPlayerName, { fontSize: '16px', fill: '#ffffff', backgroundColor: '#00000088' }).setOrigin(0.5);
    player.label = myPlayerLabel;

    // Add local player to the Firebase database
    set(ref(db, 'players/' + myPlayerId), {
        x: player.x,
        y: player.y,
        color: myPlayerColor,
        name: myPlayerName,
        vx: 0,
        vy: 0
    });

    // Keyboard input for desktop
    cursors = this.input.keyboard.createCursorKeys();

    // Mobile UI Setup
    if (this.sys.game.device.os.android || this.sys.game.device.os.iOS) {
        setupMobileUI(this);
    }

    // BUG FIX: Add a collider between the player and the ground
    this.physics.add.collider(player, ground);

    // BUG FIX: Centralize player updates into one listener to avoid race conditions
    onValue(ref(db, 'players'), (snapshot) => {
        const playersData = snapshot.val();
        if (playersData) {
            // BUG FIX: Create a set of current player IDs to check for removed players
            const currentPlayers = new Set(Object.keys(playersData));

            Object.keys(playersData).forEach(playerId => {
                if (playerId !== myPlayerId) {
                    if (!players[playerId]) {
                        // Create new remote player
                        const remotePlayer = this.add.rectangle(playersData[playerId].x, playersData[playerId].y, 40, 60, playersData[playerId].color);
                        this.physics.add.existing(remotePlayer);
                        remotePlayer.body.immovable = true;
                        remotePlayer.label = this.add.text(0, 0, playersData[playerId].name, { fontSize: '16px', fill: '#ffffff', backgroundColor: '#00000088' }).setOrigin(0.5);
                        players[playerId] = remotePlayer;
                    }
                    // Update remote player position
                    players[playerId].x = playersData[playerId].x;
                    players[playerId].y = playersData[playerId].y;
                    players[playerId].body.setVelocityX(playersData[playerId].vx);
                    players[playerId].body.setVelocityY(playersData[playerId].vy);

                    // Update label position
                    players[playerId].label.x = players[playerId].x;
                    players[playerId].label.y = players[playerId].y - 40;
                }
            });

            // Clean up when a player leaves
            Object.keys(players).forEach(playerId => {
                if (!currentPlayers.has(playerId)) {
                    if (players[playerId]) {
                        players[playerId].destroy();
                        players[playerId].label.destroy();
                        delete players[playerId];
                    }
                }
            });
        } else {
             // If all players leave, clean up all remote players
            Object.keys(players).forEach(playerId => {
                if (players[playerId]) {
                    players[playerId].destroy();
                    players[playerId].label.destroy();
                    delete players[playerId];
                }
            });
        }
    });

    // Clean up on window close
    window.addEventListener('beforeunload', () => {
        remove(ref(db, 'players/' + myPlayerId));
    });
}

function update() {
    let velocityX = 0;

    // Disable player movement if chat is open
    if (!chatOpen) {
        // Desktop Input
        if (cursors.left.isDown) {
            velocityX = -playerSpeed;
        } else if (cursors.right.isDown) {
            velocityX = playerSpeed;
        }

        // Mobile Input
        if (joystickData.x > 0) {
            velocityX = playerSpeed; // BUG FIX: Fixed speed for mobile
        } else if (joystickData.x < 0) {
            velocityX = -playerSpeed; // BUG FIX: Fixed speed for mobile
        }

        // Jump Input
        if (Phaser.Input.Keyboard.JustDown(cursors.up) && player.body.blocked.down) {
            player.body.setVelocityY(-jumpVelocity);
        }
    }

    player.body.setVelocityX(velocityX);

    // BUG FIX: Check if player and label exist before updating
    if (player && player.label) {
        // Update player label position
        player.label.x = player.x;
        player.label.y = player.y - 40;
    }

    // BUG FIX: Only update Firebase if player has been created
    if (myPlayerId && player) {
        // Update Firebase with local player's data if it has changed
        const playerRef = ref(db, 'players/' + myPlayerId);
        set(playerRef, {
            x: player.x,
            y: player.y,
            color: player.fillColor,
            name: player.label.text,
            vx: player.body.velocity.x,
            vy: player.body.velocity.y
        });
    }
}

function setupMobileUI(scene) {
    const joystickContainer = document.getElementById('joystick-container');
    const jumpButton = document.getElementById('jump-button');
    document.getElementById('mobile-ui').style.display = 'flex';

    // Joystick setup
    const options = {
        zone: joystickContainer,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        multitouch: true
    };

    joystick = nipplejs.create(options);
    joystick.on('move', (evt, data) => {
        // BUG FIX: Changed joystick data logic to better control player speed
        const speedMultiplier = data.force > 1 ? 1 : data.force; // Clamp force at 1
        joystickData.x = data.vector.x * speedMultiplier;
        joystickData.y = data.vector.y * speedMultiplier;
    });
    joystick.on('end', () => {
        joystickData.x = 0;
        joystickData.y = 0;
    });

    // Jump button setup
    jumpButton.addEventListener('pointerdown', () => {
        if (player && player.body.blocked.down) { // BUG FIX: Check if player exists
            player.body.setVelocityY(-jumpVelocity);
        }
    });
}

function setupChat() {
    const chatToggleButton = document.getElementById('chat-toggle-button');
    const chatUI = document.getElementById('chat-ui');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    chatToggleButton.addEventListener('click', () => {
        chatOpen = !chatOpen;
        chatUI.style.display = chatOpen ? 'flex' : 'none';
        // BUG FIX: Hide other UI elements when chat is open
        document.getElementById('mobile-ui').style.display = chatOpen ? 'none' : 'flex';
        if (chatOpen) {
            chatInput.focus();
        }
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim() !== '') {
            const message = chatInput.value.trim();
            // Push message to Firebase
            push(ref(db, 'chat'), {
                name: myPlayerName,
                message: message,
                timestamp: Date.now()
            });
            chatInput.value = '';
        }
    });

    // Listen for new messages from Firebase
    onValue(ref(db, 'chat'), (snapshot) => {
        const messagesData = snapshot.val();
        chatMessages.innerHTML = '';
        if (messagesData) {
            const sortedMessages = Object.values(messagesData).sort((a, b) => a.timestamp - b.timestamp);
            sortedMessages.forEach(msg => {
                const p = document.createElement('p');
                // BUG FIX: Sanitize message content to prevent XSS
                p.textContent = `${msg.name}: ${msg.message}`;
                chatMessages.appendChild(p);
            });
            // Auto-scroll to the bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}
