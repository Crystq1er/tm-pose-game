/**
 * main.js
 * Fruit Catcher: Survival Controller
 */

let poseEngine, gameEngine;
let isInitialized = false;

// DOM Elements
const dom = {
  webcamContainer: document.getElementById('webcam-container'),
  gameCanvas: document.getElementById('game-canvas'),
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  statusLabel: document.getElementById('status-label'),
  startBtn: document.getElementById('start-btn'),
  backBtn: document.getElementById('back-btn'),
  loading: document.getElementById('loading'),
  poseIndicators: {
    Left: document.querySelector('.pose-tag.left'),
    Center: document.querySelector('.pose-tag.center'),
    Right: document.querySelector('.pose-tag.right')
  }
};

/**
 * 초기화 Function
 */
async function init() {
  try {
    // 1. GameEngine 초기화
    gameEngine = new GameEngine();
    gameEngine.init(dom.gameCanvas);

    // 점수 업데이트
    gameEngine.setScoreChangeCallback((score, level) => {
      dom.score.innerText = score.toLocaleString(); // 쉼표 추가
    });

    // 생명/쉴드 업데이트
    gameEngine.setLivesChangeCallback((lives, hasShield) => {
      let hearts = "";
      for (let i = 0; i < lives; i++) hearts += "❤️";

      if (hasShield) {
        hearts += " 🛡️";
      }

      // 생명이 0이면 해골 표시 (잠시)
      if (lives <= 0) hearts = "💀 GAME OVER";

      dom.lives.innerText = hearts || "💔";
    });

    // 게임 종료 처리
    gameEngine.setGameEndCallback((finalScore, finalLevel) => {
      alert(`☠️ 게임 오버! ☠️\n\n최종 점수: ${finalScore}\n도달 레벨: ${finalLevel}`);
      resetUI();
    });

    // 2. PoseEngine 초기화
    poseEngine = new PoseEngine("./my_model/");
    await poseEngine.init({ size: 200, flip: true });

    // 웹캠 캔버스 (오버레이용)
    if (poseEngine.webcam.canvas) {
      dom.webcamContainer.appendChild(poseEngine.webcam.canvas);
    }

    // 예측 결과 처리
    poseEngine.setPredictionCallback((prediction, pose) => {
      if (!isInitialized) return;

      // 가장 높은 확률의 클래스 찾기
      let maxClass = "";
      let maxProb = 0;

      prediction.forEach(p => {
        if (p.probability > maxProb) {
          maxProb = p.probability;
          maxClass = p.className;
        }
      });

      if (maxProb > 0.8) { // 80% 이상 확신
        updatePoseUI(maxClass);
        if (gameEngine.isGameActive) {
          gameEngine.onPoseDetected(maxClass);
        }
      }
    });

    poseEngine.start();
    isInitialized = true;

    // 로딩 완료
    dom.loading.classList.remove('active');
    dom.statusLabel.innerText = "준비 완료! Start 버튼을 누르세요.";
    dom.startBtn.disabled = false;

  } catch (err) {
    console.error(err);
    alert("초기화 실패: 카메라를 확인할 수 없습니다.");
    dom.loading.innerText = "오류: " + err.message;
  }
}

/**
 * 포즈 UI 업데이트
 */
function updatePoseUI(currentClass) {
  Object.values(dom.poseIndicators).forEach(el => el && el.classList.remove('active'));

  if (dom.poseIndicators[currentClass]) {
    dom.poseIndicators[currentClass].classList.add('active');
    dom.statusLabel.innerText = `현재 자세: ${currentClass}`;
  }
}

/**
 * UI 초기화 (메뉴로 복귀)
 */
function resetUI() {
  gameEngine.stop();
  dom.startBtn.style.display = 'inline-block';
  dom.backBtn.style.display = 'none';
  dom.statusLabel.innerText = "준비 완료!";
  dom.lives.innerText = "❤️❤️❤️";
  dom.score.innerText = "0";
}

// 이벤트 리스너
dom.startBtn.addEventListener('click', () => {
  gameEngine.start();
  dom.startBtn.style.display = 'none';
  dom.backBtn.style.display = 'inline-block';
  dom.statusLabel.innerText = "생존하세요! 폭탄 조심!";
});

dom.backBtn.addEventListener('click', () => {
  if (confirm("게임을 중단하고 메뉴로 돌아가시겠습니까?")) {
    resetUI();
  }
});

// 실행
window.addEventListener('load', init);
