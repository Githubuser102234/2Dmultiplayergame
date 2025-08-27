import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push, remove } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.min.js";
import nipplejs from "https://cdnjs.cloudflare.com/ajax/libs/nipplejs/0.7.1/nipplejs.min.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAy-mx305Zbi5gQ8fIqSI2OsuV61DRhqDM",
    authDomain: "dmultiplayergame-b444e.firebaseapp.com",
    databaseURL: "https://dmultiplayergame-b444e-default-rtdb.firebaseio.com",
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
let game;

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
            // CORRECTED: Hide the intro UI
            introUI.style.display = 'none';
            // CORRECTED: Start the Phaser game here
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
    this.physics.world.setBounds(0, 0, this.game.config.width, this.game.config.height);
    this.cameras.main.setBackgroundColor('#87ceeb');

    const ground = this.add.rectangle(this.game.config.width / 2, this.game.config.height - 50, this.game.config.width, 100, 0x008000);
    this.physics.add.existing(ground, true);

    myPlayerId = push(ref(db, 'players')).key;
    const myPlayerColor = Math.random() * 0xffffff;

    const myPlayerBlock = this.add.rectangle(Phaser.Math.Between(100, this.game.config.width - 100), 50, 40, 60, myPlayerColor);
    this.physics.add.existing(myPlayerBlock);
    myPlayerBlock.body.collideWorldBounds = true;
    player = myPlayerBlock;

    const myPlayerLabel = this.add.text(0, 0, myPlayerName, { fontSize: '16px', fill: '#ffffff', backgroundColor: '#00000088' }).setOrigin(0.5);
    player.label = myPlayerLabel;

    set(ref(db, 'players/' + myPlayerId), {
        x: player.x,
        y: player.y,
        color: myPlayerColor,
        name: myPlayerName,
        vx: 0,
        vy: 0
    });

    cursors = this.input.keyboard.createCursorKeys();

    if (this.sys.game.device.os.android || this.sys.game.device.os.iOS) {
        setupMobileUI(this);
    }

    this.physics.add.collider(player, ground);

    onValue(ref(db, 'players'), (snapshot) => {
        const playersData = snapshot.val();
        if (playersData) {
            const currentPlayers = new Set(Object.keys(playersData));

            Object.keys(playersData).forEach(playerId => {
                if (playerId !== myPlayerId) {
                    if (!players[playerId]) {
                        const remotePlayer = this.add.rectangle(playersData[playerId].x, playersData[playerId].y, 40, 60, playersData[playerId].color);
                        this.physics.add.existing(remotePlayer);
                        remotePlayer.body.immovable = true;
                        remotePlayer.label = this.add.text(0, 0, playersData[playerId].name, { fontSize: '16px', fill: '#ffffff', backgroundColor: '#00000088' }).setOrigin(0.5);
                        players[playerId] = remotePlayer;
                    }
                    players[playerId].x = playersData[playerId].x;
                    players[playerId].y = playersData[playerId].y;
                    players[playerId].body.setVelocityX(playersData[playerId].vx);
                    players[playerId].body.setVelocityY(playersData[playerId].vy);

                    players[playerId].label.x = players[playerId].x;
                    players[playerId].label.y = players[playerId].y - 40;
                }
            });

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
            Object.keys(players).forEach(playerId => {
                if (players[playerId]) {
                    players[playerId].destroy();
                    players[playerId].label.destroy();
                    delete players[playerId];
                }
            });
        }
    });

    window.addEventListener('beforeunload', () => {
        remove(ref(db, 'players/' + myPlayerId));
    });
}

function update() {
    let velocityX = 0;

    if (!chatOpen) {
        if (cursors.left.isDown) {
            velocityX = -playerSpeed;
        } else if (cursors.right.isDown) {
            velocityX = playerSpeed;
        }

        if (joystickData.x !== 0) {
            velocityX = joystickData.x * playerSpeed;
        }

        if (Phaser.Input.Keyboard.JustDown(cursors.up) && player.body.blocked.down) {
            player.body.setVelocityY(-jumpVelocity);
        }
    }

    if (player && player.body) {
        player.body.setVelocityX(velocityX);
        if (player.label) {
            player.label.x = player.x;
            player.label.y = player.y - 40;
        }

        if (myPlayerId) {
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
}

function setupMobileUI(scene) {
    const joystickContainer = document.getElementById('joystick-container');
    const jumpButton = document.getElementById('jump-button');
    document.getElementById('mobile-ui').style.display = 'flex';

    const options = {
        zone: joystickContainer,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        multitouch: true
    };

    joystick = nipplejs.create(options);
    joystick.on('move', (evt, data) => {
        joystickData = data.vector;
    });
    joystick.on('end', () => {
        joystickData.x = 0;
        joystickData.y = 0;
    });

    jumpButton.addEventListener('pointerdown', () => {
        if (player && player.body.blocked.down) {
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
        document.getElementById('mobile-ui').style.display = chatOpen ? 'none' : 'flex';
        if (chatOpen) {
            chatInput.focus();
        }
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim() !== '') {
            const message = chatInput.value.trim();
            push(ref(db, 'chat'), {
                name: myPlayerName,
                message: message,
                timestamp: Date.now()
            });
            chatInput.value = '';
        }
    });

    onValue(ref(db, 'chat'), (snapshot) => {
        const messagesData = snapshot.val();
        chatMessages.innerHTML = '';
        if (messagesData) {
            const sortedMessages = Object.values(messagesData).sort((a, b) => a.timestamp - b.timestamp);
            sortedMessages.forEach(msg => {
                const p = document.createElement('p');
                p.textContent = `${msg.name}: ${msg.message}`;
                chatMessages.appendChild(p);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}
