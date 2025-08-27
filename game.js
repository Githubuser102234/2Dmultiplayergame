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
    // Start the game logic after the user enters their nickname
    // A Phaser.Game instance will be created after the nickname is submitted.
};

function preload() {
    // This is where you would load sprites, etc.
}

function create() {
    // Get UI elements
    const nicknameModal = document.getElementById('nickname-modal');
    const nicknameInput = document.getElementById('nickname-input');
    const startGameButton = document.getElementById('start-game-button');
    const loadingSpinner = document.getElementById('loading-spinner');

    // Show the modal and hide the spinner initially
    nicknameModal.style.display = 'flex';
    loadingSpinner.style.display = 'none';
    
    // Listen for the "Start Game" button click
    startGameButton.addEventListener('click', () => {
        let myPlayerName = nicknameInput.value.trim();
        if (myPlayerName.length > 0) {
            nicknameModal.style.display = 'none'; // Hide the modal
            loadingSpinner.style.display = 'block'; // Show a loading spinner
            this.sys.game.canvas.style.display = 'block'; // Show the canvas once the game starts
            
            // Start the game with the entered nickname
            startGame.call(this, myPlayerName);
        } else {
            // Provide a default name if the input is empty
            myPlayerName = "Player";
            nicknameModal.style.display = 'none';
            loadingSpinner.style.display = 'block';
            this.sys.game.canvas.style.display = 'block';
            startGame.call(this, myPlayerName);
        }
    });

    // Handle enter key on the input field
    nicknameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            startGameButton.click();
        }
    });
    
    // Initially hide the canvas until the game starts
    this.sys.game.canvas.style.display = 'none';

    // Set up the scene background and physics
    this.cameras.main.setBackgroundColor('#87ceeb');
    const ground = this.add.rectangle(0, this.game.config.height - 50, this.game.config.width * 2, 100, 0x008000);
    this.physics.add.existing(ground, true);

    // Initial setup for the game state
    // These listeners will start working once a player is created in startGame()
    onValue(ref(db, 'players'), (snapshot) => {
        const playersData = snapshot.val();
        if (playersData) {
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
        }
    });

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

    window.addEventListener('beforeunload', () => {
        if (myPlayerId) {
            remove(ref(db, 'players/' + myPlayerId));
        }
    });
}

// Function to start the game after the nickname is submitted
function startGame(myPlayerName) {
    const scene = this;

    // Get a unique player ID
    myPlayerId = push(ref(db, 'players')).key;
    
    // Choose a random color for the player
    const myPlayerColor = Math.random() * 0xffffff;
    
    // Create the local player's block
    const myPlayerBlock = scene.add.rectangle(Phaser.Math.Between(100, scene.game.config.width - 100), 50, 40, 60, myPlayerColor);
    scene.physics.add.existing(myPlayerBlock);
    myPlayerBlock.body.collideWorldBounds = true;
    myPlayerBlock.body.gravity.y = 800;
    player = myPlayerBlock;

    // Create the player's name label
    const myPlayerLabel = scene.add.text(0, 0, myPlayerName, { fontSize: '16px', fill: '#ffffff', backgroundColor: '#00000088' }).setOrigin(0.5);
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
    cursors = scene.input.keyboard.createCursorKeys();

    // Mobile UI Setup
    if (scene.sys.game.device.os.android || scene.sys.game.device.os.iOS) {
        setupMobileUI(scene);
    }
}

function update() {
    // Only run update loop if the player object exists
    if (!player) {
        return;
    }

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
        if (player && player.body && player.body.blocked.down) {
            player.body.setVelocityY(-jumpVelocity);
        }
    });
}

