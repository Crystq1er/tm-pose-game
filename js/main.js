/**
 * main.js
 * 애플리케이션 진입점 및 로직 연결
 */

let poseEngine, gameEngine;
let inputMode = null; // 'pose' or 'keyboard'

// DOM Elements
const dom = {
  startScreen: document.getElementById('start-screen'),
  gameArea: document.getElementById('game-area-container'),
  btnPose: document.getElementById('btn-pose'),
  btnKeyboard: document.getElementById('btn-keyboard'),

  webcamContainer: document.getElementById('webcam-container'),
  gameCanvas: document.getElementById('game-canvas'),
  score: document.getElementById('score'),
  highScore: document.getElementById('high-score'),
  level: document.getElementById('level'),
  time: document.getElementById('time'),
  statusLabel: document.getElementById('status-label'),
  startBtn: document.getElementById('start-btn'),
  stopBtn: document.getElementById('stop-btn'),
  loading: document.getElementById('loading'),
  poseIndicators: {
    Left: document.querySelector('.pose-tag.left'),
    Center: document.querySelector('.pose-tag.center'),
    Right: document.querySelector('.pose-tag.right')
  }
};

/**
 * 페이지 로드 시 실행 (메뉴 초기화)
 */
function initPage() {
  // 0. High Score 로드
  const storedHighScore = localStorage.getItem('fruitCatcherHighScore') || 0;
  if (dom.highScore) dom.highScore.innerText = storedHighScore;

  // 메뉴 버튼 리스너
  if (dom.btnPose) dom.btnPose.addEventListener('click', () => startGame('pose'));
  if (dom.btnKeyboard) dom.btnKeyboard.addEventListener('click', () => startGame('keyboard'));

  // 게임 내 버튼 리스너
  dom.startBtn.addEventListener('click', () => {
    gameEngine.start();
    dom.startBtn.style.display = 'none';
    dom.stopBtn.style.display = 'inline-block';
    dom.statusLabel.innerText = "게임 중! 과일을 받으세요!";
  });

  dom.stopBtn.addEventListener('click', () => {
    gameEngine.stop();
    dom.startBtn.style.display = 'inline-block';
    dom.stopBtn.style.display = 'none';
    dom.statusLabel.innerText = "게임 중지됨";
  });
}

/**
 * 게임 시작 (모드 선택 후)
 */
async function startGame(mode) {
  inputMode = mode;
  if (dom.startScreen) dom.startScreen.style.display = 'none'; // 메뉴 숨김
  if (dom.gameArea) dom.gameArea.style.display = 'block';   // 게임 영역 표시

  try {
    // 1. GameEngine 초기화 (공통)
    gameEngine = new GameEngine();
    gameEngine.init(dom.gameCanvas);

    // 콜백 연결
    setupGameCallbacks();

    // 2. 모드별 초기화
    if (inputMode === 'pose') {
      dom.loading.classList.add('active'); // 로딩 표시
      await initPoseEngine(); // 카메라/모델 로드
      dom.loading.classList.remove('active');
    } else if (inputMode === 'keyboard') {
      initKeyboardInput();
      dom.webcamContainer.style.display = 'none'; // 웹캠 영역 숨김
      dom.statusLabel.innerText = "키보드 모드: ← 왼쪽, → 오른쪽";
    }

    // 준비 완료
    dom.startBtn.disabled = false;

  } catch (err) {
    console.error(err);
    alert("게임 초기화 중 오류가 발생했습니다.");
    location.reload(); // 에러 시 새로고침 권장
  }
}

function setupGameCallbacks() {
  gameEngine.setScoreChangeCallback((score, level) => {
    dom.score.innerText = score;
    dom.level.innerText = level;
  });

  gameEngine.setTimeUpdateCallback((time) => {
    dom.time.innerText = time;
  });

  gameEngine.setGameEndCallback((finalScore, finalLevel) => {
    // High Score 갱신
    let currentHighScore = parseInt(localStorage.getItem('fruitCatcherHighScore') || 0);
    if (finalScore > currentHighScore) {
      localStorage.setItem('fruitCatcherHighScore', finalScore);
      if (dom.highScore) dom.highScore.innerText = finalScore;
      alert(`🎉 신기록 달성!\n최종 점수: ${finalScore}\n최종 레벨: ${finalLevel}`);
    } else {
      alert(`🎉 게임 종료!\n최종 점수: ${finalScore}\n최종 레벨: ${finalLevel}`);
    }

    dom.startBtn.style.display = 'inline-block';
    dom.stopBtn.style.display = 'none';
    dom.statusLabel.innerText = "게임 종료 (다시 하려면 Start 버튼)";
  });
}

/**
 * PoseEngine 초기화
 */
async function initPoseEngine() {
  poseEngine = new PoseEngine("./my_model/");
  await poseEngine.init({ size: 200, flip: true });

  if (poseEngine.webcam.canvas) {
    dom.webcamContainer.appendChild(poseEngine.webcam.canvas);
  }

  poseEngine.setPredictionCallback((prediction, pose) => {
    // 가장 높은 확률 찾기
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
      if (gameEngine && gameEngine.isGameActive) {
        gameEngine.onPoseDetected(maxClass);
      }
    }
  });

  poseEngine.start();
}

/**
 * 키보드 입력 설정
 */
function initKeyboardInput() {
  window.addEventListener('keydown', (e) => {
    if (!gameEngine || !gameEngine.isGameActive) return;

    if (e.key === "ArrowLeft") {
      updatePoseUI("Left");
      gameEngine.onPoseDetected("Left");
    } else if (e.key === "ArrowRight") {
      updatePoseUI("Right");
      gameEngine.onPoseDetected("Right");
    } else if (e.key === "ArrowDown" || e.key === " ") {
      updatePoseUI("Center");
      gameEngine.onPoseDetected("Center");
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!gameEngine || !gameEngine.isGameActive) return;

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      updatePoseUI("Center");
      gameEngine.onPoseDetected("Center");
    }
  });
}

function updatePoseUI(currentClass) {
  // UI 업데이트
  Object.values(dom.poseIndicators).forEach(el => el && el.classList.remove('active'));
  if (dom.poseIndicators[currentClass]) {
    dom.poseIndicators[currentClass].classList.add('active');
  }
}

// 실행
window.addEventListener('load', initPage);
