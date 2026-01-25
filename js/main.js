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
  missCount: document.getElementById('miss-count'),
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
  },

  // Toggles
  toggles: document.querySelectorAll('.toggle-btn')
};

// Stage Elements
dom.stageScreen = document.getElementById('stage-screen');
dom.stageGrid = document.getElementById('stage-grid');
dom.backToModeBtn = document.getElementById('back-to-mode-btn');


let controlMode = 'camera'; // 'camera' or 'keyboard'
let currentStage = 1;
let maxUnlockedStage = 1;

// Input State
const activeKeys = new Set();

/**
 * App Initialization
 */
async function init() {
  try {
    // 0. Toggle Setup
    dom.toggles.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.toggles.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        controlMode = btn.dataset.mode;

        // Update Guide
        const guideText = document.querySelector('.guide-text');
        if (controlMode === 'camera') {
          guideText.innerHTML = "📷 <b>카메라 모드</b><br>카메라 앞에서 몸을 왼쪽/오른쪽으로 기울여 바구니를 움직이세요!";
        } else {
          guideText.innerHTML = "⌨️ <b>키보드 모드</b><br><b>←(왼쪽)</b>, <b>→(오른쪽)</b> 화살표 키를 사용하여 바구니를 움직이세요! (속도 빠름)";
        }
      });
    });

    // 1. Setup Engines
    gameEngine = new GameEngine();
    gameEngine.init(dom.gameCanvas);
    gameEngine.setKeysObject(activeKeys);

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

    gameEngine.setStageClearCallback((stage) => {
      alert(`🎉 Stage ${stage} Cleared! 🎉`);
      if (stage >= maxUnlockedStage) {
        maxUnlockedStage = Math.min(25, stage + 1);
      }
      showScreen('stage'); // Back to stage select
    });

    gameEngine.setMissChangeCallback((count) => {
      dom.missCount.innerText = `${count} / 2`;
      dom.missCount.style.color = count > 0 ? 'red' : '#1976d2';
    });

    // 2. Setup Pose Engine
    poseEngine = new PoseEngine("./my-pose-model (1)/");
    await poseEngine.init({ size: 200, flip: true });

    if (poseEngine.webcam.canvas) {
      // Adjust style for container fitting
      poseEngine.webcam.canvas.style.width = "100%";
      poseEngine.webcam.canvas.style.height = "100%";
      dom.webcamContainer.appendChild(poseEngine.webcam.canvas);
    }

    poseEngine.setPredictionCallback((prediction) => {
      if (!isInitialized) return;
      if (controlMode !== 'camera') return; // Ignore camera if in keyboard mode

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
        // Label Mapping for generic names
        // Assumption: Class 1 -> Left, Class 2 -> Center, Class 3 -> Right
        let mappedPose = maxClass;
        if (maxClass === "Class 1") mappedPose = "Center";
        if (maxClass === "Class 2") mappedPose = "Right";
        if (maxClass === "Class 3") mappedPose = "Left";

        updatePoseUI(mappedPose);
        if (gameEngine.isGameActive) {
          gameEngine.onPoseDetected(mappedPose);
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
  dom.stageScreen.classList.remove('active');

  // Hide all overlays
  dom.gameOver.classList.remove('active');

  // Show target
  if (screenName === 'menu') {
    dom.menuScreen.classList.add('active');
    gameEngine.stop(false); // Stop game WITHOUT triggering Game Over event
  } else if (screenName === 'game') {
    dom.gameScreen.classList.add('active');
    // We will start game explicitly via button click logic, 
    // but here we just show the screen.
    // Resize canvas just in case
    gameEngine.resizeCanvas();
  } else if (screenName === 'stage') {
    dom.stageScreen.classList.add('active');
    renderStageButtons();
  }
}

function renderStageButtons() {
  dom.stageGrid.innerHTML = "";
  for (let i = 1; i <= 25; i++) {
    const btn = document.createElement('button');
    btn.className = `stage-btn ${i <= maxUnlockedStage ? 'unlocked' : 'locked'}`;
    btn.innerText = `Stage ${i}`;

    if (i <= maxUnlockedStage) {
      btn.addEventListener('click', () => {
        currentStage = i;
        startGameWithStage(i);
      });
    }

    dom.stageGrid.appendChild(btn);
  }
}

function startGameWithStage(stage) {
  showScreen('game');

  // Hide/Show Webcam based on mode
  if (controlMode === 'keyboard') {
    dom.webcamContainer.style.opacity = '0.1';
  } else {
    dom.webcamContainer.style.opacity = '1';
  }

  gameEngine.start(stage, controlMode);
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

// Keyboard Controls
let currentZoneIndex = 1; // 0:Left, 1:Center, 2:Right
const zones = ["Left", "Center", "Right"];


window.addEventListener('keydown', (e) => {
  activeKeys.add(e.key.toUpperCase()); // Track Key Press

  if (!gameEngine.isGameActive) return;

  switch (e.key) {
    case "ArrowLeft":
      if (currentZoneIndex > 0) {
        currentZoneIndex--;
        updateZone();
      }
      break;
    case "ArrowRight":
      if (currentZoneIndex < 2) {
        currentZoneIndex++;
        updateZone();
      }
      break;
  }
});

function updateZone() {
  const poseName = zones[currentZoneIndex];
  updatePoseUI(poseName);
  gameEngine.onPoseDetected(poseName);
}

// 1. Menu -> Stage Select
dom.mainStartBtn.addEventListener('click', () => {
  showScreen('stage');
});

dom.backToModeBtn.addEventListener('click', () => {
  showScreen('menu');
});

// Update Pose Callback to respect Control Mode
// (Already inside init, but let's verify logic)
// We need to modify the poseEngine callback in init() to check controlMode


// 2. Game View -> Back to Menu
dom.backToMenuBtn.addEventListener('click', () => {
  if (confirm("게임을 중단하고 메뉴로 돌아갈까요?")) {
    showScreen('menu');
  }
});

// 3. Game Over -> Restart
dom.restartBtn.addEventListener('click', () => {
  dom.gameOver.classList.remove('active');
  dom.gameOver.classList.remove('active');
  // Restart current stage
  startGameWithStage(currentStage);
});

// 4. Game Over -> Go Menu
dom.goMenuBtn.addEventListener('click', () => {
  showScreen('menu');
});

// Boot
window.addEventListener('load', init);
