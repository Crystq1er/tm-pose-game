/**
 * main.js
 * Fruit Catcher: Integrated Controller
 */

let poseEngine, gameEngine;
let isInitialized = false;

// DOM Elements Manager
const dom = {
  // Screens
  menuScreen: document.getElementById('menu-screen'),
  gameScreen: document.getElementById('game-screen'),

  // Overlays
  loading: document.getElementById('loading'),
  gameOver: document.getElementById('game-over'),

  // Game Areas
  webcamContainer: document.getElementById('webcam-container'),
  gameCanvas: document.getElementById('game-canvas'),

  // UI Info
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  poseLabel: document.getElementById('pose-label'),
  finalScore: document.getElementById('final-score'),

  // Buttons
  mainStartBtn: document.getElementById('main-start-btn'),
  backToMenuBtn: document.getElementById('back-to-menu-btn'),
  restartBtn: document.getElementById('restart-btn'),
  goMenuBtn: document.getElementById('go-menu-btn'),

  // Indicators
  indicators: {
    Left: document.querySelector('.tag.left'),
    Center: document.querySelector('.tag.center'),
    Right: document.querySelector('.tag.right')
  }
};

/**
 * App Initialization
 */
async function init() {
  try {
    // 1. Setup Engines
    gameEngine = new GameEngine();
    gameEngine.init(dom.gameCanvas);

    // Wire up Game Engine Callbacks
    gameEngine.setScoreChangeCallback((score, level) => {
      dom.score.innerText = score.toLocaleString();
    });

    gameEngine.setLivesChangeCallback((lives, hasShield) => {
      let display = "❤️".repeat(Math.max(0, lives));
      if (lives <= 0) display = "💀";
      if (hasShield) display += " 🛡️";
      dom.lives.innerText = display;
    });

    gameEngine.setGameEndCallback((score) => {
      showGameOver(score);
    });

    // 2. Setup Pose Engine
    poseEngine = new PoseEngine("./my_model/");
    await poseEngine.init({ size: 200, flip: true });

    if (poseEngine.webcam.canvas) {
      // Adjust style for container fitting
      poseEngine.webcam.canvas.style.width = "100%";
      poseEngine.webcam.canvas.style.height = "100%";
      dom.webcamContainer.appendChild(poseEngine.webcam.canvas);
    }

    poseEngine.setPredictionCallback((prediction) => {
      if (!isInitialized) return;

      // Find Max Prob
      let maxClass = "";
      let maxProb = 0;
      prediction.forEach(p => {
        if (p.probability > maxProb) {
          maxProb = p.probability;
          maxClass = p.className;
        }
      });

      if (maxProb > 0.8) {
        updatePoseUI(maxClass);
        if (gameEngine.isGameActive) {
          gameEngine.onPoseDetected(maxClass);
        }
      }
    });

    // Start Pose Loop
    poseEngine.start();
    isInitialized = true;

    // Ready
    dom.loading.classList.remove('active');

  } catch (e) {
    console.error(e);
    alert("오류 발생: 카메라를 확인해주세요.\n" + e.message);
  }
}

/**
 * Screen Navigation Logic
 */
function showScreen(screenName) {
  // Hide all screens
  dom.menuScreen.classList.remove('active');
  dom.gameScreen.classList.remove('active');

  // Hide all overlays
  dom.gameOver.classList.remove('active');

  // Show target
  if (screenName === 'menu') {
    dom.menuScreen.classList.add('active');
    gameEngine.stop(); // Stop game if running
  } else if (screenName === 'game') {
    dom.gameScreen.classList.add('active');
    // We will start game explicitly via button click logic, 
    // but here we just show the screen.
    // Resize canvas just in case
    gameEngine.resizeCanvas();
  }
}

function updatePoseUI(poseName) {
  // Update Text
  dom.poseLabel.innerText = poseName;

  // Update Tags
  Object.values(dom.indicators).forEach(el => el.classList.remove('active'));
  if (dom.indicators[poseName]) {
    dom.indicators[poseName].classList.add('active');
  }
}

function showGameOver(score) {
  dom.finalScore.innerText = score.toLocaleString();
  dom.gameOver.classList.add('active');
}

/* Event Listeners */

// 1. Menu -> Game Start
dom.mainStartBtn.addEventListener('click', () => {
  showScreen('game');
  gameEngine.start();
});

// 2. Game View -> Back to Menu
dom.backToMenuBtn.addEventListener('click', () => {
  if (confirm("게임을 중단하고 메뉴로 돌아갈까요?")) {
    showScreen('menu');
  }
});

// 3. Game Over -> Restart
dom.restartBtn.addEventListener('click', () => {
  dom.gameOver.classList.remove('active');
  gameEngine.start(); // Restart game directly
});

// 4. Game Over -> Go Menu
dom.goMenuBtn.addEventListener('click', () => {
  showScreen('menu');
});

// Boot
window.addEventListener('load', init);
