import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push, remove } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

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

let game; // Declare game globally to access it

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

// The fix: Access Phaser from the global window object
window.onload = () => {
    const nicknameModal = document.getElementById('nickname-modal');
    const nicknameInput = document.getElementById('nickname-input');
    const startGameButton = document.getElementById('start-game-button');

    // Add event listener for the start button
    startGameButton.addEventListener('click', () => {
        const myPlayerName = nicknameInput.value.trim() || "Player";
        if (myPlayerName) {
            // Hide the modal
            nicknameModal.classList.add('hidden');
            // Create and start the game with the provided nickname
            config.scene.create = function() {
                create.call(this, myPlayerName);
            };
            game = new Phaser.Game(config);
        }
    });

    // Handle Enter key in the input field
    nicknameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startGameButton.click();
        }
    });
};

function preload() {
    // This is where you would load sprites, etc.
}

function create(myPlayerName) {
    this.cameras.main.setBackgroundColor('#87ceeb');

    // Create static ground
    const ground = this.add.rectangle(0, this.game.config.height - 50, this.game.config.width * 2, 100, 0x008000);
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

    // Listen for other players
    onValue(ref(db, 'players'), (snapshot) => {
        const playersData = snapshot.val();
        if (playersData) {
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
        }
    });

    // Clean up when a player leaves
    onValue(ref(db, 'players'), (snapshot) => {
        const playersData = snapshot.val();
        Object.keys(players).forEach(playerId => {
            if (!playersData || !playersData[playerId]) {
                if (players[playerId]) {
                    players[playerId].destroy();
                    players[playerId].label.destroy();
                    delete players[playerId];
                }
            }
        });
    });

    // Clean up on window close or refresh
    window.addEventListener('beforeunload', () => {
        remove(ref(db, 'players/' + myPlayerId));
    });
}

function update() {
    let velocityX = 0;
    
    // Desktop Input
    if (cursors.left.isDown) {
        velocityX = -playerSpeed;
    } else if (cursors.right.isDown) {
        velocityX = playerSpeed;
    }
    
    // Mobile Input
    if (joystickData.x > 0) {
        velocityX = playerSpeed * joystickData.x;
    } else if (joystickData.x < 0) {
        velocityX = playerSpeed * joystickData.x;
    }
    
    // Jump Input
    if (Phaser.Input.Keyboard.JustDown(cursors.up) && player.body.blocked.down) {
        player.body.setVelocityY(-jumpVelocity);
    }
    
    player.body.setVelocityX(velocityX);
    
    // Update player label position
    player.label.x = player.x;
    player.label.y = player.y - 40;

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

function setupMobileUI(scene) {
    const joystickContainer = document.getElementById('joystick-container');
    const jumpButton = document.getElementById('jump-button');
    document.getElementById('mobile-ui').style.pointerEvents = 'auto';

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
        joystickData.x = data.vector.x;
        joystickData.y = data.vector.y;
    });
    joystick.on('end', () => {
        joystickData.x = 0;
        joystickData.y = 0;
    });
    
    // Jump button setup
    jumpButton.addEventListener('pointerdown', () => {
        if (player.body.blocked.down) {
            player.body.setVelocityY(-jumpVelocity);
        }
    });
}
